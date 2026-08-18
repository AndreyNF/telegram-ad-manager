import { useState } from 'react';
import Icon from '@/components/ui/icon';
import { tzLabel } from '@/lib/api';
import { CityGroup } from './types';

interface Props {
  groups: CityGroup[];
  busy: boolean;
  onAction: (body: Record<string, unknown>) => void;
}

const EMPTY = {
  id: 0,
  city: '',
  chat_id: '',
  members: '',
  slots: '',
  is_active: true,
  sort_order: 100,
  tz_offset: 3,
};

const TZ_OPTIONS = [2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12];



const GroupsTab = ({ groups, busy, onAction }: Props) => {
  const [draft, setDraft] = useState<CityGroup>(EMPTY);

  const save = () => {
    onAction({ action: 'save_group', ...draft, id: draft.id || undefined });
    setDraft(EMPTY);
  };

  return (
    <div className="flex flex-col gap-6">
      <div className="card flex flex-col gap-5">
        <div className="text-lg uppercase" style={{ fontFamily: 'var(--hero-font-head)' }}>
          {draft.id ? `Редактируем: ${draft.city}` : 'Добавить город'}
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <div>
            <span className="label">Город</span>
            <input
              className="field"
              value={draft.city}
              placeholder="Екатеринбург"
              onChange={(e) => setDraft({ ...draft, city: e.target.value })}
            />
          </div>
          <div>
            <span className="label">ID группы Telegram</span>
            <input
              className="field"
              value={draft.chat_id}
              placeholder="-1001234567890"
              onChange={(e) => setDraft({ ...draft, chat_id: e.target.value })}
            />
            <p className="mt-2 text-xs" style={{ color: 'var(--hero-muted)' }}>
              Оставьте пустым — ID подставится сам, когда бот попадёт в группу.
            </p>
          </div>
          <div>
            <span className="label">Подписчиков (для витрины)</span>
            <input
              className="field"
              value={draft.members}
              placeholder="18 900"
              onChange={(e) => setDraft({ ...draft, members: e.target.value })}
            />
          </div>
          <div>
            <span className="label">Свободные слоты</span>
            <input
              className="field"
              value={draft.slots}
              placeholder="свободно 5 слотов"
              onChange={(e) => setDraft({ ...draft, slots: e.target.value })}
            />
          </div>
          <div>
            <span className="label">Часовой пояс города</span>
            <select
              className="field"
              value={draft.tz_offset}
              onChange={(e) => setDraft({ ...draft, tz_offset: Number(e.target.value) })}
            >
              {TZ_OPTIONS.map((tz) => (
                <option key={tz} value={tz}>
                  {tzLabel(tz)} (UTC+{tz})
                </option>
              ))}
            </select>
            <p className="mt-2 text-xs" style={{ color: 'var(--hero-muted)' }}>
              По нему считается время показа объявлений в этом городе.
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <button className="btn btn-primary" disabled={busy || !draft.city} onClick={save}>
            {draft.id ? 'Сохранить' : 'Добавить город'}
          </button>
          {draft.id > 0 && (
            <button className="btn btn-ghost" onClick={() => setDraft(EMPTY)}>
              Отменить
            </button>
          )}
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        {groups.map((g) => (
          <div key={g.id} className="card flex flex-col gap-3">
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="text-xl uppercase" style={{ fontFamily: 'var(--hero-font-head)' }}>
                  {g.city}
                </div>
                <div
                  className="mt-1 text-sm"
                  style={{ color: g.chat_id ? 'var(--hero-muted)' : 'var(--hero-accent)' }}
                >
                  {g.chat_id || 'ID группы не задан'}
                </div>
              </div>
              <div className="flex flex-col items-end gap-2">
                <span
                  className="chip"
                  style={{ color: g.is_active ? 'var(--hero-x-quarter)' : 'var(--hero-muted)' }}
                >
                  {g.is_active ? 'Показывается' : 'Скрыт'}
                </span>
                <span className="chip" style={{ color: 'var(--hero-muted)' }}>
                  {tzLabel(g.tz_offset)}
                </span>
              </div>
            </div>

            <div className="flex flex-wrap gap-2">
              <button
                className="btn btn-ghost"
                style={{ padding: '8px 16px', fontSize: '0.72em' }}
                onClick={() => setDraft(g)}
              >
                <Icon name="Pencil" size={14} />
                Изменить
              </button>
              <button
                className="btn btn-ghost"
                disabled={busy}
                style={{ padding: '8px 16px', fontSize: '0.72em' }}
                onClick={() => onAction({ action: 'toggle_group', id: g.id })}
              >
                {g.is_active ? 'Скрыть' : 'Показать'}
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default GroupsTab;