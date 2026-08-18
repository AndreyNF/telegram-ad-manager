import json
import os

import psycopg2


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
            f"c.state, c.posts_sent, c.last_sent_at, c.expires_at, c.interval_minutes, c.id "
            f"FROM {schema}.ad_requests r "
            f"LEFT JOIN {schema}.campaigns c ON c.request_id = r.id AND c.state <> 'archived' "
            f"WHERE r.public_token = '{safe_token}' LIMIT 1"
        )
        row = cur.fetchone()
        if not row:
            return json_response(404, {'error': 'Объявление не найдено'})

        if method == 'POST':
            body = json.loads(event.get('body') or '{}')
            if body.get('action') == 'stop' and row[13]:
                cur.execute(
                    f"UPDATE {schema}.campaigns SET state = 'stopped', "
                    f"stopped_at = CURRENT_TIMESTAMP WHERE id = {int(row[13])}"
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
            'campaign': None if row[8] is None else {
                'state': row[8],
                'posts_sent': row[9],
                'last_sent_at': row[10],
                'expires_at': row[11],
                'interval_minutes': row[12],
            },
        })
    finally:
        cur.close()
        conn.close()
