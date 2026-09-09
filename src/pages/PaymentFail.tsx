import { useEffect, useState } from 'react';
import Icon from '@/components/ui/icon';

const PaymentFail = () => {
  const [token, setToken] = useState('');

  useEffect(() => {
    try {
      setToken(localStorage.getItem('postovoy_last_token') || '');
    } catch {
      setToken('');
    }
  }, []);

  return (
    <div className="flex min-h-screen items-center justify-center px-5">
      <div className="card max-w-sm text-center">
        <Icon name="XCircle" size={40} style={{ color: 'var(--hero-accent)' }} />
        <h1 className="section-title mt-4" style={{ fontSize: '1.4em' }}>
          Оплата не прошла
        </h1>
        <p className="mt-3 text-sm" style={{ color: 'var(--hero-muted)' }}>
          Платёж не был завершён, деньги не списаны. Попробуйте оплатить ещё раз
          со страницы вашего объявления.
        </p>
        <div className="mt-6 flex flex-wrap justify-center gap-3">
          {token && (
            <a className="btn btn-primary" href={`/status/${token}`}>
              <Icon name="RotateCcw" size={15} />
              Попробовать снова
            </a>
          )}
          <a className="btn btn-ghost" href="/">
            На главную
          </a>
        </div>
      </div>
    </div>
  );
};

export default PaymentFail;
