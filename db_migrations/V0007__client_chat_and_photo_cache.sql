ALTER TABLE t_p94374369_telegram_ad_manager.ad_requests
  ADD COLUMN IF NOT EXISTS photo_file_id TEXT;

CREATE TABLE IF NOT EXISTS t_p94374369_telegram_ad_manager.client_messages (
  id SERIAL PRIMARY KEY,
  request_id INTEGER NOT NULL,
  direction TEXT NOT NULL,
  text TEXT NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_client_messages_request
  ON t_p94374369_telegram_ad_manager.client_messages(request_id, created_at DESC);