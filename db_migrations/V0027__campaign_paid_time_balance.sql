ALTER TABLE t_p94374369_telegram_ad_manager.campaigns
ADD COLUMN IF NOT EXISTS last_tick_at timestamp without time zone;

UPDATE t_p94374369_telegram_ad_manager.campaigns
SET time_left_seconds = GREATEST(0, EXTRACT(EPOCH FROM (expires_at - CURRENT_TIMESTAMP))::int)
WHERE time_left_seconds IS NULL AND expires_at IS NOT NULL;

UPDATE t_p94374369_telegram_ad_manager.campaigns
SET time_left_seconds = COALESCE(time_left_seconds, days_paid * 86400, 0)
WHERE time_left_seconds IS NULL;

UPDATE t_p94374369_telegram_ad_manager.campaigns
SET last_tick_at = CURRENT_TIMESTAMP
WHERE state = 'running' AND last_tick_at IS NULL;