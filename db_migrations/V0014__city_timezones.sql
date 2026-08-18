ALTER TABLE t_p94374369_telegram_ad_manager.city_groups
  ADD COLUMN IF NOT EXISTS tz_offset INTEGER NOT NULL DEFAULT 3;

UPDATE t_p94374369_telegram_ad_manager.city_groups SET tz_offset = 3
  WHERE city IN ('Москва', 'Санкт-Петербург', 'Казань', 'Краснодар');

UPDATE t_p94374369_telegram_ad_manager.city_groups SET tz_offset = 5
  WHERE city = 'Екатеринбург';

UPDATE t_p94374369_telegram_ad_manager.city_groups SET tz_offset = 7
  WHERE city = 'Новосибирск';

UPDATE t_p94374369_telegram_ad_manager.campaigns c
SET tz_offset = g.tz_offset
FROM t_p94374369_telegram_ad_manager.city_groups g
WHERE g.city = c.city AND c.state <> 'archived';