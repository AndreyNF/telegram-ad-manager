UPDATE t_p94374369_telegram_ad_manager.campaigns
SET state = 'archived',
    last_error = NULL
WHERE city = 'Екатеринбург' AND id <> 23 AND state <> 'running';