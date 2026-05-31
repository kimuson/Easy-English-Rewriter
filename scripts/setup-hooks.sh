#!/usr/bin/env bash
# Enable the repository's version-controlled git hooks.
# Run once after cloning: `bash scripts/setup-hooks.sh`
set -euo pipefail
cd "$(dirname "$0")/.."

git config core.hooksPath .githooks
chmod +x .githooks/* 2>/dev/null || true

echo "Git hooks enabled (core.hooksPath=.githooks)."
echo "The pre-push hook now runs scripts/ci-local.sh before every push."
