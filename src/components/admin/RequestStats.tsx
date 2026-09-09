import Icon from '@/components/ui/icon';
import { formatDate, formatDateTz, tzLabel } from '@/lib/api';
import { AdRequest } from './types';

interface Props {
  item: AdRequest;
  isPaused: boolean;
  photoFailed: boolean;
}

const RequestStats = ({ item, isPaused, photoFailed }: Props) => {
  const c = item.campaign;

  return (
    <>
      {c && (
        <div className="flex flex-wrap gap-4 text-sm" style={{ color: 'var(--hero-muted)' }}>
          <span>Опубликовано: {c.posts_sent}</span>
          <span>
            Последний раз: {formatDateTz(c.last_sent_at, c.tz_offset)} {tzLabel(c.tz_offset)}
          </span>
          <span>
            Действует до: {formatDateTz(c.expires_at, c.tz_offset)} {tzLabel(c.tz_offset)}
          </span>
          <span>Каждые {c.interval_minutes} мин</span>
          <span style={{ color: item.total_paid > 0 ? 'var(--hero-x-quarter)' : 'var(--hero-accent)' }}>
            {item.total_paid > 0 ? `Оплачено: ${item.total_paid} ₽` : 'Оплата не внесена'}
          </span>
          {isPaused && (
            <span style={{ color: 'var(--hero-accent)' }}>
              Пауза до: {formatDate(c.paused_until)}
            </span>
          )}
        </div>
      )}

      {c?.last_error && photoFailed && (
        <div
          className="flex flex-col gap-2 p-3"
          style={{
            background: 'rgba(255, 92, 46, 0.10)',
            border: '1px solid var(--hero-accent)',
          }}
        >
          <div className="flex items-center gap-2" style={{ color: 'var(--hero-accent)' }}>
            <Icon name="ImageOff" size={17} style={{ flexShrink: 0 }} />
            <span className="uppercase text-sm" style={{ fontFamily: 'var(--hero-font-head)' }}>
              Объявление вышло без фото
            </span>
          </div>
          <span className="text-sm">
            Текст опубликован, но картинку Telegram не принял. Попробуйте загрузить фото
            заново — лучше файлом меньшего размера.
          </span>
          <span className="text-xs" style={{ color: 'var(--hero-muted)' }}>
            Ответ Telegram: {c.last_error.replace(/^фото не ушло:\s*/i, '')}
          </span>
        </div>
      )}

      {c?.last_error && !photoFailed && (
        <div className="flex items-start gap-2 text-sm" style={{ color: 'var(--hero-accent)' }}>
          <Icon name="TriangleAlert" size={15} style={{ flexShrink: 0, marginTop: 2 }} />
          <span>{c.last_error}</span>
        </div>
      )}
    </>
  );
};

export default RequestStats;
