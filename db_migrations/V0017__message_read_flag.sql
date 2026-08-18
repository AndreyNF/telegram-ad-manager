ALTER TABLE t_p94374369_telegram_ad_manager.client_messages
  ADD COLUMN IF NOT EXISTS is_read BOOLEAN NOT NULL DEFAULT false;

UPDATE t_p94374369_telegram_ad_manager.client_messages
SET is_read = true WHERE direction = 'out';

CREATE INDEX IF NOT EXISTS idx_client_messages_unread
  ON t_p94374369_telegram_ad_manager.client_messages(request_id)
  WHERE direction = 'in' AND is_read = false;