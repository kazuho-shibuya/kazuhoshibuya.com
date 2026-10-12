const { test, expect } = require("@playwright/test");
const { PNG } = require("pngjs");
const { DESKTOP, TABLET, PHONE, SMALL_PHONE, open } = require("./helpers");

for (const [name, viewport] of [
  ["desktop", DESKTOP],
  ["tablet", TABLET],
  ["phone", PHONE],
]) {
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

test("phone: the focus line is three short lines with no dots", async ({ page }) => {
  await open(page, PHONE);
  const spans = page.locator(".focus span");
  const tops = await spans.evaluateAll((all) => all.map((s) => Math.round(s.getBoundingClientRect().top)));
  expect(new Set(tops).size).toBe(3);
  await expect(page.locator(".focus em").first()).toBeHidden();
});

for (const [name, viewport] of [
  ["phone", PHONE],
  ["small phone", SMALL_PHONE],
]) {
  test(`${name}: the top label with the sail stays on one line`, async ({ page }) => {
    await open(page, viewport);
    const lines = await page
      .locator(".hero .label")
      .evaluate((el) => Math.round(el.getBoundingClientRect().height / parseFloat(getComputedStyle(el).lineHeight)));
    expect(lines).toBe(1);
  });
}

test("the tab icon and the header mark are the sail", async ({ page }) => {
  await open(page, DESKTOP);
  await expect(page.locator('link[rel="icon"]')).toHaveAttribute("href", /^data:image\/svg\+xml,.*s-jib/);
  await expect(page.locator(".hero .label .mark")).toBeVisible();
});

test("desktop: every row in How it's built sits on one line", async ({ page }) => {
  await open(page, DESKTOP);
  const rows = await page.locator(".decisions dd, .motifs p").evaluateAll((all) =>
    all.map((el) => {
      const range = document.createRange();
      range.selectNodeContents(el);
      const tops = new Set([...range.getClientRects()].map((r) => Math.round(r.top)));
      return { text: el.textContent.trim().slice(0, 40), lines: tops.size };
    }),
  );
  expect(rows.length).toBe(8);
  expect(rows.filter((r) => r.lines !== 1)).toEqual([]);
});

test("the footer carries the mark, the name and the source link", async ({ page }) => {
  await open(page, DESKTOP);
  const footer = page.locator("footer.site");
  await expect(footer.locator(".mark")).toBeVisible();
  await expect(footer).toContainText("Kazuho Shibuya · London");
  await expect(footer.locator("a")).toHaveAttribute("href", "https://github.com/kazuho-shibuya/kazuhoshibuya.com");
});

// The wave may sit faintly behind text: at most 8% change in any colour channel (20 of 255), on every screen size.
for (const [name, viewport, limit] of [
  ["desktop", DESKTOP, 20],
  ["tablet", TABLET, 20],
  ["phone", PHONE, 20],
  ["small phone", SMALL_PHONE, 20],
]) {
  test(`${name}: the wave pattern behind the top text stays within ${limit} of 255`, async ({ page }) => {
    await open(page, viewport);
    // The boxes of the letters themselves, not of the full-width blocks that hold them.
    const boxes = await page.locator(".hero").evaluate((hero) => {
      const walker = document.createTreeWalker(hero, NodeFilter.SHOW_TEXT);
      const rects = [];
      for (let node = walker.nextNode(); node; node = walker.nextNode()) {
        if (!node.textContent.trim()) continue;
        const range = document.createRange();
        range.selectNodeContents(node);
        for (const r of range.getClientRects()) {
          rects.push({ x: Math.floor(r.x), y: Math.floor(r.y), width: Math.ceil(r.width), height: Math.ceil(r.height) });
        }
      }
      return rects.filter((r) => r.width > 0 && r.height > 0);
    });
    // One screenshot of the first screen with the wave, one without; compare only pixels under text.
    const withWave = PNG.sync.read(await page.screenshot({ scale: "css" }));
    await page.addStyleTag({ content: ".wave, .hero::before { display: none !important; }" });
    const withoutWave = PNG.sync.read(await page.screenshot({ scale: "css" }));
    let worst = 0;
    for (const box of boxes) {
      for (let y = Math.max(0, box.y); y < Math.min(withWave.height, box.y + box.height); y++) {
        for (let x = Math.max(0, box.x); x < Math.min(withWave.width, box.x + box.width); x++) {
          const i = (y * withWave.width + x) * 4;
          for (let c = 0; c < 3; c++) worst = Math.max(worst, Math.abs(withWave.data[i + c] - withoutWave.data[i + c]));
        }
      }
    }
    expect(worst).toBeLessThanOrEqual(limit);
  });
}
