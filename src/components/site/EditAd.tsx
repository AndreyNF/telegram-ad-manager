import { useState } from 'react';
import Icon from '@/components/ui/icon';
import preparePhoto from '@/lib/photo';

interface Props {
  adText: string;
  photoUrl: string | null;
  busy: boolean;
  onSave: (body: Record<string, unknown>) => void;
  onCancel: () => void;
}

const EditAd = ({ adText, photoUrl, busy, onSave, onCancel }: Props) => {
  const [text, setText] = useState(adText);
  const [photo, setPhoto] = useState<{ name: string; type: string; data: string } | null>(null);
  const [removePhoto, setRemovePhoto] = useState(false);
  const [error, setError] = useState('');

  const pickPhoto = async (file?: File) => {
    if (!file) return;
    setError('');
    try {
      const prepared = await preparePhoto(file);
      setPhoto(prepared);
      setRemovePhoto(false);
    } catch {
      setError('Не удалось обработать фото');
    }
  };

  const submit = () => {
    if (text.trim().length < 10) {
      setError('Текст слишком короткий');
      return;
    }
    onSave({
      action: 'save_edit',
      ad_text: text.trim(),
      remove_photo: removePhoto,
      ...(photo ? { photo } : {}),
    });
  };

  return (
    <div className="mt-6 flex flex-col gap-5">
      <div>
        <span className="label">Текст объявления</span>
        <textarea
          className="field"
          rows={8}
          value={text}
          onChange={(e) => setText(e.target.value)}
        />
      </div>

      <div>
        <span className="label">Фото</span>
        {photoUrl && !removePhoto && !photo && (
          <div className="mb-3 flex items-center gap-3">
            <img
              src={photoUrl}
              alt=""
              className="max-h-24 w-auto object-contain"
              style={{ border: '1px solid var(--hero-x-rule)' }}
            />
            <button
              type="button"
              className="btn btn-ghost"
              style={{ padding: '6px 14px', fontSize: '0.72em' }}
              onClick={() => setRemovePhoto(true)}
            >
              Удалить фото
            </button>
          </div>
        )}

        {removePhoto && (
          <div className="mb-3 flex items-center gap-3">
            <span className="chip" style={{ color: 'var(--hero-accent)' }}>
              Фото будет удалено
            </span>
            <button
              type="button"
              className="btn btn-ghost"
              style={{ padding: '6px 14px', fontSize: '0.72em' }}
              onClick={() => setRemovePhoto(false)}
            >
              Отменить
            </button>
          </div>
        )}

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
        <div className="flex items-center gap-2" style={{ color: 'var(--hero-accent)' }}>
          <Icon name="TriangleAlert" size={17} />
          <span className="text-sm">{error}</span>
        </div>
      )}

      <p className="text-sm" style={{ color: 'var(--hero-muted)' }}>
        Правки уйдут на проверку. До одобрения публикуется текущая версия объявления.
      </p>

      <div className="flex flex-wrap gap-3">
        <button className="btn btn-primary" disabled={busy} onClick={submit}>
          <Icon name="Send" size={15} />
          {busy ? 'Отправляем...' : 'Отправить на проверку'}
        </button>
        <button className="btn btn-ghost" disabled={busy} onClick={onCancel}>
          Отмена
        </button>
      </div>
    </div>
  );
};

export default EditAd;
