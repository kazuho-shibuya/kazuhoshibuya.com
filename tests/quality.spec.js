const { test, expect } = require("@playwright/test");
const AxeBuilder = require("@axe-core/playwright").default;
const { DESKTOP, open } = require("./helpers");

test("the only scripts are the theme choice, the page script and Cloudflare's visitor count", async ({ page }) => {
  await open(page, DESKTOP);
  // Cloudflare injects its cookie-free Web Analytics beacon into some served pages; the page itself carries two inline scripts.
  const all = await page.locator("script").evaluateAll((els) => els.map((s) => s.src || `inline: ${s.textContent.trim().slice(0, 60)}`));
  const ours = all.filter((s) => !s.startsWith("https://static.cloudflareinsights.com/beacon.min.js"));
  expect(ours, `scripts on the page: ${JSON.stringify(all)}`).toEqual([
    expect.stringMatching(/^inline: try \{ const t = localStorage\.getItem\("theme"\)/),
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
