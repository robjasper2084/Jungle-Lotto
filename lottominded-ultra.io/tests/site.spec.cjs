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
  await expect(commercial.getByRole("link", { name: "Buy Now" })).toHaveAttribute("href", /merch-store\.html\?product=guardian#keychains/);
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
  const heroFilm = page.locator(".membership-hero-commercial");
  await expect(heroFilm).toBeVisible();
  await expect(heroFilm.locator(".membership-hero-commercial__hud")).toBeVisible();
  await expect(heroFilm.locator(".membership-hero-commercial__corner")).toHaveCount(4);
  await expect(heroFilm.locator(".membership-hero-commercial__meter i")).toHaveCount(6);
  await expect(heroFilm.locator("[data-membership-featured-sound]")).toBeVisible();
  await expect(heroFilm.locator("video")).not.toHaveAttribute("autoplay", "");
  await expect(heroFilm.locator("video")).toHaveAttribute("preload", "none");
  await expect(heroFilm.locator("source")).toHaveAttribute("data-src", /lottomind-membership-feature-commercial-20260716\.mp4/);
  expect(await heroFilm.locator(".membership-hero-commercial__hud").evaluate((element) => getComputedStyle(element).clipPath)).not.toBe("none");
  await expect(page.locator("[data-stripe-lookup-key]").first()).toBeDisabled();
  await expect(page.locator("[data-stripe-membership-status]")).toContainText("Test billing endpoint offline");
  expect(apiRequests).toEqual([]);
  expect(localFailures).toEqual([]);
});

test("Static Wav and Robot RAHBEE keep an explicit header hide and restore control", async ({ page }) => {
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

test("header hide control stays off every route except Static Wav and Robot RAHBEE", async ({ page }) => {
  await blockHeavyMedia(page);

  for (const route of ["/", "/memberships.html", "/features-app.html", "/merch-store.html", "/lottery-spheres.html"]) {
    await page.goto(route, { waitUntil: "domcontentloaded" });
    await expect(page.locator(".header-click-toggle")).toHaveCount(0);
  }
});

test("Home and Storefront omit the removed particle and music-reactive visual layers", async ({ page }) => {
  await blockHeavyMedia(page);

  await page.goto("/", { waitUntil: "domcontentloaded" });
  await expect(page.locator("#featureEntity, .signal-particle-layer")).toHaveCount(0);

  await page.goto("/merch-store.html", { waitUntil: "domcontentloaded" });
  await expect(page.locator("[data-live-eq], .live-eq-meter")).toHaveCount(0);
  await expect(page.locator(".merch-commercial-capsule video")).toHaveCount(1);
});

test("internal route navigation plays an outbound and arrival transition", async ({ page }) => {
  await blockHeavyMedia(page);
  await page.addInitScript(() => {
    window.__membershipCommercialOpenedDuringTransition = false;
    document.addEventListener("DOMContentLoaded", () => {
      const commercial = document.querySelector("[data-membership-commercial-modal]");
      if (!commercial) return;
      const observer = new MutationObserver(() => {
        const isOpen = commercial.classList.contains("is-open") && commercial.getAttribute("aria-hidden") === "false";
        if (isOpen && document.body.classList.contains("lm-page-is-transitioning")) {
          window.__membershipCommercialOpenedDuringTransition = true;
        }
      });
      observer.observe(commercial, { attributes: true, attributeFilter: ["class", "aria-hidden"] });
    }, { once: true });
  });
  await page.goto("/contact.html", { waitUntil: "domcontentloaded" });

  const destination = page.locator("header nav a").filter({ hasText: "Memberships" }).first();
  await destination.evaluate((link) => link.click());
  await expect(page.locator("[data-lm-page-transition]")).toHaveClass(/is-opening/);

  await page.waitForURL(/\/memberships\.html$/, { timeout: 10_000 });
  await expect(page.locator("html")).toHaveAttribute("data-lm-last-transition-phase", "close");
  const membershipCommercial = page.locator("[data-membership-commercial-modal]");
  await expect(page.locator("body")).not.toHaveClass(/lm-page-is-transitioning/, { timeout: 5_000 });
  await expect(membershipCommercial).toBeVisible({ timeout: 15_000 });
  expect(await page.evaluate(() => window.__membershipCommercialOpenedDuringTransition)).toBe(false);
});

test("membership commercial requests sound first and closes when playback ends", async ({ page }) => {
  await page.addInitScript(() => {
    window.__membershipCommercialPlayAttempts = [];
    window.__membershipEntrySequence = [];
    window.addEventListener("lottomind:page-transition", (event) => {
      window.__membershipEntrySequence.push(`transition:${event.detail.source}`);
    });
    window.addEventListener("lottomind:transition-complete", (event) => {
      window.__membershipEntrySequence.push(`complete:${event.detail.source}`);
    });
    const originalPlay = HTMLMediaElement.prototype.play;
    HTMLMediaElement.prototype.play = function patchedPlay() {
      if (this.matches?.("[data-membership-commercial-video]")) {
        window.__membershipCommercialPlayAttempts.push({ muted: this.muted, volume: this.volume });
        return Promise.resolve();
      }
      return originalPlay.call(this);
    };
    document.addEventListener("DOMContentLoaded", () => {
      const commercial = document.querySelector("[data-membership-commercial-modal]");
      if (!commercial) return;
      new MutationObserver(() => {
        if (commercial.classList.contains("is-open") && commercial.getAttribute("aria-hidden") === "false") {
          if (!window.__membershipEntrySequence.includes("commercial:open")) {
            window.__membershipEntrySequence.push("commercial:open");
          }
        }
      }).observe(commercial, { attributes: true, attributeFilter: ["class", "aria-hidden"] });
    }, { once: true });
  });

  await page.goto("/memberships.html", { waitUntil: "domcontentloaded" });
  const commercial = page.locator("[data-membership-commercial-modal]");
  const video = commercial.locator("[data-membership-commercial-video]");
  await expect(commercial).toBeVisible({ timeout: 15_000 });
  await expect(page.locator(".header-click-toggle")).toHaveCount(0);
  await expect.poll(() => page.evaluate(() => window.__membershipCommercialPlayAttempts)).toContainEqual(
    expect.objectContaining({ muted: false }),
  );
  await expect.poll(() => page.evaluate(() => window.__membershipEntrySequence)).toEqual(
    expect.arrayContaining(["transition:arrival", "complete:arrival", "commercial:open"]),
  );
  expect(await page.evaluate(() => {
    const sequence = window.__membershipEntrySequence;
    return sequence.indexOf("complete:arrival") < sequence.indexOf("commercial:open");
  })).toBe(true);
  await video.evaluate((element) => element.dispatchEvent(new Event("ended")));
  await expect(page.locator("[data-lm-page-transition]")).toHaveClass(/is-closing/);
  await expect(page.locator("#lmMembership")).toHaveAttribute("inert", "");
  await expect.poll(() => page.evaluate(() => window.__membershipEntrySequence)).toContain("complete:membership-commercial");
  await expect(commercial).toBeHidden({ timeout: 3_000 });
  await expect(page.locator("#lmMembership")).not.toHaveAttribute("inert", "");
  await expect(page.locator(".header-click-toggle")).toHaveCount(0);
  await expect(page.locator("[data-lm-page-transition]")).not.toHaveClass(/is-closing/);
});

test("Membership depth responds to pointer and keyboard while respecting reduced motion", async ({ page }) => {
  await blockHeavyMedia(page);
  await page.goto("/memberships.html", { waitUntil: "domcontentloaded" });
  const commercial = page.locator("[data-membership-commercial-modal]");
  await expect(commercial).toBeVisible({ timeout: 15_000 });
  await page.locator("[data-membership-commercial-close]").click();
  await expect(commercial).toBeHidden({ timeout: 5_000 });
  await expect(page.locator("#lmMembership")).not.toHaveAttribute("inert", "", { timeout: 5_000 });

  await expect(page.locator("body")).toHaveClass(/lm-membership-depth-ready/);
  const cards = page.locator(".membership-plan-card.lm-membership-depth-card");
  await expect(cards).toHaveCount(4);
  const firstCard = cards.first();
  const button = firstCard.locator("a, button").first();
  await firstCard.evaluate((element) => element.scrollIntoView({ block: "center", behavior: "instant" }));
  await expect(firstCard).toBeVisible();
  await button.evaluate((element) => element.focus());
  await expect(button).toBeFocused();
  await expect(firstCard).toHaveClass(/is-depth-focused/);

  const interactive = await page.locator("body").getAttribute("data-lm-membership-depth");
  if (interactive === "interactive") {
    const box = await firstCard.boundingBox();
    if (!box) throw new Error("Membership plan card is not measurable.");
    await page.mouse.move(box.x + box.width * 0.82, box.y + box.height * 0.24);
    await expect.poll(() => firstCard.evaluate((card) => (
      card.style.getPropertyValue("--lm-depth-rotate-y")
    ))).not.toBe("0deg");
  }

  await page.emulateMedia({ reducedMotion: "reduce" });
  await expect(page.locator("body")).toHaveAttribute("data-lm-membership-depth", "static");
  await expect(firstCard).toHaveCSS("transform", "none");
});

test("Storefront commercial closes itself when playback ends", async ({ page }) => {
  await blockHeavyMedia(page);
  await page.goto("/merch-store.html", { waitUntil: "domcontentloaded" });
  const commercial = page.locator("[data-merch-commercial-modal]");
  const video = commercial.locator("[data-merch-commercial-modal-video]");
  await expect(commercial).toBeVisible({ timeout: 5_000 });
  await expect(commercial.getByRole("link", { name: "Buy Now" })).toHaveAttribute("href", "#keychains");
  await expect(page.locator(".header-click-toggle")).toHaveCount(0);
  await video.evaluate((element) => element.dispatchEvent(new Event("ended")));
  await expect(commercial).toBeHidden();
  await expect(page.locator(".header-click-toggle")).toHaveCount(0);
});

test("Storefront applies the requested price, removals, and larger commercial", async ({ page }) => {
  await blockHeavyMedia(page);
  await page.goto("/merch-store.html", { waitUntil: "domcontentloaded" });
  await page.locator("[data-merch-commercial-close]").click();

  const hoodie = page.locator("#product-detroit-embroidery-hoodie");
  await expect(hoodie.locator(".product-hover-price")).toHaveText("$89.99");
  await expect(hoodie.locator(".product-row strong")).toHaveText("$89.99");
  await expect(hoodie.locator("[data-add-item]")).toHaveAttribute("data-item-price", "89.99");
  await expect(page.getByRole("heading", { name: "Cyber Brain Glow Hoodie" })).toHaveCount(0);
  await expect(page.getByRole("heading", { name: "LottoMind Coin Set" })).toHaveCount(0);
  await expect(page.locator("#gallery article", { hasText: "Boogie Knit" })).toHaveCount(0);

  const capsule = page.locator(".merch-commercial-capsule");
  const heroVideo = page.locator(".merch-hero-video");
  await expect(heroVideo).not.toHaveAttribute("autoplay", "");
  await expect(heroVideo).toHaveAttribute("preload", "none");
  await expect(heroVideo.locator("source")).toHaveAttribute("data-src", /merch-motion-01\.opt\.mp4$/);
  const capsuleBox = await capsule.boundingBox();
  const heroBox = await page.locator(".merch-hero").boundingBox();
  expect(capsuleBox).toBeTruthy();
  expect(heroBox).toBeTruthy();
  if (page.viewportSize().width > 980) {
    expect(capsuleBox.width).toBeGreaterThan(700);
  } else {
    expect(capsuleBox.width).toBeGreaterThan(280);
  }
  expect(capsuleBox.x + capsuleBox.width).toBeLessThanOrEqual(heroBox.x + heroBox.width + 1);
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
  expect(await bundles.locator("img").evaluateAll((images) => images.every((image) => /bundle-20260725\.webp$/.test(image.getAttribute("src") || "")))).toBe(true);
  await expect.poll(() => bundles.locator("img").evaluateAll((images) => images.every((image) => image.naturalWidth > 0))).toBe(true);

  const saveBundle = page.locator('#guardian-hoodie-bundle [data-wishlist-toggle="guardian-hoodie-bundle"]');
  await saveBundle.click();
  await expect(saveBundle).toHaveAttribute("aria-pressed", "true");
});

test("Arcade hero fits the supplied Guardian film with accessible motion control", async ({ page }) => {
  await blockHeavyMedia(page);
  await page.goto("/features-app.html", { waitUntil: "domcontentloaded" });
  const commercialGate = page.locator(".lm-commercial-gate");
  if (await commercialGate.isVisible().catch(() => false)) {
    await commercialGate.locator(".lm-commercial-gate__skip").click();
  }

  const media = page.locator(".arcade-pilot-hero__media");
  const video = page.locator("[data-arcade-hero-video]");
  const toggle = page.locator("[data-arcade-hero-video-toggle]");
  await expect(media).toBeVisible();
  await expect(video).toHaveAttribute("muted", "");
  await expect(video).toHaveAttribute("loop", "");
  await expect(video).toHaveAttribute("playsinline", "");
  await expect(video).not.toHaveAttribute("autoplay", "");
  await expect(video).toHaveAttribute("preload", "none");
  await expect(video.locator("source")).toHaveAttribute("data-src", /lottomind-arcade-hero-film-20260723\.mp4$/);
  await expect(toggle).toBeVisible();

  const box = await media.boundingBox();
  const copyBox = await page.locator(".arcade-pilot-hero__copy").boundingBox();
  const heroBox = await page.locator(".arcade-pilot-hero").boundingBox();
  expect(box.width).toBeGreaterThan(280);
  expect(box.height).toBeGreaterThan(150);
  expect(box.width / box.height).toBeGreaterThan(1.7);
  expect(box.width / box.height).toBeLessThan(1.85);
  expect(copyBox).toBeTruthy();
  expect(heroBox).toBeTruthy();
  if ((await page.viewportSize()).width > 1050) {
    expect(copyBox.x + copyBox.width).toBeLessThanOrEqual(box.x);
  }
  expect(box.x + box.width).toBeLessThanOrEqual(heroBox.x + heroBox.width + 1);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true);
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
  await expect(gate).toHaveClass(/lm-commercial-gate--guide/);
  await expect(gate).toHaveAttribute("data-lm-guide-hud", "static-wav-2084");
  await expect(gate.locator(".lm-commercial-gate__guide-chassis")).toContainText("STREET SIGNAL LOCKED");
  await expect(gate.locator("video")).toHaveAttribute("data-src", /lottomind-guide-commercial-20260717\.mp4/);
  await expect(gate.getByRole("link", { name: "Buy Now" })).toHaveAttribute("href", /merch-store\.html\?product=guardian#keychains/);

  const layout = await gate.evaluate((element) => {
    const panel = element.querySelector(".lm-commercial-gate__panel").getBoundingClientRect();
    const stage = element.querySelector(".lm-commercial-gate__stage").getBoundingClientRect();
    const chapters = element.querySelector(".lm-commercial-gate__chapters").getBoundingClientRect();
    const footer = element.querySelector(".lm-commercial-gate__footer").getBoundingClientRect();
    return {
      viewportWidth: window.innerWidth,
      viewportHeight: window.innerHeight,
      panel: { left: panel.left, top: panel.top, right: panel.right, bottom: panel.bottom },
      stage: { left: stage.left, top: stage.top, right: stage.right, bottom: stage.bottom },
      chapters: { left: chapters.left, top: chapters.top, right: chapters.right, bottom: chapters.bottom },
      footer: { left: footer.left, top: footer.top, right: footer.right, bottom: footer.bottom },
    };
  });

  expect(layout.panel.left).toBeGreaterThanOrEqual(-1);
  expect(layout.panel.top).toBeGreaterThanOrEqual(-1);
  expect(layout.panel.right).toBeLessThanOrEqual(layout.viewportWidth + 1);
  expect(layout.panel.bottom).toBeLessThanOrEqual(layout.viewportHeight + 1);
  if (layout.viewportWidth > 720) {
    expect(layout.stage.right).toBeLessThanOrEqual(layout.chapters.left + 1);
    expect(layout.stage.right).toBeLessThanOrEqual(layout.footer.left + 1);
  } else {
    expect(layout.stage.bottom).toBeLessThanOrEqual(layout.chapters.top + 1);
    expect(layout.chapters.bottom).toBeLessThanOrEqual(layout.footer.top + 1);
  }
  expect(await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1)).toBe(false);

  await gate.locator(".lm-commercial-gate__skip").click();
  await expect(gate).toBeHidden();

  await page.reload({ waitUntil: "domcontentloaded" });
  await expect(page.locator(".lm-commercial-gate")).toHaveCount(1);
  await expect(page.locator(".lm-commercial-gate")).toBeVisible();
});

test("Robot RAHBEE route restores the embedded game after its commercial", async ({ page }) => {
  await blockHeavyMedia(page);
  const localFailures = trackLocalFailures(page);
  await page.goto("/beat2lotto-plus.html#beat2lotto", { waitUntil: "domcontentloaded" });

  const gate = page.locator(".lm-commercial-gate");
  await expect(gate).toBeVisible();
  await gate.locator(".lm-commercial-gate__skip").click();
  await expect(gate).toBeHidden();

  const frameElement = page.locator("[data-beat2-game-frame]");
  await expect(frameElement).not.toHaveAttribute("src", /shadow-ops-canvas/);
  await page.getByRole("button", { name: "Launch game" }).click();
  await expect(frameElement).toHaveAttribute("src", /shadow-ops-canvas/);
  const frame = page.frameLocator("[data-beat2-game-frame]");
  await expect(frame.locator("#game")).toBeVisible({ timeout: 15_000 });
  await expect(frame.getByRole("heading", { name: "ROBOT RAHBEE" })).toBeVisible();
  expect(localFailures).toEqual([]);
});

test("Static Wav defers its game until the player launches it", async ({ page }) => {
  await blockHeavyMedia(page);
  const localFailures = trackLocalFailures(page);
  await page.goto("/how-to-use.html", { waitUntil: "domcontentloaded" });

  const gate = page.locator(".lm-commercial-gate");
  if (await gate.isVisible().catch(() => false)) await gate.locator(".lm-commercial-gate__skip").click();

  const frameElement = page.locator("[data-static-wave-frame]");
  await expect(frameElement).not.toHaveAttribute("src", /opengw-levels/);
  await page.getByRole("button", { name: "Launch game" }).click();
  await expect(frameElement).toHaveAttribute("src", /opengw-levels/);
  await expect(page.frameLocator("[data-static-wave-frame]").locator("canvas").first()).toBeVisible({ timeout: 15_000 });
  expect(localFailures).toEqual([]);
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
  await expect(page.getByRole("heading", { name: "RAYCHASE PONG" })).toBeVisible();
  const arcadeRail = page.locator("[data-arcade-grid]");
  const railMetrics = await arcadeRail.evaluate((element) => ({
    scrollWidth: element.scrollWidth,
    clientWidth: element.clientWidth,
    scrollSnapType: getComputedStyle(element).scrollSnapType,
  }));
  expect(railMetrics.scrollWidth).toBeGreaterThan(railMetrics.clientWidth);
  expect(railMetrics.scrollSnapType).toContain("mandatory");
  const nextGames = page.getByRole("button", { name: "Next games" });
  await expect(nextGames).toBeEnabled();
  await nextGames.click();
  await expect.poll(() => arcadeRail.evaluate((element) => element.scrollLeft)).toBeGreaterThan(0);
  await expect(page.locator("main video:not([data-arcade-hero-video]), main audio, iframe, #lottery-news, .instrument-console")).toHaveCount(0);

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

test("Spheres exposes one Oracle and consistent Robot RAHBEE handoffs", async ({ page }) => {
  await page.goto("/lottery-spheres.html#spheres", { waitUntil: "domcontentloaded" });

  await expect(page.locator(".sphere-eightball")).toHaveCount(0);
  await expect(page.locator("[data-lm-healing-generator]")).toHaveCount(1);
  await expect(page.getByRole("heading", { name: "Lottery Spheres in Motion", exact: true })).toHaveAccessibleName("Lottery Spheres in Motion");
  await expect(page.getByRole("heading", { name: "Orbit", exact: true })).toHaveAccessibleName("Orbit");
  await expect(page.getByRole("heading", { name: "Signal", exact: true })).toHaveAccessibleName("Signal");
  await expect(page.getByRole("heading", { name: "Studio", exact: true })).toHaveAccessibleName("Studio");
  await expect(page.getByRole("link", { name: "Open Robot RAHBEE", exact: true })).toHaveAttribute("href", "./beat2lotto-plus.html#beat2lotto");
  await expect(page.locator(".sphere-copy")).not.toContainText("Beat2Lotto+");

  if (page.viewportSize()?.width <= 680) {
    await expect(page.locator("[data-lm-healing-generator]")).toHaveClass(/is-minimized/);
    const overlapsPrimaryActions = await page.evaluate(() => {
      const oracle = document.querySelector("[data-lm-healing-generator]")?.getBoundingClientRect();
      const actions = document.querySelector(".sphere-actions")?.getBoundingClientRect();
      if (!oracle || !actions) return true;
      return !(oracle.right <= actions.left || oracle.left >= actions.right || oracle.bottom <= actions.top || oracle.top >= actions.bottom);
    });
    expect(overlapsPrimaryActions).toBe(false);
  }
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

test("shared navigation uses the requested Games, Robot RAHBEE, Storefront, and Static Wav labels", async ({ page }) => {
  await blockHeavyMedia(page);
  await page.goto("/lottery-spheres.html", { waitUntil: "domcontentloaded" });
  const navigation = page.locator(".site-header nav");
  await expect(navigation.locator('a[data-icon="FX"]')).toContainText("Games");
  await expect(navigation.locator('a[data-icon="B2"]')).toContainText("Robot RAHBEE");
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
  await expect(firstArticleImage).toHaveAttribute("src", /\.jpg$/);
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
  { name: "RAYCHASE PONG", route: "/games/raytrace-pong-background/", canvas: "#rayPong" },
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
