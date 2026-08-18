CREATE TABLE IF NOT EXISTS t_p94374369_telegram_ad_manager.bot_drafts (
  chat_id TEXT PRIMARY KEY,
  step TEXT NOT NULL DEFAULT 'city',
  city TEXT,
  ad_text TEXT,
  photo_file_id TEXT,
  start_hour INTEGER NOT NULL DEFAULT 9,
  end_hour INTEGER NOT NULL DEFAULT 21,
  plan TEXT,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);