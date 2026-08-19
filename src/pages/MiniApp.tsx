import { useEffect, useState } from 'react';
import Icon from '@/components/ui/icon';
import { API, formatDateTz, hourLabel, tzLabel } from '@/lib/api';
import Status from './Status';

interface Ad {
  id: number;
  city: string;
  status: string;
  public_token: string;
  ad_text: string;
  photo_url: string | null;
  start_hour: number;
  end_hour: number;
  plan: string | null;
  has_pending: boolean;
  has_renew: boolean;
  state: string | null;
  posts_sent: number | null;
  expires_at: string | null;
  interval_minutes: number | null;
  paused_until: string | null;
  tz_offset: number;
  total_paid: number;
}

interface TgWebApp {
  initData: string;
  ready: () => void;
  expand: () => void;
  openLink: (url: string) => void;
  colorScheme?: string;
  BackButton?: {
    show: () => void;
    hide: () => void;
    onClick: (cb: () => void) => void;
    offClick: (cb: () => void) => void;
  };
}

const getTg = () =>
  (window as unknown as { Telegram?: { WebApp?: TgWebApp } }).Telegram?.WebApp;

const stateInfo = (ad: Ad) => {
  const paused = ad.paused_until && new Date(ad.paused_until) > new Date();
  if (paused) return { label: 'На паузе', color: 'var(--hero-accent)' };
  if (ad.state === 'running') return { label: 'Публикуется', color: 'var(--hero-x-quarter)' };
  if (ad.state === 'expired') return { label: 'Срок закончился', color: 'var(--hero-accent)' };
  if (ad.state === 'stopped') return { label: 'Остановлено', color: 'var(--hero-muted)' };
  if (ad.status === 'rejected') return { label: 'Отклонено', color: 'var(--hero-accent)' };
  if (ad.status === 'approved') return { label: 'Одобрено', color: 'var(--hero-x-quarter)' };
  return { label: 'Ждёт модерации', color: 'var(--hero-muted)' };
};

const MiniApp = () => {
  const [ads, setAds] = useState<Ad[]>([]);
  const [name, setName] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [active, setActive] = useState('');

  useEffect(() => {
    const back = getTg()?.BackButton;
    if (!back) return;
    const handler = () => setActive('');
    if (active) {
      back.onClick(handler);
      back.show();
    } else {
      back.hide();
    }
    return () => back.offClick(handler);
  }, [active]);

  useEffect(() => {
    const tg = getTg();
    tg?.ready();
    tg?.expand();

    const initData = tg?.initData || '';
    if (!initData) {
      setError('Откройте кабинет через нашего Telegram-бота');
      setLoading(false);
      return;
    }

    fetch(API.miniapp, { headers: { 'X-Init-Data': initData } })
      .then(async (res) => {
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Не удалось загрузить');
        setAds(data.ads || []);
        setName(data.user?.name || '');
      })
      .catch((err) => setError(err instanceof Error ? err.message : 'Не удалось загрузить'))
      .finally(() => setLoading(false));
  }, []);

  if (active) {
    return <Status tokenOverride={active} onBack={() => setActive('')} />;
  }


  if (loading) {
    return (
      <div
        className="flex min-h-screen items-center justify-center"
        style={{ color: 'var(--hero-muted)' }}
      >
        Загружаем ваши объявления...
      </div>
    );
  }

  return (
    <div className="min-h-screen px-4 py-6">
      <div className="mb-6 flex items-center gap-2">
        <Icon name="Megaphone" size={20} style={{ color: 'var(--hero-accent)' }} />
        <span className="text-lg uppercase" style={{ fontFamily: 'var(--hero-font-head)' }}>
          {name ? `${name}, ваши объявления` : 'Ваши объявления'}
        </span>
      </div>

      {error && (
        <div className="card flex items-start gap-3">
          <Icon
            name="TriangleAlert"
            size={18}
            style={{ color: 'var(--hero-accent)', flexShrink: 0, marginTop: 2 }}
          />
          <span className="text-sm">{error}</span>
        </div>
      )}

      {!error && ads.length === 0 && (
        <div className="card text-center text-sm" style={{ color: 'var(--hero-muted)' }}>
          Объявлений пока нет. Отправьте боту команду /post — и подадим первое.
        </div>
      )}

      <div className="flex flex-col gap-4">
        {ads.map((ad) => {
          const info = stateInfo(ad);
          return (
            <div key={ad.id} className="card flex flex-col gap-3">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-lg uppercase" style={{ fontFamily: 'var(--hero-font-head)' }}>
                  {ad.city}
                </span>
                <span className="chip">#{ad.id}</span>
                <span className="chip" style={{ color: info.color }}>
                  {info.label}
                </span>
              </div>

              {ad.photo_url && (
                <img
                  src={ad.photo_url}
                  alt=""
                  className="max-h-40 w-full object-contain"
                  style={{ border: '1px solid var(--hero-x-rule)' }}
                />
              )}

              <div
                className="whitespace-pre-wrap p-3 text-sm"
                style={{
                  background: 'var(--hero-surface)',
                  border: '1px solid var(--hero-x-rule)',
                  maxHeight: 130,
                  overflow: 'hidden',
                }}
              >
                {ad.ad_text.length > 200 ? `${ad.ad_text.slice(0, 200)}...` : ad.ad_text}
              </div>

              <div
                className="flex flex-wrap gap-3 text-xs"
                style={{ color: 'var(--hero-muted)' }}
              >
                <span>
                  <Icon name="Clock" size={12} /> {hourLabel(ad.start_hour)}—
                  {hourLabel(ad.end_hour)} {tzLabel(ad.tz_offset)}
                </span>
                {ad.state && <span>Публикаций: {ad.posts_sent}</span>}
                {ad.expires_at && (
                  <span>До {formatDateTz(ad.expires_at, ad.tz_offset)}</span>
                )}
                {ad.total_paid > 0 && <span>Оплачено: {ad.total_paid} ₽</span>}
              </div>

              {(ad.has_pending || ad.has_renew) && (
                <span className="chip" style={{ color: 'var(--hero-accent)' }}>
                  {ad.has_pending ? 'Правки на проверке' : 'Продление оформляется'}
                </span>
              )}

              <button
                className="btn btn-primary"
                style={{ padding: '11px 18px', fontSize: '0.72em' }}
                onClick={() => setActive(ad.public_token)}
              >
                <Icon name="Settings" size={14} />
                Управлять объявлением
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default MiniApp;