const { readFileSync } = require("node:fs");
const { join } = require("node:path");
const { test, expect } = require("@playwright/test");

const manifest = JSON.parse(readFileSync(join(__dirname, "..", "dist-staging", "staging-manifest.json"), "utf8"));

async function blockHeavyMedia(page) {
  await page.route(/\.(?:mp3|mp4|wav|webm)(?:\?.*)?$/i, (route) => route.fulfill({ status: 204, body: "" }));
}

test("every copied staging route responds with an HTML document", async ({ request }) => {
  for (const route of manifest.copiedRoutes) {
    const response = await request.get(route);
    expect(response.status(), route).toBe(200);
    expect(response.headers()["content-type"], route).toContain("text/html");
    expect(await response.text(), route).toMatch(/<title>[^<]+<\/title>/i);
  }
});

test("preview shell is noindex, visibly marked, and free of broken same-origin requests", async ({ page }) => {
  await blockHeavyMedia(page);
  const failures = [];
  const pageErrors = [];
  const consoleFailures = [];
  page.on("response", (response) => {
    const url = new URL(response.url());
    if (url.origin === "http://127.0.0.1:8143" && response.status() >= 400 && !url.pathname.includes("favicon")) {
      failures.push(`${response.status()} ${url.pathname}`);
    }
  });
  page.on("pageerror", (error) => pageErrors.push(error.message));
  page.on("console", (message) => {
    if (message.type() === "warning" && /GL Driver Message.*GPU stall due to ReadPixels/i.test(message.text())) return;
    if (["error", "warning"].includes(message.type())) consoleFailures.push(`${message.type()}: ${message.text()}`);
  });

  await page.goto("/index.html", { waitUntil: "domcontentloaded" });
  await expect(page.locator("[data-lm-staging-banner]")).toHaveText("LottoMind Upgrade Preview — Not Production");
  await expect(page.locator('meta[name="robots"]')).toHaveAttribute("content", "noindex,nofollow,noarchive");
  await expect(page.locator("#lm-staging-guard-status")).toContainText("Preview safety is active");
  const environment = await page.evaluate(() => window.LottoMindEnvironment);
  expect(environment).toMatchObject({
    name: "staging",
    isProduction: false,
    allowLivePayments: false,
    allowAccountWrites: false,
    allowRedemptions: false,
    allowProductionAnalytics: false,
  });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true);
  await page.waitForTimeout(1000);
  expect(failures).toEqual([]);
  expect(pageErrors).toEqual([]);
  expect(consoleFailures).toEqual([]);
});

test("production writes are rejected while local-only browser state remains available", async ({ page }) => {
  await blockHeavyMedia(page);
  const productionRequests = [];
  page.on("request", (request) => {
    const hostname = new URL(request.url()).hostname;
    if (/supabase\.co$|stripe\.com$|google-analytics\.com$|googletagmanager\.com$/i.test(hostname)) {
      productionRequests.push(request.url());
    }
  });

  await page.goto("/memberships.html", { waitUntil: "domcontentloaded" });
  await page.waitForFunction(() => window.LottoMindStagingGuard?.active && window.LottoMindAccountService);
  const result = await page.evaluate(async () => {
    const capture = async (action) => {
      try {
        await action();
        return { blocked: false };
      } catch (error) {
        return { blocked: Boolean(error.blockedByStagingGuard), code: error.code, message: error.message };
      }
    };
    const payment = await capture(() => fetch("/api/billing/checkout", { method: "POST", body: "{}" }));
    const account = await capture(() => window.LottoMindAccountService.register({ email: "preview@example.invalid", password: "not-a-real-password" }));
    const redemption = await capture(() => window.LottoMindAccountService.redeemCollectible("PREVIEW-NOT-A-REAL-CODE"));
    const analytics = await capture(() => fetch("https://www.google-analytics.com/g/collect", { method: "POST", body: "preview" }));
    const beacon = navigator.sendBeacon("https://www.google-analytics.com/g/collect", "preview");
    localStorage.setItem("lm-staging-local-test", "available");
    const localStorageValue = localStorage.getItem("lm-staging-local-test");
    localStorage.removeItem("lm-staging-local-test");
    return { payment, account, redemption, analytics, beacon, localStorageValue };
  });

  expect(result.payment).toMatchObject({ blocked: true, code: "LM_STAGING_PAYMENT_BLOCKED" });
  expect(result.account).toMatchObject({ blocked: true, code: "LM_STAGING_ACCOUNT_WRITE_BLOCKED" });
  expect(result.redemption).toMatchObject({ blocked: true, code: "LM_STAGING_REDEMPTION_BLOCKED" });
  expect(result.analytics).toMatchObject({ blocked: true, code: "LM_STAGING_ANALYTICS_BLOCKED" });
  expect(result.beacon).toBe(false);
  expect(result.localStorageValue).toBe("available");
  await expect(page.locator("#lm-staging-guard-status")).toContainText("Production analytics are disabled");
  expect(productionRequests).toEqual([]);
});
