-- HEAL_DEMO seed: green pipeline state
-- Run in your Snowflake demo account (Snowsight / snowsql / Cortex).

CREATE DATABASE IF NOT EXISTS HEAL_DEMO;
USE DATABASE HEAL_DEMO;

CREATE SCHEMA IF NOT EXISTS STAGING;
CREATE SCHEMA IF NOT EXISTS CURATED;
CREATE SCHEMA IF NOT EXISTS META;

-- Staging orders (canonical column: amount)
CREATE OR REPLACE TABLE STAGING.ORDERS (
  order_id     NUMBER        NOT NULL,
  customer_id  NUMBER        NOT NULL,
  order_ts     TIMESTAMP_NTZ NOT NULL,
  amount       NUMBER(12, 2) NOT NULL,
  status       VARCHAR       NOT NULL
);

INSERT INTO STAGING.ORDERS (order_id, customer_id, order_ts, amount, status) VALUES
  (1, 101, '2026-08-01 10:00:00', 49.99,  'COMPLETE'),
  (2, 102, '2026-08-01 11:30:00', 120.00, 'COMPLETE'),
  (3, 101, '2026-08-02 09:15:00', 15.50,  'COMPLETE'),
  (4, 103, '2026-08-02 14:00:00', 80.00,  'PENDING'),
  (5, 104, '2026-08-03 16:45:00', 200.00, 'COMPLETE'),
  (6, 102, '2026-08-03 18:00:00', 33.25,  'COMPLETE'),
  (7, 105, '2026-08-04 08:20:00', 67.80,  'COMPLETE'),
  (8, 101, '2026-08-05 12:10:00', 22.00,  'CANCELLED'),
  (9, 106, '2026-08-05 19:40:00', 150.00, 'COMPLETE'),
  (10, 103, '2026-08-06 07:05:00', 91.10, 'COMPLETE');

-- Curated daily aggregation (depends on STAGING.ORDERS.amount)
CREATE OR REPLACE TABLE CURATED.ORDERS_DAILY AS
SELECT
  DATE_TRUNC('DAY', order_ts)::DATE AS order_date,
  COUNT(*)                          AS order_count,
  SUM(amount)                       AS gross_amount,
  SUM(IFF(status = 'COMPLETE', amount, 0)) AS completed_amount
FROM STAGING.ORDERS
GROUP BY 1;

-- Meta: last pipeline run marker
CREATE OR REPLACE TABLE META.PIPELINE_RUNS (
  run_id      VARCHAR,
  pipeline    VARCHAR,
  status      VARCHAR,
  error_message VARCHAR,
  ran_at      TIMESTAMP_NTZ DEFAULT CURRENT_TIMESTAMP()
);

INSERT INTO META.PIPELINE_RUNS (run_id, pipeline, status, error_message)
VALUES ('seed-001', 'orders_daily', 'SUCCESS', NULL);

-- Smoke checks (should succeed after seed)
-- SELECT * FROM CURATED.ORDERS_DAILY ORDER BY order_date;
-- SELECT COLUMN_NAME FROM HEAL_DEMO.INFORMATION_SCHEMA.COLUMNS
--   WHERE TABLE_SCHEMA = 'STAGING' AND TABLE_NAME = 'ORDERS' ORDER BY ORDINAL_POSITION;
