UPDATE t_p94374369_telegram_ad_manager.ad_requests r
SET client_chat_id = u.chat_id
FROM t_p94374369_telegram_ad_manager.telegram_users u
WHERE r.client_chat_id IS NULL
  AND replace(replace(replace(lower(ltrim(r.contact, '@')), '_', ''), '.', ''), '-', '')
      = replace(replace(replace(u.username, '_', ''), '.', ''), '-', '');