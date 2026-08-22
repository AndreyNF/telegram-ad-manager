import hashlib
import json
import os
import urllib.parse

import psycopg2

from telegram_client import call as call_telegram


CORS_HEADERS = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Max-Age': '86400',
    'Content-Type': 'application/json',
}

PLANS = {
    'hour': ('Час', 300, 1),
    'day': ('Сутки', 2000, 1),
    'week': ('Неделя', 5000, 7),
    'month': ('Месяц', 10000, 30),
}

PAY_URL = 'https://anypay.io/merchant/pay'


def esc(value) -> str:
    return str(value or '').replace("'", "''")


def json_response(status: int, payload: dict) -> dict:
    return {
        'statusCode': status,
        'headers': CORS_HEADERS,
        'body': json.dumps(payload, ensure_ascii=False),
        'isBase64Encoded': False,
    }


def text_response(status: int, text: str) -> dict:
    return {
        'statusCode': status,
        'headers': {'Access-Control-Allow-Origin': '*', 'Content-Type': 'text/plain'},
        'body': text,
        'isBase64Encoded': False,
    }


def db():
    conn = psycopg2.connect(os.environ['DATABASE_URL'])
    conn.autocommit = True
    return conn


def amount_str(amount) -> str:
    return f'{float(amount):.2f}'


def build_pay_url(order_id: int, amount, desc: str, email: str = '') -> str:
    """Собирает ссылку на оплату AnyPay с подписью магазина"""
    merchant = os.environ['ANYPAY_MERCHANT_ID'].strip()
    secret = os.environ['ANYPAY_SECRET_KEY'].strip()
    total = amount_str(amount)
    sign = hashlib.sha256(
        f'{merchant}:{total}:{secret}:RUB:{desc}:{order_id}'.encode()
    ).hexdigest()
    params = {
        'sign': sign,
        'currency': 'RUB',
        'desc': desc,
    }
    if email:
        params['email'] = email
    url = f'{PAY_URL}/{merchant}/{order_id}/{total}/RUB/'
    return url + '?' + urllib.parse.urlencode(params)


def notify_admin(text: str) -> None:
    token = os.environ.get('TELEGRAM_BOT_TOKEN')
    chat_id = os.environ.get('TELEGRAM_ADMIN_CHAT_ID')
    if not (token and chat_id):
        return
    try:
        call_telegram(token, 'sendMessage', {'chat_id': chat_id, 'text': text}, budget=4.0)
    except Exception:
        pass


def notify_client(chat_id, text: str) -> None:
    token = os.environ.get('TELEGRAM_BOT_TOKEN')
    if not (token and chat_id):
        return
    try:
        call_telegram(token, 'sendMessage', {'chat_id': chat_id, 'text': text}, budget=4.0)
    except Exception:
        pass


def create_order(schema: str, body: dict) -> dict:
    """Создаёт заказ на оплату и возвращает ссылку на платёжную страницу"""
    token = (body.get('token') or '').strip()
    plan = (body.get('plan') or '').strip().lower()
    if not token or plan not in PLANS:
        return json_response(400, {'error': 'Укажите объявление и тариф'})

    if not os.environ.get('ANYPAY_MERCHANT_ID'):
        return json_response(503, {'error': 'Онлайн-оплата ещё не настроена'})

    conn = db()
    cur = conn.cursor()
    try:
        cur.execute(
            f"SELECT r.id, r.city, c.id FROM {schema}.ad_requests r "
            f"LEFT JOIN {schema}.campaigns c ON c.request_id = r.id "
            f"  AND c.state <> 'archived' "
            f"WHERE r.public_token = '{esc(token)}' LIMIT 1"
        )
        row = cur.fetchone()
        if not row:
            return json_response(404, {'error': 'Объявление не найдено'})

        request_id, city, campaign_id = row[0], row[1], row[2]
        label, price, days = PLANS[plan]
        kind = 'extend' if campaign_id else 'start'

        cur.execute(
            f"INSERT INTO {schema}.payment_orders "
            f"(request_id, plan, days, amount, kind) VALUES "
            f"({int(request_id)}, '{esc(plan)}', {int(days)}, {int(price)}, '{kind}') "
            f"RETURNING id"
        )
        order_id = cur.fetchone()[0]
    finally:
        cur.close()
        conn.close()

    desc = f'Размещение объявления, {label}'
    return json_response(200, {
        'ok': True,
        'order_id': order_id,
        'amount': price,
        'plan_label': label,
        'city': city,
        'pay_url': build_pay_url(order_id, price, desc),
    })


def apply_payment(schema: str, order_id: int, amount: str, operation_id: str) -> str:
    """Включает или продлевает показы после подтверждённой оплаты"""
    conn = db()
    cur = conn.cursor()
    try:
        cur.execute(
            f"SELECT request_id, plan, days, amount, kind, status "
            f"FROM {schema}.payment_orders WHERE id = {int(order_id)}"
        )
        order = cur.fetchone()
        if not order:
            return 'no order'
        if order[5] == 'paid':
            return 'YES'

        expected = amount_str(order[3])
        if amount_str(amount) != expected:
            return 'wrong amount'

        request_id, plan, days, price = int(order[0]), order[1], int(order[2]), order[3]

        cur.execute(
            f"UPDATE {schema}.payment_orders SET status = 'paid', "
            f"paid_at = CURRENT_TIMESTAMP, fk_operation_id = '{esc(operation_id)[:64]}' "
            f"WHERE id = {int(order_id)}"
        )

        cur.execute(
            f"SELECT r.city, r.pref_start_hour, r.pref_end_hour, "
            f"COALESCE(g.tz_offset, 3), r.client_chat_id, c.id "
            f"FROM {schema}.ad_requests r "
            f"LEFT JOIN {schema}.city_groups g ON g.city = r.city "
            f"LEFT JOIN {schema}.campaigns c ON c.request_id = r.id "
            f"  AND c.state <> 'archived' "
            f"WHERE r.id = {request_id} LIMIT 1"
        )
        info = cur.fetchone()
        if not info:
            return 'no request'

        city, win_start, win_end, tz_offset, client_chat, campaign_id = info

        if campaign_id:
            cur.execute(
                f"UPDATE {schema}.campaigns SET expires_at = "
                f"GREATEST(COALESCE(expires_at, CURRENT_TIMESTAMP), CURRENT_TIMESTAMP) "
                f"+ INTERVAL '{days} days', state = 'running', reminder_sent_at = NULL, "
                f"days_paid = COALESCE(days_paid, 0) + {days}, "
                f"price_amount = COALESCE(price_amount, 0) + {price}, "
                f"paid_at = CURRENT_TIMESTAMP, payment_note = 'AnyPay', "
                f"next_run_at = CURRENT_TIMESTAMP, fail_streak = 0, last_error = NULL "
                f"WHERE id = {int(campaign_id)}"
            )
            kind_sql = 'extend'
        else:
            cur.execute(
                f"INSERT INTO {schema}.campaigns "
                f"(request_id, city, interval_minutes, state, next_run_at, days_paid, "
                f" expires_at, window_start_hour, window_end_hour, tz_offset, price_amount, "
                f" paid_at, payment_note) VALUES "
                f"({request_id}, '{esc(city)}', 15, 'running', CURRENT_TIMESTAMP, {days}, "
                f"CURRENT_TIMESTAMP + INTERVAL '{days} days', {int(win_start)}, "
                f"{int(win_end)}, {int(tz_offset)}, {price}, CURRENT_TIMESTAMP, "
                f"'AnyPay') RETURNING id"
            )
            campaign_id = cur.fetchone()[0]
            cur.execute(
                f"UPDATE {schema}.ad_requests SET status = 'approved' WHERE id = {request_id}"
            )
            kind_sql = 'start'

        cur.execute(
            f"INSERT INTO {schema}.payments "
            f"(campaign_id, request_id, amount, days, kind, note) VALUES "
            f"({int(campaign_id)}, {request_id}, {price}, {days}, '{kind_sql}', "
            f"'AnyPay #{esc(operation_id)[:40]}')"
        )
        cur.execute(
            f"UPDATE {schema}.ad_requests SET renew_plan = NULL, renew_at = NULL "
            f"WHERE id = {request_id}"
        )
    finally:
        cur.close()
        conn.close()

    label = PLANS.get(plan, (plan, 0, 0))[0]
    notify_admin(f'Оплата получена: заявка #{request_id} ({city})\n'
                 f'Тариф: {label} — {amount_str(price)} ₽\nПоказы запущены автоматически.')
    notify_client(client_chat,
                  f'Оплата получена! Показы объявления ({city}) активны '
                  f'ещё {days} дн.')
    return 'YES'


def parse_form(event: dict) -> dict:
    """Разбирает уведомление AnyPay, присланное как form-data"""
    raw = event.get('body') or ''
    if event.get('isBase64Encoded'):
        import base64
        raw = base64.b64decode(raw).decode('utf-8', errors='ignore')
    data = {}
    for key, values in urllib.parse.parse_qs(raw).items():
        data[key] = values[0] if values else ''
    return data


def handler(event: dict, context) -> dict:
    """Онлайн-оплата AnyPay: создаёт ссылку на оплату и принимает уведомления
    о платеже, автоматически запуская или продлевая показы объявления"""
    method = event.get('httpMethod', 'GET')

    if method == 'OPTIONS':
        return {'statusCode': 200, 'headers': CORS_HEADERS, 'body': ''}

    schema = os.environ.get('MAIN_DB_SCHEMA', 'public')
    params = event.get('queryStringParameters') or {}

    if method == 'GET':
        return json_response(200, {
            'ok': True,
            'configured': bool(os.environ.get('ANYPAY_MERCHANT_ID')),
        })

    if params.get('notify') == '1' or params.get('action') == 'notify':
        data = parse_form(event)
        if not data:
            data = json.loads(event.get('body') or '{}')

        merchant = os.environ.get('ANYPAY_MERCHANT_ID', '').strip()
        secret = os.environ.get('ANYPAY_SECRET_KEY', '').strip()
        order_id = data.get('pay_id', '')
        amount = data.get('amount', '')
        currency = data.get('currency', 'RUB')

        expected = hashlib.sha256(
            f"{amount}:{currency}:{secret}:{merchant}:{order_id}".encode()
        ).hexdigest()
        if expected != (data.get('sign') or '').lower():
            return text_response(400, 'wrong sign')
        if data.get('merchant_id', '') != merchant:
            return text_response(400, 'wrong merchant')
        if not str(order_id).isdigit():
            return text_response(400, 'wrong order')

        result = apply_payment(schema, int(order_id), amount, str(order_id))
        return text_response(200 if result == 'YES' else 400, 'OK' if result == 'YES' else result)

    body = json.loads(event.get('body') or '{}')
    if (body.get('action') or 'create') == 'create':
        return create_order(schema, body)

    return json_response(400, {'error': 'Неизвестное действие'})