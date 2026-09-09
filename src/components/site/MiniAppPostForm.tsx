import { useState, useEffect } from 'react';
import Icon from '@/components/ui/icon';
import { API, hourLabel } from '@/lib/api';
import { PLANS } from './Pricing';
import preparePhoto from '@/lib/photo';
import type { City } from '@/hooks/useCities';

const HOURS = Array.from({ length: 24 }, (_, i) => i);

interface Props {
  cities: City[];
  initData: string;
  onDone: () => void;
  onCancel: () => void;
}

const MiniAppPostForm = ({ cities, initData, onDone, onCancel }: Props) => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [photo, setPhoto] = useState<{ name: string; type: string; data: string } | null>(null);
  const [form, setForm] = useState({
    city: '',
    text: '',
    start_hour: 9,
    end_hour: 21,
    plan: 'week',
  });

  useEffect(() => {
    if (!form.city && cities.length > 0) {
      setForm((prev) => ({ ...prev, city: cities[0].city }));
    }
  }, [cities]);

  const selected = cities.find((c) => c.city === form.city);
  const tz = selected
    ? selected.tz_offset === 3
      ? 'МСК'
      : `МСК${selected.tz_offset > 3 ? '+' : ''}${selected.tz_offset - 3}`
    : '';

  const pickPhoto = async (file: File | undefined) => {
    if (!file) return;
    setError('');
    try {
      setPhoto(await preparePhoto(file));
    } catch {
      setError('Не удалось обработать фото');
    }
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      const res = await fetch(API.miniapp, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Init-Data': initData },
        body: JSON.stringify({ action: 'create', ...form, photo }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Не удалось отправить заявку');
      onDone();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Не удалось отправить заявку');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen px-4 py-6">
      <div className="mb-5 flex items-center gap-2">
        <Icon name="Megaphone" size={20} style={{ color: 'var(--hero-accent)' }} />
        <span className="text-lg uppercase" style={{ fontFamily: 'var(--hero-font-head)' }}>
          Новое объявление
        </span>
      </div>

      <form className="card flex flex-col gap-5" onSubmit={submit}>
        <div>
          <span className="label">Город</span>
          <select
            className="field"
            value={form.city}
            onChange={(e) => setForm({ ...form, city: e.target.value })}
          >
            {cities.map((c) => (
              <option key={c.city} value={c.city}>
                {c.city}
              </option>
            ))}
          </select>
        </div>

        <div>
          <span className="label">Время публикации</span>
          <div className="flex items-center gap-3">
            <select
              className="field"
              value={form.start_hour}
              onChange={(e) => setForm({ ...form, start_hour: Number(e.target.value) })}
            >
              {HOURS.map((h) => (
                <option key={h} value={h}>
                  {hourLabel(h)}
                </option>
              ))}
            </select>
            <span style={{ color: 'var(--hero-muted)' }}>—</span>
            <select
              className="field"
              value={form.end_hour}
              onChange={(e) => setForm({ ...form, end_hour: Number(e.target.value) })}
            >
              {HOURS.map((h) => (
                <option key={h} value={h}>
                  {hourLabel(h)}
                </option>
              ))}
            </select>
          </div>
          <p className="mt-2 text-xs" style={{ color: 'var(--hero-muted)' }}>
            Время местное{tz ? ` (${tz})` : ''}. Вне промежутка показов не будет.
          </p>
        </div>

        <div>
          <span className="label">Тариф</span>
          <div className="grid gap-2">
            {PLANS.map((p) => (
              <button
                key={p.key}
                type="button"
                className="flex items-center justify-between p-3 text-sm"
                style={{
                  background: 'var(--hero-surface)',
                  border: `1px solid ${
                    form.plan === p.key ? 'var(--hero-accent)' : 'var(--hero-x-rule)'
                  }`,
                  color: form.plan === p.key ? 'var(--hero-text)' : 'var(--hero-muted)',
                }}
                onClick={() => setForm({ ...form, plan: p.key })}
              >
                <span>{p.title}</span>
                <span style={{ fontFamily: 'var(--hero-font-head)' }}>
                  {p.price.toLocaleString('ru-RU')} ₽
                </span>
              </button>
            ))}
          </div>
        </div>

        <div>
          <span className="label">Текст объявления</span>
          <textarea
            className="field"
            rows={7}
            placeholder="Что предлагаете, условия, контакты"
            required
            value={form.text}
            onChange={(e) => setForm({ ...form, text: e.target.value })}
          />
        </div>

        <div>
          <span className="label">Фото (необязательно)</span>
          <input
            className="field"
            type="file"
            accept="image/jpeg,image/png,image/webp"
            onChange={(e) => pickPhoto(e.target.files?.[0])}
          />
          {photo && (
            <div className="mt-3 flex items-center gap-3">
              <span className="chip" style={{ color: 'var(--hero-x-quarter)' }}>
                <Icon name="Image" size={14} />
                {photo.name}
              </span>
              <button
                type="button"
                className="btn btn-ghost"
                style={{ padding: '6px 14px', fontSize: '0.72em' }}
                onClick={() => setPhoto(null)}
              >
                Убрать
              </button>
            </div>
          )}
        </div>

        {error && (
          <div className="flex items-start gap-2 text-sm" style={{ color: 'var(--hero-accent)' }}>
            <Icon name="TriangleAlert" size={16} style={{ flexShrink: 0, marginTop: 2 }} />
            <span>{error}</span>
          </div>
        )}

        <button className="btn btn-primary" type="submit" disabled={loading}>
          {loading ? 'Отправляем...' : 'Отправить на модерацию'}
          {!loading && <Icon name="ArrowRight" size={16} />}
        </button>
        <button type="button" className="btn btn-ghost" onClick={onCancel}>
          Отмена
        </button>
      </form>
    </div>
  );
};

export default MiniAppPostForm;
