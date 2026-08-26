import { defineConfig, devices } from "playwright/test";

export default defineConfig({
  testDir: "./tests/browser",
  globalSetup: "./tests/global-setup.js",
  outputDir: "./output/playwright",
  timeout: 30_000,
  workers: 1,
  fullyParallel: false,
  reporter: process.env.CI
    ? [["line"], ["junit", { outputFile: "output/test-results/playwright.xml" }]]
    : "line",
  use: {
    baseURL: "http://127.0.0.1:4178",
    screenshot: "only-on-failure",
    trace: "retain-on-failure"
  },
  projects: [
    {
      name: "desktop-chromium",
      use: { ...devices["Desktop Chrome"], viewport: { width: 1280, height: 720 } }
    },
    {
      name: "mobile-chromium",
      use: { ...devices["Pixel 7"] }
    },
    {
      name: "mobile-galaxy-a16",
      grep: /cross-browser smoke|mobile portrait|mobile landscape|mobile modifier|mobile control positions|selected match stays/,
      use: {
        ...devices["Pixel 7"],
        viewport: { width: 360, height: 780 },
        screen: { width: 360, height: 780 },
        deviceScaleFactor: 3,
        hasTouch: true,
        isMobile: true
      }
    },
    {
      name: "desktop-webkit",
      grep: /cross-browser smoke/,
      use: { ...devices["Desktop Safari"], viewport: { width: 1280, height: 720 } }
    }
  ]
});
