import Icon from '@/components/ui/icon';

const Hero = () => (
  <section className="section pt-20 md:pt-28">
    <div className="eyebrow">Автопостинг в Telegram</div>
    <h1
      className="mt-5 text-4xl leading-[1.05] md:text-7xl"
      style={{ fontFamily: 'var(--hero-font-head)', textTransform: 'uppercase' }}
    >
      Ваше объявление
      <br />
      крутится в городских
      <br />
      <span style={{ color: 'var(--hero-accent)' }}>группах 24/7</span>
    </h1>

    <p className="mt-7 max-w-xl text-lg" style={{ color: 'var(--hero-muted)' }}>
      Отправляете текст один раз — дальше бот сам публикует его по расписанию в нужном
      городе. Вы видите статистику и управляете откруткой по личной ссылке.
    </p>

    <div className="mt-10 flex flex-wrap gap-4">
      <a className="btn btn-primary" href="#post">
        Подать объявление
        <Icon name="ArrowRight" size={17} />
      </a>
      <a className="btn btn-ghost" href="#how">
        Как это работает
      </a>
    </div>

    <div className="mt-14 grid gap-5 sm:grid-cols-3">
      {[
        { icon: 'Clock', title: 'Каждые 15 минут', text: 'Интервал публикации настраивается' },
        { icon: 'MapPin', title: 'По городам', text: 'Своя группа под каждый регион' },
        { icon: 'ChartLine', title: 'Прозрачно', text: 'Видно, сколько раз вышло объявление' },
      ].map((f) => (
        <div key={f.title} className="card">
          <Icon name={f.icon} size={26} style={{ color: 'var(--hero-accent)' }} />
          <div
            className="mt-4 text-xl uppercase"
            style={{ fontFamily: 'var(--hero-font-head)' }}
          >
            {f.title}
          </div>
          <p className="mt-2 text-sm" style={{ color: 'var(--hero-muted)' }}>
            {f.text}
          </p>
        </div>
      ))}
    </div>
  </section>
);

export default Hero;
