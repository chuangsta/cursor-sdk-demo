# Self-Healing Snowflake + dbt Pipeline (Cursor SDK Prototype)

Enterprise SDLC demo: detect a broken **dbt** orders mart on Snowflake → multi-agent investigate (RO) → heal **`dbt_heal/models`** (SQL + tests + docs) → `dbt test` → write `incidents/<id>/REPORT.md`.

**Closed loop, not self-deploying.** Agents never DDL/DML prod Snowflake; humans/CI run `dbt run` to apply.

**Runtime: local Cursor SDK only.** Cloud agents are a poor fit here (no `connections.toml`/PAT, no local dbt venv, Cortex headless blocked on trial).

## Architecture

```
CLI / POST /incidents
        → resolveModel (auto-smart Router or composer-2.5 fallback)
        → Cursor SDK local agent
        → investigator (RO: cortex-code or npm run sf:sql)
        → healer + docs_sync (dbt_heal/models/**)
        → test_runner (dbt compile/test)
        → verifier → REPORT.md
```

## Prerequisites (Day 0)

1. Node.js ≥ 22.13 + `CURSOR_API_KEY` in `.env`
2. Snowflake connection in `~/.snowflake/connections.toml` (see account `NPSZJKJ-QP25178`)
3. Python venv + dbt-snowflake — see [`docs/DBT_SETUP.md`](docs/DBT_SETUP.md)
4. Optional: Cortex CLI (headless `-p` may fail on trial; `src/sf.ts` is the RO fallback)

```bash
cp .env.example .env   # CURSOR_API_KEY=
npm install
python3 -m venv .venv && source .venv/bin/activate
pip install 'dbt-snowflake>=1.8,<1.11'
npm run dbt:profile    # writes gitignored dbt_heal/profiles.yml from connections.toml
npm run preflight
npm run demo:reset     # seed + dbt build (green)
npm run models         # Router vs fallback
```

## Usage

```bash
# .venv is auto-picked by scripts/dbt.sh — activate only if you like
npm run preflight
npm run demo:reset          # green baseline
npm run sf:break            # schema drift: amount → order_amount
npm run demo:heal           # multi-agent heal loop

npm run demo:heal:dry       # investigate only
npm run demo:blast-block    # live-extend seam
npm run heal:resume -- --incident fixtures/incidents/schema-drift.json
```

Webhook: `npm run server` then `POST /incidents` with the fixture JSON.

Auto schema-drift (Phase 1): `npm run server` + `npm run watch:drift`, then `npm run sf:break` or ALTER in Snowsight — see [`docs/DEMO_PATHS.md`](docs/DEMO_PATHS.md).

## Demo script (~20 min)

See full three-path guide: [`docs/DEMO_PATHS.md`](docs/DEMO_PATHS.md).

1. `npm run demo:reset` — green `dbt_heal` + Snowflake.
2. Core path — schema drift: `npm run demo:paths -- drift` then `npm run demo:heal`.
3. Optional flash — compile / duplicates: `npm run demo:paths -- compile` or `-- dup`.
4. Open `REPORT.md` (Agents invoked) + `git diff dbt_heal/models/`.
5. Live extend: `npm run demo:blast-block`.

```bash
npm run demo:paths -- list
npm run demo:heal              # drift
npm run demo:heal:compile      # compile-fail
npm run demo:heal:dup          # duplicate unique tests
```

## Local vs cloud

| Need | Local | Cloud agent |
|------|-------|-------------|
| Snowflake PAT / connections.toml | Yes | Needs injected secrets |
| dbt venv | Yes | Must bake into image |
| Cortex `-p` on trial | Blocked → use `sf.ts` | Same + install cost |
| Interview reliability | High | Fragile |

Use **local**. Cloud is a future evolution with self-hosted runners.

## Layout

| Path | Purpose |
|------|---------|
| `dbt_heal/` | dbt project (heal target: models + tests + docs) |
| `pipeline/contract.yaml` | Thin pointer + blast_radius |
| `src/heal.ts` | CLI orchestrator (local SDK) |
| `src/sf.ts` | RO Snowflake adapter |
| `src/dbtProfile.ts` | Generate `profiles.yml` from connections.toml |
| `.cursor/agents/` | investigator, healer, docs_sync, test_runner, verifier |
| `fixtures/snowflake/` | seed / break / verify |
| `fixtures/snowflake/legacy_sql/` | Pre-dbt SQL (retired heal target) |

## Out of scope

- Cloud SDK heal loop
- Auto `DEPLOY` / unsupervised prod DDL
- dbt Cloud / package mesh
- Slack as required path (notifier stub only)
