#!/usr/bin/env bash
# Day-0 machine setup helpers (does not provision Snowflake — run SQL fixtures manually).
set -euo pipefail

echo "==> Checking Node (>=22.13 required)"
node -v

echo "==> Checking Cortex CLI"
if ! command -v cortex >/dev/null 2>&1; then
  echo "cortex not found. Install with:"
  echo "  curl -LsS https://ai.snowflake.com/static/cc-scripts/install.sh | sh"
  echo "Then: cortex connections create && cortex connections list"
else
  cortex connections list || true
fi

echo "==> Project already includes .cursor/skills/cortex-code + .cursor/rules (SDK cwd)"
echo "==> Optional: install official global skill for full security wrapper"
if npx --yes skills add snowflake-labs/subagent-cortex-code --copy --global -y; then
  mkdir -p "${HOME}/.cursor/rules"
  if [[ -f "${HOME}/.cursor/skills/cortex-code/cortex-snowflake-routing.mdc" ]]; then
    cp "${HOME}/.cursor/skills/cortex-code/cortex-snowflake-routing.mdc" \
      "${HOME}/.cursor/rules/cortex-snowflake-routing.mdc"
    echo "Copied user routing rule to ~/.cursor/rules/"
  fi
else
  echo "Global skills install skipped/failed — continue with project-local skill."
fi

echo "==> npm install"
cd "$(dirname "$0")/.."
npm install

if [[ ! -f .env ]]; then
  cp .env.example .env
  echo "Created .env — set CURSOR_API_KEY before running npm run heal"
fi

echo "==> Optional dbt venv"
if [[ ! -d .venv ]]; then
  python3 -m venv .venv
  .venv/bin/pip install -q 'dbt-snowflake>=1.8,<1.11' || echo "dbt install failed — see docs/DBT_SETUP.md"
fi
echo "Activate with: source .venv/bin/activate && npm run dbt:profile"
echo "==> Next: npm run sf:seed && npm run dbt:build && npm run models"
echo "Done."
