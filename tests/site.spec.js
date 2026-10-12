const { test, expect } = require("@playwright/test");
const AxeBuilder = require("@axe-core/playwright").default;

const DESKTOP = { width: 1440, height: 900 };
const TABLET = { width: 820, height: 1180 };
const PHONE = { width: 390, height: 844 };
const EMAIL = "k.shibuya.tech@gmail.com";

async function open(page, viewport, colorScheme = "light") {
  const problems = [];
  page.on("console", (msg) => msg.type() === "error" && problems.push(msg.text()));
  page.on("requestfailed", (req) => problems.push(`failed: ${req.url()}`));
  page.on("response", (res) => res.status() >= 400 && problems.push(`${res.status()}: ${res.url()}`));
  await page.emulateMedia({ colorScheme, reducedMotion: "reduce" });
  await page.setViewportSize(viewport);
  await page.goto("/");
  await page.evaluate(() => document.fonts.ready);
  return problems;
}

for (const [name, viewport] of [["desktop", DESKTOP], ["tablet", TABLET], ["phone", PHONE]]) {
  test(`${name}: the page cannot scroll sideways`, async ({ page }) => {
    await open(page, viewport);
    const scrollX = await page.evaluate(() => {
      window.scrollTo(5000, 0);
      return window.scrollX;
    });
    expect(scrollX).toBe(0);
  });

  test(`${name}: no visible content runs past the edge`, async ({ page }) => {
    await open(page, viewport);
    const offenders = await page.evaluate(() =>
      [...document.querySelectorAll("body *")]
        .filter((el) => !el.closest('[aria-hidden="true"]'))
        .filter((el) => el.getBoundingClientRect().right > document.documentElement.clientWidth + 1)
        .map((el) => `${el.tagName}.${el.className}: ${el.textContent.trim().slice(0, 40)}`),
    );
    expect(offenders).toEqual([]);
  });

  test(`${name}: no console errors and no failed requests`, async ({ page }) => {
    const problems = await open(page, viewport);
    expect(problems).toEqual([]);
  });
}

test("desktop: the focus line sits on one line", async ({ page }) => {
  await open(page, DESKTOP);
  const tops = await page.locator(".focus span").evaluateAll((spans) => spans.map((s) => Math.round(s.getBoundingClientRect().top)));
  expect(new Set(tops).size).toBe(1);
});

test("every font file loads", async ({ page }) => {
  await open(page, DESKTOP);
  const loaded = await page.evaluate(() => [...document.fonts].filter((f) => f.status === "loaded").map((f) => f.family.replaceAll('"', "")));
  for (const family of ["Source Serif 4", "Source Sans 3", "Source Code Pro", "Noto Serif JP"]) {
    expect(loaded).toContain(family);
  }
});

test("every mailto link goes to the one address", async ({ page }) => {
  await open(page, DESKTOP);
  for (const link of await page.locator('a[href^="mailto:"]').all()) {
    await expect(link).toHaveAttribute("href", `mailto:${EMAIL}`);
  }
});

test("the top Contact link jumps to the contact section", async ({ page }) => {
  await open(page, DESKTOP);
  const link = page.locator(".hero .links a", { hasText: "Contact" });
  await expect(link).toHaveAttribute("href", "#contact");
  await link.click();
  await expect(page.locator("#contact .email")).toBeInViewport();
});

test("the contact section shows the full address", async ({ page }) => {
  await open(page, DESKTOP);
  await expect(page.locator("#contact .email")).toHaveText(EMAIL);
});

test("the copy button puts the address on the clipboard", async ({ page, context, browserName }) => {
  test.skip(browserName !== "chromium", "clipboard permissions can only be granted in Chromium");
  await context.grantPermissions(["clipboard-read", "clipboard-write"]);
  await open(page, DESKTOP);
  const button = page.locator("#contact button.copy");
  await expect(button).toBeVisible();
  await button.click();
  await expect(page.locator("#contact .copied")).toHaveText("Copied");
  expect(await page.evaluate(() => navigator.clipboard.readText())).toBe(EMAIL);
});

test("external links point where they say", async ({ page }) => {
  await open(page, DESKTOP);
  const hrefs = await page.locator('a[href^="http"]').evaluateAll((links) => links.map((a) => a.href));
  expect(hrefs.length).toBeGreaterThan(0);
  for (const href of hrefs) {
    expect(href).toMatch(/^https:\/\/(www\.linkedin\.com\/in\/kazuho-shibuya|github\.com\/kazuho-shibuya)/);
  }
});

test("GitHub links open", async ({ page, request }) => {
  await open(page, DESKTOP);
  const hrefs = await page.locator('a[href^="https://github.com"]').evaluateAll((links) => [...new Set(links.map((a) => a.href))]);
  for (const href of hrefs) {
    const res = await request.get(href);
    expect(res.status(), href).toBe(200);
  }
});

test("Highlights open and show the bullets", async ({ page }) => {
  await open(page, DESKTOP);
  const first = page.locator(".role details").first();
  await expect(first.locator("li").first()).toBeHidden();
  await first.locator("summary").click();
  await expect(first.locator("li").first()).toBeVisible();
});

test("the route map has two London stations and three Tokyo stations", async ({ page }) => {
  await open(page, DESKTOP);
  await expect(page.locator(".role.ldn")).toHaveCount(2);
  await expect(page.locator(".role.tyo")).toHaveCount(3);
});

test("the only script of ours is the inline copy button script", async ({ page }) => {
  await open(page, DESKTOP);
  // Cloudflare adds its own bot-detection script, served from /cdn-cgi/, for some visitors such as CI runners.
  const all = await page.locator("script").evaluateAll((els) => els.map((s) => s.src || `inline: ${s.textContent.trim().slice(0, 60)}`));
  const ours = all.filter((s) => !s.includes("/cdn-cgi/"));
  expect(ours, `scripts on the page: ${JSON.stringify(all)}`).toEqual([expect.stringMatching(/^inline: for \(const button of document\.querySelectorAll\("button\.copy"/)]);
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

test.describe("looks the same as the approved version", () => {
  test.skip(!!process.env.CI || !!process.env.LIVE, "font rendering differs between macOS and Linux; live runs skip it");
  test.beforeEach(({ browserName }) => test.skip(browserName !== "chromium", "references are taken in Chrome"));
  for (const [name, viewport, scheme] of [
    ["desktop-light", DESKTOP, "light"],
    ["desktop-dark", DESKTOP, "dark"],
    ["tablet-light", TABLET, "light"],
    ["phone-light", PHONE, "light"],
  ]) {
    test(name, async ({ page }) => {
      await open(page, viewport, scheme);
      await expect(page).toHaveScreenshot(`${name}.png`, { fullPage: true, maxDiffPixelRatio: 0.002 });
    });
  }
});
