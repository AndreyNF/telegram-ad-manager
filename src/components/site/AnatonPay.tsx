import { useState } from 'react';
import Icon from '@/components/ui/icon';

export const ANATON_EXCHANGE = 'https://anaton.io/?r=FZN3OC';
export const ANATON_RECEIVER = 'CJQK7PDD';

interface Props {
  plan: string;
  busy: boolean;
  onAction: (body: Record<string, unknown>) => void;
}

const AnatonPay = ({ plan, busy, onAction }: Props) => {
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);

  const copyId = async () => {
    try {
      await navigator.clipboard.writeText(ANATON_RECEIVER);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      /* буфер обмена недоступен */
    }
  };

  return (
    <div style={{ borderTop: '1px solid var(--hero-x-rule)', paddingTop: '1rem' }}>
      <button
        type="button"
        className="flex items-center gap-2 text-sm"
        style={{ color: 'var(--hero-muted)' }}
        onClick={() => setOpen((v) => !v)}
      >
        <Icon name={open ? 'ChevronDown' : 'ChevronRight'} size={15} />
        Оплатить монетой ANATON
      </button>

      {open && (
        <div className="mt-4 flex flex-col gap-3">
          <p className="text-sm" style={{ color: 'var(--hero-muted)' }}>
            Купите монеты ANATON на бирже и переведите оплату на наш ID. Сумму
            в монетах подскажем в Telegram — напишите после перевода.
          </p>

          <div
            className="flex flex-wrap items-center gap-3 p-3"
            style={{ background: 'var(--hero-surface)', border: '1px solid var(--hero-x-rule)' }}
          >
            <span className="text-xs uppercase" style={{ color: 'var(--hero-muted)' }}>
              ID получателя
            </span>
            <span
              className="text-base"
              style={{ fontFamily: 'var(--hero-font-head)', letterSpacing: '0.06em' }}
            >
              {ANATON_RECEIVER}
            </span>
            <button
              type="button"
              className="flex items-center gap-1 text-xs"
              style={{ color: 'var(--hero-accent)', marginLeft: 'auto' }}
              onClick={copyId}
            >
              <Icon name={copied ? 'Check' : 'Copy'} size={14} />
              {copied ? 'Скопировано' : 'Копировать'}
            </button>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <a
              className="btn btn-ghost"
              href={ANATON_EXCHANGE}
              target="_blank"
              rel="noreferrer"
            >
              <Icon name="ExternalLink" size={15} />
              Купить ANATON на бирже
            </a>
            <button
              className="btn btn-primary"
              disabled={busy}
              onClick={() => onAction({ action: 'renew', plan, method: 'anaton' })}
            >
              <Icon name="Coins" size={15} />
              Я перевёл монеты
            </button>
          </div>

          <p className="text-xs" style={{ color: 'var(--hero-muted)' }}>
            После нажатия мы проверим поступление и запустим показы вручную —
            обычно в течение рабочего дня.
          </p>
        </div>
      )}
    </div>
  );
};

export default AnatonPay;
