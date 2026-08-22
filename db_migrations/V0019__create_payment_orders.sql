CREATE TABLE IF NOT EXISTS t_p94374369_telegram_ad_manager.payment_orders (
    id SERIAL PRIMARY KEY,
    request_id INTEGER NOT NULL,
    plan VARCHAR(20) NOT NULL,
    days INTEGER NOT NULL,
    amount NUMERIC(10, 2) NOT NULL,
    kind VARCHAR(20) NOT NULL DEFAULT 'renew',
    status VARCHAR(20) NOT NULL DEFAULT 'pending',
    fk_operation_id VARCHAR(64),
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    paid_at TIMESTAMP
);

CREATE INDEX IF NOT EXISTS payment_orders_request_idx
    ON t_p94374369_telegram_ad_manager.payment_orders (request_id);
CREATE INDEX IF NOT EXISTS payment_orders_status_idx
    ON t_p94374369_telegram_ad_manager.payment_orders (status);