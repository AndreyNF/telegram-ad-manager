import Icon from '@/components/ui/icon';

const PaymentSuccess = () => (
  <div className="flex min-h-screen items-center justify-center px-5">
    <div className="card max-w-sm text-center">
      <Icon name="CheckCircle2" size={40} style={{ color: 'var(--hero-x-quarter)' }} />
      <h1 className="section-title mt-4" style={{ fontSize: '1.4em' }}>
        Оплата прошла успешно
      </h1>
      <p className="mt-3 text-sm" style={{ color: 'var(--hero-muted)' }}>
        Показы объявления запускаются автоматически. Обычно это занимает
        не больше пары минут — статус можно проверить на странице объявления.
      </p>
      <a className="btn btn-ghost mt-6" href="/">
        На главную
      </a>
    </div>
  </div>
);

export default PaymentSuccess;
