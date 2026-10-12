# kazuhoshibuya.com

My personal site: one static HTML page served by a Cloudflare Worker. Built with Claude Code from plans I wrote and reviewed.

```
src/template.html          the layout, styles and the text that belongs to the site itself
scripts/build.py           fills the template from my LinkedIn text; writes public/index.html and public/_headers
scripts/subset-jp-font.sh  rebuilds the Japanese font with only the characters the page uses
public/                    the built page, its headers file and self-hosted fonts (generated, committed)
tests/                     unit tests for the build, browser tests by concern, approved screenshots
wrangler.jsonc             Cloudflare Worker config and custom domains
deploy.sh                  every check, deploy, then the browser checks against the live site
```

## Design decisions

- **One source for the words.** The headline, About, Experience, Selected work and Stack are generated from my LinkedIn text, kept in a private repo beside this one, so the site cannot say something LinkedIn does not. The build stops without writing anything if a section is missing or a selected highlight no longer exists.
- **Nothing deploys unchecked.** Every push runs the full suite; the deploy job runs only after it passes, then re-runs the browser checks against the live site.
- **A strict Content Security Policy.** `build.py` hashes each inline script and style block of the built page into `public/_headers`, so the policy allows exactly the page's own code and never `unsafe-inline`.
- **No framework, no cookies.** Two small inline scripts: the theme switch and the Email copy link. Cloudflare adds a cookie-free visitor count.

## Working on it

Test first. Write or change the test that describes the behaviour, run it and watch it fail for the right reason, then make the smallest change that passes, then `npm run check`.

| Change                 | Edit                                  | Then                                                                               |
| ---------------------- | ------------------------------------- | ---------------------------------------------------------------------------------- |
| Words                  | the LinkedIn text in the private repo | `./deploy.sh` (CI cannot read that file)                                           |
| Layout, styles, design | `src/template.html`                   | `npm run build`, check the screenshots, `npm run screenshots:update` once approved |
| Japanese text          | `src/template.html`                   | `scripts/subset-jp-font.sh`; a test fails if a character has no glyph              |
| Build logic            | `scripts/build.py`                    | `npm run test:unit`                                                                |

`npm run format` formats Python with Ruff and everything else with Prettier.

## Checks

`npm run check` runs, in order:

1. **Lint**: Ruff for Python, Prettier for the rest. The template is excluded from Prettier because whitespace between inline elements is part of the rendering.
2. **Unit tests** for `build.py`, against a made-up fixture so they run anywhere.
3. **Build** from the LinkedIn text. CI cannot read the private file, so it skips this step and checks the committed page.
4. **HTML**: `html-validate` with the recommended rules.
5. **Browser tests** with Playwright in Chrome, Safari's WebKit and Firefox, at desktop, tablet and phone widths, split by concern: `layout`, `content`, `motion`, `theme`, `quality` (scripts, security headers, WCAG 2.1 AA in light and dark) and `visual` (full-page screenshots, compared pixel for pixel in Chrome on the Mac; CI skips them because Linux renders fonts differently). LinkedIn links are checked for their address only, because LinkedIn blocks automated visits.

## Deploy

Push to `main`. GitHub Actions runs every check, deploys to Cloudflare, waits for the new version, then runs the browser checks against https://kazuhoshibuya.com, including that the live response carries the headers from `public/_headers`. The deploy needs a `CLOUDFLARE_API_TOKEN` repository secret. Dependabot proposes dependency updates weekly.
