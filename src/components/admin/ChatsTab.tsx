import { useCallback, useEffect, useState } from 'react';
import Icon from '@/components/ui/icon';
import { API, formatDate } from '@/lib/api';
import ClientChat from './ClientChat';
import { AdRequest } from './types';

export interface ChatItem {
  id: number;
  city: string;
  contact: string;
  client_name: string | null;
  client_username: string | null;
  can_write: boolean;
  public_token: string | null;
  last_text: string | null;
  last_direction: 'in' | 'out' | null;
  last_at: string | null;
  unread: number;
}

interface Props {
  password: string;
  onRefresh: () => void;
}

const ChatsTab = ({ password, onRefresh }: Props) => {
  const [chats, setChats] = useState<ChatItem[]>([]);
  const [active, setActive] = useState<ChatItem | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    try {
      const res = await fetch(`${API.adminRequests}?chats=1`, {
        headers: { 'X-Admin-Password': password },
      });
      const data = await res.json();
      if (res.ok) setChats(data.chats || []);
    } catch {
      setChats([]);
    } finally {
      setLoading(false);
    }
  }, [password]);

  useEffect(() => {
    load();
    const id = window.setInterval(load, 30000);
    return () => window.clearInterval(id);
  }, [load]);

  const open = (c: ChatItem) => {
    setActive(c);
    setChats((prev) => prev.map((x) => (x.id === c.id ? { ...x, unread: 0 } : x)));
    onRefresh();
  };

  const title = (c: ChatItem) =>
    c.client_name || (c.client_username ? `@${c.client_username}` : c.contact);

  return (
    <div className="mt-6 grid gap-5 lg:grid-cols-[340px_1fr]">
      <div className="flex flex-col gap-2" style={{ maxHeight: 620, overflowY: 'auto' }}>
        {loading && (
          <span className="text-sm" style={{ color: 'var(--hero-muted)' }}>
            Загружаем переписки...
          </span>
        )}

        {!loading && chats.length === 0 && (
          <span className="text-sm" style={{ color: 'var(--hero-muted)' }}>
            Переписок пока нет
          </span>
        )}

        {chats.map((c) => (
          <button
            key={c.id}
            className="flex flex-col gap-1 p-3 text-left"
            style={{
              background: active?.id === c.id ? 'var(--hero-surface)' : 'transparent',
              border: `1px solid ${
                c.unread > 0
                  ? 'var(--hero-accent)'
                  : active?.id === c.id
                    ? 'var(--hero-accent)'
                    : 'var(--hero-x-rule)'
              }`,
            }}
            onClick={() => open(c)}
          >
            <div className="flex items-center justify-between gap-2">
              <span className="text-sm" style={{ fontFamily: 'var(--hero-font-head)' }}>
                {title(c)}
              </span>
              {c.unread > 0 && (
                <span
                  className="text-xs"
                  style={{
                    background: 'var(--hero-accent)',
                    color: '#fff',
                    borderRadius: 10,
                    padding: '1px 8px',
                  }}
                >
                  {c.unread}
                </span>
              )}
            </div>

            <span className="text-xs" style={{ color: 'var(--hero-muted)' }}>
              #{c.id} · {c.city}
              {c.last_at ? ` · ${formatDate(c.last_at)}` : ''}
            </span>

            {c.last_text && (
              <span
                className="text-xs"
                style={{
                  color: c.unread > 0 ? 'var(--hero-text)' : 'var(--hero-muted)',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                }}
              >
                {c.last_direction === 'out' ? 'Вы: ' : ''}
                {c.last_text}
              </span>
            )}
          </button>
        ))}
      </div>

      <div>
        {active ? (
          <ClientChat
            item={
              {
                id: active.id,
                contact: title(active),
                public_token: active.public_token,
                can_write: active.can_write,
              } as AdRequest
            }
            password={password}
            onSent={() => {
              load();
              onRefresh();
            }}
          />
        ) : (
          <div
            className="flex items-center justify-center p-10 text-sm"
            style={{
              background: 'var(--hero-surface)',
              border: '1px solid var(--hero-x-rule)',
              color: 'var(--hero-muted)',
            }}
          >
            <Icon name="MessageCircle" size={18} style={{ marginRight: 8 }} />
            Выберите переписку слева
          </div>
        )}
      </div>
    </div>
  );
};

export default ChatsTab;