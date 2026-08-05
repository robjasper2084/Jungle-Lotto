const { readFileSync } = require("node:fs");
const { join } = require("node:path");
const { runInNewContext } = require("node:vm");
const { test, expect } = require("@playwright/test");

const packageRoot = join(__dirname, "..");
const productionBasePath = "/Jungle-Lotto/lottominded-ultra.io/";
const sitemap = readFileSync(join(packageRoot, "sitemap.xml"), "utf8");
const sandbox = {};
sandbox.window = sandbox;
runInNewContext(readFileSync(join(packageRoot, "assets", "js", "arcade-games.js"), "utf8"), sandbox);
const knownFailures = JSON.parse(readFileSync(join(__dirname, "known-route-failures.json"), "utf8"));

function normalizeRoute(value) {
  const route = String(value || "").replace(/^\.\//, "/");
  return !route || route === "/" ? "/" : route.startsWith("/") ? route : `/${route}`;
}

const sitemapRoutes = [...sitemap.matchAll(/<loc>([^<]+)<\/loc>/gi)].map((match) => {
  const url = new URL(match[1]);
  return normalizeRoute(url.pathname.startsWith(productionBasePath) ? url.pathname.slice(productionBasePath.length) : url.pathname);
});
const routes = [...new Set([
  ...sitemapRoutes,
  "/prompt-lab.html",
  "/lottomind-stem-studio/",
  "/redeem.html",
  "/contact.html",
  "/account.html",
  "/404.html",
  ...(sandbox.LottoMindArcadeGames || []).map((game) => normalizeRoute(game.path)),
])];

function failureKey(testInfo, route) {
  const { environment, viewportName } = testInfo.project.metadata;
  return `${environment}|${viewportName}|${route}`;
}

async function visibleKeyboardFocus(page) {
  for (let attempt = 0; attempt < 40; attempt += 1) {
    await page.keyboard.press("Tab");
    const result = await page.evaluate(() => {
      const node = document.activeElement;
      if (!node || node === document.body || node === document.documentElement) return false;
      const rect = node.getBoundingClientRect();
      if (rect.width <= 0 || rect.height <= 0) return false;
      const style = getComputedStyle(node);
      const outlineVisible = style.outlineStyle !== "none" && parseFloat(style.outlineWidth || "0") > 0;
      const shadowVisible = style.boxShadow && style.boxShadow !== "none";
      return node.matches(":focus-visible") && (outlineVisible || shadowVisible);
    });
    if (result) return true;
  }
  return false;
}

for (const route of routes) {
  test(`${route} meets the route smoke contract`, async ({ page }, testInfo) => {
    const environment = testInfo.project.metadata.environment;
    const origin = new URL(String(testInfo.project.use.baseURL)).origin;
    const consoleErrors = [];
    const pageErrors = [];
    const assetFailures = [];

    await page.route(/\.(?:mp3|wav|ogg)(?:\?.*)?$/i, (requestRoute) => requestRoute.fulfill({ status: 204, body: "" }));
    await page.route(/(?:stripe\.com|supabase\.co|google-analytics\.com|googletagmanager\.com)/i, (requestRoute) => requestRoute.abort("blockedbyclient"));
    page.on("console", (message) => {
      if (message.type() === "error" && !/ERR_BLOCKED_BY_CLIENT/i.test(message.text())) {
        const location = message.location();
        if (location.url) {
          try {
            if (new URL(location.url).origin !== origin) return;
          } catch {}
        }
        consoleErrors.push(location.url ? `${message.text()} (${location.url})` : message.text());
      }
    });
    page.on("pageerror", (error) => pageErrors.push(error.message));
    page.on("response", (response) => {
      const url = new URL(response.url());
      if (url.origin === origin && response.status() >= 400 && !url.pathname.endsWith("favicon.ico")) {
        assetFailures.push(`${response.status()} ${url.pathname}`);
      }
    });
    page.on("requestfailed", (request) => {
      const url = new URL(request.url());
      const reason = request.failure()?.errorText || "";
      if (url.origin === origin && !/ERR_ABORTED/i.test(reason)) assetFailures.push(`FAILED ${url.pathname}: ${reason || "unknown"}`);
    });

    const response = await page.goto(route, { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(700);
    const issues = [];
    const title = await page.title();
    if (!title.trim()) issues.push("empty-title");
    if (!response || response.status() >= 400) issues.push("route-load");
    if (pageErrors.length) issues.push("page-errors");
    if (consoleErrors.length) issues.push("console-errors");
    if (assetFailures.length) issues.push("asset-failures");
    if (await page.locator("h1, h2, h3, h4, h5, h6, [role=heading]").count() === 0) issues.push("missing-heading");
    if (!await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth + 1)) issues.push("horizontal-overflow");
    if (!await visibleKeyboardFocus(page)) issues.push("focus-not-visible");

    if (environment === "staging") {
      const robots = await page.locator('meta[name="robots"]').getAttribute("content");
      if (robots !== "noindex,nofollow,noarchive") issues.push("staging-noindex");
      const guard = await page.evaluate(() => ({
        environment: window.LottoMindEnvironment?.name,
        payments: window.LottoMindEnvironment?.allowLivePayments,
        accountWrites: window.LottoMindEnvironment?.allowAccountWrites,
        redemptions: window.LottoMindEnvironment?.allowRedemptions,
        analytics: window.LottoMindEnvironment?.allowProductionAnalytics,
      }));
      if (guard.environment !== "staging" || guard.payments !== false || guard.accountWrites !== false || guard.redemptions !== false || guard.analytics !== false) {
        issues.push("staging-guard");
      }
    }

    const key = failureKey(testInfo, route);
    const expected = knownFailures[key] || [];
    const unexpected = [...new Set(issues)].filter((issue) => !expected.includes(issue));
    const resolved = expected.filter((issue) => !issues.includes(issue));
    if (issues.length) {
      console.log(JSON.stringify({ key, issues: [...new Set(issues)], consoleErrors, pageErrors, assetFailures }));
    }
    expect(unexpected, `Unexpected route failures for ${key}`).toEqual([]);
    expect(resolved, `Remove resolved entries from tests/known-route-failures.json for ${key}`).toEqual([]);
  });
}
