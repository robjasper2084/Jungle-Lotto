const { defineConfig } = require("@playwright/test");

const testPort = Number(process.env.LOTTOMIND_TEST_PORT);
if (!Number.isInteger(testPort) || testPort < 1) {
  throw new Error("LOTTOMIND_TEST_PORT is required. Run `npm test` to allocate an isolated test port.");
}
const testRoot = process.env.LOTTOMIND_TEST_ROOT || ".";

module.exports = defineConfig({
  testDir: "./tests",
  testIgnore: "staging.spec.cjs",
  workers: 4,
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
    reuseExistingServer: process.env.LOTTOMIND_REUSE_TEST_SERVER === "1",
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
