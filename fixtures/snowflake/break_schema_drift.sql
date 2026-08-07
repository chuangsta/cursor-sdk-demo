-- Break the pipeline via schema drift: rename STAGING.ORDERS.amount → order_amount
-- Curated SQL / contract still expect `amount`, so refresh fails.

USE DATABASE HEAL_DEMO;

-- 1) Apply upstream schema drift (preserve row data under new column name)
CREATE OR REPLACE TABLE STAGING.ORDERS AS
SELECT
  order_id,
  customer_id,
  order_ts,
  amount AS order_amount,
  status
FROM STAGING.ORDERS;

-- 2) Record the failed pipeline run (mirrors CI/task failure after invalid identifier AMOUNT)
INSERT INTO META.PIPELINE_RUNS (run_id, pipeline, status, error_message)
VALUES (
  'break-schema-drift-' || TO_VARCHAR(CURRENT_TIMESTAMP()),
  'orders_daily',
  'FAILED',
  'SQL compilation error: error line 4 at position 6 invalid identifier ''AMOUNT'''
);

-- 3) Leave CURATED.ORDERS_DAILY stale (last successful build). Do NOT refresh it.
--    Running pipeline/sql/02_curated_orders_daily.sql now fails against STAGING.

-- Verify drift:
-- SELECT COLUMN_NAME FROM HEAL_DEMO.INFORMATION_SCHEMA.COLUMNS
--   WHERE TABLE_SCHEMA = 'STAGING' AND TABLE_NAME = 'ORDERS' ORDER BY ORDINAL_POSITION;
-- SELECT * FROM META.PIPELINE_RUNS ORDER BY ran_at DESC LIMIT 3;
