-- Optional scheduled refresh task (demo). Requires EXECUTE TASK privilege.
USE DATABASE HEAL_DEMO;

CREATE OR REPLACE TASK CURATED.REFRESH_ORDERS_DAILY
  WAREHOUSE = COMPUTE_WH
  SCHEDULE = 'USING CRON 0 6 * * * UTC'
AS
  EXECUTE IMMEDIATE $$
    CREATE OR REPLACE TABLE CURATED.ORDERS_DAILY AS
    SELECT
      DATE_TRUNC('DAY', order_ts)::DATE AS order_date,
      COUNT(*)                          AS order_count,
      SUM(amount)                       AS gross_amount,
      SUM(IFF(status = 'COMPLETE', amount, 0)) AS completed_amount
    FROM STAGING.ORDERS
    GROUP BY 1;
  $$;

-- ALTER TASK CURATED.REFRESH_ORDERS_DAILY RESUME;
