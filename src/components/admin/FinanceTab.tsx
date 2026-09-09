import { useCallback, useEffect, useState } from 'react';
import Icon from '@/components/ui/icon';
import { API, formatDate } from '@/lib/api';
import { PLAN_INFO } from './types';

interface Payment {
  id: number;
  amount: number;
  days: number;
  kind: string;
  note: string | null;
  created_at: string;
  request_id: number;
  city: string;
  contact: string;
  public_token: string | null;
}

interface MonthRow {
  month: string;
  amount: number;
  count: number;
}

interface PendingRow {
  id: number;
  city: string;
  contact: string;
  plan: string;
  created_at: string;
  method: string;
}

interface FinanceData {
  totals: { total: number; count: number; month: number; today: number };
  months: MonthRow[];
  payments: Payment[];
  pending: PendingRow[];
}

const money = (v: number) => `${v.toLocaleString('ru-RU')} ₽`;

const monthLabel = (m: string) => {
  const [y, mm] = m.split('-');
  const names = [
    'Январь', 'Февраль', 'Март', 'Апрель', 'Май', 'Июнь',
    'Июль', 'Август', 'Сентябрь', 'Октябрь', 'Ноябрь', 'Декабрь',
  ];
  return `${names[Number(mm) - 1]} ${y}`;
};

interface Props {
  password: string;
}

const FinanceTab = ({ password }: Props) => {
  const [data, setData] = useState<FinanceData | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    try {
      const res = await fetch(`${API.adminRequests}?finance=1`, {
        headers: { 'X-Admin-Password': password },
      });
      const json = await res.json();
      if (res.ok) setData(json);
    } catch {
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [password]);

  useEffect(() => {
    load();
  }, [load]);

  if (loading) {
    return <p style={{ color: 'var(--hero-muted)' }}>Загружаем финансы...</p>;
  }

  if (!data) {
    return (
      <div className="card text-center" style={{ color: 'var(--hero-muted)' }}>
        Не удалось загрузить данные
      </div>
    );
  }

  const maxMonth = Math.max(...data.months.map((m) => m.amount), 1);

  return (
    <div className="flex flex-col gap-6">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {[
          { label: 'Всего получено', value: money(data.totals.total), icon: 'Wallet' },
          { label: 'В этом месяце', value: money(data.totals.month), icon: 'CalendarDays' },
          { label: 'Сегодня', value: money(data.totals.today), icon: 'Sun' },
          { label: 'Платежей', value: String(data.totals.count), icon: 'Receipt' },
        ].map((s) => (
          <div key={s.label} className="card flex items-center justify-between">
            <div>
              <div className="text-2xl" style={{ fontFamily: 'var(--hero-font-head)' }}>
                {s.value}
              </div>
              <div className="mt-1 text-sm" style={{ color: 'var(--hero-muted)' }}>
                {s.label}
              </div>
            </div>
            <Icon name={s.icon} size={24} style={{ color: 'var(--hero-accent)' }} />
          </div>
        ))}
      </div>

      {data.pending.length > 0 && (
        <div className="card flex flex-col gap-4">
          <div className="flex items-center gap-2" style={{ color: 'var(--hero-accent)' }}>
            <Icon name="Clock" size={17} />
            <span className="text-lg uppercase" style={{ fontFamily: 'var(--hero-font-head)' }}>
              Ждут подтверждения оплаты
            </span>
          </div>
          <div className="flex flex-col gap-2">
            {data.pending.map((p) => {
              const plan = PLAN_INFO[p.plan];
              return (
                <div
                  key={p.id}
                  className="flex flex-wrap items-center gap-3 p-3 text-sm"
                  style={{
                    background: 'var(--hero-surface)',
                    border: '1px solid var(--hero-x-rule)',
                  }}
                >
                  <span className="chip">#{p.id}</span>
                  <span>{p.city}</span>
                  <span style={{ color: 'var(--hero-muted)' }}>{p.contact}</span>
                  {plan && (
                    <span style={{ fontFamily: 'var(--hero-font-head)' }}>
                      {plan.label} · {money(plan.price)}
                    </span>
                  )}
                  {p.method === 'anaton' && (
                    <span className="chip" style={{ color: 'var(--hero-accent)' }}>
                      <Icon name="Coins" size={12} />
                      ANATON
                    </span>
                  )}
                  <span style={{ color: 'var(--hero-muted)', marginLeft: 'auto' }}>
                    {formatDate(p.created_at)}
                  </span>
                </div>
              );
            })}
          </div>
          <p className="text-xs" style={{ color: 'var(--hero-muted)' }}>
            Подтвердить или отклонить можно во вкладке «Заявки».
          </p>
        </div>
      )}

      {data.months.length > 0 && (
        <div className="card flex flex-col gap-4">
          <div className="text-lg uppercase" style={{ fontFamily: 'var(--hero-font-head)' }}>
            По месяцам
          </div>
          <div className="flex flex-col gap-3">
            {data.months.map((m) => (
              <div key={m.month} className="flex flex-col gap-1">
                <div className="flex items-center justify-between text-sm">
                  <span>{monthLabel(m.month)}</span>
                  <span style={{ fontFamily: 'var(--hero-font-head)' }}>{money(m.amount)}</span>
                </div>
                <div style={{ background: 'var(--hero-surface)', height: 8 }}>
                  <div
                    style={{
                      background: 'var(--hero-accent)',
                      height: '100%',
                      width: `${(m.amount / maxMonth) * 100}%`,
                    }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="card flex flex-col gap-4">
        <div className="text-lg uppercase" style={{ fontFamily: 'var(--hero-font-head)' }}>
          Последние платежи
        </div>
        {data.payments.length === 0 ? (
          <span className="text-sm" style={{ color: 'var(--hero-muted)' }}>
            Платежей пока нет
          </span>
        ) : (
          <div className="flex flex-col gap-2">
            {data.payments.map((p) => (
              <div
                key={p.id}
                className="flex flex-wrap items-center gap-3 p-3 text-sm"
                style={{
                  background: 'var(--hero-surface)',
                  border: '1px solid var(--hero-x-rule)',
                }}
              >
                <span
                  style={{ fontFamily: 'var(--hero-font-head)', color: 'var(--hero-x-quarter)' }}
                >
                  {money(p.amount)}
                </span>
                <span className="chip">#{p.request_id}</span>
                <span>{p.city}</span>
                <span style={{ color: 'var(--hero-muted)' }}>{p.contact}</span>
                <span style={{ color: 'var(--hero-muted)' }}>
                  {p.kind === 'extend' ? 'продление' : 'запуск'} · {p.days} дн.
                </span>
                <span style={{ color: 'var(--hero-muted)', marginLeft: 'auto' }}>
                  {formatDate(p.created_at)}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default FinanceTab;