-- Inject duplicate order_ids into STAGING.ORDERS so dbt unique tests fail.
-- Requires green seed first (amount column present).
-- Expect: dbt run OK; dbt test FAIL on unique_stg_orders_order_id / source_unique_heal_orders_order_id

USE DATABASE HEAL_DEMO;

INSERT INTO STAGING.ORDERS (order_id, customer_id, order_ts, amount, status) VALUES
  (1, 999, '2026-08-07 10:00:00', 1.00, 'COMPLETE'),
  (2, 999, '2026-08-07 11:00:00', 2.00, 'PENDING');

INSERT INTO META.PIPELINE_RUNS (run_id, pipeline, status, error_message)
VALUES (
  'break-dup-' || TO_VARCHAR(CURRENT_TIMESTAMP()),
  'orders_daily',
  'FAILED',
  'dbt test failure: unique_stg_orders_order_id (duplicate order_id values in staging)'
);

-- SELECT order_id, COUNT(*) FROM STAGING.ORDERS GROUP BY 1 HAVING COUNT(*) > 1;
