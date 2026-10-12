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
3. **Browser** (Playwright, in Chrome, Safari's WebKit and Firefox, at desktop, tablet and phone widths): no sideways scroll and no text past the edge, no console errors or failed requests, every font loads, the focus line fits one line on desktop, every mailto link uses the one address, the contact section shows it and the Copy button copies it, external links go where they say and the GitHub ones open, Highlights expand, the route map has the right stations, the only script is the inline copy script, and no WCAG 2.1 AA accessibility violations in light or dark mode. Locally it also compares full-page screenshots against the approved ones in Chrome; CI skips that because Linux renders fonts differently. LinkedIn links are checked for their address only: LinkedIn blocks automated visits.

## Deploy

Push to `main`. GitHub Actions runs every check, deploys to Cloudflare, then runs the browser checks again against https://kazuhoshibuya.com. The deploy needs a `CLOUDFLARE_API_TOKEN` repository secret.

From the Mac, `./deploy.sh` does the same, and is the only way a LinkedIn text change gets built, because CI cannot read that file.

After an approved design change, refresh the reference screenshots with `npm run screenshots:update`.
