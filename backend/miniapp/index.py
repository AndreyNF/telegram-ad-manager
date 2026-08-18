import hashlib
import hmac
import json
import os
import urllib.parse

import psycopg2


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


def handler(event: dict, context) -> dict:
    """Мини-приложение Telegram: отдаёт объявления клиента по подписи initData"""
    method = event.get('httpMethod', 'GET')

    if method == 'OPTIONS':
        return {'statusCode': 200, 'headers': CORS_HEADERS, 'body': ''}

    bot_token = os.environ.get('TELEGRAM_BOT_TOKEN')
    if not bot_token:
        return json_response(500, {'error': 'Бот не настроен'})

    headers = event.get('headers') or {}
    init_data = headers.get('X-Init-Data') or headers.get('x-init-data') or ''
    if not init_data and method == 'POST':
        init_data = (json.loads(event.get('body') or '{}')).get('init_data', '')

    user = check_init_data(init_data, bot_token)
    if not user or not user.get('id'):
        return json_response(403, {'error': 'Откройте кабинет через Telegram-бота'})

    chat_id = str(user['id']).replace("'", "''")
    schema = os.environ.get('MAIN_DB_SCHEMA', 'public')

    conn = psycopg2.connect(os.environ['DATABASE_URL'])
    conn.autocommit = True
    cur = conn.cursor()

    try:
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

        return json_response(200, {
            'ads': ads,
            'user': {
                'name': user.get('first_name', ''),
                'username': user.get('username', ''),
            },
        })
    finally:
        cur.close()
        conn.close()
