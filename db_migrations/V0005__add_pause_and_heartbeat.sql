ALTER TABLE t_p94374369_telegram_ad_manager.campaigns
    ADD COLUMN IF NOT EXISTS paused_until TIMESTAMP NULL;

CREATE TABLE IF NOT EXISTS t_p94374369_telegram_ad_manager.runner_heartbeat (
    id INTEGER PRIMARY KEY DEFAULT 1,
    last_run_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    last_sent INTEGER NOT NULL DEFAULT 0
);

INSERT INTO t_p94374369_telegram_ad_manager.runner_heartbeat (id, last_run_at)
VALUES (1, CURRENT_TIMESTAMP)
ON CONFLICT (id) DO NOTHING;