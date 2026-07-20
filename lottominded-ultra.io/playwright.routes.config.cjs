const { defineConfig } = require("@playwright/test");

module.exports = defineConfig({
  testDir: "./tests",
  testMatch: "route-smoke.spec.cjs",
  timeout: 45_000,
  expect: { timeout: 8_000 },
  fullyParallel: false,
  workers: 1,
  outputDir: "test-results/route-smoke-artifacts",
  reporter: "list",
  use: {
    browserName: "chromium",
    reducedMotion: "reduce",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  projects: [
    {
      name: "source-desktop",
      metadata: { environment: "source", viewportName: "desktop" },
      use: { baseURL: "http://127.0.0.1:8142", viewport: { width: 1440, height: 900 } },
    },
    {
      name: "source-mobile",
      metadata: { environment: "source", viewportName: "mobile" },
      use: { baseURL: "http://127.0.0.1:8142", viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true },
    },
    {
      name: "staging-desktop",
      metadata: { environment: "staging", viewportName: "desktop" },
      use: { baseURL: "http://127.0.0.1:8143", viewport: { width: 1440, height: 900 } },
    },
    {
      name: "staging-mobile",
      metadata: { environment: "staging", viewportName: "mobile" },
      use: { baseURL: "http://127.0.0.1:8143", viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true },
    },
  ],
});
