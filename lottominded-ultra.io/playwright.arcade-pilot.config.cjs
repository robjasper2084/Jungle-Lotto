const { defineConfig } = require("@playwright/test");

module.exports = defineConfig({
  testDir: "./tests",
  testMatch: "site.spec.cjs",
  grep: /focused manifest-driven Arcade pilot/,
  timeout: 30_000,
  expect: { timeout: 8_000 },
  fullyParallel: false,
  workers: 1,
  outputDir: "test-results/arcade-pilot-artifacts",
  reporter: "list",
  use: {
    baseURL: "http://127.0.0.1:8143",
    browserName: "chromium",
    reducedMotion: "reduce",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  projects: [
    {
      name: "arcade-pilot-desktop",
      use: { viewport: { width: 1440, height: 900 } },
    },
    {
      name: "arcade-pilot-mobile",
      use: { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true },
    },
  ],
});
