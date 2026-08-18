import Icon from '@/components/ui/icon';

export const PLANS = [
  {
    key: 'hour',
    title: 'Час',
    price: 300,
    note: 'Быстрый тест или срочное предложение',
    perks: ['Публикации весь час', 'Идеально для акций «здесь и сейчас»'],
  },
  {
    key: 'day',
    title: 'Сутки',
    price: 2000,
    note: 'Полный день показов в вашем городе',
    perks: ['Показы в выбранное вами время', 'Можно ставить на паузу'],
  },
  {
    key: 'week',
    title: 'Неделя',
    price: 5000,
    note: 'Выгоднее, чем 7 дней по суточному тарифу',
    perks: ['7 дней показов', 'Правка текста и фото в кабинете'],
  },
  {
    key: 'month',
    title: 'Месяц',
    price: 10000,
    note: 'Максимальная выгода на длинной дистанции',
    perks: ['30 дней показов', 'Приоритет в модерации'],
  },
];

const priceLabel = (value: number) => `${value.toLocaleString('ru-RU')} ₽`;

const Pricing = () => (
  <section className="section" id="pricing">
    <div className="eyebrow">Тарифы</div>
    <h2 className="section-title mt-4">Сколько стоит</h2>
    <p className="mt-4 max-w-2xl text-sm" style={{ color: 'var(--hero-muted)' }}>
      Тариф оплачивается за каждое объявление отдельно. Запустили два объявления — у каждого свой
      срок, своё расписание и свой кабинет управления.
    </p>

    <div className="mt-12 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
      {PLANS.map((p) => (
        <div
          key={p.key}
          className="card flex flex-col gap-4"
          style={p.key === 'week' ? { borderColor: 'var(--hero-accent)' } : undefined}
        >
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xl uppercase" style={{ fontFamily: 'var(--hero-font-head)' }}>
              {p.title}
            </span>
            {p.key === 'week' && (
              <span
                className="text-xs uppercase"
                style={{ color: 'var(--hero-accent)', letterSpacing: '0.08em' }}
              >
                Хит
              </span>
            )}
          </div>

          <div className="text-3xl" style={{ fontFamily: 'var(--hero-font-head)' }}>
            {priceLabel(p.price)}
          </div>

          <p className="text-sm" style={{ color: 'var(--hero-muted)' }}>
            {p.note}
          </p>

          <div className="flex flex-col gap-2">
            {p.perks.map((perk) => (
              <span key={perk} className="flex items-start gap-2 text-sm">
                <Icon
                  name="Check"
                  size={15}
                  style={{ color: 'var(--hero-accent)', flexShrink: 0, marginTop: 3 }}
                />
                {perk}
              </span>
            ))}
          </div>

          <a
            className={p.key === 'week' ? 'btn btn-primary' : 'btn btn-ghost'}
            href="#post"
            style={{ marginTop: 'auto', padding: '11px 20px', fontSize: '0.72em' }}
          >
            Выбрать
          </a>
        </div>
      ))}
    </div>

    <p className="mt-8 text-sm" style={{ color: 'var(--hero-muted)' }}>
      Оплата после модерации объявления. Показы стартуют сразу, как только тариф активирован.
    </p>
  </section>
);

export default Pricing;