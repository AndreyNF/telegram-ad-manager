import datetime
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


def with_author(ad_text: str, name: str, username: str) -> str:
    """Ставит в начало объявления имя автора и ссылку на его Telegram"""
    clean_user = (username or '').strip().lstrip('@')
    display = (name or '').strip()

    if display and clean_user:
        header = f'{display} — @{clean_user}'
    elif clean_user:
        header = f'@{clean_user}'
    elif display:
        header = display
    else:
        return ad_text

    if ad_text.lstrip().startswith(header):
        return ad_text
    return f'{header}\n\n{ad_text}'


def extract_file_id(data: dict) -> str:
    """Достаёт file_id самой крупной версии отправленного фото"""
    photos = ((data.get('result') or {}).get('photo')) or []
    if not photos:
        return ''
    best = max(photos, key=lambda p: p.get('file_size') or 0)
    return best.get('file_id') or ''


def send_message(token: str, chat_id: str, text: str, photo_url: str = None,
                 photo_file_id: str = None, cabinet_url: str = '') -> tuple:
    """Отправляет сообщение или фото с подписью в чат. Возвращает (успех, ошибка, file_id)"""
    keyboard = None
    if cabinet_url:
        keyboard = json.dumps({'inline_keyboard': [[{
            'text': 'Открыть личный кабинет',
            'url': cabinet_url,
        }]]})

    try:
        source = photo_file_id or photo_url
        if source:
            fits = len(text) <= 1024
            data = call_telegram(token, 'sendPhoto', {
                'chat_id': chat_id,
                'photo': source,
                'caption': text if fits else '',
            }, timeout=8.0, budget=20.0)

            if not data.get('ok') and photo_file_id and photo_url:
                data = call_telegram(token, 'sendPhoto', {
                    'chat_id': chat_id,
                    'photo': photo_url,
                    'caption': text if fits else '',
                }, timeout=8.0, budget=20.0)

            if data.get('ok'):
                if not fits:
                    call_telegram(token, 'sendMessage', {'chat_id': chat_id, 'text': text})
                return (True, None, extract_file_id(data))

            note = str(data.get('description') or 'фото не отправлено')
            data = call_telegram(token, 'sendMessage', {'chat_id': chat_id, 'text': text})
            ok = bool(data.get('ok'))
            return (ok, f'фото не ушло: {note[:200]}' if ok else note[:300], '')

        params = {'chat_id': chat_id, 'text': text}
        if keyboard:
            params['reply_markup'] = keyboard
        data = call_telegram(token, 'sendMessage', params)
        return (bool(data.get('ok')), None if data.get('ok') else str(data.get('description')), '')
    except Exception as exc:
        return (False, str(exc)[:400], '')


def send_expiry_reminders(cur, schema: str, token: str) -> int:
    """Шлёт напоминания за сутки до конца оплаченного срока: админу и клиенту"""
    admin_chat = os.environ.get('TELEGRAM_ADMIN_CHAT_ID')
    site = os.environ.get('SITE_URL', '').rstrip('/')

    cur.execute(
        f"SELECT c.id, c.city, c.expires_at, r.ad_text, r.contact, r.public_token, r.client_chat_id "
        f"FROM {schema}.campaigns c "
        f"JOIN {schema}.ad_requests r ON r.id = c.request_id "
        f"WHERE c.state = 'running' AND c.reminder_sent_at IS NULL "
        f"AND c.expires_at IS NOT NULL "
        f"AND c.expires_at <= CURRENT_TIMESTAMP + INTERVAL '24 hours' "
        f"AND c.expires_at > CURRENT_TIMESTAMP LIMIT 20"
    )
    rows = cur.fetchall()
    sent = 0

    for campaign_id, city, expires_at, ad_text, contact, public_token, client_chat_id in rows:
        until = expires_at.strftime('%d.%m.%Y %H:%M') if expires_at else ''
        preview = ad_text if len(ad_text) <= 600 else ad_text[:600] + '...'
        status_link = f"\n\nСтатус объявления: {site}/status/{public_token}" if site and public_token else ''
        notes = []

        admin_text = (
            f"Открутка заканчивается через сутки\n\n"
            f"Город: {city}\nКлиент: {contact}\nОкончание: {until}\n\n{preview}{status_link}"
        )
        client_text = (
            f"Ваше объявление скоро перестанет публиковаться\n\n"
            f"Город: {city}\nОкончание: {until}\n\n{preview}\n\n"
            f"Чтобы продолжить показы, продлите тариф в личном кабинете."
        )

        if admin_chat:
            ok, err, _ = send_message(token, admin_chat, admin_text)
            if not ok:
                notes.append(f'админ: {err}')
        else:
            notes.append('админ: не задан чат')

        if client_chat_id:
            cabinet = f'{site}/status/{public_token}' if site and public_token else ''
            ok, err, _ = send_message(token, client_chat_id, client_text,
                                      cabinet_url=cabinet)
            if not ok:
                notes.append(f'клиент: {err}')
        else:
            notes.append('клиент: не запускал бота')

        note = '; '.join(notes)[:400].replace("'", "''")
        note_sql = f"'{note}'" if note else 'NULL'
        cur.execute(
            f"UPDATE {schema}.campaigns "
            f"SET reminder_sent_at = CURRENT_TIMESTAMP, reminder_note = {note_sql} "
            f"WHERE id = {campaign_id}"
        )
        sent += 1

    return sent


def minutes_until_window(utc_hour: int, utc_minute: int, start: int, end: int, tz_offset: int) -> int:
    """Возвращает 0, если сейчас внутри разрешённого окна, иначе минуты до его начала"""
    if start == end:
        return 0

    local_minutes = ((utc_hour + tz_offset) % 24) * 60 + utc_minute
    start_minutes = start * 60
    end_minutes = end * 60

    if start < end:
        inside = start_minutes <= local_minutes < end_minutes
    else:
        inside = local_minutes >= start_minutes or local_minutes < end_minutes

    if inside:
        return 0

    delta = start_minutes - local_minutes
    if delta <= 0:
        delta += 24 * 60
    return delta


def handler(event: dict, context) -> dict:
    """Публикатор: шлёт объявления по расписанию, соблюдает окно публикации и останавливает открутки с истёкшим тарифом"""
    method = event.get('httpMethod', 'GET')

    if method == 'OPTIONS':
        return {'statusCode': 200, 'headers': CORS_HEADERS, 'body': ''}

    token = os.environ.get('TELEGRAM_BOT_TOKEN')
    if not token:
        return {
            'statusCode': 200,
            'headers': CORS_HEADERS,
            'body': json.dumps({'ok': False, 'error': 'Не задан токен бота', 'sent': 0}, ensure_ascii=False),
            'isBase64Encoded': False,
        }

    schema = os.environ.get('MAIN_DB_SCHEMA', 'public')
    conn = psycopg2.connect(os.environ['DATABASE_URL'])
    conn.autocommit = True
    cur = conn.cursor()

    cur.execute(
        f"UPDATE {schema}.campaigns SET state = 'expired', stopped_at = CURRENT_TIMESTAMP "
        f"WHERE state = 'running' AND expires_at IS NOT NULL AND expires_at <= CURRENT_TIMESTAMP "
        f"RETURNING request_id"
    )
    expired_rows = cur.fetchall()
    expired = len(expired_rows)

    if expired_rows:
        site_url = os.environ.get('SITE_URL', '').rstrip('/')
        ids = ', '.join(str(int(r[0])) for r in expired_rows)
        cur.execute(
            f"SELECT id, city, client_chat_id, public_token FROM {schema}.ad_requests "
            f"WHERE id IN ({ids}) AND client_chat_id IS NOT NULL"
        )
        for req_id, city, chat, pub_token in cur.fetchall():
            cabinet = f'{site_url}/status/{pub_token}' if site_url and pub_token else ''
            send_message(
                token, chat,
                f'Показы объявления ({city}) закончились.\n\n'
                f'Чтобы возобновить публикации, продлите тариф в личном кабинете.',
                cabinet_url=cabinet,
            )

    try:
        reminders = send_expiry_reminders(cur, schema, token)
    except Exception:
        reminders = 0

    now_utc = datetime.datetime.now(datetime.timezone.utc)
    utc_hour, utc_minute = now_utc.hour, now_utc.minute

    cur.execute(
        f"UPDATE {schema}.campaigns SET paused_until = NULL "
        f"WHERE paused_until IS NOT NULL AND paused_until <= CURRENT_TIMESTAMP"
    )

    cur.execute(
        f"WITH due AS ("
        f"  SELECT id, interval_minutes FROM {schema}.campaigns "
        f"  WHERE state = 'running' AND next_run_at <= CURRENT_TIMESTAMP "
        f"  AND (paused_until IS NULL OR paused_until <= CURRENT_TIMESTAMP) "
        f"  ORDER BY next_run_at LIMIT 10 FOR UPDATE SKIP LOCKED"
        f"), claimed AS ("
        f"  UPDATE {schema}.campaigns c "
        f"  SET next_run_at = CASE "
        f"    WHEN c.next_run_at + (due.interval_minutes || ' minutes')::interval > CURRENT_TIMESTAMP "
        f"      THEN c.next_run_at + (due.interval_minutes || ' minutes')::interval "
        f"    ELSE CURRENT_TIMESTAMP + (due.interval_minutes || ' minutes')::interval "
        f"  END "
        f"  FROM due WHERE c.id = due.id "
        f"  RETURNING c.id, c.interval_minutes, c.request_id, c.city, "
        f"           c.window_start_hour, c.window_end_hour, c.tz_offset"
        f") "
        f"SELECT cl.id, cl.interval_minutes, r.ad_text, g.chat_id, "
        f"       cl.window_start_hour, cl.window_end_hour, cl.tz_offset, r.photo_url, "
        f"       cl.request_id, r.photo_file_id, "
        f"       COALESCE(NULLIF(r.client_name, ''), u.first_name), "
        f"       COALESCE(NULLIF(r.client_username, ''), u.username, "
        f"                lower(ltrim(r.contact, '@'))) "
        f"FROM claimed cl "
        f"JOIN {schema}.ad_requests r ON r.id = cl.request_id "
        f"LEFT JOIN {schema}.city_groups g ON g.city = cl.city "
        f"LEFT JOIN {schema}.telegram_users u ON u.chat_id = r.client_chat_id"
    )
    rows = cur.fetchall()

    sent = 0
    errors = 0
    postponed = 0
    for (campaign_id, interval, ad_text, chat_id, win_start, win_end, tz_offset,
         photo_url, request_id, photo_file_id, client_name, client_username) in rows:
        delay = minutes_until_window(utc_hour, utc_minute, win_start, win_end, tz_offset)
        if delay > 0:
            postponed += 1
            cur.execute(
                f"UPDATE {schema}.campaigns "
                f"SET next_run_at = CURRENT_TIMESTAMP + INTERVAL '{delay} minutes' "
                f"WHERE id = {campaign_id}"
            )
            continue

        if not chat_id:
            cur.execute(
                f"UPDATE {schema}.campaigns SET state = 'stopped', stopped_at = CURRENT_TIMESTAMP, "
                f"last_error = 'Не указана группа города' WHERE id = {campaign_id}"
            )
            errors += 1
            continue

        full_text = with_author(ad_text, client_name, client_username)
        ok, error, file_id = send_message(token, chat_id, full_text, photo_url, photo_file_id)
        if ok:
            sent += 1
            if file_id and file_id != photo_file_id:
                safe_fid = file_id.replace("'", "''")[:300]
                cur.execute(
                    f"UPDATE {schema}.ad_requests SET photo_file_id = '{safe_fid}' "
                    f"WHERE id = {request_id}"
                )
            warn = f"'{error.replace(chr(39), chr(39) * 2)[:400]}'" if error else 'NULL'
            cur.execute(
                f"UPDATE {schema}.campaigns SET posts_sent = posts_sent + 1, "
                f"last_sent_at = CURRENT_TIMESTAMP, last_error = {warn}, fail_streak = 0 "
                f"WHERE id = {campaign_id}"
            )
        else:
            errors += 1
            safe_error = (error or 'Ошибка отправки').replace("'", "''")[:400]
            cur.execute(
                f"UPDATE {schema}.campaigns SET last_error = '{safe_error}', "
                f"fail_streak = fail_streak + 1 WHERE id = {campaign_id}"
            )
            cur.execute(
                f"UPDATE {schema}.campaigns SET state = 'stopped', stopped_at = CURRENT_TIMESTAMP "
                f"WHERE id = {campaign_id} AND fail_streak >= 5"
            )

    cur.execute(
        f"INSERT INTO {schema}.runner_heartbeat (id, last_run_at, last_sent) "
        f"VALUES (1, CURRENT_TIMESTAMP, {sent}) "
        f"ON CONFLICT (id) DO UPDATE SET last_run_at = CURRENT_TIMESTAMP, last_sent = {sent}"
    )

    cur.close()
    conn.close()

    return {
        'statusCode': 200,
        'headers': CORS_HEADERS,
        'body': json.dumps({
            'ok': True,
            'sent': sent,
            'errors': errors,
            'postponed': postponed,
            'expired': expired,
            'reminders': reminders,
        }, ensure_ascii=False),
        'isBase64Encoded': False,
    }