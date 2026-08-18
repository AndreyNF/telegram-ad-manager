ALTER TABLE t_p94374369_telegram_ad_manager.telegram_users
  ADD COLUMN IF NOT EXISTS first_name TEXT;

ALTER TABLE t_p94374369_telegram_ad_manager.ad_requests
  ADD COLUMN IF NOT EXISTS client_name TEXT,
  ADD COLUMN IF NOT EXISTS client_username TEXT;