# dbt setup (local)

```bash
cd /path/to/cursor-sdk-demo
python3 -m venv .venv
source .venv/bin/activate
pip install 'dbt-snowflake>=1.8,<1.11'

# Generate profiles.yml from ~/.snowflake/connections.toml (gitignored)
npm run dbt:profile

# Smoke
npm run dbt:debug
npm run sf:seed
npm run dbt:run
npm run dbt:test
```

If `dbt` is only inside the venv, activate `.venv` before `npm run dbt:*`, or call:

```bash
.venv/bin/dbt --version
DBT_PROFILES_DIR=$PWD/dbt_heal .venv/bin/dbt compile --project-dir dbt_heal
```

`scripts/dbt.sh` looks for `dbt` on `PATH`.
