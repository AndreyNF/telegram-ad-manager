import Icon from '@/components/ui/icon';
import useCities from '@/hooks/useCities';

const Cities = () => {
  const { cities, loading } = useCities();

  return (
    <section className="section" id="cities">
      <div className="eyebrow">География</div>
      <h2 className="section-title mt-4">Города и группы</h2>

      {loading ? (
        <p className="mt-8" style={{ color: 'var(--hero-muted)' }}>
          Загружаем список...
        </p>
      ) : (
        <div className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {cities.map((c) => (
            <div key={c.city} className="card flex items-start justify-between gap-4">
              <div>
                <div
                  className="text-xl uppercase"
                  style={{ fontFamily: 'var(--hero-font-head)' }}
                >
                  {c.city}
                </div>
                {c.members && (
                  <div className="mt-2 text-sm" style={{ color: 'var(--hero-muted)' }}>
                    {c.members} подписчиков
                  </div>
                )}
                {c.slots && (
                  <div className="mt-1 text-sm" style={{ color: 'var(--hero-x-quarter)' }}>
                    {c.slots}
                  </div>
                )}
              </div>
              <Icon name="MapPin" size={20} style={{ color: 'var(--hero-accent)' }} />
            </div>
          ))}
        </div>
      )}
    </section>
  );
};

export default Cities;
