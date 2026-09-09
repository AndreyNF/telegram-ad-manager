import Icon from '@/components/ui/icon';
import { formatDate, hourLabel, tzLabel } from '@/lib/api';
import { AdRequest, PLAN_INFO, STATE_LABELS, STATUS_LABELS } from './types';

interface Props {
  item: AdRequest;
  isPaused: boolean;
  photoFailed: boolean;
}

const stateColor = (state?: string) => {
  if (state === 'running') return 'var(--hero-x-quarter)';
  if (state === 'stopped' || state === 'expired') return 'var(--hero-accent)';
  return 'var(--hero-muted)';
};

const RequestHeader = ({ item, isPaused, photoFailed }: Props) => {
  const plan = item.plan ? PLAN_INFO[item.plan] : undefined;
  const c = item.campaign;

  return (
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
          {plan && (
            <span className="chip" style={{ color: 'var(--hero-accent)' }}>
              {plan.label} · {plan.price.toLocaleString('ru-RU')} ₽
            </span>
          )}
          {c && (
            <span className="chip" style={{ color: isPaused ? 'var(--hero-accent)' : stateColor(c.state) }}>
              {isPaused ? 'На паузе' : STATE_LABELS[c.state] || c.state}
            </span>
          )}
          {photoFailed && (
            <span
              className="chip flex items-center gap-1"
              style={{
                color: 'var(--hero-bg)',
                background: 'var(--hero-accent)',
                borderColor: 'var(--hero-accent)',
              }}
            >
              <Icon name="ImageOff" size={13} />
              Без фото
            </span>
          )}
        </div>
        <div className="mt-2 flex flex-wrap gap-4 text-sm" style={{ color: 'var(--hero-muted)' }}>
          <span className="flex items-center gap-2">
            <Icon name="User" size={14} />
            {item.client_name ? `${item.client_name} · ` : ''}
            {item.client_username ? (
              <a
                href={`https://t.me/${item.client_username}`}
                target="_blank"
                rel="noreferrer"
                style={{ color: 'var(--hero-accent)' }}
              >
                @{item.client_username}
              </a>
            ) : (
              item.contact
            )}
          </span>
          <span className="flex items-center gap-2">
            <Icon name="Clock" size={14} />
            {hourLabel(item.pref_start_hour)}—{hourLabel(item.pref_end_hour)}
            {c ? ` · ${tzLabel(c.tz_offset)}` : ''}
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
  );
};

export default RequestHeader;
