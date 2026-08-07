-- Staging table definition (source of truth for HEAL_DEMO.STAGING.ORDERS)
USE DATABASE HEAL_DEMO;

CREATE OR REPLACE TABLE STAGING.ORDERS (
  order_id     NUMBER        NOT NULL,
  customer_id  NUMBER        NOT NULL,
  order_ts     TIMESTAMP_NTZ NOT NULL,
  amount       NUMBER(12, 2) NOT NULL,
  status       VARCHAR       NOT NULL
);
