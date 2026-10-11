# kazuhoshibuya.com

My personal site: one static HTML page served by a Cloudflare Worker. Built with Claude Code from plans I wrote and reviewed.

```
src/template.html  the page layout, styles and the text that belongs to the site itself
scripts/build.py   fills the template from my LinkedIn text and writes public/index.html
public/            the built page and self-hosted fonts (generated, committed)
tests/             Playwright checks, and approved screenshots under tests/screenshots
wrangler.jsonc     Cloudflare Worker config and custom domains
deploy.sh          builds, runs every check, then deploys
```

## One source for the words

The headline, About, Experience, Selected work and Stack come from one file: my LinkedIn text, kept in a private repo beside this one. `build.py` reads it and writes the page, so the site cannot say something LinkedIn does not. It stops without writing anything if a section is missing or a selected highlight no longer exists. Edit the words there, never in `public/index.html`.

## Checks

`npm run check` runs, in order:

1. **Build** from the LinkedIn text. CI cannot read the private file, so it skips this step and checks the committed page.
2. **HTML**: `html-validate` with the recommended rules.
3. **Browser** (Playwright, using installed Chrome): no sideways scroll and no text past the edge on desktop and phone, no console errors or failed requests, every font loads, the focus line fits one line on desktop, the email links are well formed, the external links go where they say, the page loads no scripts. Locally it also compares full-page screenshots against the approved ones; CI skips that because Linux renders fonts differently.

## Deploy

```
./deploy.sh
```

After an approved design change, refresh the reference screenshots with `npm run screenshots:update`.
