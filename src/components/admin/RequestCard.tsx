import { useState } from 'react';
import Icon from '@/components/ui/icon';
import { formatDate, hourLabel } from '@/lib/api';
import { AdRequest, STATE_LABELS, STATUS_LABELS } from './types';
import ClientChat from './ClientChat';

interface Props {
  item: AdRequest;
  busy: boolean;
  password: string;
  onAction: (body: Record<string, unknown>) => void;
}

const stateColor = (state?: string) => {
  if (state === 'running') return 'var(--hero-x-quarter)';
  if (state === 'stopped' || state === 'expired') return 'var(--hero-accent)';
  return 'var(--hero-muted)';
};

const RequestCard = ({ item, busy, password, onAction }: Props) => {
  const [days, setDays] = useState(30);
  const [interval, setInterval] = useState(15);
  const [open, setOpen] = useState(false);
  const [chatOpen, setChatOpen] = useState(false);

  const c = item.campaign;
  const isPaused = Boolean(c?.paused_until && new Date(c.paused_until) > new Date());
  const text = open || item.ad_text.length <= 220 ? item.ad_text : `${item.ad_text.slice(0, 220)}...`;

  return (
    <div className="card flex flex-col gap-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex flex-wrap items-center gap-3">
            <span className="text-xl uppercase" style={{ fontFamily: 'var(--hero-font-head)' }}>
              {item.city}
            </span>
            <span className="chip">#{item.id}</span>
            <span className="chip" style={{ color: 'var(--hero-muted)' }}>
              {STATUS_LABELS[item.status] || item.status}
            </span>
            {c && (
              <span className="chip" style={{ color: isPaused ? 'var(--hero-accent)' : stateColor(c.state) }}>
                {isPaused ? 'На паузе' : STATE_LABELS[c.state] || c.state}
              </span>
            )}
          </div>
          <div className="mt-2 flex flex-wrap gap-4 text-sm" style={{ color: 'var(--hero-muted)' }}>
            <span className="flex items-center gap-2">
              <Icon name="User" size={14} />
              {item.contact}
            </span>
            <span className="flex items-center gap-2">
              <Icon name="Clock" size={14} />
              {hourLabel(item.pref_start_hour)}—{hourLabel(item.pref_end_hour)}
            </span>
            <span className="flex items-center gap-2">
              <Icon name="Calendar" size={14} />
              {formatDate(item.created_at)}
            </span>
            {!item.client_notified && (
              <span className="flex items-center gap-2" style={{ color: 'var(--hero-accent)' }}>
                <Icon name="BellOff" size={14} />
                не запускал бота
              </span>
            )}
          </div>
        </div>

        {item.photo_url && (
          <a href={item.photo_url} target="_blank" rel="noreferrer">
            <img
              src={item.photo_url}
              alt=""
              className="max-h-32 w-auto object-contain"
              style={{ border: '1px solid var(--hero-x-rule)', background: 'var(--hero-surface)' }}
            />
          </a>
        )}
      </div>

      <div
        className="whitespace-pre-wrap p-4 text-sm"
        style={{ background: 'var(--hero-surface)', border: '1px solid var(--hero-x-rule)' }}
      >
        {text}
        {item.ad_text.length > 220 && (
          <button
            className="mt-2 block text-xs"
            style={{ color: 'var(--hero-accent)' }}
            onClick={() => setOpen(!open)}
          >
            {open ? 'Свернуть' : 'Показать полностью'}
          </button>
        )}
      </div>

      {item.pending && (
        <div
          className="flex flex-col gap-3 p-4"
          style={{ background: 'var(--hero-surface)', border: '1px solid var(--hero-accent)' }}
        >
          <div className="flex items-center gap-2" style={{ color: 'var(--hero-accent)' }}>
            <Icon name="FilePen" size={16} />
            <span className="text-sm uppercase" style={{ fontFamily: 'var(--hero-font-head)' }}>
              Клиент прислал правки · {formatDate(item.pending.created_at)}
            </span>
          </div>

          {item.pending.photo_clear ? (
            <span className="chip" style={{ color: 'var(--hero-accent)' }}>
              Просит удалить фото
            </span>
          ) : (
            item.pending.photo_url && (
              <a href={item.pending.photo_url} target="_blank" rel="noreferrer">
                <img
                  src={item.pending.photo_url}
                  alt=""
                  className="max-h-32 w-auto object-contain"
                  style={{ border: '1px solid var(--hero-x-rule)' }}
                />
              </a>
            )
          )}

          <div className="whitespace-pre-wrap text-sm">{item.pending.ad_text}</div>

          <div className="flex flex-wrap gap-3">
            <button
              className="btn btn-primary"
              disabled={busy}
              style={{ padding: '10px 20px', fontSize: '0.72em' }}
              onClick={() => onAction({ action: 'approve_edit', id: item.id })}
            >
              <Icon name="Check" size={14} />
              Принять правки
            </button>
            <button
              className="btn btn-ghost"
              disabled={busy}
              style={{ padding: '10px 20px', fontSize: '0.72em' }}
              onClick={() => onAction({ action: 'reject_edit', id: item.id })}
            >
              Отклонить правки
            </button>
          </div>
        </div>
      )}

      {c && (
        <div className="flex flex-wrap gap-4 text-sm" style={{ color: 'var(--hero-muted)' }}>
          <span>Опубликовано: {c.posts_sent}</span>
          <span>Последний раз: {formatDate(c.last_sent_at)}</span>
          <span>Действует до: {formatDate(c.expires_at)}</span>
          <span>Каждые {c.interval_minutes} мин</span>
          {isPaused && (
            <span style={{ color: 'var(--hero-accent)' }}>
              Пауза до: {formatDate(c.paused_until)}
            </span>
          )}
        </div>
      )}

      {c?.last_error && (
        <div className="flex items-start gap-2 text-sm" style={{ color: 'var(--hero-accent)' }}>
          <Icon name="TriangleAlert" size={15} style={{ flexShrink: 0, marginTop: 2 }} />
          <span>{c.last_error}</span>
        </div>
      )}

      <div className="flex flex-wrap items-center gap-3" style={{ borderTop: '1px solid var(--hero-x-rule)', paddingTop: 16 }}>
        {!c || c.state === 'archived' ? (
          <>
            <label className="flex items-center gap-2 text-sm" style={{ color: 'var(--hero-muted)' }}>
              Дней
              <input
                className="field"
                type="number"
                min={1}
                max={365}
                value={days}
                onChange={(e) => setDays(Number(e.target.value))}
                style={{ width: 80, padding: '8px 10px' }}
              />
            </label>
            <label className="flex items-center gap-2 text-sm" style={{ color: 'var(--hero-muted)' }}>
              Интервал, мин
              <input
                className="field"
                type="number"
                min={5}
                max={1440}
                value={interval}
                onChange={(e) => setInterval(Number(e.target.value))}
                style={{ width: 90, padding: '8px 10px' }}
              />
            </label>
            <button
              className="btn btn-primary"
              disabled={busy}
              style={{ padding: '10px 20px', fontSize: '0.75em' }}
              onClick={() => onAction({ action: 'approve', id: item.id, days, interval_minutes: interval })}
            >
              Одобрить и запустить
            </button>
          </>
        ) : (
          <>
            {isPaused ? (
              <button
                className="btn btn-primary"
                disabled={busy}
                style={{ padding: '10px 20px', fontSize: '0.75em' }}
                onClick={() => onAction({ action: 'unpause', campaign_id: c.id })}
              >
                Снять паузу
              </button>
            ) : c.state === 'running' ? (
              <button
                className="btn btn-ghost"
                disabled={busy}
                style={{ padding: '10px 20px', fontSize: '0.75em' }}
                onClick={() => onAction({ action: 'stop', campaign_id: c.id })}
              >
                Остановить
              </button>
            ) : (
              <button
                className="btn btn-primary"
                disabled={busy}
                style={{ padding: '10px 20px', fontSize: '0.75em' }}
                onClick={() => onAction({ action: 'resume', campaign_id: c.id })}
              >
                Возобновить
              </button>
            )}
            <label className="flex items-center gap-2 text-sm" style={{ color: 'var(--hero-muted)' }}>
              Продлить на
              <input
                className="field"
                type="number"
                min={1}
                max={365}
                value={days}
                onChange={(e) => setDays(Number(e.target.value))}
                style={{ width: 80, padding: '8px 10px' }}
              />
              дн.
            </label>
            <button
              className="btn btn-ghost"
              disabled={busy}
              style={{ padding: '10px 20px', fontSize: '0.75em' }}
              onClick={() => onAction({ action: 'extend', campaign_id: c.id, days })}
            >
              Продлить
            </button>
          </>
        )}

        {item.status !== 'rejected' && (
          <button
            className="btn btn-ghost"
            disabled={busy}
            style={{ padding: '10px 20px', fontSize: '0.75em', marginLeft: 'auto' }}
            onClick={() => onAction({ action: 'reject', id: item.id })}
          >
            Отклонить
          </button>
        )}

        <button
          className="btn btn-ghost"
          style={{ padding: '10px 20px', fontSize: '0.75em' }}
          onClick={() => setChatOpen(!chatOpen)}
        >
          <Icon name="MessageCircle" size={14} />
          {chatOpen ? 'Скрыть чат' : 'Написать клиенту'}
        </button>

        {item.public_token && (
          <a
            className="btn btn-ghost"
            href={`/status/${item.public_token}`}
            target="_blank"
            rel="noreferrer"
            style={{ padding: '10px 20px', fontSize: '0.75em' }}
          >
            Статус
          </a>
        )}
      </div>

      {chatOpen && (
        <ClientChat item={item} password={password} onSent={() => onAction({ action: 'refresh' })} />
      )}
    </div>
  );
};

export default RequestCard;