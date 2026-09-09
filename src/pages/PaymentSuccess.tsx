import { useEffect, useState } from 'react';
import Icon from '@/components/ui/icon';

const PaymentSuccess = () => {
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
        <Icon name="CheckCircle2" size={40} style={{ color: 'var(--hero-x-quarter)' }} />
        <h1 className="section-title mt-4" style={{ fontSize: '1.4em' }}>
          Оплата прошла успешно
        </h1>
        <p className="mt-3 text-sm" style={{ color: 'var(--hero-muted)' }}>
          Показы объявления запускаются автоматически. Обычно это занимает
          не больше пары минут — статус можно проверить на странице объявления.
        </p>
        <div className="mt-6 flex flex-wrap justify-center gap-3">
          {token && (
            <a className="btn btn-primary" href={`/status/${token}`}>
              <Icon name="FileText" size={15} />
              Моё объявление
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

export default PaymentSuccess;
