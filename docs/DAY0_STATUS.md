# Day 0 status

| Check | Status | Notes |
|-------|--------|-------|
| CURSOR_API_KEY | Done | |
| Router (`auto-smart`) | Unavailable | Falls back to composer-2.5 |
| Snowflake `NPSZJKJ-QP25178` | Done | PAT in connections.toml |
| RO adapter `sf:whoami` | Done | |
| dbt-snowflake in `.venv` | Done | |
| `npm run dbt:profile` | Done | gitignored profiles.yml |
| `sf:seed` + `dbt:run` + `dbt:test` | Done | PASS=16 |
| Multi-agent definitions | Done | investigator, healer, docs_sync, test_runner, verifier |
| Cloud agents | Out of scope | Local-only for demo reliability |

## Next demo commands

```bash
source .venv/bin/activate
npm run sf:break
npm run demo:heal
```
