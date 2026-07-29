import { mkdir, writeFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const require = createRequire(import.meta.url);
const { chromium } = require("playwright");

const packageRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const repositoryRoot = resolve(packageRoot, "..");
const outputRoot = resolve(
  repositoryRoot,
  "docs",
  "staging-reviews",
  "phase-1-platform-assets",
);
const baseUrl = String(
  process.env.LOTTOMIND_CAPTURE_BASE_URL || "http://127.0.0.1:8294",
).replace(/\/$/, "");
const routes = [
  { name: "home", path: "/index.html#top" },
  { name: "app", path: "/features.html" },
  {
    name: "arcade",
    path: "/arcade.html",
    dismiss: ".lm-commercial-gate__skip",
  },
  { name: "studio", path: "/studio.html" },
  {
    name: "help",
    path: "/how-to-use.html",
    dismiss: ".lm-commercial-gate__skip",
  },
  { name: "account", path: "/account.html" },
  {
    name: "memberships",
    path: "/memberships.html",
    dismiss: "[data-membership-commercial-close]",
  },
];
const viewports = [
  { name: "1440x900", width: 1440, height: 900 },
  { name: "768x1024", width: 768, height: 1024 },
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
        if (
          url.origin === baseUrl &&
          response.status() >= 400 &&
          !url.pathname.endsWith("favicon.ico")
        ) {
          assetFailures.push(`${response.status()} ${url.pathname}`);
        }
      });

      const response = await page.goto(`${baseUrl}${route.path}`, {
        waitUntil: "domcontentloaded",
      });
      await page.waitForTimeout(900);
      if (route.dismiss) {
        const dismiss = page.locator(route.dismiss).first();
        if (await dismiss.isVisible().catch(() => false)) {
          await dismiss.click();
          await page.waitForTimeout(1_200);
        }
      }
      await page.evaluate(() => window.scrollTo(0, 0));

      const layout = await page.evaluate(() => ({
        scrollWidth: document.documentElement.scrollWidth,
        innerWidth: window.innerWidth,
      }));
      const output = resolve(outputRoot, `${route.name}-${viewport.name}.png`);
      await page.screenshot({ path: output, fullPage: false });
      results.push({
        route: route.path,
        viewport: viewport.name,
        status: response?.status() || 0,
        output,
        noindex: await page.locator('meta[name="robots"]').getAttribute("content"),
        stagingBannerVisible: await page
          .locator("[data-lm-staging-banner]")
          .isVisible(),
        horizontalOverflow: layout.scrollWidth > layout.innerWidth + 1,
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
  `${JSON.stringify({ capturedAt: new Date().toISOString(), sourceCommit: process.env.LOTTOMIND_SOURCE_COMMIT || "", results }, null, 2)}\n`,
  "utf8",
);

const failures = results.filter(
  (result) =>
    result.status !== 200 ||
    result.noindex !== "noindex,nofollow,noarchive" ||
    !result.stagingBannerVisible ||
    result.horizontalOverflow ||
    result.consoleErrors.length ||
    result.pageErrors.length ||
    result.assetFailures.length,
);
if (failures.length) {
  throw new Error(
    `Phase 1 capture verification failed for ${failures.length} route/viewport combinations.`,
  );
}
console.log(
  `Captured and verified ${results.length} Phase 1 staging screenshots in ${outputRoot}.`,
);
