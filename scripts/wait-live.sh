#!/bin/bash
# Wait until kazuhoshibuya.com serves the page that was just deployed, up to two minutes.
cd "$(dirname "$0")/.."
live=$(mktemp)
trap 'rm -f "$live"' EXIT
for _ in $(seq 1 24); do
  if curl -sf -H "Cache-Control: no-cache" https://kazuhoshibuya.com -o "$live" && cmp -s "$live" public/index.html; then
    echo "live site matches the build"
    exit 0
  fi
  sleep 5
done
echo "live site still differs from the build after two minutes"
exit 1
