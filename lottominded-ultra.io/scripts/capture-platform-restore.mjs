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
  "platform-route-restore-assets",
);
const baseUrl = String(
  process.env.LOTTOMIND_CAPTURE_BASE_URL || "http://127.0.0.1:8299",
).replace(/\/$/, "");
const expectedNoindex = process.env.LOTTOMIND_CAPTURE_EXPECT_NOINDEX === "1";

const routes = [
  { name: "app", path: "/features.html" },
  { name: "arcade", path: "/arcade.html", dismiss: ".lm-commercial-gate__skip" },
  { name: "news", path: "/news/" },
  { name: "account", path: "/account.html" },
  { name: "rahbe", path: "/beat2lotto-plus.html#beat2lotto" },
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
          url.origin === baseUrl
          && response.status() >= 400
          && !url.pathname.endsWith("favicon.ico")
        ) {
          assetFailures.push(`${response.status()} ${url.pathname}`);
        }
      });

      const response = await page.goto(`${baseUrl}${route.path}`, {
        waitUntil: "domcontentloaded",
      });
      await page.waitForTimeout(1_200);
      if (route.dismiss) {
        const dismiss = page.locator(route.dismiss).first();
        if (await dismiss.isVisible().catch(() => false)) {
          await dismiss.click({ force: true });
          await page.waitForTimeout(800);
        }
      }
      await page.evaluate(() => window.scrollTo(0, 0));

      const output = resolve(outputRoot, `${route.name}-${viewport.name}.png`);
      await page.screenshot({ path: output, fullPage: false });

      const robotsMeta = page.locator('meta[name="robots"]');
      results.push({
        route: route.path,
        viewport: viewport.name,
        status: response?.status() || 0,
        output,
        noindex: await robotsMeta.count() ? await robotsMeta.getAttribute("content") : null,
        stagingBannerVisible: await page.locator("[data-lm-staging-banner]").isVisible(),
        horizontalOverflow: await page.evaluate(
          () => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1,
        ),
        studioLauncherVisible: await page.locator(".site-header .direct-launch").isVisible(),
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
  `${JSON.stringify({ capturedAt: new Date().toISOString(), baseUrl, results }, null, 2)}\n`,
  "utf8",
);

const failures = results.filter((result) => (
  result.status !== 200
  || result.horizontalOverflow
  || result.studioLauncherVisible
  || result.consoleErrors.length
  || result.pageErrors.length
  || result.assetFailures.length
  || (
    expectedNoindex
    && (
      result.noindex !== "noindex,nofollow,noarchive"
      || !result.stagingBannerVisible
    )
  )
));

if (failures.length) {
  throw new Error(`Platform capture verification failed: ${JSON.stringify(failures, null, 2)}`);
}

console.log(`Captured and verified ${results.length} platform screenshots in ${outputRoot}.`);
