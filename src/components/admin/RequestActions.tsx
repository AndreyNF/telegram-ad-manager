import Icon from '@/components/ui/icon';
import { AdRequest } from './types';

interface Props {
  item: AdRequest;
  busy: boolean;
  isPaused: boolean;
  days: number;
  setDays: (value: number) => void;
  interval: number;
  setInterval: (value: number) => void;
  amount: string;
  setAmount: (value: string) => void;
  chatOpen: boolean;
  setChatOpen: (value: boolean) => void;
  onAction: (body: Record<string, unknown>) => void;
}

const RequestActions = ({
  item,
  busy,
  isPaused,
  days,
  setDays,
  interval,
  setInterval,
  amount,
  setAmount,
  chatOpen,
  setChatOpen,
  onAction,
}: Props) => {
  const c = item.campaign;

  return (
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
          <label className="flex items-center gap-2 text-sm" style={{ color: 'var(--hero-muted)' }}>
            Оплата, ₽
            <input
              className="field"
              type="number"
              min={0}
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="0"
              style={{ width: 100, padding: '8px 10px' }}
            />
          </label>
          <button
            className="btn btn-primary"
            disabled={busy}
            style={{ padding: '10px 20px', fontSize: '0.75em' }}
            onClick={() =>
              onAction({
                action: 'approve',
                id: item.id,
                days,
                interval_minutes: interval,
                amount,
              })
            }
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
          <label className="flex items-center gap-2 text-sm" style={{ color: 'var(--hero-muted)' }}>
            Оплата, ₽
            <input
              className="field"
              type="number"
              min={0}
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="0"
              style={{ width: 100, padding: '8px 10px' }}
            />
          </label>
          <button
            className="btn btn-ghost"
            disabled={busy}
            style={{ padding: '10px 20px', fontSize: '0.75em' }}
            onClick={() => onAction({ action: 'extend', campaign_id: c.id, days, amount })}
          >
            Продлить
          </button>
          <button
            className="btn btn-ghost"
            disabled={busy}
            style={{ padding: '10px 20px', fontSize: '0.75em' }}
            onClick={() => onAction({ action: 'test_post', campaign_id: c.id })}
          >
            <Icon name="Send" size={14} />
            Опубликовать сейчас
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
        {item.unread > 0 && !chatOpen && (
          <span
            style={{
              background: 'var(--hero-accent)',
              color: '#fff',
              borderRadius: 10,
              padding: '1px 7px',
              marginLeft: 6,
            }}
          >
            {item.unread}
          </span>
        )}
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
  );
};

export default RequestActions;
