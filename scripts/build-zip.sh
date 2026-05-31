#!/usr/bin/env bash
# Packages only the files that ship in the extension into dist/<name>-<version>.zip.
# Docs, scripts, CI config, and git metadata are intentionally excluded.
set -euo pipefail
cd "$(dirname "$0")/.."

VERSION=$(node -p "require('./manifest.json').version")
OUT="dist/easy-english-rewriter-${VERSION}.zip"

mkdir -p dist
rm -f "${OUT}"

zip -r -X "${OUT}" \
  manifest.json \
  background.js \
  content.js \
  content.css \
  popup.html \
  popup.js \
  popup.css \
  icons \
  -x '*.DS_Store'

echo "Built ${OUT}"
