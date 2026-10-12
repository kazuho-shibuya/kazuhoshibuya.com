const { test, expect } = require("@playwright/test");
const AxeBuilder = require("@axe-core/playwright").default;
const crypto = require("crypto");
const fs = require("fs");
const path = require("path");
const { DESKTOP, open } = require("./helpers");

test("the only scripts are the theme choice, the page script and Cloudflare's visitor count", async ({ page }) => {
  await open(page, DESKTOP);
  // Cloudflare injects its cookie-free Web Analytics beacon into some served pages; the page itself carries two inline scripts.
  const all = await page
    .locator('script:not([type="application/ld+json"])')
    .evaluateAll((els) => els.map((s) => s.src || `inline: ${s.textContent.trim().slice(0, 60)}`));
  const ours = all.filter((s) => !s.startsWith("https://static.cloudflareinsights.com/beacon.min.js"));
  expect(ours, `scripts on the page: ${JSON.stringify(all)}`).toEqual([
    expect.stringMatching(/^inline: try \{\s+const t = localStorage\.getItem\("theme"\)/),
    expect.stringMatching(/^inline: for \(const link of document\.querySelectorAll\("a\[data-copy\]"/),
  ]);
});

for (const scheme of ["light", "dark"]) {
  test(`no accessibility violations in ${scheme} mode`, async ({ page }) => {
    await open(page, DESKTOP, scheme);
    await page.locator(".role details").evaluateAll((all) => all.forEach((d) => (d.open = true)));
    const results = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21aa"]).analyze();
    const summary = results.violations.map((v) => `${v.id}: ${v.nodes.length} node(s) — ${v.nodes[0].target.join(" ")}`);
    expect(summary).toEqual([]);
  });
}

test("the header and footer sit outside main, so screen readers find them as landmarks", async ({ page }) => {
  await open(page, DESKTOP);
  await expect(page.locator("main")).toHaveCount(1);
  await expect(page.locator("main header, main footer")).toHaveCount(0);
});

test("search engines get one address, a sitemap, link previews and the profile links", async ({ page, request }) => {
  await open(page, DESKTOP);
  const home = "https://kazuhoshibuya.com/";
  await expect(page).toHaveTitle("Kazuho Shibuya (澁谷 一帆) — Software Engineer");
  await expect(page.locator('link[rel="canonical"]')).toHaveAttribute("href", home);
  await expect(page.locator('meta[property="og:url"]')).toHaveAttribute("content", home);
  await expect(page.locator('meta[property="og:title"]')).toHaveAttribute("content", await page.title());
  await expect(page.locator('meta[property="og:description"]')).toHaveAttribute("content", /\S/);

  const person = JSON.parse(await page.locator('script[type="application/ld+json"]').textContent());
  expect(person["@type"]).toBe("Person");
  expect(person.name).toBe("Kazuho Shibuya");
  expect(person.alternateName).toEqual(["澁谷 一帆", "渋谷 一帆", "しぶや かずほ", "シブヤ カズホ"]);
  expect(person.url).toBe(home);
  const contactLinks = await page.locator('.links.contact a[href^="https://"]').evaluateAll((links) => links.map((a) => a.href));
  expect(person.sameAs).toEqual(contactLinks);

  const robots = await request.get("/robots.txt");
  expect(robots.ok()).toBe(true);
  expect(await robots.text()).toContain(`Sitemap: ${home}sitemap.xml`);
  const sitemap = await request.get("/sitemap.xml");
  expect(await sitemap.text()).toContain(`<loc>${home}</loc>`);
});

const PUBLIC = path.join(__dirname, "../public");

// Reads public/_headers into { name: value } for the "/*" block.
function productionHeaders() {
  const lines = fs.readFileSync(path.join(PUBLIC, "_headers"), "utf8").split("\n");
  const headers = {};
  for (const line of lines.slice(lines.indexOf("/*") + 1)) {
    const match = line.match(/^\s+([A-Za-z-]+):\s*(.+)$/);
    if (match) headers[match[1].toLowerCase()] = match[2].trim();
  }
  return headers;
}

const inlineHashes = (html, tag) =>
  [...html.matchAll(new RegExp(`<${tag}>([\\s\\S]*?)</${tag}>`, "g"))].map(
    (m) => `'sha256-${crypto.createHash("sha256").update(m[1]).digest("base64")}'`,
  );

test("the headers file sets the security headers and allows exactly the page's inline code", async () => {
  const headers = productionHeaders();
  const html = fs.readFileSync(path.join(PUBLIC, "index.html"), "utf8");
  const csp = headers["content-security-policy"];
  expect(csp, "Content-Security-Policy").toBeTruthy();
  for (const hash of inlineHashes(html, "script")) expect(csp).toContain(hash);
  for (const hash of inlineHashes(html, "style")) expect(csp).toContain(hash);
  expect(csp).toContain("default-src 'none'");
  expect(csp).toContain("frame-ancestors 'none'");
  expect(csp).not.toContain("unsafe-inline");
  expect(headers["strict-transport-security"]).toMatch(/max-age=\d{8,}/);
  expect(headers["x-content-type-options"]).toBe("nosniff");
  expect(headers["referrer-policy"]).toBe("strict-origin-when-cross-origin");
  expect(headers["permissions-policy"]).toContain("camera=()");
});

test("the page runs under the production headers with no policy violations", async ({ page, context, browserName }) => {
  test.skip(!!process.env.LIVE, "the live run checks the real headers instead");
  const headers = productionHeaders();
  await page.route("/", async (route) => {
    const response = await route.fetch();
    await route.fulfill({ response, headers: { ...response.headers(), ...headers } });
  });
  await page.addInitScript(() => {
    window.__violations = [];
    document.addEventListener("securitypolicyviolation", (e) =>
      window.__violations.push(`${e.violatedDirective}: ${e.blockedURI || "inline"}`),
    );
  });
  if (browserName === "chromium") await context.grantPermissions(["clipboard-read", "clipboard-write"]);
  await open(page, DESKTOP);
  await page.locator("button.theme").click();
  await page.locator(".links.contact a.email").click();
  expect(await page.evaluate(() => window.__violations)).toEqual([]);
});

test("the live site serves the headers from the headers file", async ({ request }) => {
  test.skip(!process.env.LIVE, "only meaningful against the deployed site");
  const live = (await request.get("/")).headers();
  for (const [name, value] of Object.entries(productionHeaders())) expect(live[name], name).toBe(value);
});
