UPDATE t_p94374369_telegram_ad_manager.campaigns
SET state = 'running',
    fail_streak = 0,
    last_error = NULL,
    stopped_at = NULL,
    next_run_at = CURRENT_TIMESTAMP
WHERE id = 23;