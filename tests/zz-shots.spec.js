const { test } = require("@playwright/test");

const OUT = "/Users/shibuyakazuho/.claude/jobs/6cbfbe2f/tmp";

for (const [name, w, h] of [["desktop", 1440, 420], ["phone", 390, 420]]) {
  for (const scheme of ["light", "dark"]) {
    test(`${name} ${scheme}`, async ({ page, browserName }) => {
      test.skip(browserName !== "chromium");
      await page.emulateMedia({ colorScheme: scheme, reducedMotion: "reduce" });
      await page.setViewportSize({ width: w, height: h });
      await page.goto("/");
      await page.evaluate(() => document.fonts.ready);
      await page.screenshot({ path: `${OUT}/sail-${name}-${scheme}.png` });
    });
  }
}

test("build notes", async ({ page, browserName }) => {
  test.skip(browserName !== "chromium");
  await page.emulateMedia({ colorScheme: "light", reducedMotion: "reduce" });
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/");
  await page.evaluate(() => document.fonts.ready);
  await page.locator(".colophon").screenshot({ path: `${OUT}/sail-colophon.png` });
});
