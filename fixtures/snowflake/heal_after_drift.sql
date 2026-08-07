-- Human/CI apply step AFTER the agent heals pipeline SQL in git.
-- Mirrors the expected post-heal curated definition (order_amount).

USE DATABASE HEAL_DEMO;

CREATE OR REPLACE TABLE CURATED.ORDERS_DAILY AS
SELECT
  DATE_TRUNC('DAY', order_ts)::DATE AS order_date,
  COUNT(*)                          AS order_count,
  SUM(order_amount)                 AS gross_amount,
  SUM(IFF(status = 'COMPLETE', order_amount, 0)) AS completed_amount
FROM STAGING.ORDERS
GROUP BY 1;

INSERT INTO META.PIPELINE_RUNS (run_id, pipeline, status, error_message)
VALUES (
  'heal-applied-' || TO_VARCHAR(CURRENT_TIMESTAMP()),
  'orders_daily',
  'SUCCESS',
  NULL
);

-- SELECT * FROM CURATED.ORDERS_DAILY ORDER BY order_date;
