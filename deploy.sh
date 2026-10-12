#!/bin/bash
# Build from the LinkedIn text, run every check, deploy, then check the live site.
# Pushing to main does the same in GitHub Actions; use this when deploying from the Mac.
set -e
cd "$(dirname "$0")"
npm run check
npx wrangler deploy --config wrangler.jsonc
LIVE=1 npx playwright test --grep-invert "looks the same"
