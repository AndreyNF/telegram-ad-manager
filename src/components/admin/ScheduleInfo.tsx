import { useState } from 'react';
import Icon from '@/components/ui/icon';
import { API } from '@/lib/api';

const ScheduleInfo = () => {
  const [copied, setCopied] = useState(false);

  const copy = () => {
    navigator.clipboard.writeText(API.publishRunner);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="card flex flex-col gap-5">
      <div className="flex items-center gap-3">
        <Icon name="Timer" size={22} style={{ color: 'var(--hero-accent)' }} />
        <span className="text-lg uppercase" style={{ fontFamily: 'var(--hero-font-head)' }}>
          Автозапуск публикации
        </span>
      </div>

      <p className="text-sm" style={{ color: 'var(--hero-muted)' }}>
        Объявления выходят сами, когда кто-то заходит на сайт. Чтобы публикация шла строго по
        расписанию даже без посетителей, подключите бесплатный планировщик: он будет открывать
        ссылку ниже каждые 5 минут.
      </p>

      <div className="flex flex-wrap items-center gap-3">
        <code
          className="flex-1 p-3 text-xs"
          style={{
            background: 'var(--hero-surface)',
            border: '1px solid var(--hero-x-rule)',
            wordBreak: 'break-all',
            minWidth: 240,
            color: 'var(--hero-x-quarter)',
          }}
        >
          {API.publishRunner}
        </code>
        <button
          className="btn btn-ghost"
          style={{ padding: '10px 18px', fontSize: '0.72em' }}
          onClick={copy}
        >
          <Icon name={copied ? 'Check' : 'Copy'} size={14} />
          {copied ? 'Скопировано' : 'Копировать'}
        </button>
      </div>

      <ol className="flex flex-col gap-3 text-sm" style={{ color: 'var(--hero-muted)' }}>
        {[
          <>
            Откройте{' '}
            <a
              href="https://cron-job.org"
              target="_blank"
              rel="noreferrer"
              style={{ color: 'var(--hero-accent)' }}
            >
              cron-job.org
            </a>{' '}
            и зарегистрируйтесь — это бесплатно.
          </>,
          'Нажмите «Create cronjob» и вставьте скопированную ссылку в поле URL.',
          'В расписании выберите «Every 5 minutes» и сохраните.',
        ].map((step, i) => (
          <li key={i} className="flex gap-3">
            <span style={{ color: 'var(--hero-accent)', fontFamily: 'var(--hero-font-head)' }}>
              {String(i + 1).padStart(2, '0')}
            </span>
            <span>{step}</span>
          </li>
        ))}
      </ol>
    </div>
  );
};

export default ScheduleInfo;
