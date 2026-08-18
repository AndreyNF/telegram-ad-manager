import { useState } from 'react';
import Icon from '@/components/ui/icon';
import { formatDate } from '@/lib/api';
import { PLANS } from './Pricing';

interface Props {
  currentPlan: string | null;
  renew: { plan: string; created_at: string } | null;
  expiresAt: string | null;
  busy: boolean;
  onAction: (body: Record<string, unknown>) => void;
}

const RenewPlan = ({ currentPlan, renew, expiresAt, busy, onAction }: Props) => {
  const [plan, setPlan] = useState(currentPlan || 'week');

  if (renew) {
    const chosen = PLANS.find((p) => p.key === renew.plan);
    return (
      <div className="card mt-6 flex flex-col gap-4">
        <div className="flex items-center gap-2" style={{ color: 'var(--hero-accent)' }}>
          <Icon name="Clock" size={17} />
          <span className="text-lg uppercase" style={{ fontFamily: 'var(--hero-font-head)' }}>
            Продление оформляется
          </span>
        </div>
        <p className="text-sm" style={{ color: 'var(--hero-muted)' }}>
          Заявка от {formatDate(renew.created_at)}. Тариф: {chosen?.title || renew.plan}
          {chosen ? ` — ${chosen.price.toLocaleString('ru-RU')} ₽` : ''}. Мы свяжемся с вами
          в Telegram для оплаты.
        </p>
        <button
          className="btn btn-ghost"
          disabled={busy}
          style={{ alignSelf: 'flex-start' }}
          onClick={() => onAction({ action: 'cancel_renew' })}
        >
          Отменить заявку
        </button>
      </div>
    );
  }

  return (
    <div className="card mt-6 flex flex-col gap-5">
      <div className="text-lg uppercase" style={{ fontFamily: 'var(--hero-font-head)' }}>
        Продлить показы
      </div>
      <p className="text-sm" style={{ color: 'var(--hero-muted)' }}>
        {expiresAt
          ? `Текущий срок заканчивается ${formatDate(expiresAt)}. Новый период добавится к нему.`
          : 'Выберите тариф — мы свяжемся с вами для оплаты.'}
      </p>

      <div className="grid gap-2 sm:grid-cols-2">
        {PLANS.map((p) => (
          <button
            key={p.key}
            type="button"
            className="flex items-center justify-between p-3 text-sm"
            style={{
              background: 'var(--hero-surface)',
              border: `1px solid ${plan === p.key ? 'var(--hero-accent)' : 'var(--hero-x-rule)'}`,
              color: plan === p.key ? 'var(--hero-text)' : 'var(--hero-muted)',
            }}
            onClick={() => setPlan(p.key)}
          >
            <span>{p.title}</span>
            <span style={{ fontFamily: 'var(--hero-font-head)' }}>
              {p.price.toLocaleString('ru-RU')} ₽
            </span>
          </button>
        ))}
      </div>

      <button
        className="btn btn-primary"
        disabled={busy}
        style={{ alignSelf: 'flex-start' }}
        onClick={() => onAction({ action: 'renew', plan })}
      >
        <Icon name="RefreshCw" size={15} />
        {busy ? 'Отправляем...' : 'Продлить'}
      </button>
    </div>
  );
};

export default RenewPlan;
