#!/usr/bin/env bash
# Showcase the three interview demo paths (drift / compile-fail / duplicate tests).
# Usage:
#   npm run demo:paths                 # interactive menu
#   npm run demo:paths -- drift        # path 1 only
#   npm run demo:paths -- compile      # path 2 only
#   npm run demo:paths -- dup          # path 3 only
#   npm run demo:paths -- list         # print paths and exit
set -uo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"
export PATH="$ROOT/.venv/bin:$PATH"

CYAN=$'\033[36m'; GREEN=$'\033[32m'; YELLOW=$'\033[33m'; RED=$'\033[31m'; BOLD=$'\033[1m'; RESET=$'\033[0m'

header() { echo; echo "${BOLD}${CYAN}═══ $* ═══${RESET}"; }
step()   { echo "${YELLOW}→${RESET} $*"; }
ok()     { echo "${GREEN}OK${RESET} $*"; }
expect_fail() { echo "${RED}(expected failure)${RESET} $*"; }

run_expect_fail() {
  local label="$1"; shift
  set +e
  "$@"
  local code=$?
  set -e
  if [[ $code -eq 0 ]]; then
    echo "${RED}UNEXPECTED SUCCESS:${RESET} $label (wanted non-zero exit)"
    return 1
  fi
  expect_fail "$label exited $code"
}

print_paths() {
  cat <<'EOF'
Demo paths
──────────
1) schema-drift   Snowflake renames amount → order_amount
                  Fail: dbt run (invalid identifier)
                  Heal: npm run demo:heal
                        --incident fixtures/incidents/schema-drift.json

2) compile-fail   Local model refs non-existent orders_bronze
                  Fail: dbt compile
                  Heal: npm run demo:heal:compile
                        --incident fixtures/incidents/compile-fail.json

3) duplicate-test Insert duplicate order_ids into STAGING.ORDERS
                  Fail: dbt test (unique_*_order_id)
                  Heal: npm run demo:heal:dup
                        --incident fixtures/incidents/duplicate-orders.json

Always start from green: npm run demo:reset
EOF
}

path_drift() {
  header "Path 1 — Schema drift"
  step "Reset to green baseline"
  npm run demo:reset
  step "Apply Snowflake schema drift"
  npm run sf:break
  step "Show dbt run failure"
  run_expect_fail "dbt run after drift" npm run dbt:run
  ok "Drift path ready for heal:"
  echo "  ${BOLD}npm run demo:heal${RESET}"
  echo "  # or: npm run heal -- --incident fixtures/incidents/schema-drift.json"
}

path_compile() {
  header "Path 2 — dbt compile fail"
  step "Reset to green baseline"
  npm run demo:reset
  step "Inject invalid ref into stg_orders.sql"
  bash scripts/break-compile.sh
  step "Show dbt compile failure"
  run_expect_fail "dbt compile after break" npm run dbt:compile
  ok "Compile-fail path ready for heal:"
  echo "  ${BOLD}npm run demo:heal:compile${RESET}"
}

path_dup() {
  header "Path 3 — dbt test duplicate records"
  step "Reset to green baseline"
  npm run demo:reset
  step "Insert duplicate order_ids"
  npm run sf:break-dup
  step "dbt run should still succeed (view/table builds)"
  npm run dbt:run
  step "Show dbt test failure (unique tests)"
  run_expect_fail "dbt test after duplicates" npm run dbt:test
  ok "Duplicate-test path ready for heal:"
  echo "  ${BOLD}npm run demo:heal:dup${RESET}"
  echo "  # Expected heal: dedupe in stg_orders (QUALIFY ROW_NUMBER …); source DQ remains RO note"
}

menu() {
  print_paths
  echo
  echo "Select: 1=drift  2=compile  3=dup  a=all  q=quit"
  read -r -p "> " choice
  case "$choice" in
    1|drift) path_drift ;;
    2|compile) path_compile ;;
    3|dup) path_dup ;;
    a|all)
      path_drift
      path_compile
      path_dup
      ;;
    q|quit) exit 0 ;;
    *) echo "Unknown choice: $choice"; exit 1 ;;
  esac
}

cmd="${1:-}"
case "$cmd" in
  ""|menu) menu ;;
  list|paths) print_paths ;;
  1|drift|schema-drift) path_drift ;;
  2|compile|compile-fail) path_compile ;;
  3|dup|duplicate|duplicates) path_dup ;;
  all)
    path_drift
    path_compile
    path_dup
    ;;
  -h|--help|help)
    echo "Usage: npm run demo:paths -- [menu|list|drift|compile|dup|all]"
    print_paths
    ;;
  *)
    echo "Unknown path: $cmd"
    echo "Use: menu|list|drift|compile|dup|all"
    exit 1
    ;;
esac
