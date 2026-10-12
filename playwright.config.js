const { defineConfig } = require("@playwright/test");

// LIVE=1 runs the same checks against the deployed site instead of a local server.
const live = !!process.env.LIVE;

module.exports = defineConfig({
  testDir: "tests",
  timeout: 20_000,
  fullyParallel: true,
  reporter: "line",
  snapshotPathTemplate: "tests/screenshots/{arg}{ext}",
  use: {
    baseURL: live ? "https://kazuhoshibuya.com" : "http://127.0.0.1:4173",
  },
  projects: [
    { name: "chrome", use: { channel: "chrome" } },
    { name: "safari", use: { browserName: "webkit" } },
  ],
  webServer: live
    ? undefined
    : {
        command: "python3 -m http.server 4173 --bind 127.0.0.1 --directory public",
        url: "http://127.0.0.1:4173",
        reuseExistingServer: !process.env.CI,
      },
});
