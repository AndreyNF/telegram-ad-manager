ALTER TABLE t_p94374369_telegram_ad_manager.ad_requests
  ADD COLUMN IF NOT EXISTS renew_plan TEXT,
  ADD COLUMN IF NOT EXISTS renew_at TIMESTAMP;