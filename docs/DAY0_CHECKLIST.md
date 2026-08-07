# Day 0 checklist (dbt + multi-agent)

- [ ] `CURSOR_API_KEY` in `.env`
- [ ] `npm run models` (note Router vs fallback)
- [ ] Snowflake connection `NPSZJKJ-QP25178` + PAT in `~/.snowflake/connections.toml`
- [ ] `python3 -m venv .venv && source .venv/bin/activate && pip install 'dbt-snowflake>=1.8,<1.11'`
- [ ] `npm run dbt:profile`
- [ ] `npm run sf:seed && npm run dbt:run && npm run dbt:test`
- [ ] Confirm agents exist under `.cursor/agents/` (5 specialists)
- [ ] `npm run demo:blast-block` exits blocked
- [ ] Practice: `npm run sf:break` then `npm run demo:heal`

See also [DBT_SETUP.md](DBT_SETUP.md), [REHEARSAL.md](REHEARSAL.md).
