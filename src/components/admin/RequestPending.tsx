import Icon from '@/components/ui/icon';
import { formatDate } from '@/lib/api';
import { AdRequest, PLAN_INFO } from './types';

interface Props {
  item: AdRequest;
  busy: boolean;
  onAction: (body: Record<string, unknown>) => void;
}

const RequestPending = ({ item, busy, onAction }: Props) => {
  const renewPlan = item.renew ? PLAN_INFO[item.renew.plan] : undefined;
  const c = item.campaign;

  return (
    <>
      {item.renew && renewPlan && (
        <div
          className="flex flex-wrap items-center gap-4 p-4"
          style={{ background: 'var(--hero-surface)', border: '1px solid var(--hero-accent)' }}
        >
          <div className="flex items-center gap-2" style={{ color: 'var(--hero-accent)' }}>
            <Icon name={item.renew.method === 'anaton' ? 'Coins' : 'RefreshCw'} size={16} />
            <span className="text-sm uppercase" style={{ fontFamily: 'var(--hero-font-head)' }}>
              {item.renew.method === 'anaton' ? 'Оплата ANATON' : 'Просит продлить'}:{' '}
              {renewPlan.label} · {renewPlan.price.toLocaleString('ru-RU')} ₽
            </span>
          </div>
          <span className="text-sm" style={{ color: 'var(--hero-muted)' }}>
            {formatDate(item.renew.created_at)}
          </span>
          <div className="flex flex-wrap gap-2" style={{ marginLeft: 'auto' }}>
            {c && (
              <button
                className="btn btn-primary"
                disabled={busy}
                style={{ padding: '9px 18px', fontSize: '0.72em' }}
                onClick={() =>
                  onAction({
                    action: 'extend',
                    campaign_id: c.id,
                    days: renewPlan.days,
                    amount: renewPlan.price,
                  })
                }
              >
                Оплата пришла
              </button>
            )}
            <button
              className="btn btn-ghost"
              disabled={busy}
              style={{ padding: '9px 18px', fontSize: '0.72em' }}
              onClick={() => {
                const reason = window.prompt(
                  'Причина отмены (покажем клиенту, можно оставить пустым):',
                  'Оплата не поступила',
                );
                if (reason === null) return;
                onAction({ action: 'reject_renew', request_id: item.id, reason });
              }}
            >
              Оплаты нет
            </button>
          </div>
        </div>
      )}

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
    </>
  );
};

export default RequestPending;
