const { test, expect } = require("@playwright/test");
const fs = require("fs");
const path = require("path");
const { PNG } = require("pngjs");
const { DESKTOP, TABLET, PHONE, open } = require("./helpers");
const { SIZE, showPreview } = require("../scripts/render-og");

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
      test.setTimeout(60_000);
      await open(page, viewport, scheme);
      await expect(page).toHaveScreenshot(`${name}.png`, { fullPage: true, maxDiffPixels: 0, threshold: 0.05 });
    });
  }

  test("the link-preview image matches the page's header today", async ({ page }) => {
    await open(page, SIZE);
    await showPreview(page);
    const rendered = PNG.sync.read(await page.screenshot({ clip: { x: 0, y: 0, ...SIZE } }));
    const committed = PNG.sync.read(fs.readFileSync(path.join(__dirname, "../public/og.png")));
    expect(Buffer.compare(rendered.data, committed.data), "public/og.png is stale or Chrome changed: run npm run build").toBe(0);
  });
});
