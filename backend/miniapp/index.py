import base64
import hashlib
import hmac
import json
import os
import urllib.parse
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
    'Access-Control-Allow-Headers': 'Content-Type, X-Init-Data',
    'Access-Control-Max-Age': '86400',
    'Content-Type': 'application/json',
}


def json_response(status: int, payload: dict) -> dict:
    return {
        'statusCode': status,
        'headers': CORS_HEADERS,
        'body': json.dumps(payload, ensure_ascii=False, default=str),
        'isBase64Encoded': False,
    }


def check_init_data(init_data: str, bot_token: str) -> dict:
    """Проверяет подпись Telegram и возвращает данные пользователя"""
    if not init_data:
        return {}

    pairs = urllib.parse.parse_qsl(init_data, keep_blank_values=True)
    data = dict(pairs)
    received_hash = data.pop('hash', '')
    if not received_hash:
        return {}

    check_string = '\n'.join(f'{k}={v}' for k, v in sorted(data.items()))
    secret = hmac.new(b'WebAppData', bot_token.encode(), hashlib.sha256).digest()
    calculated = hmac.new(secret, check_string.encode(), hashlib.sha256).hexdigest()

    if not hmac.compare_digest(calculated, received_hash):
        return {}

    try:
        return json.loads(data.get('user') or '{}')
    except Exception:
        return {}


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


def notify_admin_new(city, contact, ad_text, window, public_token, photo_url, plan):
    """Уведомляет администратора о новой заявке из мини-приложения"""
    token = os.environ.get('TELEGRAM_BOT_TOKEN')
    chat_id = os.environ.get('TELEGRAM_ADMIN_CHAT_ID')
    if not token or not chat_id:
        return

    site = os.environ.get('SITE_URL', '').rstrip('/')
    link = f"\nСтатус: {site}/status/{public_token}" if site and public_token else ''
    plan_info = PLAN_LABELS.get(plan)
    plan_note = f"\nТариф: {plan_info[0]} — {plan_info[1]} ₽" if plan_info else ''
    text = (
        f"Новая заявка из мини-приложения\n\nГород: {city}\nTelegram: {contact}{plan_note}\n"
        f"Время показа: {window}{link}\n\n{ad_text}"
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


def create_ad(cur, schema: str, chat_id: str, user: dict, body: dict) -> dict:
    """Создаёт объявление для клиента, открывшего мини-приложение"""
    city = (body.get('city') or '').strip()
    ad_text = (body.get('text') or '').strip()
    if not city or not ad_text:
        return json_response(400, {'error': 'Заполните город и текст объявления'})

    cur.execute(
        f"SELECT COUNT(*) FROM {schema}.ad_requests r "
        f"WHERE r.client_chat_id = '{chat_id}' AND r.status <> 'rejected' "
        f"AND (NOT EXISTS (SELECT 1 FROM {schema}.campaigns c WHERE c.request_id = r.id) "
        f"  OR EXISTS (SELECT 1 FROM {schema}.campaigns c WHERE c.request_id = r.id "
        f"             AND c.state = 'running'))"
    )
    if int(cur.fetchone()[0] or 0) >= 1:
        return json_response(400, {
            'error': 'У вас уже есть объявление. Один абонент может размещать только одно '
                     'объявление — измените текущее или дождитесь окончания показов.',
            'limit_reached': True,
        })

    start_hour = body.get('start_hour', 9)
    end_hour = body.get('end_hour', 21)
    if not isinstance(start_hour, int) or not 0 <= start_hour <= 23:
        start_hour = 9
    if not isinstance(end_hour, int) or not 0 <= end_hour <= 23:
        end_hour = 21

    plan = (body.get('plan') or '').strip().lower()
    if plan not in PLAN_LABELS:
        plan = 'week'

    photo_url = None
    photo_warning = None
    photo = body.get('photo')
    if isinstance(photo, dict) and photo.get('data'):
        try:
            photo_url = upload_photo(photo)
        except ValueError as exc:
            return json_response(400, {'error': str(exc)})
        except Exception:
            photo_warning = 'Фото не удалось загрузить, заявка сохранена без него'

    username = (user.get('username') or '').strip()
    contact = f"@{username}" if username else str(user.get('id'))

    safe_city = city.replace("'", "''")[:120]
    safe_contact = contact.replace("'", "''")[:200]
    safe_text = ad_text.replace("'", "''")[:4000]
    safe_name = (user.get('first_name') or '').replace("'", "''")[:120]
    safe_username = username.replace("'", "''")[:120]
    photo_sql = f"'{photo_url}'" if photo_url else 'NULL'
    token = uuid.uuid4().hex

    cur.execute(
        f"INSERT INTO {schema}.ad_requests "
        f"(city, contact, ad_text, pref_start_hour, pref_end_hour, public_token, photo_url, "
        f" plan, client_chat_id, client_notified, client_name, client_username) "
        f"VALUES ('{safe_city}', '{safe_contact}', '{safe_text}', {start_hour}, {end_hour}, "
        f"'{token}', {photo_sql}, '{plan}', '{chat_id}', true, "
        f"NULLIF('{safe_name}', ''), NULLIF('{safe_username}', '')) RETURNING id"
    )
    request_id = cur.fetchone()[0]

    window_str = f'{start_hour:02d}:00 — {end_hour:02d}:00'
    try:
        notify_admin_new(city, contact, ad_text, window_str, token, photo_url, plan)
    except Exception:
        pass

    result = {'ok': True, 'id': request_id, 'token': token}
    if photo_warning:
        result['warning'] = photo_warning
    return json_response(200, result)


def handler(event: dict, context) -> dict:
    """Мини-приложение Telegram: объявления клиента и подача новой заявки по подписи initData"""
    method = event.get('httpMethod', 'GET')

    if method == 'OPTIONS':
        return {'statusCode': 200, 'headers': CORS_HEADERS, 'body': ''}

    bot_token = os.environ.get('TELEGRAM_BOT_TOKEN')
    if not bot_token:
        return json_response(500, {'error': 'Бот не настроен'})

    headers = event.get('headers') or {}
    init_data = headers.get('X-Init-Data') or headers.get('x-init-data') or ''
    body = json.loads(event.get('body') or '{}') if method == 'POST' else {}
    if not init_data and method == 'POST':
        init_data = body.get('init_data', '')

    user = check_init_data(init_data, bot_token)
    if not user or not user.get('id'):
        return json_response(403, {'error': 'Откройте кабинет через Telegram-бота'})

    chat_id = str(user['id']).replace("'", "''")
    schema = os.environ.get('MAIN_DB_SCHEMA', 'public')

    conn = psycopg2.connect(os.environ['DATABASE_URL'])
    conn.autocommit = True
    cur = conn.cursor()

    try:
        if method == 'POST' and body.get('action') == 'create':
            return create_ad(cur, schema, chat_id, user, body)

        cur.execute(
            f"SELECT r.id, r.city, r.status, r.public_token, r.ad_text, r.photo_url, "
            f"       r.pref_start_hour, r.pref_end_hour, r.plan, r.pending_at IS NOT NULL, "
            f"       r.renew_at IS NOT NULL, "
            f"       c.state, c.posts_sent, c.expires_at, c.interval_minutes, c.paused_until, "
            f"       COALESCE(c.tz_offset, g.tz_offset, 3), "
            f"       COALESCE((SELECT SUM(p.amount) FROM {schema}.payments p "
            f"                 WHERE p.request_id = r.id), 0) "
            f"FROM {schema}.ad_requests r "
            f"LEFT JOIN {schema}.campaigns c ON c.request_id = r.id AND c.state <> 'archived' "
            f"LEFT JOIN {schema}.city_groups g ON g.city = r.city "
            f"WHERE r.client_chat_id = '{chat_id}' "
            f"ORDER BY r.created_at DESC LIMIT 30"
        )

        ads = [{
            'id': a[0],
            'city': a[1],
            'status': a[2],
            'public_token': a[3],
            'ad_text': a[4],
            'photo_url': a[5],
            'start_hour': a[6],
            'end_hour': a[7],
            'plan': a[8],
            'has_pending': a[9],
            'has_renew': a[10],
            'state': a[11],
            'posts_sent': a[12],
            'expires_at': a[13],
            'interval_minutes': a[14],
            'paused_until': a[15],
            'tz_offset': a[16],
            'total_paid': float(a[17] or 0),
        } for a in cur.fetchall()]

        cur.execute(
            f"SELECT city, members, slots, tz_offset FROM {schema}.city_groups "
            f"WHERE is_active = true ORDER BY sort_order, city"
        )
        cities = [{
            'city': g[0],
            'members': g[1],
            'slots': g[2],
            'tz_offset': g[3],
        } for g in cur.fetchall()]

        return json_response(200, {
            'ads': ads,
            'cities': cities,
            'user': {
                'name': user.get('first_name', ''),
                'username': user.get('username', ''),
            },
        })
    finally:
        cur.close()
        conn.close()