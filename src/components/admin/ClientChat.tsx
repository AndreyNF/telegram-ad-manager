import { useCallback, useEffect, useRef, useState } from 'react';
import Icon from '@/components/ui/icon';
import { API, formatDate } from '@/lib/api';
import { AdRequest, ClientMessage } from './types';

interface Props {
  item: AdRequest;
  password: string;
  onSent: () => void;
}

const QUICK = [
  'Здравствуйте! Уточните, пожалуйста, детали по объявлению.',
  'Ваше объявление одобрено и запущено в показ.',
  'Объявление отклонено: текст нарушает правила площадки.',
  'Срок показов подходит к концу. Хотите продлить?',
];

const ClientChat = ({ item, password, onSent }: Props) => {
  const [messages, setMessages] = useState<ClientMessage[]>([]);
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [loaded, setLoaded] = useState(false);
  const boxRef = useRef<HTMLDivElement>(null);

  const load = useCallback(async () => {
    try {
      const res = await fetch(`${API.adminRequests}?messages_for=${item.id}`, {
        headers: { 'X-Admin-Password': password },
      });
      const data = await res.json();
      if (res.ok) setMessages(data.messages || []);
    } catch {
      setError('Не удалось загрузить переписку');
    } finally {
      setLoaded(true);
    }
  }, [item.id, password]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    if (boxRef.current) boxRef.current.scrollTop = boxRef.current.scrollHeight;
  }, [messages]);

  const post = async (body: Record<string, unknown>) => {
    setBusy(true);
    setError('');
    try {
      const res = await fetch(API.adminRequests, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Admin-Password': password },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Не удалось отправить');
      setText('');
      await load();
      onSent();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Не удалось отправить');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div
      className="flex flex-col gap-3 p-4"
      style={{ background: 'var(--hero-surface)', border: '1px solid var(--hero-x-rule)' }}
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <span className="text-sm" style={{ color: 'var(--hero-muted)' }}>
          Переписка с {item.contact}
        </span>
        <button
          type="button"
          className="btn btn-ghost"
          disabled={busy || !item.public_token}
          style={{ padding: '8px 14px', fontSize: '0.7em' }}
          onClick={() => post({ action: 'send_cabinet_link', id: item.id })}
        >
          <Icon name="Link" size={14} />
          Отправить ссылку на кабинет
        </button>
      </div>

      {!item.can_write && (
        <div className="flex items-start gap-2 text-sm" style={{ color: 'var(--hero-accent)' }}>
          <Icon name="TriangleAlert" size={15} style={{ flexShrink: 0, marginTop: 2 }} />
          <span>
            Клиент не запускал бота или ник указан с опечаткой — сообщения доставить нельзя.
          </span>
        </div>
      )}

      <div
        ref={boxRef}
        className="flex flex-col gap-2 overflow-y-auto"
        style={{ maxHeight: 260 }}
      >
        {loaded && messages.length === 0 && (
          <span className="text-sm" style={{ color: 'var(--hero-muted)' }}>
            Сообщений пока нет
          </span>
        )}
        {messages.map((m, i) => (
          <div
            key={i}
            className="p-3 text-sm"
            style={{
              background: 'var(--hero-bg)',
              border: '1px solid var(--hero-x-rule)',
              alignSelf: m.direction === 'out' ? 'flex-end' : 'flex-start',
              maxWidth: '85%',
            }}
          >
            <div
              className="mb-1 text-xs uppercase"
              style={{ color: m.direction === 'out' ? 'var(--hero-x-quarter)' : 'var(--hero-muted)' }}
            >
              {m.direction === 'out' ? 'Вы' : item.contact} · {formatDate(m.created_at)}
            </div>
            <div className="whitespace-pre-wrap">{m.text}</div>
          </div>
        ))}
      </div>

      <div className="flex flex-wrap gap-2">
        {QUICK.map((q) => (
          <button
            key={q}
            type="button"
            className="chip"
            style={{ cursor: 'pointer' }}
            onClick={() => setText(q)}
          >
            {q.length > 34 ? `${q.slice(0, 34)}...` : q}
          </button>
        ))}
      </div>

      <textarea
        className="field"
        rows={3}
        placeholder="Сообщение клиенту в Telegram"
        value={text}
        onChange={(e) => setText(e.target.value)}
      />

      {error && (
        <span className="text-sm" style={{ color: 'var(--hero-accent)' }}>
          {error}
        </span>
      )}

      <button
        type="button"
        className="btn btn-primary"
        disabled={busy || !text.trim()}
        style={{ padding: '10px 20px', fontSize: '0.72em', alignSelf: 'flex-start' }}
        onClick={() => post({ action: 'send_message', id: item.id, text })}
      >
        <Icon name="Send" size={14} />
        Отправить
      </button>
    </div>
  );
};

export default ClientChat;
