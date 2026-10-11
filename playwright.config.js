const { defineConfig } = require("@playwright/test");

module.exports = defineConfig({
  testDir: "tests",
  timeout: 20_000,
  fullyParallel: true,
  reporter: "line",
  snapshotPathTemplate: "tests/screenshots/{arg}{ext}",
  use: {
    baseURL: "http://127.0.0.1:4173",
    channel: "chrome",
  },
  webServer: {
    command: "python3 -m http.server 4173 --bind 127.0.0.1 --directory public",
    url: "http://127.0.0.1:4173",
    reuseExistingServer: !process.env.CI,
  },
});
