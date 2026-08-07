-- Curated daily mart — intentionally brittle SELECT list (depends on STAGING.ORDERS.amount)
USE DATABASE HEAL_DEMO;

CREATE OR REPLACE TABLE CURATED.ORDERS_DAILY AS
SELECT
  DATE_TRUNC('DAY', order_ts)::DATE AS order_date,
  COUNT(*)                          AS order_count,
  SUM(amount)                       AS gross_amount,
  SUM(IFF(status = 'COMPLETE', amount, 0)) AS completed_amount
FROM STAGING.ORDERS
GROUP BY 1;
