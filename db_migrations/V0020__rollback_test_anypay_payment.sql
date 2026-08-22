UPDATE t_p94374369_telegram_ad_manager.campaigns
SET state = 'stopped',
    expires_at = expires_at - INTERVAL '1 days',
    days_paid = days_paid - 1,
    price_amount = price_amount - 300,
    payment_note = NULL,
    paid_at = NULL
WHERE id = 32;

UPDATE t_p94374369_telegram_ad_manager.payment_orders SET status = 'test_rolled_back' WHERE id = 1;