import { execFileSync } from "node:child_process";
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { tmpdir } from "node:os";
import { createRequire } from "node:module";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const require = createRequire(import.meta.url);
const { chromium } = require("playwright");
const packageRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const repositoryRoot = resolve(packageRoot, "..");
const outputRoot = resolve(repositoryRoot, "docs", "staging-reviews", "release-signoff-assets");
const temporaryRoot = resolve(tmpdir(), `lottomind-release-signoff-${Date.now()}`);
const baseUrlArgumentIndex = process.argv.indexOf("--base-url");
const inlineBaseUrlArgument = process.argv.find((argument) => argument.startsWith("--base-url="));
const requestedBaseUrl = baseUrlArgumentIndex >= 0
  ? process.argv[baseUrlArgumentIndex + 1]
  : inlineBaseUrlArgument?.slice("--base-url=".length);
const baseUrl = String(requestedBaseUrl || process.env.LOTTOMIND_STAGING_URL || "http://127.0.0.1:8304").replace(/\/$/, "");
const sourceCommit = execFileSync("git", ["rev-parse", "HEAD"], { cwd: repositoryRoot, encoding: "utf8" }).trim();
const baselineManifest = JSON.parse(await readFile(resolve(repositoryRoot, "docs", "visual-baseline", "v1", "baseline-manifest.json"), "utf8"));

const routes = [
  "/",
  "/features-app.html",
  "/memberships.html",
  "/news/",
  "/live-events.html",
  "/lottery-spheres.html",
  "/beat2lotto-plus.html",
  "/merch-store.html",
  "/how-to-use.html",
  "/privacy.html",
  "/terms.html",
  "/accessibility.html",
  "/prompt-lab.html",
  "/redeem.html",
  "/contact.html",
  "/help.html",
  "/account.html",
  "/404.html",
  "/games/gothtechnology2/",
  "/games/lottomind-jackpot-maze/",
  "/games/lottomind-313-fortune-grid/",
  "/games/lottomind-trivia/",
  "/games/opengw-levels/",
  "/games/shadow-ops-canvas/",
  "/games/raytrace-pong-background/",
  "/lottery-spheres.html#spheres",
  "/lottomind-stem-studio/",
];
const viewports = [
  { name: "desktop", width: 1440, height: 900 },
  { name: "tablet", width: 768, height: 1024, hasTouch: true },
  { name: "mobile", width: 390, height: 844, hasTouch: true, isMobile: true },
];

function slugForRoute(route) {
  if (route === "/") return "home";
  return route.replace(/^\//, "").replace(/\/$/, "-index").replace(/\.html/g, "").replace(/[^a-z0-9]+/gi, "-").replace(/^-|-$/g, "").toLowerCase();
}

async function hasVisibleKeyboardFocus(page) {
  for (let attempt = 0; attempt < 40; attempt += 1) {
    await page.keyboard.press("Tab");
    if (await page.evaluate(() => {
      const node = document.activeElement;
      if (!node || node === document.body || node === document.documentElement) return false;
      const rect = node.getBoundingClientRect();
      if (rect.width <= 0 || rect.height <= 0) return false;
      const style = getComputedStyle(node);
      const outline = style.outlineStyle !== "none" && Number.parseFloat(style.outlineWidth || "0") > 0;
      return node.matches(":focus-visible") && (outline || style.boxShadow !== "none");
    })) return true;
  }
  return false;
}

async function createContactSheet(browser, viewport, entries) {
  const page = await browser.newPage({ viewport: { width: 1600, height: 900 } });
  const cards = (await Promise.all(entries.map(async (entry) => {
    const screenshot = await readFile(entry.temporaryScreenshot);
    return `
    <article>
      <img src="data:image/jpeg;base64,${screenshot.toString("base64")}" alt="">
      <strong>${entry.route}</strong>
      <span>${entry.status} · ${(entry.sameOriginBytes / 1024 / 1024).toFixed(1)} MiB · focus ${entry.visibleKeyboardFocus ? "pass" : "fail"}</span>
    </article>`;
  }))).join("");
  await page.setContent(`<!doctype html><meta charset="utf-8"><style>
    *{box-sizing:border-box}body{margin:0;padding:24px;background:#05080d;color:#eef8ff;font:14px Arial,sans-serif}
    h1{margin:0 0 20px;color:#f2ca52;letter-spacing:0}main{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:14px}
    article{min-width:0;border:1px solid #1bd6ee;background:#071426;padding:7px}img{display:block;width:100%;aspect-ratio:${viewport.width}/${viewport.height};object-fit:cover;object-position:top;background:#000}
    strong,span{display:block;padding-top:6px;overflow-wrap:anywhere}span{color:#8edfec;font-size:12px}
  </style><h1>LottoMind current staging · ${viewport.width}x${viewport.height}</h1><main>${cards}</main>`);
  await page.waitForTimeout(500);
  await page.screenshot({ path: resolve(outputRoot, `${viewport.name}-contact-sheet.png`), fullPage: true });
  await page.close();
}

await Promise.all([mkdir(outputRoot, { recursive: true }), mkdir(temporaryRoot, { recursive: true })]);
const browser = await chromium.launch({ headless: true });
const results = [];

try {
  for (const viewport of viewports) {
    const context = await browser.newContext({
      viewport: { width: viewport.width, height: viewport.height },
      hasTouch: viewport.hasTouch || false,
      isMobile: viewport.isMobile || false,
      reducedMotion: "reduce",
    });
    for (const route of routes) {
      const page = await context.newPage();
      const consoleErrors = [];
      const pageErrors = [];
      const assetFailures = [];
      const externalAssetWarnings = [];
      let sameOriginBytes = 0;
      await page.route(/\.(?:mp3|wav|ogg)(?:\?.*)?$/i, (requestRoute) => requestRoute.fulfill({ status: 204, body: "" }));
      await page.route(/(?:stripe\.com|supabase\.co|google-analytics\.com|googletagmanager\.com)/i, (requestRoute) => requestRoute.abort("blockedbyclient"));
      page.on("console", (message) => {
        if (message.type() !== "error" || /ERR_BLOCKED_BY_CLIENT/i.test(message.text())) return;
        const locationUrl = message.location()?.url || "";
        if (/^https?:\/\//i.test(locationUrl) && new URL(locationUrl).origin !== new URL(baseUrl).origin && /Failed to load resource/i.test(message.text())) {
          externalAssetWarnings.push(`PUBLISHER MEDIA ${locationUrl}`);
          return;
        }
        consoleErrors.push(message.text());
      });
      page.on("pageerror", (error) => pageErrors.push(error.message));
      page.on("response", (response) => {
        const url = new URL(response.url());
        if (url.origin !== new URL(baseUrl).origin) return;
        const length = Number(response.headers()["content-length"] || 0);
        if (Number.isFinite(length)) sameOriginBytes += length;
        if (response.status() >= 400 && !url.pathname.endsWith("favicon.ico")) assetFailures.push(`${response.status()} ${url.pathname}`);
      });
      page.on("requestfailed", (request) => {
        const url = new URL(request.url());
        const reason = request.failure()?.errorText || "";
        if (url.origin === new URL(baseUrl).origin && !/ERR_ABORTED/i.test(reason)) {
          assetFailures.push(`FAILED ${url.pathname}: ${reason || "unknown"}`);
        } else if (url.origin !== new URL(baseUrl).origin && /\.(?:avif|gif|jpe?g|png|webp)(?:$|\?)/i.test(url.pathname + url.search)) {
          externalAssetWarnings.push(`PUBLISHER MEDIA ${url.href}: ${reason || "unavailable"}`);
        }
      });

      const response = await page.goto(`${baseUrl}${route}`, { waitUntil: "domcontentloaded" });
      await page.waitForTimeout(700);
      const title = await page.title();
      const heading = await page.locator("h1, h2, h3, [role=heading]").first().textContent().catch(() => "");
      const screenshotName = `${slugForRoute(route)}--${viewport.name}.jpg`;
      const temporaryScreenshot = resolve(temporaryRoot, screenshotName);
      const result = {
        route,
        viewport: viewport.name,
        dimensions: `${viewport.width}x${viewport.height}`,
        status: response?.status() || 0,
        title: title.trim(),
        firstHeading: String(heading || "").trim().replace(/\s+/g, " ").slice(0, 160),
        horizontalOverflow: await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1),
        visibleKeyboardFocus: await hasVisibleKeyboardFocus(page),
        reducedMotion: await page.evaluate(() => matchMedia("(prefers-reduced-motion: reduce)").matches),
        noindex: await page.evaluate(() => document.querySelector('meta[name="robots"]')?.getAttribute("content") || ""),
        stagingBannerVisible: await page.locator("[data-lm-staging-banner]").isVisible().catch(() => false),
        environment: await page.evaluate(() => ({
          name: window.LottoMindEnvironment?.name,
          allowLivePayments: window.LottoMindEnvironment?.allowLivePayments,
          allowAccountWrites: window.LottoMindEnvironment?.allowAccountWrites,
          allowRedemptions: window.LottoMindEnvironment?.allowRedemptions,
          allowProductionAnalytics: window.LottoMindEnvironment?.allowProductionAnalytics,
        })),
        sameOriginBytes,
        consoleErrors,
        pageErrors,
        assetFailures,
        externalAssetWarnings: [...new Set(externalAssetWarnings)],
        temporaryScreenshot,
      };
      await page.screenshot({ path: temporaryScreenshot, type: "jpeg", quality: 72, fullPage: false });
      results.push(result);
      await page.close();
      console.log(`${viewport.name} ${route} -> ${result.status}`);
    }
    await createContactSheet(browser, viewport, results.filter((entry) => entry.viewport === viewport.name));
    await context.close();
  }
} finally {
  await browser.close();
}

const failures = results.filter((entry) => (
  entry.status !== 200 || !entry.title || !entry.firstHeading || entry.horizontalOverflow || !entry.visibleKeyboardFocus || !entry.reducedMotion ||
  entry.noindex !== "noindex,nofollow,noarchive" || !entry.stagingBannerVisible || entry.environment.name !== "staging" ||
  entry.environment.allowLivePayments !== false || entry.environment.allowAccountWrites !== false || entry.environment.allowRedemptions !== false ||
  entry.environment.allowProductionAnalytics !== false || entry.consoleErrors.length || entry.pageErrors.length || entry.assetFailures.length
));
const report = {
  generatedAt: new Date().toISOString(),
  sourceCommit,
  stagingUrl: baseUrl,
  productionReference: baselineManifest.productionReference,
  routeCount: routes.length,
  viewportCount: viewports.length,
  captureCount: results.length,
  failureCount: failures.length,
  contactSheets: viewports.map((viewport) => `${viewport.name}-contact-sheet.png`),
  results: results.map(({ temporaryScreenshot, ...entry }) => entry),
};
await writeFile(resolve(outputRoot, "release-signoff-manifest.json"), `${JSON.stringify(report, null, 2)}\n`, "utf8");

if (failures.length) {
  console.error(JSON.stringify(failures, null, 2));
  throw new Error(`Release sign-off capture failed for ${failures.length} route/viewport combinations.`);
}
console.log(`Captured ${results.length} verified route states across ${viewports.length} viewports.`);
