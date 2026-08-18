UPDATE t_p94374369_telegram_ad_manager.ad_requests r
SET client_username = u.username,
    client_name = COALESCE(NULLIF(r.client_name, ''), u.first_name)
FROM t_p94374369_telegram_ad_manager.telegram_users u
WHERE r.client_chat_id = u.chat_id
  AND r.client_username IS NULL;