#!/usr/bin/env bash
# Reset Snowflake + dbt models to green baseline (before break/heal demo)
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"
export PATH="$ROOT/.venv/bin:$PATH"

echo "[demo:reset] restoring dbt model files from git (if tracked)..."
git checkout -- dbt_heal/models 2>/dev/null || true

echo "[demo:reset] seeding HEAL_DEMO..."
npm run sf:seed

echo "[demo:reset] dbt build (compile + run + test)..."
npm run dbt:build

echo "[demo:reset] green baseline ready."
echo "Demo paths: npm run demo:paths -- list"
echo "Next (drift): npm run sf:break && npm run demo:heal"
