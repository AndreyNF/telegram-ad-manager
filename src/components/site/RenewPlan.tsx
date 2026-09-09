import { useState } from 'react';
import Icon from '@/components/ui/icon';
import { formatDate } from '@/lib/api';
import { PLANS } from './Pricing';
import AnatonPay from './AnatonPay';

interface Props {
  currentPlan: string | null;
  renew: { plan: string; created_at: string } | null;
  expiresAt: string | null;
  busy: boolean;
  token?: string;
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
          {chosen ? ` — ${chosen.price.toLocaleString('ru-RU')} ₽` : ''}. Проверяем поступление
          оплаты — свяжемся с вами в Telegram.
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
        {expiresAt ? 'Продлить показы' : 'Оплатить размещение'}
      </div>
      <p className="text-sm" style={{ color: 'var(--hero-muted)' }}>
        {expiresAt
          ? `Текущий срок заканчивается ${formatDate(expiresAt)}. Новый период добавится к нему.`
          : 'Выберите тариф — после оплаты объявление начнёт публиковаться автоматически.'}
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

      <div style={{ borderTop: '1px solid var(--hero-x-rule)', paddingTop: '1.25rem' }}>
        <div
          className="mb-4 flex items-center gap-2 text-sm uppercase"
          style={{ fontFamily: 'var(--hero-font-head)' }}
        >
          <Icon name="Coins" size={16} style={{ color: 'var(--hero-accent)' }} />
          Оплата монетой ANATON
        </div>
        <AnatonPay plan={plan} busy={busy} onAction={onAction} />
      </div>
    </div>
  );
};

export default RenewPlan;
