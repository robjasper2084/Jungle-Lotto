const { test, expect } = require("@playwright/test");
const fs = require("node:fs");
const path = require("node:path");

async function blockHeavyMedia(page) {
  await page.route(/\.(?:mp3|mp4|wav|webm)(?:\?.*)?$/i, (route) => route.fulfill({ status: 204, body: "" }));
}

function trackLocalFailures(page) {
  const failures = [];
  page.on("response", (response) => {
    const url = new URL(response.url());
    if (url.origin !== "http://127.0.0.1:8142") return;
    if (url.pathname.includes("favicon")) return;
    if (response.status() >= 400) failures.push(`${response.status()} ${url.pathname}`);
  });
  return failures;
}

async function mockAuthenticatedBilling(page, checkoutResponse) {
  await page.addInitScript(() => {
    localStorage.setItem("lottomind.account.session.v1", JSON.stringify({
      access_token: "test-access-token",
      expires_at: Math.floor(Date.now() / 1000) + 3600,
    }));
  });
  await page.route(/https:\/\/sqdasdbvlkgpbbiyeune\.supabase\.co\/functions\/v1\/lottomind-api.*/i, (route) => {
    const request = route.request();
    const pathname = new URL(request.url()).pathname;
    const headers = {
      "Access-Control-Allow-Origin": request.headers().origin || "http://127.0.0.1:8142",
      "Access-Control-Allow-Credentials": "true",
      "Access-Control-Allow-Headers": "authorization, content-type, x-client-info, x-requested-with",
      "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    };
    if (request.method() === "OPTIONS") return route.fulfill({ status: 204, headers });
    if (pathname.endsWith("/billing/config")) {
      return route.fulfill({
        status: 200,
        contentType: "application/json",
        headers,
        body: JSON.stringify({
          enabled: true,
          mode: "test",
          message: "Secure Stripe checkout is ready.",
          plans: [{ lookupKey: "gold_monthly", available: true }],
        }),
      });
    }
    if (pathname.endsWith("/account/snapshot")) {
      return route.fulfill({
        status: 200,
        contentType: "application/json",
        headers,
        body: JSON.stringify({ authenticated: true, user: { id: "test-user" }, wallet: { balance: 0 }, memberships: [], collector: {} }),
      });
    }
    if (pathname.endsWith("/entitlements/beat2lotto")) {
      return route.fulfill({ status: 200, contentType: "application/json", headers, body: '{"entitled":false,"tier":"free"}' });
    }
    if (pathname.endsWith("/billing/checkout")) {
      return route.fulfill({ contentType: "application/json", headers, ...checkoutResponse });
    }
    return route.fulfill({ status: 404, contentType: "application/json", headers, body: '{"error":{"message":"Unexpected test route"}}' });
  });
}

test("memberships opens its entry commercial and keeps manual replay available", async ({ page }) => {
  await blockHeavyMedia(page);
  await page.route(/https:\/\/js\.stripe\.com\/.*/i, (route) => route.abort());
  await page.route(/https:\/\/sqdasdbvlkgpbbiyeune\.supabase\.co\/functions\/v1\/lottomind-api.*/i, (route) =>
    route.fulfill({ status: 503, contentType: "application/json", body: '{"error":{"message":"Test billing endpoint offline"}}' })
  );
  const localFailures = trackLocalFailures(page);
  const apiRequests = [];
  page.on("request", (request) => {
    const url = new URL(request.url());
    if (url.origin === "http://127.0.0.1:8142" && url.pathname.includes("/api/")) apiRequests.push(url.pathname);
  });

  await page.goto("/memberships.html", { waitUntil: "domcontentloaded" });
  await page.waitForLoadState("networkidle").catch(() => {});

  const commercial = page.locator("[data-membership-commercial-modal]");
  await expect(commercial).toBeVisible({ timeout: 15_000 });
  await expect(commercial.locator("video")).toHaveAttribute("data-src", /membership-hoodie-commercial/);
  await page.locator("[data-membership-commercial-close]").click();
  await expect(commercial).toBeHidden();
  await expect(page.locator(".lm-temporal-loader")).toHaveCount(0);
  const commercialOpener = page.locator("[data-membership-commercial-open]").last();
  await commercialOpener.scrollIntoViewIfNeeded();
  await expect(commercialOpener).toBeVisible();
  await commercialOpener.click();
  await expect(commercial).toBeVisible();
  await page.locator("[data-membership-commercial-close]").click();
  await expect(commercial).toBeHidden();
  await expect(page.locator("[data-stripe-lookup-key]").first()).toBeDisabled();
  await expect(page.locator("[data-stripe-membership-status]")).toContainText("Test billing endpoint offline");
  expect(apiRequests).toEqual([]);
  expect(localFailures).toEqual([]);
});

test("Static Wav and RAHBE keep an explicit header hide and restore control", async ({ page }) => {
  await blockHeavyMedia(page);

  for (const route of ["/how-to-use.html", "/beat2lotto-plus.html#beat2lotto"]) {
    await page.goto(route, { waitUntil: "domcontentloaded" });
    const commercialGate = page.locator(".lm-commercial-gate");
    if (await commercialGate.isVisible().catch(() => false)) {
      await commercialGate.locator(".lm-commercial-gate__skip").click();
      await expect(commercialGate).toBeHidden();
    }
    const toggle = page.locator(".header-click-toggle");
    await expect(toggle).toBeVisible();
    await expect(toggle).toHaveText("HIDE NAV");

    await toggle.click();
    await expect(page.locator("body")).toHaveClass(/is-click-header-hidden/);
    await expect(toggle).toHaveText("SHOW NAV");

    await toggle.click();
    await expect(page.locator("body")).not.toHaveClass(/is-click-header-hidden/);
    await expect(toggle).toHaveText("HIDE NAV");
  }
});

test("internal route navigation plays an outbound and arrival transition", async ({ page }) => {
  await blockHeavyMedia(page);
  await page.goto("/contact.html", { waitUntil: "domcontentloaded" });

  const destination = page.locator("header nav a").filter({ hasText: "Memberships" }).first();
  await destination.evaluate((link) => link.click());
  await expect(page.locator("[data-lm-page-transition]")).toHaveClass(/is-opening/);

  await page.waitForURL(/\/memberships\.html$/, { timeout: 10_000 });
  await expect(page.locator("html")).toHaveAttribute("data-lm-last-transition-phase", "close");
});

test("membership commercial requests sound first and closes when playback ends", async ({ page }) => {
  await page.addInitScript(() => {
    window.__membershipCommercialPlayAttempts = [];
    const originalPlay = HTMLMediaElement.prototype.play;
    HTMLMediaElement.prototype.play = function patchedPlay() {
      if (this.matches?.("[data-membership-commercial-video]")) {
        window.__membershipCommercialPlayAttempts.push({ muted: this.muted, volume: this.volume });
        return Promise.resolve();
      }
      return originalPlay.call(this);
    };
  });

  await page.goto("/memberships.html", { waitUntil: "domcontentloaded" });
  const commercial = page.locator("[data-membership-commercial-modal]");
  const video = commercial.locator("[data-membership-commercial-video]");
  await expect(commercial).toBeVisible({ timeout: 15_000 });
  await expect(page.locator(".header-click-toggle")).toBeHidden();
  await expect.poll(() => page.evaluate(() => window.__membershipCommercialPlayAttempts)).toContainEqual(
    expect.objectContaining({ muted: false }),
  );
  await video.evaluate((element) => element.dispatchEvent(new Event("ended")));
  await expect(commercial).toBeHidden({ timeout: 3_000 });
  await expect(page.locator(".header-click-toggle")).toBeVisible();
});

test("Storefront commercial closes itself when playback ends", async ({ page }) => {
  await blockHeavyMedia(page);
  await page.goto("/merch-store.html", { waitUntil: "domcontentloaded" });
  const commercial = page.locator("[data-merch-commercial-modal]");
  const video = commercial.locator("[data-merch-commercial-modal-video]");
  await expect(commercial).toBeVisible({ timeout: 5_000 });
  await expect(page.locator(".header-click-toggle")).toBeHidden();
  await video.evaluate((element) => element.dispatchEvent(new Event("ended")));
  await expect(commercial).toBeHidden();
  await expect(page.locator(".header-click-toggle")).toBeVisible();
});

test("Storefront presents supplied Guardian bundles without inventing checkout claims", async ({ page }) => {
  await blockHeavyMedia(page);
  await page.goto("/merch-store.html", { waitUntil: "domcontentloaded" });
  await page.locator("[data-merch-commercial-close]").click();

  const bundles = page.locator(".bundle-card");
  await expect(bundles).toHaveCount(2);
  await expect(page.locator("#guardian-hoodie-bundle")).toContainText("Guardian Hoodie Package");
  await expect(page.locator("#detroit-carry-bundle")).toContainText("Detroit Carry Package");
  await expect(bundles).toContainText(["Pricing TBA", "Pricing TBA"]);
  await expect(bundles.locator("[data-add-item]")).toHaveCount(0);
  await expect.poll(() => bundles.locator("img").evaluateAll((images) => images.every((image) => image.naturalWidth > 0))).toBe(true);

  const saveBundle = page.locator('#guardian-hoodie-bundle [data-wishlist-toggle="guardian-hoodie-bundle"]');
  await saveBundle.click();
  await expect(saveBundle).toHaveAttribute("aria-pressed", "true");
});

test("membership checkout explains an authenticated backend rejection", async ({ page }) => {
  await blockHeavyMedia(page);
  await mockAuthenticatedBilling(page, {
    status: 401,
    body: '{"error":{"code":"AUTH_REQUIRED","message":"Sign in is required."}}',
  });

  await page.goto("/memberships.html", { waitUntil: "domcontentloaded" });
  await expect(page.locator("[data-stripe-membership-status]")).toHaveText("Secure Stripe checkout is ready.");
  await page.locator('[data-stripe-lookup-key="gold_monthly"]').evaluate((button) => button.click());

  await expect(page.locator("[data-stripe-membership-status]")).toHaveText("Sign in is required.");
  await expect(page.locator('[data-stripe-lookup-key="gold_monthly"]')).toBeEnabled();
  await expect(page).toHaveURL(/\/memberships\.html$/);
});

test("membership checkout sends the signed-in account token", async ({ page }) => {
  await blockHeavyMedia(page);
  let checkoutAuthorization = "";
  await mockAuthenticatedBilling(page, {
    status: 401,
    body: '{"error":{"code":"AUTH_REQUIRED","message":"Authorization inspected."}}',
  });
  page.on("request", (request) => {
    if (new URL(request.url()).pathname.endsWith("/billing/checkout")) {
      checkoutAuthorization = request.headers().authorization || "";
    }
  });

  await page.goto("/memberships.html", { waitUntil: "domcontentloaded" });
  await expect(page.locator("[data-stripe-membership-status]")).toHaveText("Secure Stripe checkout is ready.");
  await page.locator('[data-stripe-lookup-key="gold_monthly"]').evaluate((button) => button.click());

  await expect(page.locator("[data-stripe-membership-status]")).toHaveText("Authorization inspected.");
  expect(checkoutAuthorization).toBe("Bearer test-access-token");
});

test("membership checkout return resolves immediately when the visitor is signed out", async ({ page }) => {
  await blockHeavyMedia(page);
  await page.addInitScript(() => {
    window.LottoMindAccountService = {
      getApiBase: () => "https://sqdasdbvlkgpbbiyeune.supabase.co/functions/v1/lottomind-api",
      getAccessToken: async () => "",
      getSnapshot: async () => ({ authenticated: false, memberships: [] }),
    };
  });
  await page.route(/https:\/\/sqdasdbvlkgpbbiyeune\.supabase\.co\/functions\/v1\/lottomind-api.*/i, (route) => {
    const request = route.request();
    const headers = {
      "Access-Control-Allow-Origin": request.headers().origin || "http://127.0.0.1:8142",
      "Access-Control-Allow-Credentials": "true",
      "Access-Control-Allow-Headers": "authorization, content-type, x-client-info, x-requested-with",
      "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    };
    if (request.method() === "OPTIONS") return route.fulfill({ status: 204, headers });
    return route.fulfill({
      status: 200,
      contentType: "application/json",
      headers,
      body: '{"enabled":true,"mode":"test","message":"Secure Stripe checkout is ready.","plans":[{"lookupKey":"gold_monthly","available":true}]}',
    });
  });

  await page.goto("/memberships.html?checkout=success", { waitUntil: "domcontentloaded" });
  await expect(page.locator("[data-stripe-membership-status]")).toHaveText(
    "Stripe returned to LottoMind. Sign in with the account used at checkout to verify membership access."
  );
  await expect(page.locator("[data-stripe-membership-status]")).toHaveAttribute("data-state", "auth-required");
});

test("membership checkout return confirms an active paid membership", async ({ page }) => {
  await blockHeavyMedia(page);
  await page.addInitScript(() => {
    window.LottoMindAccountService = {
      getApiBase: () => "https://sqdasdbvlkgpbbiyeune.supabase.co/functions/v1/lottomind-api",
      getAccessToken: async () => "test-access-token",
      getSnapshot: async () => ({
        authenticated: true,
        memberships: [{ plan_code: "gold", status: "active" }],
      }),
    };
  });
  await page.route(/https:\/\/sqdasdbvlkgpbbiyeune\.supabase\.co\/functions\/v1\/lottomind-api.*/i, (route) => {
    const request = route.request();
    const headers = {
      "Access-Control-Allow-Origin": request.headers().origin || "http://127.0.0.1:8142",
      "Access-Control-Allow-Credentials": "true",
      "Access-Control-Allow-Headers": "authorization, content-type, x-client-info, x-requested-with",
      "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    };
    if (request.method() === "OPTIONS") return route.fulfill({ status: 204, headers });
    return route.fulfill({
      status: 200,
      contentType: "application/json",
      headers,
      body: '{"enabled":true,"mode":"test","message":"Secure Stripe checkout is ready.","plans":[{"lookupKey":"gold_monthly","available":true}]}',
    });
  });

  await page.goto("/memberships.html?checkout=success", { waitUntil: "domcontentloaded" });
  await expect(page.locator("[data-stripe-membership-status]")).toHaveText("Gold membership is active. Secure billing is connected.");
  await expect(page.locator("body")).toHaveAttribute("data-membership-plan", "gold");
});

test("membership checkout rejects an unsafe redirect response", async ({ page }) => {
  await blockHeavyMedia(page);
  await mockAuthenticatedBilling(page, {
    status: 200,
    body: '{"url":"javascript:alert(1)"}',
  });

  await page.goto("/memberships.html", { waitUntil: "domcontentloaded" });
  await expect(page.locator("[data-stripe-membership-status]")).toHaveText("Secure Stripe checkout is ready.");
  await page.locator('[data-stripe-lookup-key="gold_monthly"]').evaluate((button) => button.click());

  await expect(page.locator("[data-stripe-membership-status]")).toContainText("invalid checkout link");
  await expect(page).toHaveURL(/\/memberships\.html$/);
});

test("membership checkout stays disabled for malformed plan configuration", async ({ page }) => {
  await blockHeavyMedia(page);
  await page.route(/https:\/\/sqdasdbvlkgpbbiyeune\.supabase\.co\/functions\/v1\/lottomind-api.*/i, (route) => {
    const request = route.request();
    const headers = {
      "Access-Control-Allow-Origin": request.headers().origin || "http://127.0.0.1:8142",
      "Access-Control-Allow-Credentials": "true",
      "Access-Control-Allow-Headers": "authorization, content-type, x-client-info, x-requested-with",
      "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    };
    if (request.method() === "OPTIONS") return route.fulfill({ status: 204, headers });
    return route.fulfill({
      status: 200,
      contentType: "application/json",
      headers,
      body: '{"enabled":true,"plans":"not-an-array"}',
    });
  });

  await page.goto("/memberships.html", { waitUntil: "domcontentloaded" });

  await expect(page.locator("[data-stripe-membership-status]")).toContainText("invalid plan configuration");
  await expect(page.locator("[data-stripe-lookup-key]").first()).toBeDisabled();
});

test("billing Edge Function returns expected auth failures through its CORS response helper", () => {
  const source = fs.readFileSync(path.join(__dirname, "..", "supabase", "functions", "lottomind-api", "index.ts"), "utf8");
  expect(source).toContain('return user || fail(req, 401, "AUTH_REQUIRED", "Sign in is required.")');
  expect(source).not.toContain("throw Object.assign");
  expect(source).toContain('"Access-Control-Allow-Origin"');
  expect(source).toContain('"INVALID_JSON_BODY"');
  expect(source).toContain('validStripeUrl(session.url, "checkout.stripe.com")');
});

test("Static Wav keeps one commercial on each page entry", async ({ page }) => {
  await blockHeavyMedia(page);
  await page.goto("/how-to-use.html", { waitUntil: "domcontentloaded" });

  const gate = page.locator(".lm-commercial-gate");
  await expect(gate).toBeVisible();
  await gate.locator(".lm-commercial-gate__skip").click();
  await expect(gate).toBeHidden();

  await page.reload({ waitUntil: "domcontentloaded" });
  await expect(page.locator(".lm-commercial-gate")).toHaveCount(1);
  await expect(page.locator(".lm-commercial-gate")).toBeVisible();
});

test("features combines the cinematic shell with the manifest-driven Arcade directory", async ({ page }) => {
  await blockHeavyMedia(page);
  const localFailures = trackLocalFailures(page);
  await page.goto("/features-app.html", { waitUntil: "domcontentloaded" });
  const commercial = page.locator(".lm-commercial-gate");
  await expect(commercial).toBeVisible();
  await commercial.locator(".lm-commercial-gate__skip").click();
  await expect(commercial).toBeHidden();

  await expect(page.locator(".arcade-pilot-label")).toHaveText("LottoMind Features / Arcade + Creative Systems");
  await expect(page.locator('.arcade-pilot-hero__art[src*="lottomind-little-man-membership-hero-v2.png"]')).toBeVisible();
  await expect(page.locator("#featureEntity.feature-entity")).toHaveCount(1);
  await expect(page.locator("[data-shape]")).toHaveCount(8);
  await expect.poll(() => page.evaluate(() => document.body.classList.contains("feature-entity-ready"))).toBe(true);
  expect(await page.locator("#arcade-title").evaluate((title) => getComputedStyle(title).fontFamily)).not.toMatch(/Impact/i);
  await expect(page.locator(".feature-channel")).toHaveCount(5);
  await expect(page.locator("[data-arcade-grid] .arcade-game-card")).toHaveCount(8);
  await expect(page.locator("[data-arcade-count]")).toHaveText("8");
  await expect(page.locator(".arcade-game-card__status")).toHaveText(Array(8).fill("Playable"));
  await expect(page.locator("main video, main audio, iframe, #lottery-news, .instrument-console")).toHaveCount(0);

  await page.getByRole("button", { name: "Action", exact: true }).click();
  await expect(page.locator("[data-arcade-grid] .arcade-game-card")).toHaveCount(3);
  await expect(page.locator("[data-arcade-visible-count]")).toHaveText("3");

  await page.getByRole("button", { name: "All", exact: true }).click();
  await page.locator("[data-arcade-search]").fill("Stem Studio");
  await expect(page.locator("[data-arcade-grid] .arcade-game-card")).toHaveCount(1);
  await expect(page.getByRole("heading", { name: "LottoMind Stem Studio" })).toBeVisible();

  const overflow = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1);
  expect(overflow).toBe(false);
  expect(localFailures).toEqual([]);
});

test("home opens directly to the muted hero without a startup popup", async ({ page }) => {
  const commercialRequests = [];
  page.on("request", (request) => {
    if (/lottomind-home-commercial-20260716\.mp4/i.test(request.url())) commercialRequests.push(request.url());
  });
  await page.goto("/", { waitUntil: "domcontentloaded" });
  const startup = page.locator("[data-startup-video]");
  const heroFilm = page.locator(".hero-motion");
  await expect(startup).toHaveCount(0);
  await expect(heroFilm).toBeVisible();
  await expect.poll(() => heroFilm.evaluate((video) => ({ muted: video.muted, paused: video.paused }))).toEqual({ muted: true, paused: false });
  expect(commercialRequests).toEqual([]);
});

test("Spheres has no automatic Jackpot Maze popup", async ({ page }) => {
  await page.goto("/lottery-spheres.html#spheres", { waitUntil: "domcontentloaded" });
  await expect(page.locator("[data-jackpot-maze-popup]")).toHaveCount(0);
});

test("Contact prepares a support request locally", async ({ page }) => {
  const localFailures = trackLocalFailures(page);
  await page.goto("/contact.html", { waitUntil: "domcontentloaded" });

  await page.locator("#supportTopic").selectOption("technical");
  await page.locator("#supportEmail").fill("preview@example.com");
  await page.locator("#supportPage").fill("https://example.test/affected-route");
  await page.locator("#supportDetails").fill("The preview route did not behave as expected during local testing.");
  await page.getByRole("button", { name: "Prepare Support Request" }).click();

  await expect(page.locator("[data-support-status]")).toHaveText("Support request prepared locally. Nothing has been sent.");
  await expect(page.locator("[data-support-draft]")).toHaveAttribute("href", /^mailto:support@lottomind\.one\?/);
  expect(localFailures).toEqual([]);
});

test("membership hero leads, Collector follows Gaming Showcase, and the Guardian offer closes the page", async ({ page }) => {
  await blockHeavyMedia(page);
  await page.route(/https:\/\/js\.stripe\.com\/.*/i, (route) => route.abort());
  await page.goto("/memberships.html", { waitUntil: "domcontentloaded" });

  const supportGrid = page.locator("#membership-plans > .membership-plan-support-grid");
  const hero = page.locator("#dust");
  const plans = page.locator("#membership-plans");
  const collector = page.locator("main > #lm-access-hero");
  const showcase = page.locator("#worlds");
  const guardianSection = page.locator("main > .membership-guardian-bottom");
  const guardian = guardianSection.locator(":scope > .membership-collectible-card");

  await expect(supportGrid).toHaveCount(1);
  await expect(supportGrid.locator(":scope > *")).toHaveCount(0);
  await expect(collector).toHaveCount(1);
  await expect(guardian).toHaveCount(1);
  await expect(collector.locator("#plansTitle")).toHaveText(/Choose your signal level/i);
  await expect(page.locator(".membership-comparison, .membership-benefit-strip, #lm-credits, .membership-billing-tools")).toHaveCount(0);
  await expect(page.locator("#dust .membership-collectible-card")).toHaveCount(0);
  await expect(page.locator("#water")).toHaveCount(0);
  await expect(page.getByText(/Film 04/i)).toHaveCount(0);
  await expect(page.locator("footer.site-footer-standard .site-legal-links a")).toHaveCount(4);
  await expect(page.locator("footer.site-footer-standard > a.footer-link")).toHaveCount(0);

  expect(await hero.evaluate((node) =>
    Boolean(node.compareDocumentPosition(document.querySelector("#membership-plans")) & Node.DOCUMENT_POSITION_FOLLOWING)
  )).toBe(true);

  expect(await showcase.evaluate((node) =>
    Boolean(node.compareDocumentPosition(document.querySelector("#lm-access-hero")) & Node.DOCUMENT_POSITION_FOLLOWING)
  )).toBe(true);
  expect(await guardianSection.evaluate((node) => {
    const sections = [...node.parentElement.querySelectorAll(":scope > section")];
    return sections.at(-1) === node;
  })).toBe(true);

  const collectorBox = await collector.boundingBox();
  const heroBox = await hero.boundingBox();
  const plansBox = await plans.boundingBox();
  const showcaseBox = await showcase.boundingBox();
  const guardianBox = await guardian.boundingBox();
  expect(collectorBox).toBeTruthy();
  expect(heroBox).toBeTruthy();
  expect(plansBox).toBeTruthy();
  expect(showcaseBox).toBeTruthy();
  expect(guardianBox).toBeTruthy();

  expect(heroBox.y).toBeLessThan(plansBox.y);
  expect(collectorBox.y).toBeGreaterThan(showcaseBox.y);
  expect(collectorBox.y).toBeLessThan(guardianBox.y);
});

test("shared navigation uses the requested Games, RAHBE, Storefront, and Static Wav labels", async ({ page }) => {
  await blockHeavyMedia(page);
  await page.goto("/lottery-spheres.html", { waitUntil: "domcontentloaded" });
  const navigation = page.locator(".site-header nav");
  await expect(navigation.locator('a[data-icon="FX"]')).toContainText("Games");
  await expect(navigation.locator('a[data-icon="B2"]')).toContainText("RAHBE");
  await expect(navigation.locator('a[data-icon="DR"]')).toContainText("Storefront");
  await expect(navigation.locator('a[data-icon="GD"]')).toContainText("Static Wav");
});

test("Stem Studio contains the workstation at compact mobile width", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/lottomind-stem-studio/", { waitUntil: "domcontentloaded" });
  await expect(page.getByRole("heading", { name: "LottoMind Stem Studio" })).toBeVisible();

  const viewport = await page.evaluate(() => ({
    clientWidth: document.documentElement.clientWidth,
    scrollWidth: document.documentElement.scrollWidth,
  }));
  expect(viewport.scrollWidth).toBeLessThanOrEqual(viewport.clientWidth + 1);
});

test("mobile memberships hero keeps its title inside the viewport", async ({ page }, testInfo) => {
  test.skip(!testInfo.project.name.startsWith("mobile"), "Mobile layout assertion");
  await blockHeavyMedia(page);
  await page.route(/https:\/\/js\.stripe\.com\/.*/i, (route) => route.abort());
  await page.goto("/memberships.html", { waitUntil: "domcontentloaded" });

  const titleBox = await page.locator("#membershipHeroTitle").boundingBox();
  const membershipWordBox = await page.locator("#membershipHeroTitle em").boundingBox();
  const viewportWidth = await page.evaluate(() => window.innerWidth);
  expect(titleBox).toBeTruthy();
  expect(membershipWordBox).toBeTruthy();
  expect(titleBox.x).toBeGreaterThanOrEqual(0);
  expect(titleBox.x + titleBox.width).toBeLessThanOrEqual(viewportWidth);
  expect(membershipWordBox.x).toBeGreaterThanOrEqual(0);
  expect(membershipWordBox.x + membershipWordBox.width).toBeLessThanOrEqual(viewportWidth);
});

test("news route renders from the static feed without probing the missing API", async ({ page }) => {
  await blockHeavyMedia(page);
  const localFailures = trackLocalFailures(page);
  const apiRequests = [];
  page.on("request", (request) => {
    const url = new URL(request.url());
    if (url.origin === "http://127.0.0.1:8142" && url.pathname.includes("/api/")) apiRequests.push(url.pathname);
  });

  await page.goto("/news/", { waitUntil: "domcontentloaded" });
  await page.waitForFunction(() => (document.querySelector("#root")?.textContent || "").trim().length > 80);

  await expect(page.locator("#root")).toContainText(/LottoMind|News|Lottery/i);
  const firstArticleImage = page.locator(".article-grid .news-card__media img").first();
  await firstArticleImage.scrollIntoViewIfNeeded();
  await expect(firstArticleImage).toBeVisible();
  await expect.poll(() => firstArticleImage.evaluate((image) => image.complete && image.naturalWidth > 0)).toBe(true);
  expect(apiRequests).toEqual([]);
  expect(localFailures).toEqual([]);
});

test("GothTechnology canvas boots with a visible play surface", async ({ page }) => {
  const localFailures = trackLocalFailures(page);
  await page.goto("/games/gothtechnology2/", { waitUntil: "domcontentloaded" });
  await page.waitForFunction(() => {
    const canvas = document.querySelector("#game");
    if (!canvas) return false;
    const rect = canvas.getBoundingClientRect();
    return rect.width >= 320 && rect.height >= 180;
  });

  const canvas = page.locator("#game");
  await expect(canvas).toBeVisible();
  const pixels = await canvas.evaluate((node) => {
    const context = node.getContext("2d");
    if (!context) return 0;
    const sample = context.getImageData(0, 0, node.width, node.height).data;
    let lit = 0;
    for (let index = 0; index < sample.length; index += 256) {
      if (sample[index] || sample[index + 1] || sample[index + 2]) lit += 1;
    }
    return lit;
  });
  expect(pixels).toBeGreaterThan(20);
  expect(localFailures).toEqual([]);
});

test("Jackpot Maze built route renders instead of a dev shell", async ({ page }) => {
  const localFailures = trackLocalFailures(page);
  await page.goto("/games/lottomind-jackpot-maze/", { waitUntil: "domcontentloaded" });
  await page.waitForFunction(() => (document.querySelector("#root")?.textContent || "").trim().length > 20);

  await expect(page.getByRole("heading", { name: "LottoMind Jackpot Maze" })).toHaveCount(1);
  await expect(page.getByRole("button", { name: /Enter the Maze/i })).toBeVisible();
  expect(localFailures).toEqual([]);
});

for (const game of [
  { name: "OpenGW Levels", route: "/games/opengw-levels/", canvas: "#game" },
  { name: "Raytrace Pong", route: "/games/raytrace-pong-background/", canvas: "#rayPong" },
  { name: "Shadow Ops", route: "/games/shadow-ops-canvas/", canvas: "#game" },
]) {
  test(`${game.name} boots its visible canvas without local asset failures`, async ({ page }) => {
    await blockHeavyMedia(page);
    const localFailures = trackLocalFailures(page);
    await page.goto(game.route, { waitUntil: "domcontentloaded" });
    await page.waitForFunction((selector) => {
      const canvas = document.querySelector(selector);
      if (!canvas) return false;
      const rect = canvas.getBoundingClientRect();
      return rect.width >= 280 && rect.height >= 150;
    }, game.canvas);

    await expect(page.locator(game.canvas)).toBeVisible();
    expect(localFailures).toEqual([]);
  });
}
