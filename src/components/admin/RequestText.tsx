import { AdRequest } from './types';
import TelegramPreview from './TelegramPreview';

interface Props {
  item: AdRequest;
  open: boolean;
  setOpen: (value: boolean) => void;
  preview: boolean;
  setPreview: (value: boolean) => void;
}

const RequestText = ({ item, open, setOpen, preview, setPreview }: Props) => {
  const text = open || item.ad_text.length <= 220 ? item.ad_text : `${item.ad_text.slice(0, 220)}...`;

  return (
    <div
      className="p-4"
      style={{ background: 'var(--hero-surface)', border: '1px solid var(--hero-x-rule)' }}
    >
      <div className="mb-3 flex flex-wrap gap-2">
        {[
          { key: 'text', label: 'Текст' },
          { key: 'preview', label: 'Как в группе' },
        ].map((t) => (
          <button
            key={t.key}
            className="chip"
            style={{
              cursor: 'pointer',
              color: preview === (t.key === 'preview') ? 'var(--hero-accent)' : 'var(--hero-muted)',
              borderColor:
                preview === (t.key === 'preview') ? 'var(--hero-accent)' : 'var(--hero-x-rule)',
            }}
            onClick={() => setPreview(t.key === 'preview')}
          >
            {t.label}
          </button>
        ))}
      </div>

      {preview ? (
        <TelegramPreview item={item} />
      ) : (
        <div className="whitespace-pre-wrap text-sm">
          {text}
          {item.ad_text.length > 220 && (
            <button
              className="mt-2 block text-xs"
              style={{ color: 'var(--hero-accent)' }}
              onClick={() => setOpen(!open)}
            >
              {open ? 'Свернуть' : 'Показать полностью'}
            </button>
          )}
        </div>
      )}
    </div>
  );
};

export default RequestText;
