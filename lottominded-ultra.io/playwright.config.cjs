const { defineConfig } = require("@playwright/test");

const testPort = Number(process.env.LOTTOMIND_TEST_PORT || 8142);
const testRoot = process.env.LOTTOMIND_TEST_ROOT || ".";

module.exports = defineConfig({
  testDir: "./tests",
  timeout: 30_000,
  expect: { timeout: 8_000 },
  outputDir: "test-results/artifacts",
  reporter: [
    ["list"],
    ["junit", { outputFile: "test-results/playwright/results.xml" }],
    ["html", { outputFolder: "playwright-report", open: "never" }]
  ],
  use: {
    baseURL: `http://127.0.0.1:${testPort}`,
    trace: "retain-on-failure",
    screenshot: "only-on-failure"
  },
  webServer: {
    command: `node scripts/serve-site.mjs "${testRoot}" ${testPort}`,
    url: `http://127.0.0.1:${testPort}/index.html`,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000
  },
  projects: [
    {
      name: "desktop-chromium",
      use: { browserName: "chromium", viewport: { width: 1280, height: 720 } }
    },
    {
      name: "mobile-chromium",
      use: {
        browserName: "chromium",
        viewport: { width: 537, height: 924 },
        hasTouch: true,
        isMobile: true
      }
    }
  ]
});
