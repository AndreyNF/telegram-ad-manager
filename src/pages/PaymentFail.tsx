import Icon from '@/components/ui/icon';

const PaymentFail = () => (
  <div className="flex min-h-screen items-center justify-center px-5">
    <div className="card max-w-sm text-center">
      <Icon name="XCircle" size={40} style={{ color: 'var(--hero-accent)' }} />
      <h1 className="section-title mt-4" style={{ fontSize: '1.4em' }}>
        Оплата не прошла
      </h1>
      <p className="mt-3 text-sm" style={{ color: 'var(--hero-muted)' }}>
        Платёж не был завершён. Попробуйте оплатить ещё раз со страницы
        вашего объявления или выберите другой способ оплаты.
      </p>
      <a className="btn btn-ghost mt-6" href="/">
        На главную
      </a>
    </div>
  </div>
);

export default PaymentFail;
