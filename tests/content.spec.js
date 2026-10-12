const { test, expect } = require("@playwright/test");
const fontkit = require("fontkit");
const path = require("path");
const { DESKTOP, PHONE, EMAIL, open } = require("./helpers");

test("the Japanese name is 澁谷 一帆, and the shipped font file contains every character of it", async ({ page }) => {
  await open(page, DESKTOP);
  const text = await page.locator('[lang="ja"]').allTextContents();
  expect(text[0]).toBe("澁谷 一帆");
  const font = fontkit.openSync(path.join(__dirname, "../public/fonts/noto-serif-jp.woff2"));
  const missing = [...new Set(text.join("").replace(/\s/g, ""))].filter((ch) => !font.hasGlyphForCodePoint(ch.codePointAt(0)));
  expect(missing, "characters with no glyph in noto-serif-jp.woff2").toEqual([]);
});

test("every font file loads", async ({ page }) => {
  await open(page, DESKTOP);
  const loaded = await page.evaluate(() =>
    [...document.fonts].filter((f) => f.status === "loaded").map((f) => f.family.replaceAll('"', "")),
  );
  for (const family of ["Source Serif 4", "Source Sans 3", "Source Code Pro", "Noto Serif JP"]) {
    expect(loaded).toContain(family);
  }
});

test("every mailto link goes to the one address", async ({ page }) => {
  await open(page, DESKTOP);
  const links = await page.locator('a[href^="mailto:"]').all();
  expect(links.length).toBeGreaterThan(0);
  for (const link of links) {
    await expect(link).toHaveAttribute("href", `mailto:${EMAIL}`);
  }
});

test("the contact row is LinkedIn, GitHub, then Email, and appears only once", async ({ page }) => {
  await open(page, DESKTOP);
  await expect(page.locator(".links.contact a")).toHaveText(["LinkedIn", "GitHub", "Email"]);
  for (const href of ["https://www.linkedin.com/in/kazuho-shibuya", "https://github.com/kazuho-shibuya", `mailto:${EMAIL}`]) {
    await expect(page.locator(`a[href="${href}"]`)).toHaveCount(1);
  }
});

test("Email copies the address and says so", async ({ page, context, browserName }) => {
  test.skip(browserName !== "chromium", "clipboard permissions can only be granted in Chromium");
  await context.grantPermissions(["clipboard-read", "clipboard-write"]);
  await open(page, PHONE);
  await page.locator(".links.contact a.email").click();
  await expect(page.locator(".links.contact .copied")).toHaveText(`Copied ${EMAIL}`);
  expect(await page.evaluate(() => navigator.clipboard.readText())).toBe(EMAIL);
  expect(page.url()).not.toContain("mailto:");
});

test("when copying fails, Email falls back to the mail link", async ({ page }) => {
  await page.addInitScript(() =>
    Object.defineProperty(navigator, "clipboard", { value: { writeText: () => Promise.reject(new Error("denied")) } }),
  );
  await open(page, PHONE);
  // A same-page address stands in for mailto:, which a test browser cannot follow.
  await page.locator(".links.contact a.email").evaluate((a) => (a.href = "/#mail"));
  await page.locator(".links.contact a.email").click();
  await expect(page).toHaveURL(/#mail$/);
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
  test.skip(!process.env.LIVE, "calls github.com, so it runs with the live checks only");
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

test("How it's built claims only what the repo does: three browsers, unit tests, and the security policy", async ({ page }) => {
  await open(page, DESKTOP);
  const rows = Object.fromEntries(
    await page
      .locator(".decisions div")
      .evaluateAll((all) => all.map((d) => [d.querySelector("dt").textContent, d.querySelector("dd").textContent])),
  );
  expect(Object.keys(rows)).toEqual(["Source", "Quality", "Security", "Stack", "Method"]);
  expect(rows.Quality).toContain("unit, browser and accessibility tests");
  expect(rows.Quality).toContain("three browsers");
  expect(rows.Security).toContain("Content Security Policy");
  const config = require("../playwright.config.js");
  expect(config.projects.length, "the number of browsers the Quality row claims").toBe(3);
});
