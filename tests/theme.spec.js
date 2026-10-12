const { test, expect } = require("@playwright/test");
const { DESKTOP, open } = require("./helpers");

const PAPER = { light: "rgb(248, 245, 238)", dark: "rgb(19, 26, 42)" };
const background = (page) => page.evaluate(() => getComputedStyle(document.body).backgroundColor);

// Playwright cannot carry an emulated colour scheme across the process switch that COOP causes in Firefox,
// so on the live site Firefox is checked through its own OS-theme preference instead (below).
const emulationBlocked = (browserName) => !!process.env.LIVE && browserName === "firefox";

for (const scheme of ["light", "dark"]) {
  test(`with no saved choice, the page follows the system's ${scheme} setting`, async ({ page, browserName }) => {
    test.skip(emulationBlocked(browserName), "covered by the Firefox OS-theme test");
    await open(page, DESKTOP, scheme);
    expect(await background(page)).toBe(PAPER[scheme]);
    const other = scheme === "light" ? "dark" : "light";
    await expect(page.locator("button.theme")).toHaveAttribute("aria-label", `Switch to ${other} mode`);
  });

  test(`from ${scheme}, the switch flips the theme and the choice survives a reload`, async ({ page, browserName }) => {
    test.skip(emulationBlocked(browserName), "covered by the Firefox OS-theme test");
    const other = scheme === "light" ? "dark" : "light";
    await open(page, DESKTOP, scheme);
    await page.locator("button.theme").click();
    expect(await background(page)).toBe(PAPER[other]);
    await expect(page.locator("button.theme")).toHaveAttribute("aria-label", `Switch to ${scheme} mode`);
    await page.reload();
    expect(await background(page)).toBe(PAPER[other]);
  });
}
