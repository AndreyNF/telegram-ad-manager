import { useState } from 'react';
import Icon from '@/components/ui/icon';
import { API, formatDate } from '@/lib/api';
import { PLANS } from './Pricing';

interface Props {
  currentPlan: string | null;
  renew: { plan: string; created_at: string } | null;
  expiresAt: string | null;
  busy: boolean;
  token?: string;
  onAction: (body: Record<string, unknown>) => void;
}

const RenewPlan = ({ currentPlan, renew, expiresAt, busy, token, onAction }: Props) => {
  const [plan, setPlan] = useState(currentPlan || 'week');
  const [paying, setPaying] = useState(false);
  const [payError, setPayError] = useState('');

  const payOnline = async () => {
    if (!token) return;
    setPaying(true);
    setPayError('');
    try {
      const res = await fetch(API.payment, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'create', token, plan }),
      });
      const data = await res.json();
      if (!res.ok || !data.pay_url) {
        setPayError(data.error || 'Не удалось создать платёж');
        setPaying(false);
        return;
      }
      window.location.href = data.pay_url;
    } catch {
      setPayError('Не удалось связаться с платёжной системой');
      setPaying(false);
    }
  };

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

      {payError && (
        <div className="flex items-start gap-2 text-sm" style={{ color: 'var(--hero-accent)' }}>
          <Icon name="TriangleAlert" size={15} style={{ flexShrink: 0, marginTop: 2 }} />
          <span>{payError}</span>
        </div>
      )}

      <div className="flex flex-wrap items-center gap-3">
        {token && (
          <button
            className="btn btn-primary"
            disabled={busy || paying}
            onClick={payOnline}
          >
            <Icon name="CreditCard" size={15} />
            {paying ? 'Открываем оплату...' : 'Оплатить картой'}
          </button>
        )}
        <button
          className="btn btn-ghost"
          disabled={busy || paying}
          onClick={() => onAction({ action: 'renew', plan })}
        >
          <Icon name="RefreshCw" size={15} />
          {busy ? 'Отправляем...' : 'Оплачу иначе'}
        </button>
      </div>

      <p className="text-xs" style={{ color: 'var(--hero-muted)' }}>
        Оплата картой или через СБП — показы продлятся автоматически сразу после платежа.
      </p>
    </div>
  );
};

export default RenewPlan;