ALTER TABLE t_p94374369_telegram_ad_manager.ad_requests
  ADD COLUMN IF NOT EXISTS pending_ad_text TEXT,
  ADD COLUMN IF NOT EXISTS pending_photo_url TEXT,
  ADD COLUMN IF NOT EXISTS pending_photo_clear BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS pending_at TIMESTAMP,
  ADD COLUMN IF NOT EXISTS pending_rejected_at TIMESTAMP;

CREATE INDEX IF NOT EXISTS idx_ad_requests_pending
  ON t_p94374369_telegram_ad_manager.ad_requests(pending_at)
  WHERE pending_at IS NOT NULL;