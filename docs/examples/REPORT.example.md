# Incident inc-2026-08-07-schema-drift

## Summary
Staging column `amount` renamed to `order_amount`. dbt `stg_orders` / `orders_daily` and yml tests/docs still referenced `amount`.

## Classification
`schema_drift`

## Root cause
Upstream schema drift invalidated dbt model SQL and source tests.

## Model
Pinned `composer-2.5` (Router unavailable) or `auto-smart` when enabled.

## Envelope / RO path
RO via `npx tsx src/sf.ts sql` (Cortex `-p` unavailable on trial).

## Agents invoked
1. investigator
2. healer
3. docs_sync
4. test_runner
5. verifier

## Files changed
- `dbt_heal/models/staging/stg_orders.sql`
- `dbt_heal/models/marts/orders_daily.sql`
- `dbt_heal/models/sources.yml`
- `dbt_heal/models/staging/stg_orders.yml`
- `dbt_heal/models/marts/orders_daily.yml`

## dbt results
- compile: passed (post-heal)
- test: passed (post-heal)

## Verification
Live INFORMATION_SCHEMA shows `ORDER_AMOUNT`. Mart may remain stale until human `dbt run`.

## Status
`status: passed`
