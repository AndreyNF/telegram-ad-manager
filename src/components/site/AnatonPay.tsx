import { useState } from 'react';
import Icon from '@/components/ui/icon';

export const ANATON_EXCHANGE = 'https://anaton.io/?r=FZN3OC';
export const ANATON_BOT = 'https://t.me/Anatonex_bot';
export const ANATON_RECEIVER = 'CJQK7PDD';

const isMobile = () =>
  typeof navigator !== 'undefined' &&
  /android|iphone|ipad|ipod|mobile/i.test(navigator.userAgent);

interface Props {
  plan: string;
  busy: boolean;
  onAction: (body: Record<string, unknown>) => void;
}

const AnatonPay = ({ plan, busy, onAction }: Props) => {
  const [copied, setCopied] = useState(false);
  const mobile = isMobile();

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
    <div className="flex flex-col gap-4">
      <ol className="flex flex-col gap-2 text-sm" style={{ color: 'var(--hero-muted)' }}>
        <li>1. Купите монеты ANATON на бирже.</li>
        <li>2. Переведите оплату за тариф на ID получателя — он указан ниже.</li>
        <li>3. Нажмите «Я оплатил» — мы проверим перевод и запустим показы.</li>
      </ol>

      <a
        className="btn btn-primary"
        href={mobile ? ANATON_BOT : ANATON_EXCHANGE}
        target="_blank"
        rel="noreferrer"
        style={{ alignSelf: 'flex-start' }}
      >
        <Icon name={mobile ? 'Send' : 'ExternalLink'} size={15} />
        {mobile ? 'Открыть биржу в Telegram' : 'Перейти на биржу'}
      </a>

      <div
        className="flex flex-wrap items-center gap-3 p-3"
        style={{ background: 'var(--hero-surface)', border: '1px solid var(--hero-x-rule)' }}
      >
        <span className="text-xs uppercase" style={{ color: 'var(--hero-muted)' }}>
          ID для оплаты тарифа
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

      <button
        className="btn btn-ghost"
        disabled={busy}
        style={{ alignSelf: 'flex-start' }}
        onClick={() => onAction({ action: 'renew', plan, method: 'anaton' })}
      >
        <Icon name="Coins" size={15} />
        Я оплатил
      </button>

      <p className="text-xs" style={{ color: 'var(--hero-muted)' }}>
        Сумму в монетах подскажем в Telegram. После перевода мы проверим поступление
        и запустим показы — обычно в течение рабочего дня.
      </p>
    </div>
  );
};

export default AnatonPay;
