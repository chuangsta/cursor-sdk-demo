#!/usr/bin/env bash
# Run dbt against dbt_heal/ with local profiles.yml
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
export DBT_PROFILES_DIR="${DBT_PROFILES_DIR:-$ROOT/dbt_heal}"

# Prefer project venv so agents don't need `source .venv/bin/activate`
if [[ -x "$ROOT/.venv/bin/dbt" ]]; then
  export PATH="$ROOT/.venv/bin:$PATH"
fi

cd "$ROOT/dbt_heal"

if [[ ! -f "$DBT_PROFILES_DIR/profiles.yml" ]]; then
  echo "Missing $DBT_PROFILES_DIR/profiles.yml — run: npm run dbt:profile" >&2
  exit 1
fi

if ! command -v dbt >/dev/null 2>&1; then
  echo "dbt not on PATH. Install with:" >&2
  echo "  python3 -m venv .venv && source .venv/bin/activate && pip install 'dbt-snowflake>=1.8,<1.11'" >&2
  exit 1
fi

exec dbt "$@"
