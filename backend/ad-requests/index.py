import base64
import json
import os
import uuid

import boto3
import psycopg2
from botocore.config import Config as BotoConfig

from telegram_client import call as call_telegram


PHOTO_TYPES = {
    'image/jpeg': 'jpg',
    'image/jpg': 'jpg',
    'image/png': 'png',
    'image/webp': 'webp',
}
MAX_PHOTO_BYTES = 5 * 1024 * 1024

PLAN_LABELS = {
    'hour': ('Час', 300, 1),
    'day': ('Сутки', 2000, 1),
    'week': ('Неделя', 5000, 7),
    'month': ('Месяц', 10000, 30),
}

CORS_HEADERS = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, X-User-Id, X-Auth-Token, X-Session-Id',
    'Access-Control-Max-Age': '86400',
    'Content-Type': 'application/json',
}


def upload_photo(photo: dict) -> str:
    """Кладёт фото объявления в S3 и возвращает публичную ссылку"""
    mime = (photo.get('type') or '').lower()
    ext = PHOTO_TYPES.get(mime)
    if not ext:
        raise ValueError('Поддерживаются только JPG, PNG и WEBP')

    raw = photo.get('data') or ''
    if ',' in raw:
        raw = raw.split(',', 1)[1]

    data = base64.b64decode(raw)
    if len(data) > MAX_PHOTO_BYTES:
        raise ValueError('Фото больше 5 МБ')

    key = f'ads/{uuid.uuid4().hex}.{ext}'
    access_key = os.environ['AWS_ACCESS_KEY_ID']
    s3 = boto3.client(
        's3',
        endpoint_url='https://bucket.poehali.dev',
        aws_access_key_id=access_key,
        aws_secret_access_key=os.environ['AWS_SECRET_ACCESS_KEY'],
        config=BotoConfig(connect_timeout=3, read_timeout=6, retries={'max_attempts': 1}),
    )
    s3.put_object(Bucket='files', Key=key, Body=data, ContentType=mime)
    return f'https://cdn.poehali.dev/projects/{access_key}/bucket/{key}'


def notify_telegram(city, contact, ad_text, window='', public_token='', photo_url=None,
                    client_notified=False, plan=''):
    """Уведомляет администратора о новой заявке"""
    token = os.environ.get('TELEGRAM_BOT_TOKEN')
    chat_id = os.environ.get('TELEGRAM_ADMIN_CHAT_ID')
    if not token or not chat_id:
        return

    site = os.environ.get('SITE_URL', '').rstrip('/')
    link = f"\nСтатус: {site}/status/{public_token}" if site and public_token else ''
    reach_note = '' if client_notified else '\n⚠️ Клиенту ссылку в личку отправить не удалось (не запускал бота)'
    plan_info = PLAN_LABELS.get(plan)
    plan_note = f"\nТариф: {plan_info[0]} — {plan_info[1]} ₽" if plan_info else ''
    text = (
        f"Новая заявка\n\nГород: {city}\nTelegram: {contact}{plan_note}\n"
        f"Время показа: {window}{link}{reach_note}\n\n{ad_text}"
    )

    sent_ok = False
    if photo_url:
        try:
            fits = len(text) <= 1024
            data = call_telegram(token, 'sendPhoto', {
                'chat_id': chat_id,
                'photo': photo_url,
                'caption': text if fits else '',
            }, budget=4.0)
            sent_ok = bool(data.get('ok'))
            if sent_ok and not fits:
                call_telegram(token, 'sendMessage', {'chat_id': chat_id, 'text': text}, budget=3.0)
        except Exception:
            sent_ok = False

    if not sent_ok:
        try:
            note = text if not photo_url else f"{text}\n\nФото: {photo_url}"
            call_telegram(token, 'sendMessage', {'chat_id': chat_id, 'text': note}, budget=3.0)
        except Exception:
            pass


def find_chat_id(schema: str, contact: str) -> str:
    """Ищет chat_id клиента по username, сохранённый при нажатии /start у бота"""
    raw = (contact or '').strip().lstrip('@').lower()
    if not raw:
        return ''
    if raw.lstrip('-').isdigit():
        return raw

    safe_username = raw.replace("'", "''")
    compact = safe_username.replace('_', '').replace('.', '').replace('-', '')
    conn = psycopg2.connect(os.environ['DATABASE_URL'])
    conn.autocommit = True
    cur = conn.cursor()
    cur.execute(
        f"SELECT chat_id FROM {schema}.telegram_users "
        f"WHERE username = '{safe_username}' OR "
        f"replace(replace(replace(username, '_', ''), '.', ''), '-', '') = '{compact}' "
        f"ORDER BY (username = '{safe_username}') DESC LIMIT 1"
    )
    row = cur.fetchone()
    cur.close()
    conn.close()
    return row[0] if row else ''


def notify_client_direct(client_chat: str, city: str, window: str, public_token: str) -> bool:
    """Шлёт клиенту в личку ссылку на статус его объявления"""
    token = os.environ.get('TELEGRAM_BOT_TOKEN')
    site = os.environ.get('SITE_URL', '').rstrip('/')
    if not token or not site or not client_chat:
        return False

    text = (
        f"Заявка принята в работу\n\n"
        f"Город: {city}\n"
        f"Время показа: {window}\n\n"
        f"В личном кабинете можно изменить текст и фото, поставить показы на паузу "
        f"и посмотреть статистику. Открыть его снова — команда /cabinet"
    )
    keyboard = json.dumps({'inline_keyboard': [[{
        'text': 'Открыть личный кабинет',
        'url': f'{site}/status/{public_token}',
    }]]})
    data = call_telegram(token, 'sendMessage', {
        'chat_id': client_chat,
        'text': text,
        'reply_markup': keyboard,
    }, budget=4.0)
    return bool(data.get('ok'))


def handler(event: dict, context) -> dict:
    """Принимает заявки на публикацию объявления, сохраняет их в базу и отправляет уведомления в Telegram"""
    method = event.get('httpMethod', 'GET')

    if method == 'OPTIONS':
        return {'statusCode': 200, 'headers': CORS_HEADERS, 'body': ''}

    if method != 'POST':
        return {
            'statusCode': 405,
            'headers': CORS_HEADERS,
            'body': json.dumps({'error': 'Method not allowed'}),
            'isBase64Encoded': False,
        }

    body = json.loads(event.get('body') or '{}')
    city = (body.get('city') or '').strip()
    contact = (body.get('contact') or '').strip()
    ad_text = (body.get('text') or '').strip()

    if not city or not contact or not ad_text:
        return {
            'statusCode': 400,
            'headers': CORS_HEADERS,
            'body': json.dumps({'error': 'Заполните город, контакт и текст объявления'}, ensure_ascii=False),
            'isBase64Encoded': False,
        }

    start_hour = body.get('start_hour', 9)
    end_hour = body.get('end_hour', 21)
    if not isinstance(start_hour, int) or not 0 <= start_hour <= 23:
        start_hour = 9
    if not isinstance(end_hour, int) or not 0 <= end_hour <= 23:
        end_hour = 21

    photo_url = None
    photo_warning = None
    photo = body.get('photo')
    if isinstance(photo, dict) and photo.get('data'):
        try:
            photo_url = upload_photo(photo)
        except ValueError as exc:
            return {
                'statusCode': 400,
                'headers': CORS_HEADERS,
                'body': json.dumps({'error': str(exc)}, ensure_ascii=False),
                'isBase64Encoded': False,
            }
        except Exception:
            photo_warning = 'Фото не удалось загрузить, заявка сохранена без него'

    schema = os.environ.get('MAIN_DB_SCHEMA', 'public')
    conn = psycopg2.connect(os.environ['DATABASE_URL'])
    conn.autocommit = True
    cur = conn.cursor()

    safe_city = city.replace("'", "''")[:120]
    safe_contact = contact.replace("'", "''")[:200]
    safe_text = ad_text.replace("'", "''")[:4000]

    token = uuid.uuid4().hex
    photo_sql = f"'{photo_url}'" if photo_url else 'NULL'

    plan = (body.get('plan') or '').strip().lower()
    if plan not in PLAN_LABELS:
        plan = 'week'

    cur.execute(
        f"INSERT INTO {schema}.ad_requests "
        f"(city, contact, ad_text, pref_start_hour, pref_end_hour, public_token, photo_url, plan) "
        f"VALUES ('{safe_city}', '{safe_contact}', '{safe_text}', {start_hour}, {end_hour}, "
        f"'{token}', {photo_sql}, '{plan}') RETURNING id"
    )
    request_id = cur.fetchone()[0]

    window_str = f'{start_hour:02d}:00 — {end_hour:02d}:00'
    chat_found = find_chat_id(schema, contact)

    client_notified = False
    if chat_found:
        try:
            client_notified = notify_client_direct(chat_found, city, window_str, token)
        except Exception:
            client_notified = False

    if client_notified:
        safe_chat = chat_found.replace("'", "''")
        cur.execute(
            f"UPDATE {schema}.ad_requests SET client_notified = true, "
            f"client_chat_id = '{safe_chat}' WHERE id = {request_id}"
        )

    cur.close()
    conn.close()

    try:
        notify_telegram(city, contact, ad_text, window_str, token, photo_url,
                        client_notified, plan)
    except Exception:
        pass

    result = {'ok': True, 'id': request_id, 'token': token, 'client_notified': client_notified}
    if photo_warning:
        result['warning'] = photo_warning

    return {
        'statusCode': 200,
        'headers': CORS_HEADERS,
        'body': json.dumps(result, ensure_ascii=False),
        'isBase64Encoded': False,
    }