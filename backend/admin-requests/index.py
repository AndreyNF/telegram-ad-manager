import json
import os

import psycopg2

from telegram_client import call as call_telegram


CORS_HEADERS = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, X-Admin-Password',
    'Access-Control-Max-Age': '86400',
    'Content-Type': 'application/json',
}


def esc(value) -> str:
    return str(value or '').replace("'", "''")


def money(value) -> float:
    """Приводит сумму оплаты к числу, отсекая мусор"""
    try:
        amount = float(str(value).replace(',', '.').strip())
    except (TypeError, ValueError):
        return 0.0
    return round(amount, 2) if 0 < amount < 10_000_000 else 0.0


def json_response(status: int, payload: dict) -> dict:
    return {
        'statusCode': status,
        'headers': CORS_HEADERS,
        'body': json.dumps(payload, ensure_ascii=False, default=str),
        'isBase64Encoded': False,
    }


def list_data(cur, schema: str) -> dict:
    """Собирает всё для админки: заявки, кампании и группы городов"""
    cur.execute(
        f"SELECT r.id, r.city, r.contact, r.ad_text, r.status, r.created_at, "
        f"r.pref_start_hour, r.pref_end_hour, r.public_token, r.photo_url, r.client_notified, "
        f"r.client_chat_id, r.pending_ad_text, r.pending_photo_url, r.pending_photo_clear, "
        f"r.pending_at, r.client_name, r.client_username, r.plan, "
        f"c.id, c.state, c.posts_sent, c.last_sent_at, c.last_error, c.expires_at, "
        f"c.interval_minutes, c.window_start_hour, c.window_end_hour, c.paused_until, "
        f"c.price_amount, c.paid_at, c.days_paid, "
        f"COALESCE((SELECT SUM(p.amount) FROM {schema}.payments p "
        f"          WHERE p.request_id = r.id), 0) "
        f"FROM {schema}.ad_requests r "
        f"LEFT JOIN {schema}.campaigns c ON c.request_id = r.id AND c.state <> 'archived' "
        f"ORDER BY r.created_at DESC LIMIT 200"
    )
    requests = []
    for row in cur.fetchall():
        requests.append({
            'id': row[0],
            'city': row[1],
            'contact': row[2],
            'ad_text': row[3],
            'status': row[4],
            'created_at': row[5],
            'pref_start_hour': row[6],
            'pref_end_hour': row[7],
            'public_token': row[8],
            'photo_url': row[9],
            'client_notified': row[10],
            'can_write': bool(row[11]),
            'pending': None if row[15] is None else {
                'ad_text': row[12],
                'photo_url': row[13],
                'photo_clear': row[14],
                'created_at': row[15],
            },
            'client_name': row[16],
            'client_username': row[17],
            'plan': row[18],
            'campaign': None if row[19] is None else {
                'id': row[19],
                'state': row[20],
                'posts_sent': row[21],
                'last_sent_at': row[22],
                'last_error': row[23],
                'expires_at': row[24],
                'interval_minutes': row[25],
                'window_start_hour': row[26],
                'window_end_hour': row[27],
                'paused_until': row[28],
                'price_amount': float(row[29]) if row[29] is not None else None,
                'paid_at': row[30],
                'days_paid': row[31],
            },
            'total_paid': float(row[32] or 0),
        })

    cur.execute(
        f"SELECT id, city, chat_id, members, slots, is_active, sort_order "
        f"FROM {schema}.city_groups ORDER BY sort_order, city"
    )
    groups = [{
        'id': g[0],
        'city': g[1],
        'chat_id': g[2],
        'members': g[3],
        'slots': g[4],
        'is_active': g[5],
        'sort_order': g[6],
    } for g in cur.fetchall()]

    cur.execute(
        f"SELECT last_run_at, EXTRACT(EPOCH FROM (CURRENT_TIMESTAMP - last_run_at)) / 60 "
        f"FROM {schema}.runner_heartbeat WHERE id = 1"
    )
    hb = cur.fetchone()
    heartbeat = {
        'last_run_at': hb[0] if hb else None,
        'minutes_ago': round(float(hb[1]), 1) if hb and hb[1] is not None else None,
    }

    return {'requests': requests, 'groups': groups, 'heartbeat': heartbeat}


def deliver_to_client(cur, schema: str, request_id: int, text: str) -> dict:
    """Шлёт клиенту сообщение в Telegram и сохраняет его в переписке"""
    cur.execute(
        f"SELECT client_chat_id, contact FROM {schema}.ad_requests WHERE id = {request_id}"
    )
    row = cur.fetchone()
    if not row:
        return json_response(404, {'error': 'Заявка не найдена'})

    chat_id, contact = row
    if not chat_id:
        return json_response(400, {
            'error': f'Клиент {contact} не запускал бота — доставить сообщение нельзя'
        })

    token = os.environ.get('TELEGRAM_BOT_TOKEN')
    if not token:
        return json_response(500, {'error': 'Бот не настроен'})

    try:
        data = call_telegram(token, 'sendMessage', {'chat_id': chat_id, 'text': text}, budget=6.0)
    except Exception as exc:
        return json_response(502, {'error': f'Telegram недоступен: {str(exc)[:200]}'})

    if not data.get('ok'):
        return json_response(502, {'error': str(data.get('description'))[:300]})

    cur.execute(
        f"INSERT INTO {schema}.client_messages (request_id, direction, text) "
        f"VALUES ({request_id}, 'out', '{esc(text)}')"
    )
    return json_response(200, {'ok': True})


def handler(event: dict, context) -> dict:
    """Админка: список заявок, модерация, запуск и остановка открутки, управление группами городов"""
    method = event.get('httpMethod', 'GET')

    if method == 'OPTIONS':
        return {'statusCode': 200, 'headers': CORS_HEADERS, 'body': ''}

    headers = event.get('headers') or {}
    password = headers.get('X-Admin-Password') or headers.get('x-admin-password') or ''
    if password != os.environ.get('ADMIN_PASSWORD'):
        return json_response(403, {'error': 'Неверный пароль'})

    schema = os.environ.get('MAIN_DB_SCHEMA', 'public')
    conn = psycopg2.connect(os.environ['DATABASE_URL'])
    conn.autocommit = True
    cur = conn.cursor()

    try:
        if method == 'GET':
            params = event.get('queryStringParameters') or {}
            messages_for = params.get('messages_for')
            if messages_for:
                cur.execute(
                    f"SELECT direction, text, created_at FROM {schema}.client_messages "
                    f"WHERE request_id = {int(messages_for)} ORDER BY created_at LIMIT 100"
                )
                return json_response(200, {'messages': [
                    {'direction': m[0], 'text': m[1], 'created_at': m[2]}
                    for m in cur.fetchall()
                ]})
            return json_response(200, list_data(cur, schema))

        body = json.loads(event.get('body') or '{}')
        action = body.get('action', '')

        if action in ('approve_edit', 'reject_edit'):
            request_id = int(body.get('id', 0))
            cur.execute(
                f"SELECT pending_ad_text, pending_photo_url, pending_photo_clear, city "
                f"FROM {schema}.ad_requests WHERE id = {request_id} AND pending_at IS NOT NULL"
            )
            row = cur.fetchone()
            if not row:
                return json_response(404, {'error': 'Правок нет'})

            if action == 'approve_edit':
                new_photo = row[1]
                if row[2]:
                    photo_set = "photo_url = NULL, photo_file_id = NULL"
                elif new_photo:
                    photo_set = f"photo_url = '{esc(new_photo)}', photo_file_id = NULL"
                else:
                    photo_set = "photo_url = photo_url"

                cur.execute(
                    f"UPDATE {schema}.ad_requests SET ad_text = '{esc(row[0])}', {photo_set}, "
                    f"pending_ad_text = NULL, pending_photo_url = NULL, "
                    f"pending_photo_clear = false, pending_at = NULL, pending_rejected_at = NULL "
                    f"WHERE id = {request_id}"
                )
                note = f'Правки объявления ({row[3]}) одобрены — публикуем новую версию.'
            else:
                cur.execute(
                    f"UPDATE {schema}.ad_requests SET pending_ad_text = NULL, "
                    f"pending_photo_url = NULL, pending_photo_clear = false, pending_at = NULL, "
                    f"pending_rejected_at = CURRENT_TIMESTAMP WHERE id = {request_id}"
                )
                note = (f'Правки объявления ({row[3]}) отклонены. '
                        f'Продолжаем публиковать предыдущую версию.')

            cur.execute(
                f"SELECT client_chat_id FROM {schema}.ad_requests WHERE id = {request_id}"
            )
            chat = cur.fetchone()
            token = os.environ.get('TELEGRAM_BOT_TOKEN')
            if chat and chat[0] and token:
                try:
                    call_telegram(token, 'sendMessage',
                                  {'chat_id': chat[0], 'text': note}, budget=5.0)
                    cur.execute(
                        f"INSERT INTO {schema}.client_messages (request_id, direction, text) "
                        f"VALUES ({request_id}, 'out', '{esc(note)}')"
                    )
                except Exception:
                    pass

            return json_response(200, {'ok': True})

        if action == 'send_message':
            request_id = int(body.get('id', 0))
            text = (body.get('text') or '').strip()[:3000]
            if not text:
                return json_response(400, {'error': 'Пустое сообщение'})
            return deliver_to_client(cur, schema, request_id, text)

        if action == 'send_cabinet_link':
            request_id = int(body.get('id', 0))
            cur.execute(
                f"SELECT public_token, city FROM {schema}.ad_requests WHERE id = {request_id}"
            )
            row = cur.fetchone()
            if not row or not row[0]:
                return json_response(404, {'error': 'У заявки нет ссылки на кабинет'})

            site = os.environ.get('SITE_URL', '').rstrip('/')
            if not site:
                return json_response(500, {'error': 'Не задан адрес сайта'})

            text = (
                f"Личный кабинет вашего объявления ({row[1]}):\n"
                f"{site}/status/{row[0]}\n\n"
                f"Здесь можно изменить текст и фото, поставить показы на паузу "
                f"и посмотреть статистику. Открыть кабинет снова — команда /cabinet"
            )
            return deliver_to_client(cur, schema, request_id, text)

        if action == 'approve':
            request_id = int(body.get('id', 0))
            days = int(body.get('days', 30))
            interval = int(body.get('interval_minutes', 15))
            interval = max(5, min(interval, 1440))

            cur.execute(
                f"SELECT city, pref_start_hour, pref_end_hour FROM {schema}.ad_requests "
                f"WHERE id = {request_id}"
            )
            row = cur.fetchone()
            if not row:
                return json_response(404, {'error': 'Заявка не найдена'})
            city, win_start, win_end = row

            cur.execute(
                f"UPDATE {schema}.campaigns SET state = 'archived' "
                f"WHERE request_id = {request_id} AND state <> 'archived'"
            )
            amount = money(body.get('amount'))
            note = esc(body.get('payment_note', ''))[:200]
            paid_sql = 'CURRENT_TIMESTAMP' if amount else 'NULL'

            cur.execute(
                f"INSERT INTO {schema}.campaigns "
                f"(request_id, city, interval_minutes, state, next_run_at, days_paid, expires_at, "
                f"window_start_hour, window_end_hour, price_amount, paid_at, payment_note) VALUES "
                f"({request_id}, '{esc(city)}', {interval}, 'running', CURRENT_TIMESTAMP, {days}, "
                f"CURRENT_TIMESTAMP + INTERVAL '{days} days', {win_start}, {win_end}, "
                f"{amount if amount else 'NULL'}, {paid_sql}, '{note}') RETURNING id"
            )
            campaign_id = cur.fetchone()[0]
            if amount:
                cur.execute(
                    f"INSERT INTO {schema}.payments "
                    f"(campaign_id, request_id, amount, days, kind, note) VALUES "
                    f"({campaign_id}, {request_id}, {amount}, {days}, 'start', '{note}')"
                )
            cur.execute(
                f"UPDATE {schema}.ad_requests SET status = 'approved' WHERE id = {request_id}"
            )
            return json_response(200, {'ok': True, 'campaign_id': campaign_id})

        if action == 'reject':
            request_id = int(body.get('id', 0))
            cur.execute(
                f"UPDATE {schema}.ad_requests SET status = 'rejected' WHERE id = {request_id}"
            )
            cur.execute(
                f"UPDATE {schema}.campaigns SET state = 'stopped', stopped_at = CURRENT_TIMESTAMP "
                f"WHERE request_id = {request_id} AND state = 'running'"
            )
            return json_response(200, {'ok': True})

        if action in ('stop', 'resume'):
            campaign_id = int(body.get('campaign_id', 0))
            if action == 'stop':
                cur.execute(
                    f"UPDATE {schema}.campaigns SET state = 'stopped', "
                    f"stopped_at = CURRENT_TIMESTAMP WHERE id = {campaign_id}"
                )
            else:
                cur.execute(
                    f"UPDATE {schema}.campaigns SET state = 'running', stopped_at = NULL, "
                    f"fail_streak = 0, last_error = NULL, next_run_at = CURRENT_TIMESTAMP "
                    f"WHERE id = {campaign_id}"
                )
            return json_response(200, {'ok': True})

        if action == 'pause':
            campaign_id = int(body.get('campaign_id', 0))
            hours = float(body.get('hours', 24))
            hours = max(0.5, min(hours, 720))
            minutes = int(hours * 60)
            cur.execute(
                f"UPDATE {schema}.campaigns SET "
                f"paused_until = CURRENT_TIMESTAMP + INTERVAL '{minutes} minutes', "
                f"expires_at = expires_at + INTERVAL '{minutes} minutes' "
                f"WHERE id = {campaign_id}"
            )
            return json_response(200, {'ok': True})

        if action == 'unpause':
            campaign_id = int(body.get('campaign_id', 0))
            cur.execute(
                f"UPDATE {schema}.campaigns SET paused_until = NULL, "
                f"next_run_at = CURRENT_TIMESTAMP WHERE id = {campaign_id}"
            )
            return json_response(200, {'ok': True})

        if action == 'extend':
            campaign_id = int(body.get('campaign_id', 0))
            days = max(1, min(int(body.get('days', 30)), 365))
            amount = money(body.get('amount'))
            note = esc(body.get('payment_note', ''))[:200]

            paid_set = ''
            if amount:
                paid_set = (f", price_amount = COALESCE(price_amount, 0) + {amount}, "
                            f"paid_at = CURRENT_TIMESTAMP, payment_note = '{note}'")

            cur.execute(
                f"UPDATE {schema}.campaigns SET "
                f"expires_at = GREATEST(COALESCE(expires_at, CURRENT_TIMESTAMP), CURRENT_TIMESTAMP) "
                f"+ INTERVAL '{days} days', state = 'running', reminder_sent_at = NULL, "
                f"days_paid = COALESCE(days_paid, 0) + {days}{paid_set} "
                f"WHERE id = {campaign_id} RETURNING request_id"
            )
            row = cur.fetchone()
            if row and amount:
                cur.execute(
                    f"INSERT INTO {schema}.payments "
                    f"(campaign_id, request_id, amount, days, kind, note) VALUES "
                    f"({campaign_id}, {row[0]}, {amount}, {days}, 'extend', '{note}')"
                )
            return json_response(200, {'ok': True})

        if action == 'save_group':
            group_id = body.get('id')
            city = esc(body.get('city', ''))[:120]
            chat_id = esc(body.get('chat_id', ''))[:64]
            members = esc(body.get('members', ''))[:64]
            slots = esc(body.get('slots', ''))[:64]
            is_active = 'true' if body.get('is_active', True) else 'false'
            sort_order = int(body.get('sort_order', 100))

            if not city:
                return json_response(400, {'error': 'Укажите город'})

            if group_id:
                cur.execute(
                    f"UPDATE {schema}.city_groups SET city = '{city}', chat_id = '{chat_id}', "
                    f"members = '{members}', slots = '{slots}', is_active = {is_active}, "
                    f"sort_order = {sort_order} WHERE id = {int(group_id)}"
                )
            else:
                cur.execute(
                    f"INSERT INTO {schema}.city_groups (city, chat_id, members, slots, is_active, sort_order) "
                    f"VALUES ('{city}', '{chat_id}', '{members}', '{slots}', {is_active}, {sort_order})"
                )
            return json_response(200, {'ok': True})

        if action == 'toggle_group':
            group_id = int(body.get('id', 0))
            cur.execute(
                f"UPDATE {schema}.city_groups SET is_active = NOT is_active WHERE id = {group_id}"
            )
            return json_response(200, {'ok': True})

        return json_response(400, {'error': 'Неизвестное действие'})
    finally:
        cur.close()
        conn.close()