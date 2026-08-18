ALTER TABLE t_p94374369_telegram_ad_manager.campaigns
  ADD COLUMN IF NOT EXISTS price_amount NUMERIC(10, 2),
  ADD COLUMN IF NOT EXISTS paid_at TIMESTAMP,
  ADD COLUMN IF NOT EXISTS payment_note TEXT;

CREATE TABLE IF NOT EXISTS t_p94374369_telegram_ad_manager.payments (
  id SERIAL PRIMARY KEY,
  campaign_id INTEGER NOT NULL,
  request_id INTEGER NOT NULL,
  amount NUMERIC(10, 2) NOT NULL,
  days INTEGER NOT NULL,
  kind TEXT NOT NULL DEFAULT 'start',
  note TEXT,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_payments_request
  ON t_p94374369_telegram_ad_manager.payments(request_id, created_at DESC);