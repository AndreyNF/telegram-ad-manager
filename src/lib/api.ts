export const API = {
  adRequests: 'https://functions.poehali.dev/d16fe7f8-0cb5-4f11-9d85-771f4a6a9844',
  adminRequests: 'https://functions.poehali.dev/87c85baa-2857-459a-9379-ca23416879fa',
  clientStatus: 'https://functions.poehali.dev/0f051941-4689-49fc-b184-f041a807d5a6',
  publishRunner: 'https://functions.poehali.dev/7ff2e024-dc42-4763-95b7-5aee70dc48b1',
};

export const BOT_USERNAME = 'kupidom_moder_bot';
export const BOT_URL = `https://t.me/${BOT_USERNAME}`;

/** База отдаёт время в UTC без пометки — приводим его к настоящему UTC */
const toUtcDate = (value: string) => {
  const iso = value.includes('T') ? value : value.replace(' ', 'T');
  const hasZone = /[Zz]|[+-]\d{2}:?\d{2}$/.test(iso);
  return new Date(hasZone ? iso : `${iso}Z`);
};

export const formatDate = (value?: string | null) => {
  if (!value) return '—';
  const d = toUtcDate(value);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleString('ru-RU', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
};

/** Показывает время в часовом поясе города публикации */
export const formatDateTz = (value?: string | null, tzOffset = 3) => {
  if (!value) return '—';
  const d = toUtcDate(value);
  if (Number.isNaN(d.getTime())) return '—';
  const shifted = new Date(d.getTime() + tzOffset * 3600 * 1000);
  return shifted.toLocaleString('ru-RU', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'UTC',
  });
};

export const tzLabel = (tz: number) => (tz === 3 ? 'МСК' : `МСК${tz > 3 ? '+' : ''}${tz - 3}`);

export const hourLabel = (h: number) => `${String(h).padStart(2, '0')}:00`;