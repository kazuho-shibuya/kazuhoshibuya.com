const { test, expect } = require("@playwright/test");
const { DESKTOP, PHONE, open } = require("./helpers");

test("with reduced motion, nothing on the page moves", async ({ page }) => {
  await open(page, DESKTOP);
  await page.mouse.wheel(0, 2000);
  const running = await page.evaluate(() => document.getAnimations().map((a) => a.animationName));
  expect(running).toEqual([]);
});

test("with motion allowed, the wave drifts and the sections and route map animate on scroll", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "no-preference" });
  await page.setViewportSize(DESKTOP);
  await page.goto("/");
  const names = await page.evaluate(() => [...new Set(document.getAnimations().map((a) => a.animationName))]);
  expect(names).toContain("drift");
  const scrollDriven = await page.evaluate(() => CSS.supports("animation-timeline: view()"));
  if (scrollDriven) {
    for (const name of ["reveal", "draw", "pop"]) expect(names).toContain(name);
  }
});

for (const [name, viewport] of [
  ["desktop", DESKTOP],
  ["phone", PHONE],
]) {
  test(`${name}: after scrolling to the bottom, every scroll animation has finished`, async ({ page }) => {
    test.setTimeout(60_000);
    await page.emulateMedia({ reducedMotion: "no-preference" });
    await page.setViewportSize(viewport);
    await page.goto("/");
    const supported = await page.evaluate(() => CSS.supports("animation-timeline: view()"));
    test.skip(!supported, "this browser does not support scroll-driven animations");
    const height = await page.evaluate(() => document.documentElement.scrollHeight);
    // Scroll at a reading pace: scroll-driven animations update once per frame.
    for (let y = 0; y <= height; y += 200) {
      await page.evaluate((top) => window.scrollTo(0, top), y);
      await page.waitForTimeout(100);
    }
    await page.waitForTimeout(300);
    // Wait for the browser to catch up rather than sleeping: under load, scroll timelines update late.
    const unfinished = () =>
      page.evaluate(() =>
        document
          .getAnimations()
          .filter((a) => a.timeline && !(a.timeline instanceof DocumentTimeline))
          .filter((a) => a.effect.getComputedTiming().progress !== 1)
          .map((a) => `${a.animationName} on ${a.effect.target?.className || a.effect.target?.tagName}${a.effect.pseudoElement || ""}`),
      );
    await expect.poll(unfinished, { timeout: 15_000 }).toEqual([]);
  });
}
