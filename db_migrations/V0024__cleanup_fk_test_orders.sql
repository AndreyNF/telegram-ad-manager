UPDATE t_p94374369_telegram_ad_manager.payment_orders
SET status = 'test_rolled_back'
WHERE id IN (9, 10) AND status = 'pending';