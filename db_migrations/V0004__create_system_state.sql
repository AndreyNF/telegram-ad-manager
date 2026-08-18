CREATE TABLE IF NOT EXISTS t_p94374369_telegram_ad_manager.system_state (
    key VARCHAR(64) PRIMARY KEY,
    value TEXT,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

INSERT INTO t_p94374369_telegram_ad_manager.system_state (key, value)
VALUES ('publisher_last_run', '')
ON CONFLICT (key) DO NOTHING;