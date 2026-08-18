import { useEffect, useState, useCallback } from 'react';
import { useParams } from 'react-router-dom';
import Icon from '@/components/ui/icon';
import { API, formatDate, hourLabel, BOT_URL } from '@/lib/api';

interface StatusData {
  id: number;
  city: string;
  ad_text: string;
  status: string;
  created_at: string;
  photo_url: string | null;
  pref_start_hour: number;
  pref_end_hour: number;
  campaign: {
    state: string;
    posts_sent: number;
    last_sent_at: string | null;
    expires_at: string | null;
    interval_minutes: number;
  } | null;
}

const Status = () => {
  const { token } = useParams();
  const [data, setData] = useState<StatusData | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    try {
      const res = await fetch(`${API.clientStatus}?token=${token}`);
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Объявление не найдено');
      setData(json);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Объявление не найдено');
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    load();
  }, [load]);

  const stop = async () => {
    setBusy(true);
    try {
      await fetch(`${API.clientStatus}?token=${token}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'stop' }),
      });
      await load();
    } finally {
      setBusy(false);
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center" style={{ color: 'var(--hero-muted)' }}>
        Загружаем...
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="flex min-h-screen items-center justify-center px-5">
        <div className="card max-w-sm text-center">
          <Icon name="SearchX" size={32} style={{ color: 'var(--hero-accent)' }} />
          <p className="mt-4">{error}</p>
          <a className="btn btn-ghost mt-6" href="/">
            На главную
          </a>
        </div>
      </div>
    );
  }

  const c = data.campaign;
  const isRunning = c?.state === 'running';

  return (
    <div className="min-h-screen">
      <header style={{ borderBottom: '1px solid var(--hero-x-rule)' }}>
        <div className="mx-auto flex w-full max-w-3xl items-center justify-between px-5 py-5">
          <a href="/" className="flex items-center gap-2">
            <Icon name="Megaphone" size={20} style={{ color: 'var(--hero-accent)' }} />
            <span className="uppercase" style={{ fontFamily: 'var(--hero-font-head)' }}>
              Постовой
            </span>
          </a>
          <a className="btn btn-ghost" href={BOT_URL} target="_blank" rel="noreferrer" style={{ padding: '9px 16px', fontSize: '0.72em' }}>
            Наш бот
          </a>
        </div>
      </header>

      <main className="mx-auto w-full max-w-3xl px-5 py-12">
        <div className="eyebrow">Ваше объявление</div>
        <h1 className="section-title mt-4">{data.city}</h1>

        <div className="mt-8 flex flex-wrap gap-3">
          <span
            className="chip"
            style={{ color: isRunning ? 'var(--hero-x-quarter)' : 'var(--hero-accent)' }}
          >
            <Icon name={isRunning ? 'Radio' : 'Pause'} size={14} />
            {isRunning
              ? 'Публикуется'
              : c
                ? c.state === 'expired'
                  ? 'Срок закончился'
                  : 'Остановлено'
                : data.status === 'rejected'
                  ? 'Отклонено'
                  : 'Ждёт модерации'}
          </span>
          <span className="chip" style={{ color: 'var(--hero-muted)' }}>
            <Icon name="Clock" size={14} />
            {hourLabel(data.pref_start_hour)}—{hourLabel(data.pref_end_hour)}
          </span>
        </div>

        {c && (
          <div className="mt-8 grid gap-4 sm:grid-cols-3">
            {[
              { label: 'Публикаций', value: c.posts_sent, icon: 'Send' },
              { label: 'Раз в', value: `${c.interval_minutes} мин`, icon: 'Repeat' },
              { label: 'Действует до', value: formatDate(c.expires_at), icon: 'CalendarClock' },
            ].map((s) => (
              <div key={s.label} className="card">
                <Icon name={s.icon} size={20} style={{ color: 'var(--hero-accent)' }} />
                <div className="mt-3 text-xl" style={{ fontFamily: 'var(--hero-font-head)' }}>
                  {s.value}
                </div>
                <div className="mt-1 text-sm" style={{ color: 'var(--hero-muted)' }}>
                  {s.label}
                </div>
              </div>
            ))}
          </div>
        )}

        <div className="card mt-8">
          <span className="label">Текст объявления</span>
          {data.photo_url && (
            <img
              src={data.photo_url}
              alt=""
              className="mb-4 max-h-72 w-full object-cover"
              style={{ border: '1px solid var(--hero-x-rule)' }}
            />
          )}
          <div className="whitespace-pre-wrap text-sm">{data.ad_text}</div>
        </div>

        {c && (
          <div className="mt-6 flex flex-wrap items-center gap-4">
            {isRunning && (
              <button className="btn btn-ghost" disabled={busy} onClick={stop}>
                {busy ? 'Останавливаем...' : 'Остановить показы'}
              </button>
            )}
            <span className="text-sm" style={{ color: 'var(--hero-muted)' }}>
              Последняя публикация: {formatDate(c.last_sent_at)}
            </span>
          </div>
        )}

        <p className="mt-10 text-sm" style={{ color: 'var(--hero-muted)' }}>
          Чтобы продлить или возобновить показы, напишите нам в Telegram.
        </p>
      </main>
    </div>
  );
};

export default Status;
