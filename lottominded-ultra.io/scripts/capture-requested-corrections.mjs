import { mkdir, writeFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const require = createRequire(import.meta.url);
const { chromium } = require("playwright");

const packageRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const outputRoot = resolve(packageRoot, "docs", "staging-reviews", "requested-corrections", "screenshots");
const baseUrl = "http://127.0.0.1:8143";
const routes = [
  { name: "memberships", path: "/memberships.html", dismiss: "[data-membership-commercial-close]" },
  { name: "static-wav", path: "/how-to-use.html", dismiss: ".lm-commercial-gate__skip" },
  { name: "live-events", path: "/live-events.html" },
  { name: "news", path: "/news/", focus: ".news-card" },
  { name: "lottery-spheres", path: "/lottery-spheres.html#spheres" },
];
const viewports = [
  { name: "1440x900", width: 1440, height: 900 },
  { name: "390x844", width: 390, height: 844, isMobile: true, hasTouch: true },
];

await mkdir(outputRoot, { recursive: true });
const browser = await chromium.launch({ headless: true });
const results = [];

try {
  for (const viewport of viewports) {
    const context = await browser.newContext({
      viewport: { width: viewport.width, height: viewport.height },
      isMobile: viewport.isMobile || false,
      hasTouch: viewport.hasTouch || false,
      reducedMotion: "reduce",
    });

    for (const route of routes) {
      const page = await context.newPage();
      const consoleErrors = [];
      const pageErrors = [];
      const assetFailures = [];
      page.on("console", (message) => {
        if (message.type() === "error") consoleErrors.push(message.text());
      });
      page.on("pageerror", (error) => pageErrors.push(error.message));
      page.on("response", (response) => {
        const url = new URL(response.url());
        if (url.origin === baseUrl && response.status() >= 400 && !url.pathname.endsWith("favicon.ico")) {
          assetFailures.push(`${response.status()} ${url.pathname}`);
        }
      });

      const response = await page.goto(`${baseUrl}${route.path}`, { waitUntil: "domcontentloaded" });
      if (route.dismiss) {
        await page.waitForTimeout(1000);
        const dismiss = page.locator(route.dismiss);
        if (await dismiss.count() > 0 && await dismiss.first().isVisible()) {
          await dismiss.first().click();
          await page.waitForTimeout(1250);
        }
      }
      if (route.focus) {
        await page.locator(route.focus).first().evaluate((element) => element.scrollIntoView({ block: "start" }));
        await page.waitForTimeout(250);
      } else {
        await page.evaluate(() => window.scrollTo(0, 0));
      }
      const output = resolve(outputRoot, `${route.name}-${viewport.name}.png`);
      await page.screenshot({ path: output, fullPage: false });
      results.push({
        route: route.path,
        viewport: viewport.name,
        status: response?.status() || 0,
        output,
        noindex: await page.locator('meta[name="robots"]').getAttribute("content"),
        stagingBannerVisible: await page.locator("[data-lm-staging-banner]").isVisible(),
        consoleErrors,
        pageErrors,
        assetFailures,
      });
      await page.close();
    }
    await context.close();
  }
} finally {
  await browser.close();
}

await writeFile(
  resolve(outputRoot, "capture-report.json"),
  `${JSON.stringify({ capturedAt: new Date().toISOString(), results }, null, 2)}\n`,
  "utf8",
);

const failures = results.filter((result) => (
  result.status !== 200 ||
  result.noindex !== "noindex,nofollow,noarchive" ||
  !result.stagingBannerVisible ||
  result.consoleErrors.length ||
  result.pageErrors.length ||
  result.assetFailures.length
));
if (failures.length) {
  throw new Error(`Capture verification failed for ${failures.length} route/viewport combinations.`);
}
console.log(`Captured and verified ${results.length} staging screenshots in ${outputRoot}.`);
