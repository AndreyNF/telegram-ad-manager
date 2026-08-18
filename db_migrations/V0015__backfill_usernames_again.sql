UPDATE t_p94374369_telegram_ad_manager.ad_requests r
SET client_chat_id = COALESCE(r.client_chat_id, u.chat_id),
    client_username = COALESCE(NULLIF(r.client_username, ''), u.username),
    client_name = COALESCE(NULLIF(r.client_name, ''), u.first_name)
FROM t_p94374369_telegram_ad_manager.telegram_users u
WHERE replace(replace(replace(lower(ltrim(r.contact, '@')), '_', ''), '.', ''), '-', '')
      = replace(replace(replace(u.username, '_', ''), '.', ''), '-', '')
  AND (r.client_username IS NULL OR r.client_name IS NULL OR r.client_chat_id IS NULL);

UPDATE t_p94374369_telegram_ad_manager.ad_requests
SET client_username = lower(ltrim(contact, '@'))
WHERE client_username IS NULL AND contact <> '';