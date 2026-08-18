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

CORS_HEADERS = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
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


def upload_photo(photo: dict) -> str:
    """Кладёт новое фото объявления в S3 и возвращает публичную ссылку"""
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


def notify_admin_edit(city: str, request_id: int) -> None:
    """Сообщает админу, что клиент прислал правки объявления"""
    token = os.environ.get('TELEGRAM_BOT_TOKEN')
    chat_id = os.environ.get('TELEGRAM_ADMIN_CHAT_ID')
    if not token or not chat_id:
        return
    site = os.environ.get('SITE_URL', '').rstrip('/')
    link = f"\n{site}/admin" if site else ''
    try:
        call_telegram(token, 'sendMessage', {
            'chat_id': chat_id,
            'text': f"Клиент изменил объявление #{request_id} ({city}).\n"
                    f"Правки ждут вашего подтверждения в админке.{link}",
        }, budget=4.0)
    except Exception:
        pass


def handler(event: dict, context) -> dict:
    """Публичные данные: список городов для формы заявки и статус объявления по личной ссылке"""
    method = event.get('httpMethod', 'GET')

    if method == 'OPTIONS':
        return {'statusCode': 200, 'headers': CORS_HEADERS, 'body': ''}

    schema = os.environ.get('MAIN_DB_SCHEMA', 'public')
    params = event.get('queryStringParameters') or {}
    token = (params.get('token') or '').strip()

    conn = psycopg2.connect(os.environ['DATABASE_URL'])
    conn.autocommit = True
    cur = conn.cursor()

    try:
        if not token:
            cur.execute(
                f"SELECT city, members, slots FROM {schema}.city_groups "
                f"WHERE is_active = true ORDER BY sort_order, city"
            )
            cities = [{'city': r[0], 'members': r[1], 'slots': r[2]} for r in cur.fetchall()]
            return json_response(200, {'cities': cities})

        safe_token = token.replace("'", "''")[:40]
        cur.execute(
            f"SELECT r.id, r.city, r.ad_text, r.status, r.created_at, r.photo_url, "
            f"r.pref_start_hour, r.pref_end_hour, "
            f"c.state, c.posts_sent, c.last_sent_at, c.expires_at, c.interval_minutes, c.id, "
            f"c.paused_until, r.pending_ad_text, r.pending_photo_url, r.pending_photo_clear, "
            f"r.pending_at, r.pending_rejected_at "
            f"FROM {schema}.ad_requests r "
            f"LEFT JOIN {schema}.campaigns c ON c.request_id = r.id AND c.state <> 'archived' "
            f"WHERE r.public_token = '{safe_token}' LIMIT 1"
        )
        row = cur.fetchone()
        if not row:
            return json_response(404, {'error': 'Объявление не найдено'})

        if method == 'POST':
            body = json.loads(event.get('body') or '{}')
            action = body.get('action')
            campaign_id = row[13]

            if action == 'save_edit':
                new_text = (body.get('ad_text') or '').strip()
                if len(new_text) < 10:
                    return json_response(400, {'error': 'Текст слишком короткий'})
                if len(new_text) > 3000:
                    return json_response(400, {'error': 'Текст длиннее 3000 символов'})

                photo = body.get('photo')
                remove_photo = bool(body.get('remove_photo'))
                photo_sql = 'pending_photo_url'

                if isinstance(photo, dict) and photo.get('data'):
                    try:
                        photo_sql = f"'{upload_photo(photo)}'"
                    except ValueError as exc:
                        return json_response(400, {'error': str(exc)})
                    except Exception:
                        return json_response(502, {'error': 'Не удалось загрузить фото'})
                    remove_photo = False
                elif remove_photo:
                    photo_sql = 'NULL'

                safe_text = new_text.replace("'", "''")
                cur.execute(
                    f"UPDATE {schema}.ad_requests SET pending_ad_text = '{safe_text}', "
                    f"pending_photo_url = {photo_sql}, "
                    f"pending_photo_clear = {'true' if remove_photo else 'false'}, "
                    f"pending_at = CURRENT_TIMESTAMP, pending_rejected_at = NULL "
                    f"WHERE id = {int(row[0])}"
                )
                notify_admin_edit(row[1], row[0])
                return json_response(200, {'ok': True})

            if action == 'cancel_edit':
                cur.execute(
                    f"UPDATE {schema}.ad_requests SET pending_ad_text = NULL, "
                    f"pending_photo_url = NULL, pending_photo_clear = false, "
                    f"pending_at = NULL WHERE id = {int(row[0])}"
                )
                return json_response(200, {'ok': True})

            if not campaign_id:
                return json_response(400, {'error': 'Открутка ещё не запущена'})

            if action == 'stop':
                cur.execute(
                    f"UPDATE {schema}.campaigns SET state = 'stopped', "
                    f"stopped_at = CURRENT_TIMESTAMP WHERE id = {int(campaign_id)}"
                )
                return json_response(200, {'ok': True})

            if action == 'pause':
                hours = body.get('hours', 24)
                try:
                    hours = float(hours)
                except (TypeError, ValueError):
                    return json_response(400, {'error': 'Укажите срок паузы'})
                if not 0.5 <= hours <= 720:
                    return json_response(400, {'error': 'Пауза возможна от 30 минут до 30 дней'})

                minutes = int(hours * 60)
                cur.execute(
                    f"UPDATE {schema}.campaigns SET "
                    f"paused_until = CURRENT_TIMESTAMP + INTERVAL '{minutes} minutes', "
                    f"expires_at = expires_at + INTERVAL '{minutes} minutes' "
                    f"WHERE id = {int(campaign_id)}"
                )
                return json_response(200, {'ok': True})

            if action == 'resume':
                cur.execute(
                    f"UPDATE {schema}.campaigns SET paused_until = NULL, "
                    f"next_run_at = CURRENT_TIMESTAMP WHERE id = {int(campaign_id)}"
                )
                return json_response(200, {'ok': True})

            return json_response(400, {'error': 'Действие недоступно'})

        return json_response(200, {
            'id': row[0],
            'city': row[1],
            'ad_text': row[2],
            'status': row[3],
            'created_at': row[4],
            'photo_url': row[5],
            'pref_start_hour': row[6],
            'pref_end_hour': row[7],
            'pending': None if row[18] is None else {
                'ad_text': row[15],
                'photo_url': row[16],
                'photo_clear': row[17],
                'created_at': row[18],
            },
            'edit_rejected_at': row[19],
            'campaign': None if row[8] is None else {
                'state': row[8],
                'posts_sent': row[9],
                'last_sent_at': row[10],
                'expires_at': row[11],
                'interval_minutes': row[12],
                'paused_until': row[14],
            },
        })
    finally:
        cur.close()
        conn.close()