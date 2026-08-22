import json
import os

import psycopg2

from telegram_client import call as call_telegram
import draft as ad_draft


CORS_HEADERS = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Max-Age': '86400',
    'Content-Type': 'application/json',
}


def save_user(schema: str, username: str, chat_id: int, first_name: str = '') -> None:
    """Запоминает chat_id и имя пользователя, чтобы бот мог писать ему в личку"""
    conn = psycopg2.connect(os.environ['DATABASE_URL'])
    conn.autocommit = True
    cur = conn.cursor()
    safe_username = username.lower().replace("'", "''")
    safe_name = (first_name or '').replace("'", "''")[:120]
    cur.execute(
        f"INSERT INTO {schema}.telegram_users (username, chat_id, first_name, updated_at) "
        f"VALUES ('{safe_username}', '{chat_id}', '{safe_name}', CURRENT_TIMESTAMP) "
        f"ON CONFLICT (username) DO UPDATE SET chat_id = EXCLUDED.chat_id, "
        f"first_name = COALESCE(NULLIF(EXCLUDED.first_name, ''), {schema}.telegram_users.first_name), "
        f"updated_at = CURRENT_TIMESTAMP"
    )
    compact = safe_username.replace('_', '').replace('.', '').replace('-', '')
    cur.execute(
        f"UPDATE {schema}.ad_requests SET client_chat_id = '{chat_id}', "
        f"client_username = '{safe_username}', "
        f"client_name = COALESCE(NULLIF(client_name, ''), NULLIF('{safe_name}', '')) "
        f"WHERE client_chat_id IS NULL AND ("
        f"  lower(ltrim(contact, '@')) = '{safe_username}' OR "
        f"  replace(replace(replace(lower(ltrim(contact, '@')), '_', ''), '.', ''), '-', '') "
        f"    = '{compact}')"
    )
    cur.execute(
        f"UPDATE {schema}.ad_requests SET client_username = '{safe_username}', "
        f"client_name = COALESCE(NULLIF('{safe_name}', ''), client_name) "
        f"WHERE client_chat_id = '{chat_id}'"
    )
    cur.execute(
        f"DELETE FROM {schema}.telegram_users WHERE chat_id = '{chat_id}' "
        f"AND username <> '{safe_username}'"
    )
    cur.close()
    conn.close()


def save_incoming(schema: str, chat_id: int, text: str) -> None:
    """Сохраняет ответ клиента в переписку по его последней заявке"""
    conn = psycopg2.connect(os.environ['DATABASE_URL'])
    conn.autocommit = True
    cur = conn.cursor()
    cur.execute(
        f"SELECT id, city, COALESCE(NULLIF(client_name, ''), contact), client_username "
        f"FROM {schema}.ad_requests WHERE client_chat_id = '{chat_id}' "
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

    if not row:
        return

    admin_chat = os.environ.get('TELEGRAM_ADMIN_CHAT_ID')
    if not admin_chat:
        return

    site = os.environ.get('SITE_URL', '').rstrip('/')
    who = row[2] or 'клиент'
    nick = f' (@{row[3]})' if row[3] else ''
    params = {
        'chat_id': admin_chat,
        'text': f'Сообщение от клиента\n\n{who}{nick} · заявка #{row[0]} ({row[1]})\n\n'
                f'{text[:600]}',
    }
    if site:
        params['reply_markup'] = json.dumps({'inline_keyboard': [[{
            'text': 'Ответить в админке',
            'url': f'{site}/admin',
        }]]})
    try:
        call_telegram(os.environ['TELEGRAM_BOT_TOKEN'], 'sendMessage', params, budget=5.0)
    except Exception:
        pass


def get_user_ads(schema: str, chat_id: int) -> list:
    """Возвращает объявления клиента со ссылками на личный кабинет"""
    conn = psycopg2.connect(os.environ['DATABASE_URL'])
    conn.autocommit = True
    cur = conn.cursor()
    cur.execute(
        f"SELECT r.id, r.city, r.status, r.public_token, c.state, c.expires_at "
        f"FROM {schema}.ad_requests r "
        f"LEFT JOIN {schema}.campaigns c ON c.request_id = r.id AND c.state <> 'archived' "
        f"WHERE r.client_chat_id = '{chat_id}' AND r.public_token IS NOT NULL "
        f"ORDER BY r.created_at DESC LIMIT 10"
    )
    rows = cur.fetchall()
    cur.close()
    conn.close()
    return rows


def state_label(status: str, state: str) -> str:
    if state == 'running':
        return 'публикуется'
    if state == 'stopped':
        return 'остановлено'
    if state == 'expired':
        return 'срок закончился'
    if status == 'rejected':
        return 'отклонено'
    if status == 'approved':
        return 'одобрено'
    return 'ждёт модерации'


def send_cabinet(schema: str, chat_id: int) -> None:
    """Отправляет клиенту кнопки входа в личный кабинет по каждому объявлению"""
    token = os.environ['TELEGRAM_BOT_TOKEN']
    site = os.environ.get('SITE_URL', '').rstrip('/')
    rows = get_user_ads(schema, chat_id)

    if not rows:
        call_telegram(token, 'sendMessage', {
            'chat_id': chat_id,
            'text': 'У вас пока нет объявлений. Оставьте заявку на сайте — '
                    'после этого личный кабинет откроется здесь.'
                    + (f'\n{site}' if site else ''),
        })
        return

    if not site:
        call_telegram(token, 'sendMessage', {
            'chat_id': chat_id,
            'text': 'Личный кабинет временно недоступен.',
        })
        return

    lines = ['Ваши объявления:']
    for ad_id, city, status, public_token, state, expires_at in rows:
        label = state_label(status, state)
        until = f", до {expires_at.strftime('%d.%m.%Y')}" if expires_at else ''
        lines.append(f"\n#{ad_id} · {city} — {label}{until}")

    buttons = [[{
        'text': 'Открыть личный кабинет',
        'web_app': {'url': f'{site}/app'},
    }]]

    call_telegram(token, 'sendMessage', {
        'chat_id': chat_id,
        'text': '\n'.join(lines) + '\n\nВ кабинете можно изменить текст и фото, '
                                   'поставить показы на паузу, продлить тариф '
                                   'и посмотреть статистику.',
        'reply_markup': json.dumps({'inline_keyboard': buttons}),
    }, budget=6.0)


def setup_commands() -> None:
    """Показывает клиенту меню команд бота"""
    token = os.environ['TELEGRAM_BOT_TOKEN']
    call_telegram(token, 'setMyCommands', {
        'commands': json.dumps([
            {'command': 'post', 'description': 'Подать объявление'},
            {'command': 'cabinet', 'description': 'Личный кабинет объявления'},
            {'command': 'start', 'description': 'Начать работу с ботом'},
        ]),
    })

    site = os.environ.get('SITE_URL', '').rstrip('/')
    if not site:
        return
    call_telegram(token, 'setChatMenuButton', {
        'menu_button': json.dumps({
            'type': 'web_app',
            'text': 'Кабинет',
            'web_app': {'url': f'{site}/app'},
        }),
    })


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


def has_active_ad(schema: str, user_id: int, username: str) -> bool:
    """Проверяет, есть ли у автора оплаченное объявление, которое сейчас крутится"""
    safe_user = (username or '').lower().replace("'", "''")
    conn = psycopg2.connect(os.environ['DATABASE_URL'])
    conn.autocommit = True
    cur = conn.cursor()
    by_name = (
        f" OR lower(ltrim(r.contact, '@')) = '{safe_user}'"
        f" OR lower(r.client_username) = '{safe_user}'"
    ) if safe_user else ''
    cur.execute(
        f"SELECT COUNT(*) FROM {schema}.campaigns c "
        f"JOIN {schema}.ad_requests r ON r.id = c.request_id "
        f"WHERE c.state = 'running' AND ("
        f"  r.client_chat_id = '{int(user_id)}'{by_name})"
    )
    total = int(cur.fetchone()[0] or 0)
    cur.close()
    conn.close()
    return total > 0


def is_moderated_group(schema: str, chat_id: int) -> bool:
    """Отвечает, включена ли для этой группы очистка чужих объявлений"""
    conn = psycopg2.connect(os.environ['DATABASE_URL'])
    conn.autocommit = True
    cur = conn.cursor()
    cur.execute(
        f"SELECT COUNT(*) FROM {schema}.city_groups "
        f"WHERE chat_id = '{int(chat_id)}' AND is_active = true AND auto_clean = true"
    )
    total = int(cur.fetchone()[0] or 0)
    cur.close()
    conn.close()
    return total > 0


def moderate_group_message(schema: str, message: dict, chat_id: int) -> bool:
    """Удаляет сообщение из группы, если у автора нет оплаченного размещения"""
    from_user = message.get('from') or {}
    user_id = from_user.get('id')
    if not user_id or from_user.get('is_bot'):
        return False
    if message.get('new_chat_members') or message.get('left_chat_member'):
        return False
    message_id = message.get('message_id')
    if not message_id:
        return False

    if not is_moderated_group(schema, chat_id):
        return False

    token = os.environ['TELEGRAM_BOT_TOKEN']
    member = call_telegram(token, 'getChatMember',
                           {'chat_id': chat_id, 'user_id': user_id}, budget=6.0)
    status = ((member.get('result') or {}).get('status') or '')
    if status in ('creator', 'administrator'):
        return False

    if has_active_ad(schema, user_id, from_user.get('username', '')):
        return False

    call_telegram(token, 'deleteMessage',
                  {'chat_id': chat_id, 'message_id': message_id}, budget=6.0)

    try:
        call_telegram(token, 'sendMessage', {
            'chat_id': user_id,
            'text': 'Ваше сообщение удалено из группы: размещать объявления могут '
                    'только участники с оплаченным размещением.\n\n'
                    'Подать объявление — /post',
        }, budget=5.0)
    except Exception:
        pass
    return True


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

    callback = update.get('callback_query')
    if callback:
        cb_user = callback.get('from') or {}
        cb_chat = ((callback.get('message') or {}).get('chat') or {})
        cb_id = cb_chat.get('id')
        cb_data = callback.get('data') or ''
        try:
            call_telegram(os.environ['TELEGRAM_BOT_TOKEN'], 'answerCallbackQuery',
                          {'callback_query_id': callback.get('id')}, budget=3.0)
        except Exception:
            pass
        if cb_id and cb_data.startswith('draft:') and cb_user.get('username'):
            try:
                ad_draft.handle_callback(schema, cb_id, cb_data,
                                         cb_user['username'], cb_user.get('first_name', ''))
            except Exception:
                pass
        return {
            'statusCode': 200,
            'headers': CORS_HEADERS,
            'body': json.dumps({'ok': True}),
            'isBase64Encoded': False,
        }

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

        if update.get('message') or update.get('edited_message'):
            try:
                moderate_group_message(schema, message, chat_id)
            except Exception:
                pass

        return {
            'statusCode': 200,
            'headers': CORS_HEADERS,
            'body': json.dumps({'ok': True}),
            'isBase64Encoded': False,
        }

    from_user = message.get('from') or {}
    username = from_user.get('username')

    if chat_id and chat_type == 'private' and not username:
        try:
            call_telegram(os.environ['TELEGRAM_BOT_TOKEN'], 'sendMessage', {
                'chat_id': chat_id,
                'text': 'У вашего аккаунта не задан никнейм (@username) — без него мы не сможем '
                        'указать вас в объявлении и связать заявку с этим чатом.\n\n'
                        'Откройте настройки Telegram → «Имя пользователя», задайте ник '
                        'и напишите нам ещё раз.',
            }, budget=5.0)
        except Exception:
            pass
        return {
            'statusCode': 200,
            'headers': CORS_HEADERS,
            'body': json.dumps({'ok': True}),
            'isBase64Encoded': False,
        }

    if username and chat_id and chat_type == 'private':
        try:
            save_user(schema, username, chat_id, from_user.get('first_name', ''))
        except Exception:
            pass

        text = (message.get('text') or message.get('caption') or '').strip()
        lower = text.lower()

        photos = message.get('photo') or []
        photo_fid = ''
        if photos:
            best = max(photos, key=lambda p: p.get('file_size') or 0)
            photo_fid = best.get('file_id') or ''

        wants_post = (
            lower.startswith('/post')
            or lower.startswith('/new')
            or lower in ('подать объявление', 'новое объявление', 'разместить')
        )

        if wants_post:
            try:
                ad_draft.start_draft(schema, chat_id)
            except Exception:
                pass
            return {
                'statusCode': 200,
                'headers': CORS_HEADERS,
                'body': json.dumps({'ok': True}),
                'isBase64Encoded': False,
            }

        if text and not text.startswith('/'):
            try:
                if ad_draft.handle_text(schema, chat_id, text, photo_fid):
                    return {
                        'statusCode': 200,
                        'headers': CORS_HEADERS,
                        'body': json.dumps({'ok': True}),
                        'isBase64Encoded': False,
                    }
            except Exception:
                pass
            try:
                save_incoming(schema, chat_id, text)
            except Exception:
                pass

        wants_cabinet = (
            lower.startswith('/cabinet')
            or lower.startswith('/status')
            or lower in ('кабинет', 'личный кабинет', 'мои объявления')
        )

        if wants_cabinet:
            try:
                send_cabinet(schema, chat_id)
            except Exception:
                pass

        elif lower.startswith('/start'):
            try:
                token = os.environ['TELEGRAM_BOT_TOKEN']
                call_telegram(token, 'sendMessage', {
                    'chat_id': chat_id,
                    'text': 'Готово! Здесь вы будете получать уведомления по объявлению.\n\n'
                            '/post — подать объявление прямо здесь, без захода на сайт.\n'
                            '/cabinet — личный кабинет: изменить текст и фото, поставить '
                            'показы на паузу, продлить тариф и посмотреть статистику.',
                })
                setup_commands()
                send_cabinet(schema, chat_id)
            except Exception:
                pass

    return {
        'statusCode': 200,
        'headers': CORS_HEADERS,
        'body': json.dumps({'ok': True}),
        'isBase64Encoded': False,
    }