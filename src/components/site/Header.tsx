import Icon from '@/components/ui/icon';

const Header = () => (
  <header
    className="sticky top-0 z-50 backdrop-blur"
    style={{
      background: 'rgba(13, 15, 18, 0.85)',
      borderBottom: '1px solid var(--hero-x-rule)',
    }}
  >
    <div className="mx-auto flex w-full max-w-6xl items-center justify-between px-5 py-4">
      <a href="/" className="flex items-center gap-2">
        <Icon name="Megaphone" size={22} style={{ color: 'var(--hero-accent)' }} />
        <span
          className="text-lg uppercase"
          style={{ fontFamily: 'var(--hero-font-head)', letterSpacing: '0.08em' }}
        >
          Постовой
        </span>
      </a>

      <nav className="hidden items-center gap-8 md:flex">
        {[
          { href: '#how', label: 'Как работает' },
          { href: '#cities', label: 'Города' },
        ].map((l) => (
          <a
            key={l.href}
            href={l.href}
            className="text-sm transition-colors"
            style={{ color: 'var(--hero-muted)' }}
            onMouseEnter={(e) => (e.currentTarget.style.color = 'var(--hero-text)')}
            onMouseLeave={(e) => (e.currentTarget.style.color = 'var(--hero-muted)')}
          >
            {l.label}
          </a>
        ))}
      </nav>

      <a className="btn btn-primary" href="#post" style={{ padding: '10px 20px', fontSize: '0.75em' }}>
        Подать заявку
      </a>
    </div>
  </header>
);

export default Header;
