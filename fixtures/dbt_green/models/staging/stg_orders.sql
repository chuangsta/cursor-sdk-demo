{{ config(alias='stg_orders') }}

select
  order_id,
  customer_id,
  order_ts,
  amount,
  status
from {{ source('heal', 'orders') }}
