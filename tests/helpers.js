const DESKTOP = { width: 1440, height: 900 };
const TABLET = { width: 820, height: 1180 };
const PHONE = { width: 390, height: 844 };
const SMALL_PHONE = { width: 360, height: 780 };
const EMAIL = "k.shibuya.tech@gmail.com";

// Real screen widths, from the smallest phones still in use to a large desktop.
const WIDTHS = [
  ["iPhone SE (1st gen)", 320],
  ["small Android", 360],
  ["iPhone SE / mini", 375],
  ["iPhone", 390],
  ["large Android", 414],
  ["iPhone Pro Max", 430],
  ["iPad mini", 768],
  ["iPad Air", 820],
  ["iPad Pro / small laptop", 1024],
  ["laptop", 1280],
  ["desktop", 1440],
  ["large desktop", 1920],
].map(([name, width]) => [name, { width, height: 900 }]);

// Opens the page with motion off and collects console errors, failed requests and 4xx/5xx responses.
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

module.exports = { DESKTOP, TABLET, PHONE, SMALL_PHONE, EMAIL, WIDTHS, open };
