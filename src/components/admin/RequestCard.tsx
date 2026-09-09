import { useState } from 'react';
import { AdRequest, PLAN_INFO } from './types';
import ClientChat from './ClientChat';
import RequestHeader from './RequestHeader';
import RequestText from './RequestText';
import RequestPending from './RequestPending';
import RequestStats from './RequestStats';
import RequestActions from './RequestActions';

interface Props {
  item: AdRequest;
  busy: boolean;
  password: string;
  onAction: (body: Record<string, unknown>) => void;
}

const RequestCard = ({ item, busy, password, onAction }: Props) => {
  const plan = item.plan ? PLAN_INFO[item.plan] : undefined;
  const [days, setDays] = useState(plan?.days ?? 30);
  const [interval, setInterval] = useState(15);
  const [open, setOpen] = useState(false);
  const [chatOpen, setChatOpen] = useState(false);
  const [amount, setAmount] = useState(plan ? String(plan.price) : '');
  const [preview, setPreview] = useState(false);

  const c = item.campaign;
  const isPaused = Boolean(c?.paused_until && new Date(c.paused_until) > new Date());
  const photoFailed = Boolean(c?.last_error && /фото не ушло/i.test(c.last_error));

  return (
    <div className="card flex flex-col gap-4">
      <RequestHeader item={item} isPaused={isPaused} photoFailed={photoFailed} />

      <RequestText
        item={item}
        open={open}
        setOpen={setOpen}
        preview={preview}
        setPreview={setPreview}
      />

      <RequestPending item={item} busy={busy} onAction={onAction} />

      <RequestStats item={item} isPaused={isPaused} photoFailed={photoFailed} />

      <RequestActions
        item={item}
        busy={busy}
        isPaused={isPaused}
        days={days}
        setDays={setDays}
        interval={interval}
        setInterval={setInterval}
        amount={amount}
        setAmount={setAmount}
        chatOpen={chatOpen}
        setChatOpen={setChatOpen}
        onAction={onAction}
      />

      {chatOpen && (
        <ClientChat item={item} password={password} onSent={() => onAction({ action: 'refresh' })} />
      )}
    </div>
  );
};

export default RequestCard;
