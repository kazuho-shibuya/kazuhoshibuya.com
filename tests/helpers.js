const DESKTOP = { width: 1440, height: 900 };
const TABLET = { width: 820, height: 1180 };
const PHONE = { width: 390, height: 844 };
const SMALL_PHONE = { width: 360, height: 780 };
const EMAIL = "k.shibuya.tech@gmail.com";

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

module.exports = { DESKTOP, TABLET, PHONE, SMALL_PHONE, EMAIL, open };
