const { test, expect } = require("@playwright/test");
const { DESKTOP, TABLET, PHONE, open } = require("./helpers");

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
});
