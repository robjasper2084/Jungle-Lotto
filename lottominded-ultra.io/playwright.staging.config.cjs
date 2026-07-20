const { defineConfig } = require("@playwright/test");

module.exports = defineConfig({
  testDir: "./tests",
  testMatch: "staging.spec.cjs",
  timeout: 45_000,
  expect: { timeout: 8_000 },
  outputDir: "test-results/staging-artifacts",
  reporter: "list",
  use: {
    baseURL: "http://127.0.0.1:8143",
    browserName: "chromium",
    viewport: { width: 1280, height: 720 },
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
});
