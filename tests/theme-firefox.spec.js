const { test, expect } = require("@playwright/test");

// ui.systemUsesDarkTheme is how Firefox learns the operating system's dark setting. Unlike Playwright's
// colour-scheme emulation, it survives the process switch that Cross-Origin-Opener-Policy causes.
// colorScheme: null stops Playwright forcing its default light scheme, so the OS preference decides.
test.use({ colorScheme: null, launchOptions: { firefoxUserPrefs: { "ui.systemUsesDarkTheme": 1 } } });

const background = (page) => page.evaluate(() => getComputedStyle(document.body).backgroundColor);

test("Firefox with its operating system set to dark shows the dark theme, and the switch still flips it", async ({ page, browserName }) => {
  test.skip(browserName !== "firefox", "the OS-theme preference is Firefox's");
  await page.goto("/");
  expect(await background(page)).toBe("rgb(19, 26, 42)");
  await page.locator("button.theme").click();
  expect(await background(page)).toBe("rgb(248, 245, 238)");
});
