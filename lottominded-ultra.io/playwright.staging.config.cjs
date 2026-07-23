const { defineConfig } = require("@playwright/test");
const stagingPort = Number(process.env.LOTTOMIND_STAGING_TEST_PORT || 8143);

module.exports = defineConfig({
  testDir: "./tests",
  testMatch: "staging.spec.cjs",
  timeout: 45_000,
  expect: { timeout: 8_000 },
  outputDir: "test-results/staging-artifacts",
  reporter: "list",
  use: {
    baseURL: `http://127.0.0.1:${stagingPort}`,
    browserName: "chromium",
    viewport: { width: 1280, height: 720 },
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
});
