import { useState } from 'react';
import Icon from '@/components/ui/icon';
import { hourLabel } from '@/lib/api';

const HOURS = Array.from({ length: 24 }, (_, i) => i);

interface Props {
  startHour: number;
  endHour: number;
  tzOffset: number;
  busy: boolean;
  onSave: (body: Record<string, unknown>) => void;
}

const tzLabel = (tz: number) => (tz === 3 ? 'МСК' : `МСК${tz > 3 ? '+' : ''}${tz - 3}`);

const EditWindow = ({ startHour, endHour, tzOffset, busy, onSave }: Props) => {
  const [open, setOpen] = useState(false);
  const [start, setStart] = useState(startHour);
  const [end, setEnd] = useState(endHour);

  const changed = start !== startHour || end !== endHour;

  return (
    <div className="card mt-6 flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="text-lg uppercase" style={{ fontFamily: 'var(--hero-font-head)' }}>
          Время показов
        </div>
        {!open && (
          <button
            className="btn btn-ghost"
            style={{ padding: '8px 16px', fontSize: '0.72em' }}
            onClick={() => setOpen(true)}
          >
            <Icon name="Pencil" size={14} />
            Изменить
          </button>
        )}
      </div>

      {!open ? (
        <p className="text-sm" style={{ color: 'var(--hero-muted)' }}>
          Сейчас объявление публикуется с {hourLabel(startHour)} до {hourLabel(endHour)} по времени
          вашего города ({tzLabel(tzOffset)}).
        </p>
      ) : (
        <>
          <div className="flex flex-wrap items-center gap-3">
            <select
              className="field"
              value={start}
              onChange={(e) => setStart(Number(e.target.value))}
              style={{ width: 120 }}
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
              value={end}
              onChange={(e) => setEnd(Number(e.target.value))}
              style={{ width: 120 }}
            >
              {HOURS.map((h) => (
                <option key={h} value={h}>
                  {hourLabel(h)}
                </option>
              ))}
            </select>
            <span className="chip" style={{ color: 'var(--hero-muted)' }}>
              {tzLabel(tzOffset)}
            </span>
          </div>

          <p className="text-xs" style={{ color: 'var(--hero-muted)' }}>
            Время местное — по часовому поясу города публикации. Изменения применяются сразу,
            модерация не нужна.
          </p>

          <div className="flex flex-wrap gap-3">
            <button
              className="btn btn-primary"
              disabled={busy || start === end || !changed}
              onClick={() => onSave({ action: 'set_window', start_hour: start, end_hour: end })}
            >
              {busy ? 'Сохраняем...' : 'Сохранить'}
            </button>
            <button
              className="btn btn-ghost"
              disabled={busy}
              onClick={() => {
                setStart(startHour);
                setEnd(endHour);
                setOpen(false);
              }}
            >
              Отмена
            </button>
          </div>
        </>
      )}
    </div>
  );
};

export default EditWindow;
