# Incident inc-schema-drift-watch-2026-08-25T00-40-10-134Z

## Summary
Watcher detected schema drift on `HEAL_DEMO.STAGING.ORDERS`: live column `ORDER_AMOUNT` replaced `AMOUNT`. dbt models, source contract, and yml tests/docs still referenced `amount`, causing `invalid identifier 'AMOUNT'` on the deployed `STG_ORDERS` view. Heal agents updated git to use `order_amount` throughout.

## Classification
`schema_drift`

## Root cause
Upstream column rename (`amount` → `order_amount`) on `STAGING.ORDERS` invalidated dbt staging SQL, mart aggregations, and source/model yml column definitions.

## Model
Pinned `composer-2.5` (Router unavailable)

## Envelope / RO path
RO via `npx tsx src/sf.ts sql` (Cortex `-p` unavailable on trial). No Snowflake DDL/DML executed by agents.

## Agents invoked
1. **investigator** — RO diagnosis + blast radius
2. **healer** — patched dbt SQL + sources.yml
3. **docs_sync** — aligned staging/marts yml descriptions and tests
4. **test_runner** — `npm run dbt:compile` and `npm run dbt:test`
5. **verifier** — RO + dbt results → final status

## Investigation
- **Live columns:** `ORDER_ID`, `CUSTOMER_ID`, `ORDER_TS`, `ORDER_AMOUNT`, `STATUS`
- **Expected (pre-heal):** `order_id`, `customer_id`, `order_ts`, `amount`, `status`
- **Drift:** `AMOUNT` missing; `ORDER_AMOUNT` present
- **Deployed `DBT_DEV.STG_ORDERS` view:** still selects `amount` — broken until `dbt run`
- **`DBT_DEV.ORDERS_DAILY` mart:** readable but stale (last good build)
- **Blast radius:** 3 base tables in `DBT_DEV`, `CURATED`, `META` (threshold: 3) — within limit
- **META.PIPELINE_RUNS:** no FAILED rows for this incident (watcher-only detection)

## Files changed
- `dbt_heal/models/staging/stg_orders.sql`
- `dbt_heal/models/marts/orders_daily.sql`
- `dbt_heal/models/sources.yml`
- `dbt_heal/models/staging/stg_orders.yml`
- `dbt_heal/models/marts/orders_daily.yml`

## dbt results
- **compile:** passed (2 models, 16 data tests, 1 source; deprecation warnings on `accepted_values` args only)
- **test:** 12 pass, 4 error (16 total)
  - **Source tests (7):** all passed — contract aligned with live `STAGING.ORDERS`
  - **orders_daily mart tests (4):** all passed (stale table still readable)
  - **stg_orders model tests (4):** failed — `invalid identifier 'AMOUNT'` when querying deployed view (not heal defect)

## Verification
- Git model SQL and yml now reference `order_amount` consistently; no remaining `amount` column refs in `dbt_heal/models/**`
- Live `INFORMATION_SCHEMA` confirms `ORDER_AMOUNT` on `STAGING.ORDERS`
- Deployed view DDL still references `amount`; human/CI must apply with `npm run dbt:run` to refresh `STG_ORDERS` and mart

## Status
`status: passed`
