#!/bin/bash
# Build from the LinkedIn text, run every check, then deploy. Nothing ships if a step fails.
set -e
cd "$(dirname "$0")"
npm run check
npx wrangler deploy --config wrangler.jsonc
