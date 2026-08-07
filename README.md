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
npm run sf:seed
npm run dbt:run && npm run dbt:test
npm run models         # Router vs fallback
```

## Usage

```bash
source .venv/bin/activate   # so npm run dbt:* finds dbt

npm run sf:seed
npm run dbt:build           # green baseline
npm run sf:break            # schema drift: amount → order_amount
npm run demo:heal           # multi-agent heal loop

npm run demo:heal:dry       # investigate only
npm run demo:blast-block    # live-extend seam
npm run heal:resume -- --incident fixtures/incidents/schema-drift.json
```

Webhook: `npm run server` then `POST /incidents` with the fixture JSON.

## Demo script (~20 min)

1. Show green: `dbt_heal/models/marts/orders_daily.sql` + yml tests/docs (`amount`).
2. `npm run sf:break` — staging column rename; `dbt run` would fail on invalid identifier.
3. `npm run demo:heal` — stream **investigator → healer → docs_sync → test_runner → verifier**.
4. Open `REPORT.md` (Agents invoked) + git diff under `dbt_heal/models/`.
5. Live extend: blast-radius gate or add a freshness test in yml.

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
