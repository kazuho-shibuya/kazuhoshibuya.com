// Render public/og.png, the 1200x630 link-preview image, from the built page's header.
const { chromium } = require("@playwright/test");
const path = require("path");

const ROOT = path.join(__dirname, "..");
const SIZE = { width: 1200, height: 630 };

async function main() {
  if (process.env.CI) {
    console.log("skipped: CI checks the committed public/og.png");
    return;
  }
  const browser = await chromium.launch({ channel: "chrome" });
  const page = await browser.newPage({ viewport: SIZE, reducedMotion: "reduce", colorScheme: "light" });
  await page.goto(`file://${path.join(ROOT, "public/index.html")}`);
  await page.evaluate(() => document.fonts.ready);
  // Links cannot be clicked in an image, and the small facts row is unreadable at preview size.
  const hide = ".theme, .links.contact, .facts, main, footer.site { display: none !important; }";
  const centre = ".hero { min-height: 630px; padding: 0 !important; display: flex; flex-direction: column; justify-content: center; }";
  await page.addStyleTag({ content: `${hide} ${centre}` });
  await page.screenshot({ path: path.join(ROOT, "public/og.png"), clip: { x: 0, y: 0, ...SIZE } });
  await browser.close();
  console.log("rendered public/og.png");
}

main();
