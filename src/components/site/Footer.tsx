import Icon from '@/components/ui/icon';
import { BOT_URL } from '@/lib/api';

const Footer = () => (
  <footer style={{ borderTop: '1px solid var(--hero-x-rule)' }}>
    <div className="mx-auto flex w-full max-w-6xl flex-wrap items-center justify-between gap-6 px-5 py-10">
      <div className="flex items-center gap-2">
        <Icon name="Megaphone" size={20} style={{ color: 'var(--hero-accent)' }} />
        <span
          className="uppercase"
          style={{ fontFamily: 'var(--hero-font-head)', letterSpacing: '0.08em' }}
        >
          Постовой
        </span>
      </div>

      <div className="flex flex-wrap items-center gap-6 text-sm" style={{ color: 'var(--hero-muted)' }}>
        <a href={BOT_URL} target="_blank" rel="noreferrer" className="flex items-center gap-2">
          <Icon name="Send" size={16} />
          Наш бот
        </a>
        <a href="/admin">Вход для модератора</a>
      </div>
    </div>

    <div
      className="mx-auto flex w-full max-w-6xl flex-col items-center gap-3 px-5 pb-10"
      style={{ borderTop: '1px solid var(--hero-x-rule)', paddingTop: 24 }}
    >
      <span className="text-xs uppercase" style={{ color: 'var(--hero-muted)', letterSpacing: '0.08em' }}>
        Приём оплаты
      </span>
      <a href="https://freekassa.net" target="_blank" rel="noreferrer" title="Free-Kassa">
        <img
          src="/freekassa.png"
          alt="Оплата через Free-Kassa"
          width={170}
          height={60}
          loading="lazy"
          style={{ maxWidth: '100%', height: 'auto' }}
        />
      </a>
    </div>
  </footer>
);

export default Footer;