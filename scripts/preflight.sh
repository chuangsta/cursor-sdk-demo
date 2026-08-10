#!/usr/bin/env bash
# Interview-day preflight — exit non-zero if not ready for demo:heal
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"
export PATH="$ROOT/.venv/bin:$PATH"

ok=0
fail() { echo "FAIL: $*"; ok=1; }
pass() { echo "OK:   $*"; }

echo "=== Preflight ==="

command -v node >/dev/null && pass "node $(node -v)" || fail "node missing"
[[ -f .env ]] && grep -q 'CURSOR_API_KEY=.\+' .env && pass "CURSOR_API_KEY set" || fail "CURSOR_API_KEY missing in .env"
[[ -x .venv/bin/dbt ]] && pass "dbt $(.venv/bin/dbt --version 2>/dev/null | head -1)" || fail "dbt missing — see docs/DBT_SETUP.md"
[[ -f dbt_heal/profiles.yml ]] && pass "dbt_heal/profiles.yml present" || fail "run npm run dbt:profile"
command -v cortex >/dev/null && pass "cortex on PATH (optional)" || echo "WARN: cortex not on PATH (sf.ts RO fallback OK)"

npm run sf:whoami >/dev/null && pass "Snowflake auth (sf:whoami)" || fail "Snowflake connection"

echo "=== Result ==="
if [[ "$ok" -ne 0 ]]; then
  echo "Preflight FAILED"
  exit 1
fi
echo "Preflight PASSED — ready for:"
echo "  npm run demo:reset"
echo "  npm run sf:break"
echo "  npm run demo:heal"
