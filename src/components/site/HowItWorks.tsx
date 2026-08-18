import Icon from '@/components/ui/icon';

const STEPS = [
  {
    icon: 'Send',
    title: 'Запускаете бота',
    text: 'Нажимаете «Старт» — так мы сможем прислать вам ссылку на статус в личку.',
  },
  {
    icon: 'FileText',
    title: 'Отправляете объявление',
    text: 'Выбираете город, время показа и пишете текст. Можно приложить фото.',
  },
  {
    icon: 'ShieldCheck',
    title: 'Проходите модерацию',
    text: 'Проверяем текст на соответствие правилам группы. Обычно до 15 минут.',
  },
  {
    icon: 'Repeat',
    title: 'Объявление крутится',
    text: 'Бот публикует его по расписанию, пока действует оплаченный период.',
  },
];

const HowItWorks = () => (
  <section className="section" id="how">
    <div className="eyebrow">Процесс</div>
    <h2 className="section-title mt-4">Как это работает</h2>

    <div className="mt-12 grid gap-5 md:grid-cols-2">
      {STEPS.map((s, i) => (
        <div key={s.title} className="card flex gap-5">
          <div
            className="flex h-12 w-12 shrink-0 items-center justify-center"
            style={{ background: 'var(--hero-surface)', border: '1px solid var(--hero-x-rule)' }}
          >
            <Icon name={s.icon} size={20} style={{ color: 'var(--hero-accent)' }} />
          </div>
          <div>
            <div className="flex items-center gap-3">
              <span
                style={{ color: 'var(--hero-accent)', fontFamily: 'var(--hero-font-head)' }}
              >
                {String(i + 1).padStart(2, '0')}
              </span>
              <span
                className="text-xl uppercase"
                style={{ fontFamily: 'var(--hero-font-head)' }}
              >
                {s.title}
              </span>
            </div>
            <p className="mt-2 text-sm" style={{ color: 'var(--hero-muted)' }}>
              {s.text}
            </p>
          </div>
        </div>
      ))}
    </div>
  </section>
);

export default HowItWorks;
