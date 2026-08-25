{{ config(alias='orders_daily') }}

select
  date_trunc('day', order_ts)::date as order_date,
  count(*) as order_count,
  sum(order_amount) as gross_amount,
  sum(iff(status = 'COMPLETE', order_amount, 0)) as completed_amount
from {{ ref('stg_orders') }}
group by 1
