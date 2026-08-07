# Rehearsal & trade-off notes

## Reset → break → heal (dbt)

1. `source .venv/bin/activate`
2. `npm run sf:seed` && `npm run dbt:build` (green: 16 tests)
3. `npm run sf:break` (amount → order_amount)
4. Show `dbt run` failure or `invalid identifier` expectation
5. Optional: `git checkout -- dbt_heal/` if a prior heal left patches
6. `npm run demo:heal` — watch multi-agent delegation
7. `REPORT.md` + `git diff dbt_heal/models`
8. Narrate: human/CI `dbt run` applies mart refresh

## Live-extend

```bash
npm run demo:blast-block
npm run demo:blast-confirm
```

Or add a source freshness block in `dbt_heal/models/sources.yml` live.

## Local vs cloud (say this)

Local SDK keeps PAT, dbt venv, and RO adapter on one machine. Cloud agents would need secret injection + image bake; Cortex `-p` is already blocked on trial. We chose local on purpose.

## Multi-agent story

Orchestrator is a control plane. investigator never edits dbt; healer never talks to Snowflake; test_runner owns `dbt test`; docs_sync owns yml descriptions.

## Trade-offs

| Topic | Position |
|-------|----------|
| dbt vs raw SQL | Tests + docs + lineage language enterprises already use |
| Heal in git vs `dbt run` | Reviewable PR; deploy stays CI |
| Router | `auto-smart` when team enables it; else pinned `composer-2.5` |
| Trial Cortex | `sf.ts` RO adapter; licensed path returns to cortex-code envelopes |
