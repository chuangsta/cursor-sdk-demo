#!/usr/bin/env bash
# Reset Snowflake + dbt models to green baseline (before break/heal demo).
# Always restores brittle `amount` models from fixtures/dbt_green — not from git HEAD
# (HEAD may already be healed to order_amount after a prior demo).
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"
export PATH="$ROOT/.venv/bin:$PATH"

GREEN="$ROOT/fixtures/dbt_green/models"
DEST="$ROOT/dbt_heal/models"

echo "[demo:reset] restoring green dbt models from fixtures/dbt_green (amount baseline)..."
cp "$GREEN/sources.yml" "$DEST/sources.yml"
cp "$GREEN/staging/stg_orders.sql" "$DEST/staging/stg_orders.sql"
cp "$GREEN/staging/stg_orders.yml" "$DEST/staging/stg_orders.yml"
cp "$GREEN/marts/orders_daily.sql" "$DEST/marts/orders_daily.sql"
cp "$GREEN/marts/orders_daily.yml" "$DEST/marts/orders_daily.yml"

echo "[demo:reset] seeding HEAL_DEMO..."
npm run sf:seed

echo "[demo:reset] dbt build (compile + run + test)..."
npm run dbt:build

echo "[demo:reset] green baseline ready."
echo "Demo paths: npm run demo:paths -- list"
echo "Next (drift): HEAL_CREATE_PR=1 npm run server   # T1"
echo "              npm run watch:drift -- --interval 10   # T2"
echo "              ALTER … amount → order_amount   # Snowsight"
