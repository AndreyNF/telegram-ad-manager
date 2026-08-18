import json
import os

import psycopg2


CORS_HEADERS = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, X-Admin-Password',
    'Access-Control-Max-Age': '86400',
    'Content-Type': 'application/json',
}


def esc(value) -> str:
    return str(value or '').replace("'", "''")


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
        f"c.id, c.state, c.posts_sent, c.last_sent_at, c.last_error, c.expires_at, "
        f"c.interval_minutes, c.window_start_hour, c.window_end_hour "
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
            'campaign': None if row[11] is None else {
                'id': row[11],
                'state': row[12],
                'posts_sent': row[13],
                'last_sent_at': row[14],
                'last_error': row[15],
                'expires_at': row[16],
                'interval_minutes': row[17],
                'window_start_hour': row[18],
                'window_end_hour': row[19],
            },
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

    return {'requests': requests, 'groups': groups}


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
            return json_response(200, list_data(cur, schema))

        body = json.loads(event.get('body') or '{}')
        action = body.get('action', '')

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
            cur.execute(
                f"INSERT INTO {schema}.campaigns "
                f"(request_id, city, interval_minutes, state, next_run_at, days_paid, expires_at, "
                f"window_start_hour, window_end_hour) VALUES "
                f"({request_id}, '{esc(city)}', {interval}, 'running', CURRENT_TIMESTAMP, {days}, "
                f"CURRENT_TIMESTAMP + INTERVAL '{days} days', {win_start}, {win_end}) RETURNING id"
            )
            campaign_id = cur.fetchone()[0]
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

        if action == 'extend':
            campaign_id = int(body.get('campaign_id', 0))
            days = max(1, min(int(body.get('days', 30)), 365))
            cur.execute(
                f"UPDATE {schema}.campaigns SET "
                f"expires_at = GREATEST(COALESCE(expires_at, CURRENT_TIMESTAMP), CURRENT_TIMESTAMP) "
                f"+ INTERVAL '{days} days', state = 'running', reminder_sent_at = NULL "
                f"WHERE id = {campaign_id}"
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
