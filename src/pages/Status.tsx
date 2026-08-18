import { useEffect, useState, useCallback } from 'react';
import { useParams } from 'react-router-dom';
import Icon from '@/components/ui/icon';
import { API, formatDate, hourLabel, BOT_URL } from '@/lib/api';
import EditAd from '@/components/site/EditAd';
import RenewPlan from '@/components/site/RenewPlan';
import EditWindow from '@/components/site/EditWindow';

interface StatusData {
  id: number;
  city: string;
  ad_text: string;
  status: string;
  created_at: string;
  photo_url: string | null;
  pref_start_hour: number;
  pref_end_hour: number;
  pending: {
    ad_text: string;
    photo_url: string | null;
    photo_clear: boolean;
    created_at: string;
  } | null;
  edit_rejected_at: string | null;
  total_paid: number;
  days_paid: number | null;
  plan: string | null;
  tz_offset: number;
  renew: { plan: string; created_at: string } | null;
  campaign: {
    state: string;
    posts_sent: number;
    last_sent_at: string | null;
    expires_at: string | null;
    interval_minutes: number;
    paused_until: string | null;
  } | null;
}

const PAUSE_OPTIONS = [
  { label: '2 часа', hours: 2 },
  { label: '6 часов', hours: 6 },
  { label: 'Сутки', hours: 24 },
  { label: '3 дня', hours: 72 },
  { label: 'Неделя', hours: 168 },
];

const Status = () => {
  const { token } = useParams();
  const [data, setData] = useState<StatusData | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [pauseOpen, setPauseOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [customHours, setCustomHours] = useState(12);

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

  const act = async (body: Record<string, unknown>) => {
    setBusy(true);
    setError('');
    try {
      const res = await fetch(`${API.clientStatus}?token=${token}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Не удалось выполнить');
      setPauseOpen(false);
      setEditOpen(false);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Не удалось выполнить');
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
  const isPaused = Boolean(c?.paused_until && new Date(c.paused_until) > new Date());
  const isRunning = c?.state === 'running' && !isPaused;

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
              : isPaused
                ? `На паузе до ${formatDate(c?.paused_until)}`
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
            {' · '}
            {data.tz_offset === 3
              ? 'МСК'
              : `МСК${data.tz_offset > 3 ? '+' : ''}${data.tz_offset - 3}`}
          </span>
        </div>

        {c && (
          <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {[
              { label: 'Публикаций', value: c.posts_sent, icon: 'Send' },
              { label: 'Раз в', value: `${c.interval_minutes} мин`, icon: 'Repeat' },
              { label: 'Действует до', value: formatDate(c.expires_at), icon: 'CalendarClock' },
              ...(data.total_paid > 0
                ? [{ label: 'Оплачено', value: `${data.total_paid} ₽`, icon: 'Wallet' }]
                : []),
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
          <div className="flex flex-wrap items-center justify-between gap-3">
            <span className="label" style={{ marginBottom: 0 }}>
              Текст объявления
            </span>
            {!editOpen && !data.pending && (
              <button
                className="btn btn-ghost"
                style={{ padding: '8px 16px', fontSize: '0.72em' }}
                onClick={() => setEditOpen(true)}
              >
                <Icon name="Pencil" size={14} />
                Изменить
              </button>
            )}
          </div>

          {!editOpen && (
            <div className="mt-4">
              {data.photo_url && (
                <img
                  src={data.photo_url}
                  alt=""
                  className="mb-4 max-h-72 w-full object-contain"
                  style={{ border: '1px solid var(--hero-x-rule)' }}
                />
              )}
              <div className="whitespace-pre-wrap text-sm">{data.ad_text}</div>
            </div>
          )}

          {editOpen && (
            <EditAd
              adText={data.ad_text}
              photoUrl={data.photo_url}
              busy={busy}
              onSave={act}
              onCancel={() => setEditOpen(false)}
            />
          )}
        </div>

        {data.pending && (
          <div className="card mt-6 flex flex-col gap-4">
            <div className="flex items-center gap-2" style={{ color: 'var(--hero-accent)' }}>
              <Icon name="Clock" size={17} />
              <span className="text-lg uppercase" style={{ fontFamily: 'var(--hero-font-head)' }}>
                Правки на проверке
              </span>
            </div>
            <p className="text-sm" style={{ color: 'var(--hero-muted)' }}>
              Отправлено {formatDate(data.pending.created_at)}. Пока правки не одобрены,
              публикуется текущая версия.
            </p>

            {data.pending.photo_clear ? (
              <span className="chip" style={{ color: 'var(--hero-accent)' }}>
                Фото будет удалено
              </span>
            ) : (
              data.pending.photo_url && (
                <img
                  src={data.pending.photo_url}
                  alt=""
                  className="max-h-56 w-full object-contain"
                  style={{ border: '1px solid var(--hero-x-rule)' }}
                />
              )
            )}

            <div
              className="whitespace-pre-wrap p-4 text-sm"
              style={{ background: 'var(--hero-surface)', border: '1px solid var(--hero-x-rule)' }}
            >
              {data.pending.ad_text}
            </div>

            <button
              className="btn btn-ghost"
              disabled={busy}
              style={{ alignSelf: 'flex-start' }}
              onClick={() => act({ action: 'cancel_edit' })}
            >
              Отозвать правки
            </button>
          </div>
        )}

        {!data.pending && data.edit_rejected_at && (
          <div className="card mt-6 flex items-start gap-3">
            <Icon
              name="TriangleAlert"
              size={18}
              style={{ color: 'var(--hero-accent)', flexShrink: 0, marginTop: 2 }}
            />
            <span className="text-sm">
              Последние правки отклонены модератором {formatDate(data.edit_rejected_at)}.
              Публикуется предыдущая версия — можно отправить новый вариант.
            </span>
          </div>
        )}

        <EditWindow
          startHour={data.pref_start_hour}
          endHour={data.pref_end_hour}
          tzOffset={data.tz_offset}
          busy={busy}
          onSave={act}
        />

        {c && (
          <RenewPlan
            currentPlan={data.plan}
            renew={data.renew}
            expiresAt={c.expires_at}
            busy={busy}
            onAction={act}
          />
        )}

        {c && c.state !== 'expired' && (
          <div className="card mt-6 flex flex-col gap-5">
            <div className="text-lg uppercase" style={{ fontFamily: 'var(--hero-font-head)' }}>
              Управление показами
            </div>

            {isPaused ? (
              <>
                <div className="flex items-start gap-3" style={{ color: 'var(--hero-accent)' }}>
                  <Icon name="Pause" size={18} style={{ flexShrink: 0, marginTop: 2 }} />
                  <span className="text-sm">
                    Показы на паузе до {formatDate(c.paused_until)}. Срок действия продлён на время
                    паузы — оплаченные дни не сгорают.
                  </span>
                </div>
                <button
                  className="btn btn-primary"
                  disabled={busy}
                  style={{ alignSelf: 'flex-start' }}
                  onClick={() => act({ action: 'resume' })}
                >
                  <Icon name="Play" size={15} />
                  {busy ? 'Возобновляем...' : 'Возобновить сейчас'}
                </button>
              </>
            ) : isRunning ? (
              <>
                <p className="text-sm" style={{ color: 'var(--hero-muted)' }}>
                  Нужен перерыв? Поставьте показы на паузу — оплаченное время не сгорит, срок
                  сдвинется ровно на длительность паузы.
                </p>

                {!pauseOpen ? (
                  <div className="flex flex-wrap gap-3">
                    <button
                      className="btn btn-primary"
                      onClick={() => setPauseOpen(true)}
                      disabled={busy}
                    >
                      <Icon name="Pause" size={15} />
                      Приостановить
                    </button>
                    <button
                      className="btn btn-ghost"
                      disabled={busy}
                      onClick={() => act({ action: 'stop' })}
                    >
                      Остановить совсем
                    </button>
                  </div>
                ) : (
                  <div className="flex flex-col gap-4">
                    <span className="label" style={{ margin: 0 }}>
                      На сколько приостановить
                    </span>
                    <div className="flex flex-wrap gap-2">
                      {PAUSE_OPTIONS.map((o) => (
                        <button
                          key={o.hours}
                          className="btn btn-ghost"
                          disabled={busy}
                          style={{ padding: '10px 18px', fontSize: '0.72em' }}
                          onClick={() => act({ action: 'pause', hours: o.hours })}
                        >
                          {o.label}
                        </button>
                      ))}
                    </div>

                    <div className="flex flex-wrap items-end gap-3">
                      <label className="flex flex-col gap-2">
                        <span className="label" style={{ margin: 0 }}>
                          Свой срок, часов
                        </span>
                        <input
                          className="field"
                          type="number"
                          min={1}
                          max={720}
                          value={customHours}
                          onChange={(e) => setCustomHours(Number(e.target.value))}
                          style={{ width: 120 }}
                        />
                      </label>
                      <button
                        className="btn btn-primary"
                        disabled={busy || customHours < 1}
                        onClick={() => act({ action: 'pause', hours: customHours })}
                      >
                        {busy ? 'Ставим на паузу...' : 'Приостановить'}
                      </button>
                      <button className="btn btn-ghost" onClick={() => setPauseOpen(false)}>
                        Отмена
                      </button>
                    </div>
                  </div>
                )}
              </>
            ) : (
              <p className="text-sm" style={{ color: 'var(--hero-muted)' }}>
                Показы остановлены. Чтобы возобновить, напишите нам в Telegram.
              </p>
            )}

            {error && (
              <div className="flex items-center gap-2" style={{ color: 'var(--hero-accent)' }}>
                <Icon name="TriangleAlert" size={16} />
                <span className="text-sm">{error}</span>
              </div>
            )}

            <span className="text-sm" style={{ color: 'var(--hero-muted)' }}>
              Последняя публикация: {formatDate(c.last_sent_at)}
            </span>
          </div>
        )}
      </main>
    </div>
  );
};

export default Status;