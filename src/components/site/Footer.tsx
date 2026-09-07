import Icon from '@/components/ui/icon';

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
    </div>
  </footer>
);

export default Footer;