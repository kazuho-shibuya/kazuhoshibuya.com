#!/bin/bash
# Is the live site what linkedin.md would build today? Exit 1 with the reason if not.
set -e
cd "$(dirname "$0")/.."
python3 scripts/build.py >/dev/null
live=$(mktemp)
curl -sf https://kazuhoshibuya.com -o "$live"
if ! git diff --quiet -- public/index.html; then
  echo "stale: linkedin.md or the template has changed since the page was last built. Run ./deploy.sh."
  exit 1
fi
if ! cmp -s "$live" public/index.html; then
  echo "stale: the live page differs from the committed build. Run ./deploy.sh."
  exit 1
fi
echo "ok: the live site matches linkedin.md"
