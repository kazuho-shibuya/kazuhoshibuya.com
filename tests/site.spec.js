const { test, expect } = require("@playwright/test");
const AxeBuilder = require("@axe-core/playwright").default;
const { PNG } = require("pngjs");

const DESKTOP = { width: 1440, height: 900 };
const TABLET = { width: 820, height: 1180 };
const PHONE = { width: 390, height: 844 };
const EMAIL = "k.shibuya.tech@gmail.com";

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

for (const [name, viewport] of [["desktop", DESKTOP], ["tablet", TABLET], ["phone", PHONE]]) {
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

for (const [name, viewport] of [["phone", PHONE], ["small phone", { width: 360, height: 780 }]]) {
  test(`${name}: the top label with the sail stays on one line`, async ({ page }) => {
    await open(page, viewport);
    const lines = await page.locator(".hero .label").evaluate((el) => Math.round(el.getBoundingClientRect().height / parseFloat(getComputedStyle(el).lineHeight)));
    expect(lines).toBe(1);
  });
}

test("the tab icon and the header mark are the sail", async ({ page }) => {
  await open(page, DESKTOP);
  await expect(page.locator('link[rel="icon"]')).toHaveAttribute("href", /^data:image\/svg\+xml,.*s-jib/);
  await expect(page.locator(".hero .label .mark")).toBeVisible();
});

for (const [name, viewport] of [["desktop", DESKTOP], ["phone", PHONE]]) {
  test(`${name}: the build flow shows four arrows and no step breaks mid-way`, async ({ page }) => {
    await open(page, viewport);
    const arrows = page.locator(".pipeline b");
    await expect(arrows).toHaveCount(4);
    for (const arrow of await arrows.all()) await expect(arrow).toHaveText("→");
    const steps = await page.locator(".pipeline span").evaluateAll((all) =>
      all.map((s) => {
        const range = document.createRange();
        range.selectNodeContents(s.firstChild);
        return range.getClientRects().length;
      }),
    );
    expect(steps.every((lines) => lines === 1), `lines per step: ${steps}`).toBe(true);
  });
}

test("every font file loads", async ({ page }) => {
  await open(page, DESKTOP);
  const loaded = await page.evaluate(() => [...document.fonts].filter((f) => f.status === "loaded").map((f) => f.family.replaceAll('"', "")));
  for (const family of ["Source Serif 4", "Source Sans 3", "Source Code Pro", "Noto Serif JP"]) {
    expect(loaded).toContain(family);
  }
});

test("every mailto link goes to the one address", async ({ page }) => {
  await open(page, DESKTOP);
  for (const link of await page.locator('a[href^="mailto:"]').all()) {
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

// The wave may sit faintly behind text: at most 8% change in any colour channel (20 of 255), on every screen size.
for (const [name, viewport, limit] of [["desktop", DESKTOP, 20], ["tablet", TABLET, 20], ["phone", PHONE, 20], ["small phone", { width: 360, height: 780 }, 20]]) {
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

for (const [name, viewport] of [["desktop", DESKTOP], ["phone", PHONE]]) {
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

test("external links point where they say", async ({ page }) => {
  await open(page, DESKTOP);
  const hrefs = await page.locator('a[href^="http"]').evaluateAll((links) => links.map((a) => a.href));
  expect(hrefs.length).toBeGreaterThan(0);
  for (const href of hrefs) {
    expect(href).toMatch(/^https:\/\/(www\.linkedin\.com\/in\/kazuho-shibuya|github\.com\/kazuho-shibuya)/);
  }
});

test("GitHub links open", async ({ page, request }) => {
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

test("the only scripts are the theme choice, the page script and Cloudflare's visitor count", async ({ page }) => {
  await open(page, DESKTOP);
  // Cloudflare injects its cookie-free Web Analytics beacon into some served pages; the page itself carries two inline scripts.
  const all = await page.locator("script").evaluateAll((els) => els.map((s) => s.src || `inline: ${s.textContent.trim().slice(0, 60)}`));
  const ours = all.filter((s) => !s.startsWith("https://static.cloudflareinsights.com/beacon.min.js"));
  expect(ours, `scripts on the page: ${JSON.stringify(all)}`).toEqual([
    expect.stringMatching(/^inline: try \{ const t = localStorage\.getItem\("theme"\)/),
    expect.stringMatching(/^inline: for \(const link of document\.querySelectorAll\("a\[data-copy\]"/),
  ]);
});

const PAPER = { light: "rgb(248, 245, 238)", dark: "rgb(19, 26, 42)" };
const background = (page) => page.evaluate(() => getComputedStyle(document.body).backgroundColor);

for (const scheme of ["light", "dark"]) {
  test(`with no saved choice, the page follows the system's ${scheme} setting`, async ({ page }) => {
    await open(page, DESKTOP, scheme);
    expect(await background(page)).toBe(PAPER[scheme]);
    const other = scheme === "light" ? "dark" : "light";
    await expect(page.locator("button.theme")).toHaveAttribute("aria-label", `Switch to ${other} mode`);
  });

  test(`from ${scheme}, the switch flips the theme and the choice survives a reload`, async ({ page }) => {
    const other = scheme === "light" ? "dark" : "light";
    await open(page, DESKTOP, scheme);
    await page.locator("button.theme").click();
    expect(await background(page)).toBe(PAPER[other]);
    await expect(page.locator("button.theme")).toHaveAttribute("aria-label", `Switch to ${scheme} mode`);
    await page.reload();
    expect(await background(page)).toBe(PAPER[other]);
  });
}


for (const scheme of ["light", "dark"]) {
  test(`no accessibility violations in ${scheme} mode`, async ({ page }) => {
    await open(page, DESKTOP, scheme);
    await page.locator(".role details").evaluateAll((all) => all.forEach((d) => (d.open = true)));
    const results = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21aa"]).analyze();
    const summary = results.violations.map((v) => `${v.id}: ${v.nodes.length} node(s) — ${v.nodes[0].target.join(" ")}`);
    expect(summary).toEqual([]);
  });
}

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
