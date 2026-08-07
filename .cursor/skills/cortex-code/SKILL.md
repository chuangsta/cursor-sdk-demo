---
name: cortex-code
description: >-
  Routes Snowflake-related operations to Cortex Code CLI for specialized
  Snowflake expertise. Use for HEAL_DEMO, Snowflake SQL, INFORMATION_SCHEMA,
  warehouses, Cortex AI, Snowpark, dynamic tables, or explicit "Cortex"/"Snowflake"
  mentions. Do NOT use for general programming, local file edits, or non-Snowflake DBs.
compatibility: Requires Cortex Code CLI (`cortex`) installed and configured
---

# Cortex Code (project skill)

Prefer the official install when available:

```bash
npx skills add snowflake-labs/subagent-cortex-code --copy --global
```

This project skill is a **fallback** so local Cursor SDK agents can still route Snowflake work to Cortex CLI with an RO-first policy.

## Routing principle

ONLY Snowflake operations → Cortex Code. Everything else → the coding agent.

## Security (this prototype)

- Default envelope: **RO**
- Forbidden: `DEPLOY`, unsupervised prod DDL/DML
- Approval: prefer interactive/`prompt` when using the full Snowflake Labs skill
- Never pass `.env`, SSH keys, or credential paths into Cortex prompts

## Execution

### Prefer Cortex Code when licensed for headless

```bash
cortex -c NPSZJKJ-QP25178 -p "ENRICHED_PROMPT" --output-format stream-json --sql-read-only
```

**Trial/subscription limitation:** some accounts return
`Error: --print mode is not available for subscription/trial accounts.`
In that case use the project RO fallback (same `~/.snowflake/connections.toml`):

```bash
npm run sf:whoami
npm run sf:sql -- "SELECT COLUMN_NAME FROM HEAL_DEMO.INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA='STAGING' AND TABLE_NAME='ORDERS'"
```

Or from the agent shell:

```bash
npx tsx src/sf.ts sql "SELECT CURRENT_ACCOUNT(), CURRENT_USER()"
```

Still treat results as **RO evidence**. Never DDL/DML from healer path.

## HEAL_DEMO checks

Useful RO prompts:

1. List columns of `HEAL_DEMO.STAGING.ORDERS` via INFORMATION_SCHEMA
2. Latest rows from `HEAL_DEMO.META.PIPELINE_RUNS`
3. Smoke `SELECT * FROM HEAL_DEMO.CURATED.ORDERS_DAILY LIMIT 5`
4. List tables in `CURATED` and `META` (blast radius)

## Important

- Do not answer Snowflake inventory questions from memory — run Cortex
- Return query evidence to the parent heal orchestrator
- Repo file edits stay with the coding agent / healer subagent
