#!/usr/bin/env bash
# Runs the same checks as GitHub Actions CI, locally.
# Use before every commit/push. Invoked by the "run-ci" Claude Code skill.
set -euo pipefail
cd "$(dirname "$0")/.."

echo "▶ 1/3 JavaScript syntax check"
for f in $(git ls-files '*.js' '*.mjs'); do
  node --check "$f"
done
echo "   ok"

echo "▶ 2/3 Manifest validation"
node scripts/validate.mjs

echo "▶ 3/3 Build package"
bash scripts/build-zip.sh

echo "✅ All CI checks passed locally."
