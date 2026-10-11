#!/bin/bash
# Run every check, then deploy to Cloudflare. Nothing ships if a check fails.
set -e
cd "$(dirname "$0")"
npm run check
npx wrangler deploy --config wrangler.jsonc
