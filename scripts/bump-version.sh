#!/usr/bin/env bash
# Usage: ./scripts/bump-version.sh <new-version>
# Example: ./scripts/bump-version.sh 1.1.0
set -euo pipefail

NEW_VERSION="${1:-}"
if [[ -z "$NEW_VERSION" ]]; then
  echo "Usage: $0 <new-version>  (e.g. 1.1.0)"
  exit 1
fi

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
TAURI_CONF="$ROOT/grpcpeek/src-tauri/tauri.conf.json"
PKG_JSON="$ROOT/grpcpeek/frontend/package.json"

CURRENT=$(sed -n 's/.*"version": "\([^"]*\)".*/\1/p' "$TAURI_CONF" | head -1)
echo "Bumping $CURRENT → $NEW_VERSION"

sed -i.bak "s/\"version\": \"$CURRENT\"/\"version\": \"$NEW_VERSION\"/" "$TAURI_CONF" && rm "$TAURI_CONF.bak"
sed -i.bak "s/\"version\": \"$CURRENT\"/\"version\": \"$NEW_VERSION\"/" "$PKG_JSON"   && rm "$PKG_JSON.bak"

echo "Done. Commit and push, then trigger the pipeline."
