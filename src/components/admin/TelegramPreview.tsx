import Icon from '@/components/ui/icon';
import { AdRequest } from './types';

interface Props {
  item: AdRequest;
}

const TelegramPreview = ({ item }: Props) => {
  const name = item.client_name?.trim() || '';
  const username = item.client_username?.trim() || '';
  const label = name || (username ? `@${username}` : '');
  const captionFits = item.ad_text.length <= 1024;

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-3">
        <span className="text-sm" style={{ color: 'var(--hero-muted)' }}>
          Так объявление увидят в группе
        </span>
        {item.photo_url && !captionFits && (
          <span className="chip" style={{ color: 'var(--hero-accent)' }}>
            Текст длинный — уйдёт вторым сообщением
          </span>
        )}
      </div>

      <div
        className="max-w-lg overflow-hidden"
        style={{ background: '#17212b', border: '1px solid var(--hero-x-rule)', borderRadius: 10 }}
      >
        {item.photo_url && (
          <img
            src={item.photo_url}
            alt=""
            className="w-full object-contain"
            style={{ maxHeight: 320, background: '#0e1621' }}
          />
        )}

        <div className="p-4">
          {label && (
            <div className="mb-2">
              <span style={{ color: '#6ab3f3', fontWeight: 700 }}>{label}</span>
            </div>
          )}

          <div
            className="whitespace-pre-wrap text-sm"
            style={{ color: '#e9edf1', lineHeight: 1.5 }}
          >
            {item.ad_text}
          </div>
        </div>
      </div>

      {!label && (
        <div className="flex items-start gap-2 text-sm" style={{ color: 'var(--hero-accent)' }}>
          <Icon name="TriangleAlert" size={15} style={{ flexShrink: 0, marginTop: 2 }} />
          <span>Не определён автор — объявление уйдёт без имени и ссылки на Telegram.</span>
        </div>
      )}
    </div>
  );
};

export default TelegramPreview;