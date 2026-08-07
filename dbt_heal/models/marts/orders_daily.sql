{{ config(alias='orders_daily') }}

-- Intentionally brittle: depends on staging column `amount`.
-- After fixtures/snowflake/break_schema_drift.sql, source has order_amount instead.
select
  date_trunc('day', order_ts)::date as order_date,
  count(*) as order_count,
  sum(amount) as gross_amount,
  sum(iff(status = 'COMPLETE', amount, 0)) as completed_amount
from {{ ref('stg_orders') }}
group by 1
