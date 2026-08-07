---
name: heal-pipeline
description: >-
  Closed-loop self-healing for the HEAL_DEMO orders_daily dbt pipeline.
  Multi-agent: investigator → healer → docs_sync → test_runner → verifier.
  Investigate with Cortex RO or sf.ts, heal dbt_heal/models only, verify with
  dbt test + RO, write incidents/<id>/REPORT.md.
---

# Heal Pipeline Skill (dbt + multi-agent)

## Closed loop

```
detect → investigator (RO) → healer (dbt SQL) → docs_sync (yml)
      → test_runner (dbt test) → verifier → REPORT.md
```

Healing is **repo-first** under `dbt_heal/models/**`. Deploy/`dbt run` in prod stays with humans/CI.

## Runtime

**Local Cursor SDK only** for this demo. Cloud agents lack local `connections.toml`, dbt venv, and reliable Cortex/Snowflake secrets.

## Key paths

| Path | Role |
|------|------|
| `dbt_heal/` | dbt project (heal target) |
| `dbt_heal/models/marts/orders_daily.sql` | Brittle mart — primary heal file |
| `dbt_heal/models/staging/stg_orders.sql` | Staging select list |
| `dbt_heal/models/**/*.yml` | Tests + docs |
| `pipeline/contract.yaml` | Thin pointer + blast_radius |
| `fixtures/snowflake/*.sql` | Seed / break / verify control plane |
| `incidents/<id>/REPORT.md` | Required output |

## Envelope / RO policy

- Investigate / verify Snowflake: cortex-code **RO**, or `npx tsx src/sf.ts sql` if Cortex `-p` unavailable (trial)
- Forbidden: DEPLOY, unsupervised RW, prod DDL from agents

## Mandatory multi-agent order

Orchestrator **must** delegate via the Agent/Task tool in this order (do not skip):

1. `investigator`
2. `healer` (skip file edits if HEAL_DRY_RUN)
3. `docs_sync` (skip if dry-run)
4. `test_runner`
5. `verifier`

Include an **Agents invoked** section in REPORT.md.

## Schema-drift heal pattern

When `STAGING.ORDERS.amount` was renamed to `order_amount`:

1. Update `stg_orders.sql` to read `order_amount`
2. Update `orders_daily.sql` aggregations
3. Update `sources.yml` + staging/marts yml column names, tests, descriptions (`docs_sync`)
4. `dbt compile` + `dbt test`
5. RO verify live columns

## Report template

```markdown
# Incident <id>

## Summary
## Classification
## Root cause
## Model
## Envelope / RO path
## Agents invoked
## Investigation
## Files changed
## dbt results
## Verification
## Status
`status: passed` or `status: failed`
```
