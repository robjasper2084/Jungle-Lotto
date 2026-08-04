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

test("home staging restores the muted-first startup commercial", async ({ page }) => {
  const commercialRequests = [];
  page.on("request", (request) => {
    if (/lottomind-membership-unboxing-commercial-20260716\.opt\.mp4/i.test(request.url())) {
      commercialRequests.push(request.url());
    }
  });

  await page.goto("/", { waitUntil: "domcontentloaded" });
  const startup = page.locator("[data-startup-video]");
  await expect(startup).toBeVisible({ timeout: 5_000 });
  await expect(startup.getByRole("button", { name: "Play with sound" })).toBeVisible();
  await expect.poll(() => startup.locator("video").evaluate((video) => ({ muted: video.muted, paused: video.paused }))).toMatchObject({ muted: true });
  await expect.poll(() => commercialRequests.length).toBeGreaterThan(0);
  await startup.getByRole("button", { name: "Enter Site", exact: true }).click();
  await expect(startup).toBeHidden();
  await expect(page.locator(".hero-motion")).toBeVisible();
});

test("membership entry film requests sound and keeps an accessible fallback", async ({ page }) => {
  const filmRequests = [];
  const soundtrackRequests = [];
  page.on("request", (request) => {
    if (/assets\/merch\/.*commercial.*\.mp4/i.test(request.url())) filmRequests.push(request.url());
    if (/home-screen-song\.mp3/i.test(request.url())) soundtrackRequests.push(request.url());
  });

  await page.goto("/memberships.html", { waitUntil: "domcontentloaded" });
  const commercial = page.locator("[data-membership-commercial-modal]");
  await expect(commercial).toBeVisible({ timeout: 15_000 });
  await expect.poll(() => filmRequests.length).toBeGreaterThan(0);
  expect(soundtrackRequests).toEqual([]);
  await expect.poll(() =>
    commercial.locator("video").evaluate((video) => ({ muted: video.muted, paused: video.paused }))
  ).toMatchObject({ paused: false });
  const playbackState = await commercial.locator("video").evaluate((video) => ({ muted: video.muted, paused: video.paused }));
  if (playbackState?.muted) {
    await expect(page.locator("[data-membership-commercial-sound]")).toHaveText("Play with sound");
    await page.locator("[data-membership-commercial-sound]").click();
    await expect.poll(() => commercial.locator("video").evaluate((video) => video.muted)).toBe(false);
  } else {
    await expect(page.locator("[data-membership-commercial-sound]")).toBeHidden();
  }
  await page.locator("[data-membership-commercial-close]").click();
  await expect.poll(() => soundtrackRequests.length).toBeGreaterThan(0);
});

test("guide keeps its single commercial gate and safe sound handoff", async ({ page }) => {
  await page.goto("/how-to-use.html", { waitUntil: "domcontentloaded" });
  const gate = page.locator(".lm-commercial-gate");
  await expect(gate).toBeVisible();
  await expect(gate).toHaveCount(1);
  await expect.poll(() => gate.locator("video").evaluate((video) => video.currentSrc)).toContain("lottomind-guide-commercial-20260717.mp4");
  await expect(gate.locator(".lm-commercial-gate__sound")).toHaveText("Play with sound");
  await expect.poll(() => gate.locator("video").evaluate((video) => ({ muted: video.muted, paused: video.paused }))).toEqual({ muted: true, paused: false });
  const safetyLayout = await page.evaluate(() => {
    const status = document.querySelector("#lm-staging-guard-status").getBoundingClientRect();
    const panel = document.querySelector(".lm-commercial-gate__panel").getBoundingClientRect();
    return { statusBottom: status.bottom, panelTop: panel.top };
  });
  expect(safetyLayout.panelTop).toBeGreaterThanOrEqual(safetyLayout.statusBottom - 1);

  await gate.locator(".lm-commercial-gate__sound").click();
  await expect.poll(() => gate.locator("video").evaluate((video) => video.muted)).toBe(false);
});

test("merch route uses one automatic unboxing commercial with no extra gate", async ({ page }) => {
  const filmRequests = [];
  page.on("request", (request) => {
    if (/lottomind-membership-unboxing-commercial-20260716\.opt\.mp4/i.test(request.url())) {
      filmRequests.push(request.url());
    }
  });

  await page.goto("/merch-store.html", { waitUntil: "domcontentloaded" });
  await expect(page.locator(".lm-commercial-gate")).toHaveCount(0);
  const modal = page.locator("[data-merch-commercial-modal]");
  await expect(modal).toHaveCount(1);
  await expect(modal).toBeVisible();
  await expect.poll(() => filmRequests.length).toBeGreaterThan(0);
  await expect.poll(() => modal.locator("video").evaluate((video) => video.paused)).toBe(false);
  await page.locator("[data-merch-commercial-close]").click();
  await expect(modal).toBeHidden();
});

test("mobile Help actions remain clear of preview safety and fixed controls", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/help.html", { waitUntil: "domcontentloaded" });

  const layout = await page.evaluate(() => {
    const actions = [...document.querySelectorAll(".lm-platform-actions a")];
    const controls = [...document.querySelectorAll(".vault-credit-badge, .universal-menu-toggle")];
    const overlaps = actions.flatMap((action) => {
      const actionBox = action.getBoundingClientRect();
      return controls.map((control) => {
        const controlBox = control.getBoundingClientRect();
        const width = Math.max(0, Math.min(actionBox.right, controlBox.right) - Math.max(actionBox.left, controlBox.left));
        const height = Math.max(0, Math.min(actionBox.bottom, controlBox.bottom) - Math.max(actionBox.top, controlBox.top));
        return width * height;
      });
    });
    return {
      overlaps,
      noindex: document.querySelector('meta[name="robots"]')?.content,
      previewVisible: Boolean(document.querySelector("[data-lm-staging-banner]")),
    };
  });

  expect(layout.overlaps.every((area) => area === 0), JSON.stringify(layout.overlaps)).toBe(true);
  expect(layout.noindex).toBe("noindex,nofollow,noarchive");
  expect(layout.previewVisible).toBe(true);
});

test("Live Events renders a complete channel hub without invented live or commerce data", async ({ page }) => {
  await blockHeavyMedia(page);
  await page.goto("/live-events.html", { waitUntil: "domcontentloaded" });

  await expect(page.getByRole("heading", { name: "Featured Stream Events" })).toBeVisible();
  await expect(page.getByText("Live status and schedules are supplied by Twitch")).toBeVisible();
  await expect(page.getByRole("heading", { name: "Detroit Archive Highlights" })).toBeVisible();
  await expect(page.getByText("No passes on sale")).toBeVisible();
  await expect(page.getByText("Live Now", { exact: true })).toHaveCount(0);
  await expect(page.locator(".watchers")).toHaveCount(0);
  await expect(page.getByText(/\d[\d,.]*\s+online/i)).toHaveCount(0);
  await expect(page.getByText(/\$\d/)).toHaveCount(0);
  await expect(page.getByText("Ultra Points", { exact: true })).toHaveCount(0);
});

test("Shadow Ops defers campaign assets until the run starts", async ({ page }) => {
  const assetRequests = [];
  page.on("request", (request) => {
    if (/shadow-ops-canvas\/assets\//i.test(request.url())) assetRequests.push(request.url());
  });

  await page.goto("/games/shadow-ops-canvas/", { waitUntil: "domcontentloaded" });
  await expect(page.getByRole("heading", { name: "ROBOT RAHBEE" })).toBeVisible();
  await page.waitForTimeout(1000);
  expect(assetRequests.some((url) => /robot-rahbe-intro-cutscene\.mp4/i.test(url))).toBe(false);
  expect(assetRequests.some((url) => /digital-static-10\.mp3/i.test(url))).toBe(false);
  expect(assetRequests.some((url) => /platform_tiles_level[123]_clean|bosses\/(?:canopy|jackpot|midas)/i.test(url))).toBe(false);

  await page.getByRole("button", { name: "Solo Run" }).click();
  await expect.poll(() => assetRequests.some((url) => /robot-rahbe-intro-cutscene\.mp4/i.test(url))).toBe(true);
  await expect.poll(() => assetRequests.some((url) => /digital-static-10\.mp3/i.test(url))).toBe(true);
  await expect.poll(() => assetRequests.some((url) => /platform_tiles_level1_clean/i.test(url))).toBe(true);
  expect(assetRequests.some((url) => /platform_tiles_level[23]_clean|bosses\/(?:jackpot|midas)/i.test(url))).toBe(false);
});

test("News uses its static feed without contacting production Supabase", async ({ page }) => {
  const productionRequests = [];
  const consoleErrors = [];
  page.on("request", (request) => {
    if (/\.supabase\.co\//i.test(request.url())) productionRequests.push(request.url());
  });
  page.on("console", (message) => {
    if (message.type() === "error") consoleErrors.push(message.text());
  });

  await page.goto("/news/", { waitUntil: "domcontentloaded" });
  await expect(page.locator("#root")).toContainText(/LottoMind News Intelligence/i);
  await expect(page.locator(".article-grid .news-card").first()).toBeVisible();
  expect(productionRequests).toEqual([]);
  expect(consoleErrors).toEqual([]);
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
    const passwordReset = await capture(() => window.LottoMindAccountService.requestPasswordReset("preview@example.invalid"));
    const passwordUpdate = await capture(() => window.LottoMindAccountService.completePasswordRecovery("not-a-real-password"));
    const redemption = await capture(() => window.LottoMindAccountService.redeemCollectible("PREVIEW-NOT-A-REAL-CODE"));
    const analytics = await capture(() => fetch("https://www.google-analytics.com/g/collect", { method: "POST", body: "preview" }));
    const beacon = navigator.sendBeacon("https://www.google-analytics.com/g/collect", "preview");
    localStorage.setItem("lm-staging-local-test", "available");
    const localStorageValue = localStorage.getItem("lm-staging-local-test");
    localStorage.removeItem("lm-staging-local-test");
    return { payment, account, passwordReset, passwordUpdate, redemption, analytics, beacon, localStorageValue };
  });

  expect(result.payment).toMatchObject({ blocked: true, code: "LM_STAGING_PAYMENT_BLOCKED" });
  expect(result.account).toMatchObject({ blocked: true, code: "LM_STAGING_ACCOUNT_WRITE_BLOCKED" });
  expect(result.passwordReset).toMatchObject({ blocked: true, code: "LM_STAGING_ACCOUNT_WRITE_BLOCKED" });
  expect(result.passwordUpdate).toMatchObject({ blocked: true, code: "LM_STAGING_ACCOUNT_WRITE_BLOCKED" });
  expect(result.redemption).toMatchObject({ blocked: true, code: "LM_STAGING_REDEMPTION_BLOCKED" });
  expect(result.analytics).toMatchObject({ blocked: true, code: "LM_STAGING_ANALYTICS_BLOCKED" });
  expect(result.beacon).toBe(false);
  expect(result.localStorageValue).toBe("available");
  await expect(page.locator("#lm-staging-guard-status")).toContainText("Production analytics are disabled");
  expect(productionRequests).toEqual([]);
});

test("Collector Access deep link remains reviewable while staging account writes stay blocked", async ({ page }) => {
  await blockHeavyMedia(page);
  await page.goto("/memberships.html?collector=access#lm-access-hero", { waitUntil: "domcontentloaded" });

  const panel = page.locator("[data-collector-panel]");
  await expect(panel).toBeVisible();
  await expect(page.locator("[data-membership-commercial-modal]")).toBeHidden();
  await page.locator("#collectorEmail").fill("preview@example.invalid");
  await page.locator('[data-password-toggle][aria-controls="collectorPassword"]').click();
  await expect(page.locator("#collectorPassword")).toHaveAttribute("type", "text");
  await page.locator("[data-collector-forgot-password]").click();
  await expect(page.locator("[data-collector-message]")).toContainText("Production account services are configured but disabled in this preview");
  await expect(page.locator("#lm-staging-guard-status")).toContainText("Production account changes are disabled");
});
