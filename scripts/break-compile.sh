#!/usr/bin/env bash
# Break dbt compile by introducing an invalid ref in stg_orders.sql (local file only).
# Reset with: npm run demo:reset  (git checkout dbt_heal/models)
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
TARGET="$ROOT/dbt_heal/models/staging/stg_orders.sql"

cat > "$TARGET" <<'EOF'
{{ config(alias='stg_orders') }}

-- INTENTIONAL COMPILE BREAK (demo path: compile-fail)
-- Invalid `orders_bronze` does not exist → dbt compile fails.
select
  order_id,
  customer_id,
  order_ts,
  amount,
  status
from {{ ref('orders_bronze') }}
EOF

echo "[break-compile] wrote invalid ref into $TARGET"
echo "[break-compile] Next: npm run dbt:compile   # expect Compilation Error"
echo "[break-compile] Reset:  npm run demo:reset"
