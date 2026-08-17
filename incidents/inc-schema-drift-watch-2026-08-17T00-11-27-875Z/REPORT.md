# Incident Report — inc-schema-drift-watch-2026-08-17T00-11-27-875Z

| Field | Value |
|---|---|
| **Severity** | P2 |
| **Pipeline** | orders_daily |
| **Database** | HEAL_DEMO |
| **Classification** | schema_drift |
| **Detected** | 2026-08-17T00:11:27Z |

## Error

Watcher detected schema drift on `HEAL_DEMO.STAGING.ORDERS` (columns: `ORDER_AMOUNT`):
`ORDER_AMOUNT` present, `AMOUNT` missing — invalid identifier `'AMOUNT'`.

## Root Cause

Upstream column rename: `amount` → `order_amount` (via `fixtures/snowflake/break_schema_drift.sql`).
dbt SQL and YAML still referenced the old column name. Deployed Snowflake view
`HEAL_DEMO.DBT_DEV.STG_ORDERS` retained stale SQL selecting `amount`.

## Blast Radius Gate

| Metric | Value |
|---|---|
| Downstream objects | 3 (`DBT_DEV.STG_ORDERS`, `DBT_DEV.ORDERS_DAILY`, `CURATED.ORDERS_DAILY`) |
| Contract max | 3 |
| **Gate** | **PASS** (3 ≤ 3) |

## Healing Actions

Patched `amount` → `order_amount` across git contract:

| File | Change |
|---|---|
| `dbt_heal/models/staging/stg_orders.sql` | SELECT `order_amount` from source |
| `dbt_heal/models/marts/orders_daily.sql` | Aggregate `sum(order_amount)` |
| `dbt_heal/models/sources.yml` | Column rename + tests |
| `dbt_heal/models/staging/stg_orders.yml` | Column rename + tests |
| `dbt_heal/models/marts/orders_daily.yml` | Descriptions updated |

No Snowflake DDL/DML executed (policy).

## Validation Results

| Check | Result |
|---|---|
| `npm run dbt:compile` | **PASS** |
| `npm run dbt:test` | **12 PASS / 4 ERROR** |
| Source tests (`heal.orders`) | All pass — live schema aligned |
| Model tests (`stg_orders`) | 4 fail — deployed view still selects `amount` |

The 4 failing tests are **expected pre-deploy**: they query `DBT_DEV.STG_ORDERS`,
which has not been rebuilt. Re-run after `npm run dbt:run`.

## Post-Heal Action Required

Human or CI must apply:

```bash
npm run dbt:run
npm run dbt:test
```

This redeploys `stg_orders` and `orders_daily` in Snowflake. All 16 tests should pass afterward.

## Agents Invoked

1. **investigator** — RO diagnosis via `DESCRIBE TABLE HEAL_DEMO.STAGING.ORDERS`; confirmed `ORDER_AMOUNT` present / `AMOUNT` absent; blast radius 3/3 PASS
2. **healer** — patched 5 files under `dbt_heal/models/**` (`amount` → `order_amount`)
3. **docs_sync** — verified yml alignment; no additional changes needed
4. **test_runner** — `dbt:compile` PASS; `dbt:test` 12/16 (4 stg_orders model tests blocked on stale deploy)
5. **verifier** — confirmed git patches correct; RO verified live source schema and stale deployed view; git healing scope complete

status: passed
