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
  "signal-media-corrections-assets",
);
const baseUrl = String(process.env.LOTTOMIND_CAPTURE_BASE_URL || "http://127.0.0.1:8143").replace(/\/$/, "");
const routeFilter = new Set(
  String(process.env.LOTTOMIND_CAPTURE_ROUTES || "")
    .split(",")
    .map((name) => name.trim())
    .filter(Boolean),
);

const availableRoutes = [
  { name: "home", path: "/index.html#top" },
  { name: "memberships", path: "/memberships.html#dust", focus: "#dust" },
  {
    name: "membership-commercial",
    path: "/memberships.html",
    focus: ".membership-hero-commercial",
  },
  {
    name: "membership-guardian",
    path: "/memberships.html",
    focus: ".membership-guardian-bottom",
  },
  {
    name: "storefront",
    path: "/merch-store.html",
    focus: ".merch-hero",
    dismiss: ".lm-commercial-gate__skip",
  },
  {
    name: "arcade",
    path: "/features-app.html",
    dismiss: ".lm-commercial-gate__skip",
  },
  {
    name: "rahbe",
    path: "/beat2lotto-plus.html#beat2lotto",
    dismiss: ".lm-commercial-gate__skip",
  },
  { name: "spheres", path: "/lottery-spheres.html#spheres" },
  { name: "live-events", path: "/live-events.html" },
  { name: "news", path: "/news/", focus: ".article-grid .news-card" },
];
const routes = routeFilter.size
  ? availableRoutes.filter((route) => routeFilter.has(route.name))
  : availableRoutes;
if (!routes.length) {
  throw new Error("LOTTOMIND_CAPTURE_ROUTES did not match any configured capture route.");
}
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
        if (url.origin === baseUrl && response.status() >= 400 && !url.pathname.endsWith("favicon.ico")) {
          assetFailures.push(`${response.status()} ${url.pathname}`);
        }
      });

      const response = await page.goto(`${baseUrl}${route.path}`, {
        waitUntil: "domcontentloaded",
      });
      await page.waitForTimeout(1200);

      if (route.dismiss) {
        const dismiss = page.locator(route.dismiss).first();
        if (await dismiss.count() && await dismiss.isVisible()) {
          await dismiss.click();
          await page.waitForTimeout(800);
        }
      }

      if (route.focus) {
        const target = page.locator(route.focus).first();
        await target.waitFor({ state: "visible" });
        await target.evaluate((element) => element.scrollIntoView({ block: "start" }));
        await page.waitForTimeout(350);
      } else {
        await page.evaluate(() => window.scrollTo(0, 0));
      }

      const output = resolve(outputRoot, `${route.name}-${viewport.name}.png`);
      await page.screenshot({ path: output, fullPage: false });
      const horizontalOverflow = await page.evaluate(
        () => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1,
      );
      const animationsRunning = await page.evaluate(
        () => document.getAnimations().filter((animation) => animation.playState === "running").length,
      );

      results.push({
        route: route.path,
        viewport: viewport.name,
        status: response?.status() || 0,
        output,
        noindex: await page.locator('meta[name="robots"]').getAttribute("content"),
        stagingBannerVisible: await page.locator("[data-lm-staging-banner]").isVisible(),
        horizontalOverflow,
        animationsRunning,
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
  result.status !== 200
  || result.noindex !== "noindex,nofollow,noarchive"
  || !result.stagingBannerVisible
  || result.horizontalOverflow
  || result.consoleErrors.length
  || result.pageErrors.length
  || result.assetFailures.length
));

if (failures.length) {
  throw new Error(`Capture verification failed for ${failures.length} route/viewport combinations.`);
}

console.log(`Captured and verified ${results.length} staging screenshots in ${outputRoot}.`);
