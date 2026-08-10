const { defineConfig } = require("@playwright/test");
const testPort = Number(process.env.LOTTOMIND_ARCADE_TEST_PORT || 8644);

module.exports = defineConfig({
  testDir: "./tests",
  testMatch: "site.spec.cjs",
  grep: /features combines the cinematic shell with the manifest-driven Arcade directory/,
  timeout: 30_000,
  expect: { timeout: 8_000 },
  fullyParallel: false,
  workers: 1,
  outputDir: "test-results/arcade-pilot-artifacts",
  reporter: "list",
  use: {
    baseURL: `http://127.0.0.1:${testPort}`,
    browserName: "chromium",
    reducedMotion: "reduce",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  webServer: {
    command: `node scripts/serve-site.mjs . ${testPort}`,
    url: `http://127.0.0.1:${testPort}/features-app.html`,
    reuseExistingServer: false,
    timeout: 30_000,
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
