# kazuhoshibuya.com

My personal site: one static HTML page served by a Cloudflare Worker. Built with Claude Code from plans I wrote and reviewed.

```
public/            the site: index.html and self-hosted fonts
tests/             Playwright checks, and approved screenshots under tests/screenshots
scripts/           check-copy.py: every sentence must match my LinkedIn text
wrangler.jsonc     Cloudflare Worker config and custom domains
deploy.sh          runs every check, then deploys
```

## Checks

`npm run check` runs, in order:

1. **Copy**: each sentence on the page appears word for word in my LinkedIn text. That file is private, so CI skips this step.
2. **HTML**: `html-validate` with the recommended rules.
3. **Browser** (Playwright, using installed Chrome): no sideways scroll and no text past the edge on desktop and phone, no console errors or failed requests, every font loads, the focus line fits one line on desktop, the email links are well formed, the external links go where they say, the page loads no scripts. Locally it also compares full-page screenshots against the approved ones; CI skips that because Linux renders fonts differently.

## Deploy

```
./deploy.sh
```

After an approved design change, refresh the reference screenshots with `npm run screenshots:update`.
