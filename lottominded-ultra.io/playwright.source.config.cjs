const { defineConfig } = require("@playwright/test");

const testPort = Number(process.env.LOTTOMIND_TEST_PORT || 8142);

module.exports = defineConfig({
  testDir: "./tests",
  testIgnore: "staging.spec.cjs",
  workers: 4,
  timeout: 30_000,
  expect: { timeout: 8_000 },
  outputDir: "test-results/source-artifacts",
  reporter: [
    ["list"],
    ["junit", { outputFile: "test-results/source-results.xml" }],
  ],
  use: {
    baseURL: `http://127.0.0.1:${testPort}`,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  projects: [
    {
      name: "desktop-chromium",
      use: { browserName: "chromium", viewport: { width: 1280, height: 720 } },
    },
    {
      name: "mobile-chromium",
      use: {
        browserName: "chromium",
        viewport: { width: 537, height: 924 },
        hasTouch: true,
        isMobile: true,
      },
    },
  ],
});
