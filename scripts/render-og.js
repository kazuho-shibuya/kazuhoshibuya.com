// Render public/og.png, the 1200x630 link-preview image, from the built page's header.
const { chromium } = require("@playwright/test");
const path = require("path");

const ROOT = path.join(__dirname, "..");
const OUTPUT = path.join(ROOT, "public/og.png");
const SIZE = { width: 1200, height: 630 };
const FONTS = ["Source Serif 4", "Source Sans 3", "Source Code Pro", "Noto Serif JP"];
// Hide what an image cannot use, and draw the header 1.45x so LinkedIn's 480px copy stays legible.
const PREVIEW_STYLE = [
  ".theme, .links.contact, .facts, main, footer.site { display: none !important; }",
  ".hero > *:not(.wave) { zoom: 1.45; }",
  ".hero { min-height: 630px; padding: 0 !important; display: flex; flex-direction: column; justify-content: center; }",
].join("\n");

// Runs in the page: why the header cannot be used as the preview, if anything.
function findProblems({ fonts, height }) {
  const loadedFaces = [...document.fonts].filter((face) => face.status === "loaded");
  const loadedFamilies = loadedFaces.map((face) => face.family.replaceAll('"', ""));
  const missing = fonts.filter((family) => !loadedFamilies.includes(family));
  const problems = missing.map((family) => `font not loaded: ${family}`);
  const heroHeight = document.querySelector(".hero").scrollHeight;
  if (heroHeight > height) problems.push(`header is ${heroHeight}px tall, more than ${height}px`);
  return problems;
}

// Turns the open page into the preview, and throws if a font did not load or the header does not fit.
async function showPreview(page) {
  await page.evaluate(() => document.fonts.ready);
  await page.addStyleTag({ content: PREVIEW_STYLE });
  const problems = await page.evaluate(findProblems, { fonts: FONTS, height: SIZE.height });
  if (problems.length) throw new Error(problems.join("; "));
}

async function main() {
  if (process.env.CI) {
    console.log("skipped: CI uses the committed public/og.png");
    return;
  }
  const browser = await chromium.launch({ channel: "chrome" });
  try {
    const page = await browser.newPage({ viewport: SIZE, reducedMotion: "reduce", colorScheme: "light" });
    await page.goto(`file://${path.join(ROOT, "public/index.html")}`);
    await showPreview(page);
    await page.screenshot({ path: OUTPUT, clip: { x: 0, y: 0, ...SIZE } });
  } finally {
    await browser.close();
  }
  console.log("rendered public/og.png");
}

if (require.main === module) {
  main().catch((error) => {
    console.error(`render-og failed: ${error.message}`);
    process.exit(1);
  });
}

module.exports = { SIZE, showPreview };
