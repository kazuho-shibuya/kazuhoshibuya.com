const { defineConfig } = require("@playwright/test");

// LIVE=1 runs the same checks against the deployed site instead of a local server.
const live = !!process.env.LIVE;

module.exports = defineConfig({
  testDir: "tests",
  timeout: 20_000,
  fullyParallel: true,
  // This Mac is often busy; two at a time keeps the browsers from timing out. CI runs at full width.
  workers: process.env.CI ? undefined : 2,
  reporter: "line",
  snapshotPathTemplate: "tests/screenshots/{arg}{ext}",
  expect: { toHaveScreenshot: { timeout: 20_000 } },
  use: {
    baseURL: live ? "https://kazuhoshibuya.com" : "http://127.0.0.1:4173",
  },
  projects: [
    { name: "chrome", use: { channel: "chrome" } },
    { name: "safari", use: { browserName: "webkit" } },
    { name: "firefox", use: { browserName: "firefox" } },
  ],
  webServer: live
    ? undefined
    : {
        command: "python3 -m http.server 4173 --bind 127.0.0.1 --directory public",
        url: "http://127.0.0.1:4173",
        reuseExistingServer: !process.env.CI,
      },
});
