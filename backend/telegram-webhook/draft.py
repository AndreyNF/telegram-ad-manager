"""Пошаговая подача объявления прямо в Telegram-боте."""
import json
import os
import uuid

import psycopg2

from telegram_client import call as call_telegram


PLANS = [
    ('hour', 'Час', 300, 1),
    ('day', 'Сутки', 2000, 1),
    ('week', 'Неделя', 5000, 7),
    ('month', 'Месяц', 10000, 30),
]

HOUR_PRESETS = [
    ('9-21', 'Днём 09:00 — 21:00', 9, 21),
    ('10-23', 'День и вечер 10:00 — 23:00', 10, 23),
    ('22-6', 'Ночью 22:00 — 06:00', 22, 6),
    ('0-23', 'Круглосуточно', 0, 23),
]


def esc(value) -> str:
    return str(value or '').replace("'", "''")


def db():
    conn = psycopg2.connect(os.environ['DATABASE_URL'])
    conn.autocommit = True
    return conn


def send(chat_id, text, buttons=None):
    """Шлёт сообщение с необязательной клавиатурой"""
    params = {'chat_id': chat_id, 'text': text}
    if buttons:
        params['reply_markup'] = json.dumps({'inline_keyboard': buttons})
    return call_telegram(os.environ['TELEGRAM_BOT_TOKEN'], 'sendMessage', params, budget=6.0)


def get_draft(cur, schema: str, chat_id):
    cur.execute(
        f"SELECT step, city, ad_text, photo_file_id, start_hour, end_hour, plan "
        f"FROM {schema}.bot_drafts WHERE chat_id = '{chat_id}'"
    )
    return cur.fetchone()


def clear_draft(cur, schema: str, chat_id):
    cur.execute(f"DELETE FROM {schema}.bot_drafts WHERE chat_id = '{chat_id}'")


UNPAID_LIMIT = 2


def count_unpaid(cur, schema: str, chat_id) -> int:
    """Считает заявки клиента без поступившей оплаты"""
    cur.execute(
        f"SELECT COUNT(*) FROM {schema}.ad_requests r "
        f"WHERE r.client_chat_id = '{chat_id}' AND r.status <> 'rejected' "
        f"AND NOT EXISTS (SELECT 1 FROM {schema}.payments p WHERE p.request_id = r.id)"
    )
    return int(cur.fetchone()[0] or 0)


def start_draft(schema: str, chat_id) -> None:
    """Начинает подачу объявления: показывает список городов"""
    conn = db()
    cur = conn.cursor()

    if count_unpaid(cur, schema, chat_id) >= UNPAID_LIMIT:
        cur.close()
        conn.close()
        send(chat_id,
             f'У вас уже {UNPAID_LIMIT} объявления без оплаты. Оплатите их — '
             f'и сможете подать новое.\n\nПосмотреть свои объявления — /cabinet')
        return

    cur.execute(
        f"SELECT city FROM {schema}.city_groups WHERE is_active = true "
        f"ORDER BY sort_order, city LIMIT 20"
    )
    cities = [r[0] for r in cur.fetchall()]

    if not cities:
        send(chat_id, 'Пока нет доступных городов. Загляните чуть позже.')
        cur.close()
        conn.close()
        return

    cur.execute(
        f"INSERT INTO {schema}.bot_drafts (chat_id, step, updated_at) "
        f"VALUES ('{chat_id}', 'city', CURRENT_TIMESTAMP) "
        f"ON CONFLICT (chat_id) DO UPDATE SET step = 'city', city = NULL, ad_text = NULL, "
        f"photo_file_id = NULL, plan = NULL, updated_at = CURRENT_TIMESTAMP"
    )
    cur.close()
    conn.close()

    buttons = [[{'text': c, 'callback_data': f'draft:city:{c}'}] for c in cities]
    buttons.append([{'text': 'Отменить', 'callback_data': 'draft:cancel'}])
    send(chat_id, 'Подаём объявление. В каком городе публикуем?', buttons)


def ask_text(chat_id, city):
    send(chat_id, f'Город: {city}\n\nТеперь пришлите текст объявления одним сообщением. '
                  f'Можно сразу отправить фото с подписью — так фото попадёт в объявление.')


def ask_hours(chat_id):
    buttons = [[{'text': label, 'callback_data': f'draft:hours:{key}'}]
               for key, label, _, _ in HOUR_PRESETS]
    buttons.append([{'text': 'Отменить', 'callback_data': 'draft:cancel'}])
    send(chat_id, 'В какое время публиковать? Время местное — по часовому поясу города.',
         buttons)


def ask_plan(chat_id):
    buttons = [[{'text': f'{label} — {price} ₽', 'callback_data': f'draft:plan:{key}'}]
               for key, label, price, _ in PLANS]
    buttons.append([{'text': 'Отменить', 'callback_data': 'draft:cancel'}])
    send(chat_id, 'Выберите тариф. Оплата за это объявление — реквизиты пришлём '
                  'после модерации.', buttons)


def save_step(cur, schema: str, chat_id, **fields):
    parts = [f"{k} = '{esc(v)}'" if isinstance(v, str) else f"{k} = {v}"
             for k, v in fields.items()]
    cur.execute(
        f"UPDATE {schema}.bot_drafts SET {', '.join(parts)}, updated_at = CURRENT_TIMESTAMP "
        f"WHERE chat_id = '{chat_id}'"
    )


def handle_text(schema: str, chat_id, text: str, photo_file_id: str = '') -> bool:
    """Принимает текст объявления, если клиент сейчас его вводит"""
    conn = db()
    cur = conn.cursor()
    draft = get_draft(cur, schema, chat_id)

    if not draft or draft[0] != 'text':
        cur.close()
        conn.close()
        return False

    if len(text.strip()) < 10:
        cur.close()
        conn.close()
        send(chat_id, 'Текст слишком короткий — напишите подробнее, что предлагаете.')
        return True

    fields = {'ad_text': text.strip()[:3000], 'step': 'hours'}
    if photo_file_id:
        fields['photo_file_id'] = photo_file_id
    save_step(cur, schema, chat_id, **fields)
    cur.close()
    conn.close()

    ask_hours(chat_id)
    return True


def submit(schema: str, chat_id, username: str, first_name: str) -> None:
    """Сохраняет готовую заявку и уведомляет админа"""
    conn = db()
    cur = conn.cursor()
    draft = get_draft(cur, schema, chat_id)
    if not draft:
        cur.close()
        conn.close()
        return

    if count_unpaid(cur, schema, chat_id) >= UNPAID_LIMIT:
        clear_draft(cur, schema, chat_id)
        cur.close()
        conn.close()
        send(chat_id, f'У вас уже {UNPAID_LIMIT} объявления без оплаты — '
                      f'новое можно подать после оплаты.')
        return

    _, city, ad_text, photo_fid, start_hour, end_hour, plan = draft
    token = uuid.uuid4().hex
    photo_sql = "'" + esc(photo_fid) + "'" if photo_fid else 'NULL'

    cur.execute(
        f"INSERT INTO {schema}.ad_requests "
        f"(city, contact, ad_text, pref_start_hour, pref_end_hour, public_token, "
        f" photo_file_id, plan, client_chat_id, client_username, client_name, client_notified) "
        f"VALUES ('{esc(city)}', '@{esc(username)}', '{esc(ad_text)}', {start_hour}, "
        f"{end_hour}, '{token}', {photo_sql}, "
        f"'{esc(plan)}', '{chat_id}', '{esc(username.lower())}', '{esc(first_name)}', true) "
        f"RETURNING id"
    )
    request_id = cur.fetchone()[0]
    clear_draft(cur, schema, chat_id)
    cur.close()
    conn.close()

    site = os.environ.get('SITE_URL', '').rstrip('/')
    plan_info = next((p for p in PLANS if p[0] == plan), None)
    plan_text = f'{plan_info[1]} — {plan_info[2]} ₽' if plan_info else plan

    buttons = None
    if site:
        buttons = [[{'text': 'Открыть личный кабинет', 'url': f'{site}/status/{token}'}]]

    send(chat_id,
         f'Заявка принята!\n\nГород: {city}\nВремя: {start_hour:02d}:00 — {end_hour:02d}:00\n'
         f'Тариф: {plan_text}\n\nМы проверим объявление и свяжемся с вами по оплате.',
         buttons)

    admin_chat = os.environ.get('TELEGRAM_ADMIN_CHAT_ID')
    if admin_chat:
        link = f'\n{site}/admin' if site else ''
        try:
            send(admin_chat,
                 f'Новая заявка из бота #{request_id}\n\nГород: {city}\n'
                 f'Клиент: @{username}\nТариф: {plan_text}\n'
                 f'Время: {start_hour:02d}:00 — {end_hour:02d}:00\n\n{ad_text[:500]}{link}')
        except Exception:
            pass


def handle_callback(schema: str, chat_id, data: str, username: str, first_name: str) -> None:
    """Обрабатывает нажатия кнопок в диалоге подачи"""
    parts = data.split(':', 2)
    if len(parts) < 2:
        return
    kind = parts[1]

    if kind == 'cancel':
        conn = db()
        cur = conn.cursor()
        clear_draft(cur, schema, chat_id)
        cur.close()
        conn.close()
        send(chat_id, 'Подача объявления отменена. Начать заново — команда /post')
        return

    value = parts[2] if len(parts) > 2 else ''
    conn = db()
    cur = conn.cursor()

    if kind == 'city':
        save_step(cur, schema, chat_id, city=value, step='text')
        cur.close()
        conn.close()
        ask_text(chat_id, value)
        return

    if kind == 'hours':
        preset = next((h for h in HOUR_PRESETS if h[0] == value), None)
        if preset:
            save_step(cur, schema, chat_id, start_hour=preset[2],
                      end_hour=preset[3], step='plan')
        cur.close()
        conn.close()
        ask_plan(chat_id)
        return

    if kind == 'plan':
        save_step(cur, schema, chat_id, plan=value, step='done')
        cur.close()
        conn.close()
        submit(schema, chat_id, username, first_name)
        return

    cur.close()
    conn.close()