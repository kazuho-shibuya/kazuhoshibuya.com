const { test, expect } = require("@playwright/test");
const { PNG } = require("pngjs");
const { DESKTOP, TABLET, PHONE, SMALL_PHONE, WIDTHS, open } = require("./helpers");

// Runs in the page: the text of each element that takes more than one row.
function wrappedText(elements) {
  const rowsOf = (el) => {
    const range = document.createRange();
    range.selectNodeContents(el);
    const pieces = [...range.getClientRects()].filter((r) => r.width > 1 && r.height > 1).sort((a, b) => a.top - b.top);
    let rows = 0;
    let bottom = -Infinity;
    for (const piece of pieces) {
      // Pieces of one row overlap vertically even when their font sizes differ.
      if (piece.top >= bottom - 1) rows += 1;
      bottom = Math.max(bottom, piece.bottom);
    }
    return rows;
  };
  const visible = elements.filter((el) => el.getClientRects().length);
  const wrapped = visible.filter((el) => rowsOf(el) > 1);
  return wrapped.map((el) => el.textContent.trim().replace(/\s+/g, " ").slice(0, 50));
}

for (const [name, viewport] of WIDTHS) {
  test(`${name} (${viewport.width}px): nothing marked data-one-line wraps`, async ({ page }) => {
    await open(page, viewport);
    expect(await page.locator("[data-one-line]").evaluateAll(wrappedText)).toEqual([]);
  });
}

for (const [name, viewport] of WIDTHS) {
  test(`${name} (${viewport.width}px): the page cannot scroll sideways`, async ({ page }) => {
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

test("the tab icon and the header mark are the sail", async ({ page }) => {
  await open(page, DESKTOP);
  await expect(page.locator('link[rel="icon"]')).toHaveAttribute("href", /^data:image\/svg\+xml,.*s-jib/);
  await expect(page.locator(".hero .label .mark")).toBeVisible();
});

test("desktop: every row in How it's built sits on one line", async ({ page }) => {
  await open(page, DESKTOP);
  const rows = page.locator(".decisions dd, .motifs p");
  await expect(rows).toHaveCount(9);
  expect(await rows.evaluateAll(wrappedText)).toEqual([]);
});

test("the footer carries the mark, the name and the source link", async ({ page }) => {
  await open(page, DESKTOP);
  const footer = page.locator("footer.site");
  await expect(footer.locator(".mark")).toBeVisible();
  await expect(footer).toContainText("Kazuho Shibuya · London");
  await expect(footer.locator("a")).toHaveAttribute("href", "https://github.com/kazuho-shibuya/kazuhoshibuya.com");
});

// The largest change in any colour channel between two screenshots, inside one box.
function largestColourChange(a, b, box) {
  let largest = 0;
  for (let y = Math.max(0, box.y); y < Math.min(a.height, box.y + box.height); y++) {
    for (let x = Math.max(0, box.x); x < Math.min(a.width, box.x + box.width); x++) {
      const i = (y * a.width + x) * 4;
      const change = Math.max(...[0, 1, 2].map((c) => Math.abs(a.data[i + c] - b.data[i + c])));
      largest = Math.max(largest, change);
    }
  }
  return largest;
}

test.describe("the wave and the text", () => {
  // The check hides the wave with an injected style, which the live Content Security Policy rightly blocks.
  test.use({ bypassCSP: true });

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
      const worst = Math.max(0, ...boxes.map((box) => largestColourChange(withWave, withoutWave, box)));
      expect(worst).toBeLessThanOrEqual(limit);
    });
  }
});

const SCALE = [14, 18, 24, 32];
// Only these scale with the screen; everything else sits on a step of SCALE.
const FLUID = { ".focus": [24, 32], h1: [46.4, 96] };

// Runs in the page: each rendered text size off the scale, including text drawn by ::before.
function offScaleSizes({ scale, fluid }) {
  const px = (style) => Math.round(parseFloat(style.fontSize) * 10) / 10;
  const allowed = (el, size) => {
    const range = Object.entries(fluid).find(([selector]) => el.closest(selector));
    if (range) return size >= range[1][0] && size <= range[1][1];
    return scale.includes(size);
  };
  const hasText = (el) => [...el.childNodes].some((n) => n.nodeType === Node.TEXT_NODE && n.textContent.trim());
  const hasDrawnText = (el) => /^"[^"]+"$|counter/.test(getComputedStyle(el, "::before").content);
  const rendered = [...document.querySelectorAll("body *")].filter((el) => el.getClientRects().length && !el.closest(".visually-hidden"));
  const off = [];
  for (const el of rendered) {
    const name = `${el.tagName.toLowerCase()}.${el.className}`;
    const size = px(getComputedStyle(el));
    if (hasText(el) && !allowed(el, size)) off.push(`${size}px: ${name} "${el.textContent.trim().slice(0, 30)}"`);
    const drawn = px(getComputedStyle(el, "::before"));
    if (hasDrawnText(el) && !scale.includes(drawn)) off.push(`${drawn}px: ${name}::before`);
  }
  return [...new Set(off)];
}

for (const [name, viewport] of WIDTHS) {
  test(`${name} (${viewport.width}px): every text size is on the type scale`, async ({ page }) => {
    await open(page, viewport);
    expect(await page.evaluate(offScaleSizes, { scale: SCALE, fluid: FLUID })).toEqual([]);
  });
}
