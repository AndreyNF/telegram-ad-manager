import json
import os
import urllib.request

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


def f_quote(value) -> str:
    return "'" + esc(value)[:400] + "'"


def esc_html(value) -> str:
    return (str(value or '').replace('&', '&amp;')
            .replace('<', '&lt;').replace('>', '&gt;'))


def download_photo(url: str) -> tuple:
    """Скачивает фото, чтобы отправить его в Telegram файлом"""
    try:
        req = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0'})
        with urllib.request.urlopen(req, timeout=15) as resp:
            mime = resp.headers.get('Content-Type', 'image/jpeg').split(';')[0].strip()
            data = resp.read(10 * 1024 * 1024)
        if not data or not mime.startswith('image/'):
            return (b'', '')
        return (data, mime)
    except Exception:
        return (b'', '')


def build_post(ad_text: str, name: str, username: str) -> str:
    """Собирает текст объявления с именем автора и ссылкой на Telegram"""
    clean_user = (username or '').strip().lstrip('@')
    display = (name or '').strip()
    body = esc_html(ad_text)

    if clean_user:
        label = esc_html(display) if display else f'@{esc_html(clean_user)}'
        header = f'<b><a href="https://t.me/{clean_user}">{label}</a></b>'
        if display:
            header += f' · @{esc_html(clean_user)}'
    elif display:
        header = f'<b>{esc_html(display)}</b>'
    else:
        return body

    return f'{header}\n\n{body}'


def publish_now(token: str, chat_id: str, ad_text: str, photo_url: str,
                photo_file_id: str, name: str, username: str) -> tuple:
    """Публикует объявление в группу прямо сейчас. Возвращает (успех, заметка, file_id)"""
    text = build_post(ad_text, name, username)
    source = photo_file_id or photo_url

    try:
        if source:
            fits = len(text) <= 1024
            params = {'chat_id': chat_id, 'photo': source,
                      'caption': text if fits else ''}
            if fits:
                params['parse_mode'] = 'HTML'
            data = call_telegram(token, 'sendPhoto', params, timeout=20.0, budget=45.0)

            if not data.get('ok') and photo_file_id and photo_url:
                params['photo'] = photo_url
                data = call_telegram(token, 'sendPhoto', params, timeout=20.0, budget=45.0)

            if not data.get('ok') and photo_url:
                blob, mime = download_photo(photo_url)
                if blob:
                    upload = {k: v for k, v in params.items() if k != 'photo'}
                    data = call_telegram(
                        token, 'sendPhoto', upload, timeout=25.0, budget=50.0,
                        file_field='photo', file_bytes=blob,
                        filename='ad.jpg', mime=mime,
                    )

            if data.get('ok'):
                photos = ((data.get('result') or {}).get('photo')) or []
                fid = ''
                if photos:
                    fid = max(photos, key=lambda p: p.get('file_size') or 0).get('file_id', '')
                if not fits:
                    call_telegram(token, 'sendMessage',
                                  {'chat_id': chat_id, 'text': text, 'parse_mode': 'HTML'},
                                  timeout=8.0, budget=18.0)
                return (True, None, fid)

            note = str(data.get('description') or 'фото не отправлено')
            data = call_telegram(token, 'sendMessage',
                                 {'chat_id': chat_id, 'text': text, 'parse_mode': 'HTML'},
                                 timeout=8.0, budget=18.0)
            ok = bool(data.get('ok'))
            return (ok, f'фото не ушло: {note[:200]}' if ok else note[:300], '')

        data = call_telegram(token, 'sendMessage',
                             {'chat_id': chat_id, 'text': text, 'parse_mode': 'HTML'},
                             timeout=8.0, budget=18.0)
        return (bool(data.get('ok')), None if data.get('ok')
                else str(data.get('description'))[:300], '')
    except Exception as exc:
        return (False, str(exc)[:300], '')


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
        f"r.renew_plan, r.renew_at, "
        f"c.id, c.state, c.posts_sent, c.last_sent_at, c.last_error, c.expires_at, "
        f"c.interval_minutes, c.window_start_hour, c.window_end_hour, c.paused_until, "
        f"c.price_amount, c.paid_at, c.days_paid, c.tz_offset, "
        f"COALESCE((SELECT SUM(p.amount) FROM {schema}.payments p "
        f"          WHERE p.request_id = r.id), 0), "
        f"(SELECT COUNT(*) FROM {schema}.client_messages m "
        f" WHERE m.request_id = r.id AND m.direction = 'in' AND m.is_read = false) "
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
            'renew': None if row[20] is None else {
                'plan': row[19],
                'created_at': row[20],
            },
            'campaign': None if row[21] is None else {
                'id': row[21],
                'state': row[22],
                'posts_sent': row[23],
                'last_sent_at': row[24],
                'last_error': row[25],
                'expires_at': row[26],
                'interval_minutes': row[27],
                'window_start_hour': row[28],
                'window_end_hour': row[29],
                'paused_until': row[30],
                'price_amount': float(row[31]) if row[31] is not None else None,
                'paid_at': row[32],
                'days_paid': row[33],
                'tz_offset': row[34],
            },
            'total_paid': float(row[35] or 0),
            'unread': int(row[36] or 0),
        })

    cur.execute(
        f"SELECT id, city, chat_id, members, slots, is_active, sort_order, tz_offset "
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
        'tz_offset': g[7],
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


def list_chats(cur, schema: str) -> list:
    """Собирает переписки со всеми клиентами: последнее сообщение и непрочитанные"""
    cur.execute(
        f"SELECT r.id, r.city, r.contact, r.client_name, r.client_username, "
        f"       r.client_chat_id IS NOT NULL, r.public_token, "
        f"       m.text, m.direction, m.created_at, "
        f"       COALESCE(u.cnt, 0) "
        f"FROM {schema}.ad_requests r "
        f"LEFT JOIN LATERAL ("
        f"  SELECT text, direction, created_at FROM {schema}.client_messages "
        f"  WHERE request_id = r.id ORDER BY created_at DESC LIMIT 1"
        f") m ON true "
        f"LEFT JOIN LATERAL ("
        f"  SELECT COUNT(*) AS cnt FROM {schema}.client_messages "
        f"  WHERE request_id = r.id AND direction = 'in' AND is_read = false"
        f") u ON true "
        f"WHERE m.created_at IS NOT NULL OR r.client_chat_id IS NOT NULL "
        f"ORDER BY COALESCE(u.cnt, 0) > 0 DESC, m.created_at DESC NULLS LAST, r.id DESC "
        f"LIMIT 100"
    )
    return [{
        'id': c[0],
        'city': c[1],
        'contact': c[2],
        'client_name': c[3],
        'client_username': c[4],
        'can_write': bool(c[5]),
        'public_token': c[6],
        'last_text': c[7],
        'last_direction': c[8],
        'last_at': c[9],
        'unread': int(c[10] or 0),
    } for c in cur.fetchall()]


def deliver_to_client(cur, schema: str, request_id: int, text: str) -> dict:
    """Шлёт клиенту сообщение в Telegram и сохраняет его в переписке"""
    cur.execute(
        f"SELECT client_chat_id, contact, public_token FROM {schema}.ad_requests "
        f"WHERE id = {request_id}"
    )
    row = cur.fetchone()
    if not row:
        return json_response(404, {'error': 'Заявка не найдена'})

    chat_id, contact, public_token = row
    if not chat_id:
        return json_response(400, {
            'error': f'Клиент {contact} не запускал бота — доставить сообщение нельзя'
        })

    token = os.environ.get('TELEGRAM_BOT_TOKEN')
    if not token:
        return json_response(500, {'error': 'Бот не настроен'})

    site = os.environ.get('SITE_URL', '').rstrip('/')
    params = {'chat_id': chat_id, 'text': text}
    if site and public_token:
        params['reply_markup'] = json.dumps({'inline_keyboard': [[{
            'text': 'Открыть личный кабинет',
            'url': f'{site}/status/{public_token}',
        }]]})

    try:
        data = call_telegram(token, 'sendMessage', params, budget=6.0)
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
                req_id = int(messages_for)
                cur.execute(
                    f"SELECT direction, text, created_at FROM {schema}.client_messages "
                    f"WHERE request_id = {req_id} ORDER BY created_at LIMIT 100"
                )
                messages = [
                    {'direction': m[0], 'text': m[1], 'created_at': m[2]}
                    for m in cur.fetchall()
                ]
                cur.execute(
                    f"UPDATE {schema}.client_messages SET is_read = true "
                    f"WHERE request_id = {req_id} AND direction = 'in' AND is_read = false"
                )
                return json_response(200, {'messages': messages})

            if params.get('chats'):
                return json_response(200, {'chats': list_chats(cur, schema)})

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

        if action == 'test_post':
            campaign_id = int(body.get('campaign_id', 0))
            cur.execute(
                f"SELECT r.ad_text, r.photo_url, r.photo_file_id, g.chat_id, "
                f"COALESCE(NULLIF(r.client_name, ''), u.first_name), "
                f"COALESCE(NULLIF(r.client_username, ''), u.username, "
                f"         lower(ltrim(r.contact, '@'))), r.id "
                f"FROM {schema}.campaigns c "
                f"JOIN {schema}.ad_requests r ON r.id = c.request_id "
                f"LEFT JOIN {schema}.city_groups g ON g.city = c.city "
                f"LEFT JOIN {schema}.telegram_users u ON u.chat_id = r.client_chat_id "
                f"WHERE c.id = {campaign_id}"
            )
            row = cur.fetchone()
            if not row:
                return json_response(404, {'error': 'Открутка не найдена'})
            if not row[3]:
                return json_response(400, {'error': 'У города не указана группа Telegram'})

            token_bot = os.environ.get('TELEGRAM_BOT_TOKEN')
            if not token_bot:
                return json_response(500, {'error': 'Бот не настроен'})

            ok, err, file_id = publish_now(
                token_bot, row[3], row[0], row[1], row[2], row[4], row[5]
            )
            if ok:
                if file_id:
                    cur.execute(
                        f"UPDATE {schema}.ad_requests SET photo_file_id = '{esc(file_id)}' "
                        f"WHERE id = {int(row[6])}"
                    )
                cur.execute(
                    f"UPDATE {schema}.campaigns SET posts_sent = posts_sent + 1, "
                    f"last_sent_at = CURRENT_TIMESTAMP, last_error = "
                    f"{f_quote(err) if err else 'NULL'} WHERE id = {campaign_id}"
                )
                return json_response(200, {'ok': True, 'warning': err})

            cur.execute(
                f"UPDATE {schema}.campaigns SET last_error = {f_quote(err or 'Ошибка')} "
                f"WHERE id = {campaign_id}"
            )
            return json_response(502, {'error': err or 'Не удалось опубликовать'})

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
                f"SELECT r.city, r.pref_start_hour, r.pref_end_hour, "
                f"COALESCE(g.tz_offset, 3) FROM {schema}.ad_requests r "
                f"LEFT JOIN {schema}.city_groups g ON g.city = r.city "
                f"WHERE r.id = {request_id}"
            )
            row = cur.fetchone()
            if not row:
                return json_response(404, {'error': 'Заявка не найдена'})
            city, win_start, win_end, tz_offset = row

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
                f"window_start_hour, window_end_hour, tz_offset, price_amount, paid_at, "
                f"payment_note) VALUES "
                f"({request_id}, '{esc(city)}', {interval}, 'running', CURRENT_TIMESTAMP, {days}, "
                f"CURRENT_TIMESTAMP + INTERVAL '{days} days', {win_start}, {win_end}, "
                f"{int(tz_offset)}, {amount if amount else 'NULL'}, {paid_sql}, '{note}') "
                f"RETURNING id"
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
            if row:
                request_id = row[0]
                if amount:
                    cur.execute(
                        f"INSERT INTO {schema}.payments "
                        f"(campaign_id, request_id, amount, days, kind, note) VALUES "
                        f"({campaign_id}, {request_id}, {amount}, {days}, 'extend', '{note}')"
                    )
                cur.execute(
                    f"UPDATE {schema}.ad_requests SET renew_plan = NULL, renew_at = NULL "
                    f"WHERE id = {request_id}"
                )

                cur.execute(
                    f"SELECT client_chat_id, public_token, city FROM {schema}.ad_requests "
                    f"WHERE id = {request_id}"
                )
                info = cur.fetchone()
                token_bot = os.environ.get('TELEGRAM_BOT_TOKEN')
                site = os.environ.get('SITE_URL', '').rstrip('/')
                if info and info[0] and token_bot:
                    msg = (f'Показы продлены на {days} дн. Объявление ({info[2]}) '
                           f'продолжает публиковаться.')
                    params = {'chat_id': info[0], 'text': msg}
                    if site and info[1]:
                        params['reply_markup'] = json.dumps({'inline_keyboard': [[{
                            'text': 'Открыть личный кабинет',
                            'url': f'{site}/status/{info[1]}',
                        }]]})
                    try:
                        call_telegram(token_bot, 'sendMessage', params, budget=5.0)
                        cur.execute(
                            f"INSERT INTO {schema}.client_messages (request_id, direction, text) "
                            f"VALUES ({request_id}, 'out', '{esc(msg)}')"
                        )
                    except Exception:
                        pass
            return json_response(200, {'ok': True})

        if action == 'save_group':
            group_id = body.get('id')
            city = esc(body.get('city', ''))[:120]
            chat_id = esc(body.get('chat_id', ''))[:64]
            members = esc(body.get('members', ''))[:64]
            slots = esc(body.get('slots', ''))[:64]
            is_active = 'true' if body.get('is_active', True) else 'false'
            sort_order = int(body.get('sort_order', 100))
            tz_offset = max(2, min(int(body.get('tz_offset', 3) or 3), 12))

            if not city:
                return json_response(400, {'error': 'Укажите город'})

            if group_id:
                cur.execute(
                    f"UPDATE {schema}.city_groups SET city = '{city}', chat_id = '{chat_id}', "
                    f"members = '{members}', slots = '{slots}', is_active = {is_active}, "
                    f"sort_order = {sort_order}, tz_offset = {tz_offset} "
                    f"WHERE id = {int(group_id)}"
                )
                cur.execute(
                    f"UPDATE {schema}.campaigns SET tz_offset = {tz_offset}, "
                    f"next_run_at = CURRENT_TIMESTAMP "
                    f"WHERE city = '{city}' AND state <> 'archived'"
                )
            else:
                cur.execute(
                    f"INSERT INTO {schema}.city_groups "
                    f"(city, chat_id, members, slots, is_active, sort_order, tz_offset) "
                    f"VALUES ('{city}', '{chat_id}', '{members}', '{slots}', {is_active}, "
                    f"{sort_order}, {tz_offset})"
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