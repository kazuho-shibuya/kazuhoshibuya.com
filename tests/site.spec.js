const { test, expect } = require("@playwright/test");

const DESKTOP = { width: 1440, height: 900 };
const PHONE = { width: 390, height: 844 };

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

for (const [name, viewport] of [["desktop", DESKTOP], ["phone", PHONE]]) {
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

test("every font file loads and is used", async ({ page }) => {
  await open(page, DESKTOP);
  const loaded = await page.evaluate(() => [...document.fonts].filter((f) => f.status === "loaded").map((f) => f.family.replaceAll('"', "")));
  for (const family of ["Source Serif 4", "Source Sans 3", "Source Code Pro", "Noto Serif JP"]) {
    expect(loaded).toContain(family);
  }
});

test("email links are one well-formed address, shown as Email", async ({ page }) => {
  await open(page, DESKTOP);
  const mail = page.locator('a[href^="mailto:"]');
  await expect(mail).toHaveCount(2);
  for (const link of await mail.all()) {
    await expect(link).toHaveAttribute("href", "mailto:k.shibuya.tech@gmail.com");
    await expect(link).toHaveText("Email");
  }
  const bodyText = await page.locator("body").innerText();
  expect(bodyText).not.toContain("k.shibuya.tech@gmail.com");
});

test("external links are https and point where they say", async ({ page }) => {
  await open(page, DESKTOP);
  const hrefs = await page.locator('a[href^="http"]').evaluateAll((links) => links.map((a) => a.href));
  for (const href of hrefs) {
    expect(href).toMatch(/^https:\/\/(www\.linkedin\.com\/in\/kazuho-shibuya|github\.com\/kazuho-shibuya)/);
  }
});

test("the route map has two London stations and three Tokyo stations", async ({ page }) => {
  await open(page, DESKTOP);
  await expect(page.locator(".role.ldn")).toHaveCount(2);
  await expect(page.locator(".role.tyo")).toHaveCount(3);
});

test("the page loads no scripts", async ({ page }) => {
  await open(page, DESKTOP);
  await expect(page.locator("script")).toHaveCount(0);
});

test.describe("looks the same as the approved version", () => {
  test.skip(!!process.env.CI, "font rendering differs between macOS and the Linux runner");
  for (const [name, viewport, scheme] of [
    ["desktop-light", DESKTOP, "light"],
    ["desktop-dark", DESKTOP, "dark"],
    ["phone-light", PHONE, "light"],
  ]) {
    test(name, async ({ page }) => {
      await open(page, viewport, scheme);
      await expect(page).toHaveScreenshot(`${name}.png`, { fullPage: true, maxDiffPixelRatio: 0.002 });
    });
  }
});
