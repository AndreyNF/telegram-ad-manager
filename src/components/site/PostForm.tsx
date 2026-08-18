import { useState, useEffect } from 'react';
import Icon from '@/components/ui/icon';
import useCities from '@/hooks/useCities';
import { API, BOT_URL, hourLabel } from '@/lib/api';
import { PLANS } from './Pricing';
import preparePhoto from '@/lib/photo';

const HOURS = Array.from({ length: 24 }, (_, i) => i);

const PostForm = () => {
  const { cities } = useCities();
  const [sent, setSent] = useState(false);
  const [statusToken, setStatusToken] = useState('');
  const [clientNotified, setClientNotified] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [needBot, setNeedBot] = useState(false);
  const [photo, setPhoto] = useState<{ name: string; type: string; data: string } | null>(null);
  const [form, setForm] = useState({
    city: '',
    contact: '',
    text: '',
    start_hour: 9,
    end_hour: 21,
    plan: 'week',
  });

  useEffect(() => {
    if (!form.city && cities.length > 0) {
      setForm((prev) => ({ ...prev, city: cities[0].city }));
    }
  }, [cities]);

  const selectedCity = cities.find((c) => c.city === form.city);
  const tzLabel = selectedCity
    ? selectedCity.tz_offset === 3
      ? 'МСК'
      : `МСК${selectedCity.tz_offset > 3 ? '+' : ''}${selectedCity.tz_offset - 3}`
    : '';

  const pickPhoto = async (file: File | undefined) => {
    if (!file) return;
    setError('');
    try {
      setPhoto(await preparePhoto(file));
    } catch {
      setError('Не удалось обработать фото');
    }
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const res = await fetch(API.adRequests, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(photo ? { ...form, photo } : form),
      });
      const data = await res.json();
      if (!res.ok) {
        setNeedBot(Boolean(data.need_bot));
        throw new Error(data.error || 'Не удалось отправить заявку');
      }
      setNeedBot(false);
      setForm({
        city: cities[0]?.city || '',
        contact: '',
        text: '',
        start_hour: 9,
        end_hour: 21,
        plan: 'week',
      });
      setPhoto(null);
      setStatusToken(data.token || '');
      setClientNotified(Boolean(data.client_notified));
      setSent(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Не удалось отправить заявку');
    } finally {
      setLoading(false);
    }
  };

  if (sent) {
    const link = `${window.location.origin}/status/${statusToken}`;
    return (
      <section className="section" id="post">
        <div className="eyebrow">Заявка</div>
        <h2 className="section-title mt-4">Заявка принята</h2>

        <div className="card mt-10 flex max-w-2xl flex-col items-start gap-5">
          <Icon name="CircleCheck" size={34} style={{ color: 'var(--hero-x-quarter)' }} />
          <p style={{ color: 'var(--hero-muted)' }}>
            Модератор посмотрит текст и запустит открутку. Обычно это занимает до 15 минут.
          </p>

          {clientNotified ? (
            <div className="flex items-start gap-3" style={{ color: 'var(--hero-x-quarter)' }}>
              <Icon name="Send" size={18} style={{ flexShrink: 0 }} />
              <span>Ссылку на статус мы уже отправили вам в Telegram.</span>
            </div>
          ) : (
            <div className="flex flex-col gap-3">
              <div className="flex items-start gap-3" style={{ color: 'var(--hero-accent)' }}>
                <Icon name="TriangleAlert" size={18} style={{ flexShrink: 0 }} />
                <span>
                  Не смогли написать вам в Telegram — нажмите «Старт» у бота, тогда уведомления
                  будут приходить автоматически. Пока сохраните ссылку вручную.
                </span>
              </div>
              <a className="btn btn-ghost" href={BOT_URL} target="_blank" rel="noreferrer">
                Открыть бота
              </a>
            </div>
          )}

          {statusToken && (
            <div className="flex w-full flex-col gap-3">
              <span className="label" style={{ margin: 0 }}>
                Личная ссылка на статус — сохраните её
              </span>
              <div className="flex flex-wrap items-center gap-3">
                <a
                  className="field"
                  href={`/status/${statusToken}`}
                  style={{
                    width: 'auto',
                    flex: '1 1 260px',
                    fontSize: '0.85em',
                    wordBreak: 'break-all',
                    color: 'var(--hero-x-quarter)',
                    textDecoration: 'none',
                  }}
                >
                  {link}
                </a>
                <button
                  className="btn btn-ghost"
                  onClick={() => navigator.clipboard.writeText(link)}
                >
                  Скопировать
                </button>
              </div>
            </div>
          )}

          <button className="btn btn-ghost" onClick={() => setSent(false)}>
            Отправить ещё
          </button>
        </div>
      </section>
    );
  }

  return (
    <section className="section" id="post">
      <div className="eyebrow">Заявка</div>
      <h2 className="section-title mt-4">
        Отправьте объявление
        <br />
        на модерацию
      </h2>

      <div className="mt-12 grid gap-6 lg:grid-cols-[1fr_320px]">
        <form className="card flex flex-col gap-6" onSubmit={submit}>
          <div>
            <span className="label">Город</span>
            <select
              className="field"
              value={form.city}
              onChange={(e) => setForm({ ...form, city: e.target.value })}
            >
              {cities.map((c) => (
                <option key={c.city} value={c.city}>
                  {c.city}
                </option>
              ))}
            </select>
          </div>

          <div>
            <span className="label">Ваш Telegram</span>
            <input
              className="field"
              placeholder="@username"
              required
              value={form.contact}
              onChange={(e) => setForm({ ...form, contact: e.target.value })}
            />
            <div
              className="mt-3 flex flex-wrap items-center gap-3 p-3"
              style={{ background: 'var(--hero-surface)', border: '1px solid var(--hero-x-rule)' }}
            >
              <Icon name="Send" size={18} style={{ color: 'var(--hero-accent)', flexShrink: 0 }} />
              <span style={{ color: 'var(--hero-muted)', fontSize: '0.85em', flex: '1 1 200px' }}>
                Обязательно: нажмите «Старт» у бота до отправки заявки. Без этого заявка
                не примется — мы не сможем связать её с вашим Telegram.
              </span>
              <a
                className="btn btn-ghost"
                href={BOT_URL}
                target="_blank"
                rel="noreferrer"
                style={{ padding: '8px 16px', fontSize: '0.75em', whiteSpace: 'nowrap' }}
              >
                Открыть бота
              </a>
            </div>
          </div>

          <div>
            <span className="label">Время публикации</span>
            <div className="flex items-center gap-3">
              <select
                className="field"
                value={form.start_hour}
                onChange={(e) => setForm({ ...form, start_hour: Number(e.target.value) })}
              >
                {HOURS.map((h) => (
                  <option key={h} value={h}>
                    {hourLabel(h)}
                  </option>
                ))}
              </select>
              <span style={{ color: 'var(--hero-muted)' }}>—</span>
              <select
                className="field"
                value={form.end_hour}
                onChange={(e) => setForm({ ...form, end_hour: Number(e.target.value) })}
              >
                {HOURS.map((h) => (
                  <option key={h} value={h}>
                    {hourLabel(h)}
                  </option>
                ))}
              </select>
            </div>
            <p className="mt-2 text-xs" style={{ color: 'var(--hero-muted)' }}>
              Время местное — по часовому поясу города {form.city || 'публикации'}
              {tzLabel ? ` (${tzLabel})` : ''}. Вне этого промежутка объявление публиковаться
              не будет.
            </p>
          </div>

          <div>
            <span className="label">Тариф</span>
            <div className="grid gap-2 sm:grid-cols-2">
              {PLANS.map((p) => (
                <button
                  key={p.key}
                  type="button"
                  className="flex items-center justify-between p-3 text-sm"
                  style={{
                    background: 'var(--hero-surface)',
                    border: `1px solid ${
                      form.plan === p.key ? 'var(--hero-accent)' : 'var(--hero-x-rule)'
                    }`,
                    color: form.plan === p.key ? 'var(--hero-text)' : 'var(--hero-muted)',
                  }}
                  onClick={() => setForm({ ...form, plan: p.key })}
                >
                  <span>{p.title}</span>
                  <span style={{ fontFamily: 'var(--hero-font-head)' }}>
                    {p.price.toLocaleString('ru-RU')} ₽
                  </span>
                </button>
              ))}
            </div>
            <p className="mt-2 text-xs" style={{ color: 'var(--hero-muted)' }}>
              Оплата за это объявление. Реквизиты пришлём после модерации.
            </p>
          </div>

          <div>
            <span className="label">Текст объявления</span>
            <textarea
              className="field"
              rows={7}
              placeholder="Что предлагаете, условия, контакты"
              required
              value={form.text}
              onChange={(e) => setForm({ ...form, text: e.target.value })}
            />
          </div>

          <div>
            <span className="label">Фото (необязательно)</span>
            <input
              className="field"
              type="file"
              accept="image/jpeg,image/png,image/webp"
              onChange={(e) => pickPhoto(e.target.files?.[0])}
            />
            {photo && (
              <div className="mt-3 flex items-center gap-3">
                <span className="chip" style={{ color: 'var(--hero-x-quarter)' }}>
                  <Icon name="Image" size={14} />
                  {photo.name}
                </span>
                <button
                  type="button"
                  className="btn btn-ghost"
                  style={{ padding: '6px 14px', fontSize: '0.72em' }}
                  onClick={() => setPhoto(null)}
                >
                  Убрать
                </button>
              </div>
            )}
          </div>

          {error && (
            <div
              className="flex flex-col gap-3 p-4"
              style={{
                background: 'var(--hero-surface)',
                border: '1px solid var(--hero-accent)',
              }}
            >
              <div className="flex items-start gap-2" style={{ color: 'var(--hero-accent)' }}>
                <Icon name="TriangleAlert" size={18} style={{ flexShrink: 0, marginTop: 2 }} />
                <span className="text-sm">{error}</span>
              </div>
              {needBot && (
                <a
                  className="btn btn-primary"
                  href={BOT_URL}
                  target="_blank"
                  rel="noreferrer"
                  style={{ alignSelf: 'flex-start', padding: '10px 20px', fontSize: '0.72em' }}
                >
                  <Icon name="Send" size={15} />
                  Запустить бота
                </a>
              )}
            </div>
          )}

          <button className="btn btn-primary" type="submit" disabled={loading}>
            {loading ? 'Отправляем...' : 'Отправить на модерацию'}
            {!loading && <Icon name="ArrowRight" size={17} />}
          </button>
        </form>

        <aside className="card h-fit">
          <div className="text-lg uppercase" style={{ fontFamily: 'var(--hero-font-head)' }}>
            Правила
          </div>
          <ul className="mt-5 flex flex-col gap-4 text-sm" style={{ color: 'var(--hero-muted)' }}>
            {[
              'Без запрещённых товаров и услуг',
              'Без оскорблений и разжигания вражды',
              'Один текст — один город',
              'Контакты указывайте прямо в объявлении',
            ].map((r) => (
              <li key={r} className="flex items-start gap-3">
                <Icon
                  name="Check"
                  size={16}
                  style={{ color: 'var(--hero-x-quarter)', flexShrink: 0, marginTop: 3 }}
                />
                <span>{r}</span>
              </li>
            ))}
          </ul>
        </aside>
      </div>
    </section>
  );
};

export default PostForm;