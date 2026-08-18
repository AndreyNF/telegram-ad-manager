import json
import os

import psycopg2

from telegram_client import call as call_telegram


CORS_HEADERS = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Max-Age': '86400',
    'Content-Type': 'application/json',
}


def save_user(schema: str, username: str, chat_id: int) -> None:
    """Запоминает chat_id пользователя, чтобы бот мог писать ему в личку"""
    conn = psycopg2.connect(os.environ['DATABASE_URL'])
    conn.autocommit = True
    cur = conn.cursor()
    safe_username = username.lower().replace("'", "''")
    cur.execute(
        f"INSERT INTO {schema}.telegram_users (username, chat_id, updated_at) "
        f"VALUES ('{safe_username}', '{chat_id}', CURRENT_TIMESTAMP) "
        f"ON CONFLICT (username) DO UPDATE SET chat_id = EXCLUDED.chat_id, "
        f"updated_at = CURRENT_TIMESTAMP"
    )
    compact = safe_username.replace('_', '').replace('.', '').replace('-', '')
    cur.execute(
        f"UPDATE {schema}.ad_requests SET client_chat_id = '{chat_id}' "
        f"WHERE client_chat_id IS NULL AND ("
        f"  lower(ltrim(contact, '@')) = '{safe_username}' OR "
        f"  replace(replace(replace(lower(ltrim(contact, '@')), '_', ''), '.', ''), '-', '') "
        f"    = '{compact}')"
    )
    cur.close()
    conn.close()


def save_incoming(schema: str, chat_id: int, text: str) -> None:
    """Сохраняет ответ клиента в переписку по его последней заявке"""
    conn = psycopg2.connect(os.environ['DATABASE_URL'])
    conn.autocommit = True
    cur = conn.cursor()
    cur.execute(
        f"SELECT id FROM {schema}.ad_requests WHERE client_chat_id = '{chat_id}' "
        f"ORDER BY created_at DESC LIMIT 1"
    )
    row = cur.fetchone()
    if row:
        safe_text = text.replace("'", "''")[:3000]
        cur.execute(
            f"INSERT INTO {schema}.client_messages (request_id, direction, text) "
            f"VALUES ({row[0]}, 'in', '{safe_text}')"
        )
    cur.close()
    conn.close()


def save_group(schema: str, chat_id: int, title: str) -> None:
    """Автоматически подставляет ID группы по её названию, если город совпал"""
    if not title:
        return
    safe_title = title.replace("'", "''")
    conn = psycopg2.connect(os.environ['DATABASE_URL'])
    conn.autocommit = True
    cur = conn.cursor()
    cur.execute(
        f"UPDATE {schema}.city_groups SET chat_id = '{chat_id}' "
        f"WHERE (chat_id = '' OR chat_id IS NULL) "
        f"AND position(lower(city) in lower('{safe_title}')) > 0"
    )
    cur.close()
    conn.close()


def handler(event: dict, context) -> dict:
    """Принимает обновления Telegram-бота: запоминает chat_id пользователя при первом /start
    и автоматически определяет ID группы города, когда бота в неё добавляют"""
    method = event.get('httpMethod', 'GET')

    if method == 'OPTIONS':
        return {'statusCode': 200, 'headers': CORS_HEADERS, 'body': ''}

    params = event.get('queryStringParameters') or {}
    register_url = params.get('register')
    if method == 'GET' and register_url:
        token = os.environ['TELEGRAM_BOT_TOKEN']
        try:
            result = call_telegram(token, 'setWebhook', {'url': register_url})
        except Exception as exc:
            result = {'ok': False, 'error': str(exc)[:300]}
        return {
            'statusCode': 200,
            'headers': CORS_HEADERS,
            'body': json.dumps(result, ensure_ascii=False),
            'isBase64Encoded': False,
        }

    if method == 'GET':
        return {
            'statusCode': 200,
            'headers': CORS_HEADERS,
            'body': json.dumps({'ok': True}),
            'isBase64Encoded': False,
        }

    schema = os.environ.get('MAIN_DB_SCHEMA', 'public')
    update = json.loads(event.get('body') or '{}')
    message = (
        update.get('message')
        or update.get('edited_message')
        or update.get('my_chat_member')
        or {}
    )
    chat = message.get('chat') or {}
    chat_id = chat.get('id')
    chat_type = chat.get('type', '')

    if chat_id and chat_type in ('group', 'supergroup', 'channel'):
        try:
            save_group(schema, chat_id, chat.get('title', ''))
        except Exception:
            pass

    from_user = message.get('from') or {}
    username = from_user.get('username')

    if username and chat_id and chat_type == 'private':
        try:
            save_user(schema, username, chat_id)
        except Exception:
            pass

        text = message.get('text', '')
        if text and not text.startswith('/'):
            try:
                save_incoming(schema, chat_id, text)
            except Exception:
                pass

        if text.startswith('/start'):
            try:
                token = os.environ['TELEGRAM_BOT_TOKEN']
                call_telegram(token, 'sendMessage', {
                    'chat_id': chat_id,
                    'text': 'Готово! Теперь мы сможем присылать вам ссылку на статус объявления и уведомления.',
                })
            except Exception:
                pass

    return {
        'statusCode': 200,
        'headers': CORS_HEADERS,
        'body': json.dumps({'ok': True}),
        'isBase64Encoded': False,
    }