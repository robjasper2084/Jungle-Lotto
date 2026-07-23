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
    let pageOrigin = "";
    try { pageOrigin = new URL(page.url()).origin; } catch (_) {}
    if (url.origin === pageOrigin && response.status() >= 400 && !url.pathname.includes("favicon")) {
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
  await expect(page.locator("footer.site-footer-standard .site-legal-links a")).toHaveCount(4);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true);
  await page.waitForTimeout(1000);
  expect(failures).toEqual([]);
  expect(pageErrors).toEqual([]);
  expect(consoleFailures).toEqual([]);
});

test("primary headers share labels, orb artwork, dimensions, and overflow boundaries", async ({ page }) => {
  await blockHeavyMedia(page);
  const routes = [
    "/index.html",
    "/memberships.html",
    "/features-app.html",
    "/news/",
    "/live-events.html",
    "/lottery-spheres.html#spheres",
    "/beat2lotto-plus.html#beat2lotto",
    "/merch-store.html",
    "/how-to-use.html",
    "/prompt-lab.html",
  ];
  const expectedLabels = {
    MB: "Memberships",
    HM: "Home",
    FX: "Games",
    NW: "News",
    EV: "Events",
    SP: "Spheres",
    B2: "RAHBE",
    DR: "Storefront",
    GD: "Static Wav",
    LM: "LottoMind App",
  };
  const expectedArtwork = {
    MB: "guide-puck-cyan-city",
    HM: "guide-puck-gold-mascot-close",
    FX: "lottomind-branded-puck",
    NW: "guide-puck-gold-mascot-wide",
    EV: "jazz-network",
    SP: "guide-puck-cyan-city",
    B2: "jazz-network",
    DR: "lottomind-branded-puck",
    GD: "guide-puck-gold-mascot-close",
    LM: "lottomind-branded-puck",
  };

  for (const viewport of [{ width: 1440, height: 900 }, { width: 390, height: 844 }]) {
    await page.setViewportSize(viewport);
    for (const route of routes) {
      await page.goto(route, { waitUntil: "domcontentloaded" });
      const header = page.locator("[data-site-header]");
      await expect(header, route).toBeVisible();
      await expect(header.locator("nav a[data-icon]"), route).toHaveCount(10);
      await header.dispatchEvent("click");
      await expect(header, `${route} header remains pinned after click`).toBeVisible();
      await expect(header, route).not.toHaveClass(/is-(?:click|home|sphere|universal)-header-hidden/);
      await expect(page.locator(".header-click-toggle"), route).toHaveCount(0);

      const audit = await header.evaluate((node) => {
        const links = [...node.querySelectorAll("nav a[data-icon]")];
        return {
          viewportWidth: document.documentElement.clientWidth,
          documentWidth: document.documentElement.scrollWidth,
          headerRect: node.getBoundingClientRect().toJSON(),
          links: links.map((link) => {
            const style = getComputedStyle(link);
            const rect = link.getBoundingClientRect();
            return {
              icon: link.dataset.icon,
              label: link.textContent.trim(),
              artwork: style.getPropertyValue("--sphere-nav-image").trim(),
              width: rect.width,
              height: rect.height,
              overflow: style.overflow,
            };
          }),
        };
      });

      expect(audit.documentWidth, `${route} at ${viewport.width}px`).toBeLessThanOrEqual(audit.viewportWidth + 1);
      expect(audit.headerRect.left, route).toBeGreaterThanOrEqual(-1);
      expect(audit.headerRect.right, route).toBeLessThanOrEqual(audit.viewportWidth + 1);
      for (const link of audit.links) {
        expect(link.label, `${route} ${link.icon}`).toBe(expectedLabels[link.icon]);
        expect(link.artwork, `${route} ${link.icon}`).toContain(expectedArtwork[link.icon]);
        expect(Math.abs(link.width - link.height), `${route} ${link.icon}`).toBeLessThanOrEqual(1);
        expect(link.overflow, `${route} ${link.icon}`).toBe("hidden");
      }
    }
  }
});

test("Arcade arrival transition clears its handoff without leaking into the next route", async ({ page }) => {
  await blockHeavyMedia(page);
  await page.goto("/index.html", { waitUntil: "domcontentloaded" });
  await page.evaluate(() => {
    sessionStorage.setItem("lmTransitionArriving", "yes");
    sessionStorage.setItem("lmTransitionTheme", "features");
    sessionStorage.setItem("lmTransitionLabel", "Games");
  });

  await page.goto("/features-app.html", { waitUntil: "domcontentloaded" });
  await expect(page.locator("[data-lm-page-transition]")).toHaveAttribute("aria-hidden", "true", { timeout: 2_500 });
  expect(await page.evaluate(() => sessionStorage.getItem("lmTransitionArriving"))).toBeNull();

  await page.goto("/beat2lotto-plus.html#beat2lotto", { waitUntil: "domcontentloaded" });
  await expect(page.locator("[data-lm-page-transition]")).toHaveAttribute("aria-hidden", "true");
  await expect(page.locator("[data-lm-page-transition]")).not.toHaveClass(/is-active/);
});

test("home opens directly with muted hero video and no startup dialog", async ({ page }) => {
  const removedCommercialRequests = [];
  const soundtrackRequests = [];
  page.on("request", (request) => {
    if (/lottomind-home-commercial-20260716\.mp4/i.test(request.url())) removedCommercialRequests.push(request.url());
    if (/home-screen-song\.mp3/i.test(request.url())) soundtrackRequests.push(request.url());
  });

  await page.addInitScript(() => {
    const originalPlay = HTMLMediaElement.prototype.play;
    HTMLMediaElement.prototype.play = function (...args) {
      this.dataset.lmPlayAttempts = String(Number(this.dataset.lmPlayAttempts || "0") + 1);
      return originalPlay.apply(this, args);
    };
    const nativeSetTimeout = window.setTimeout.bind(window);
    window.setTimeout = (callback, delay, ...args) => {
      if (delay === 60_000) {
        window.__lmStartupDelay = delay;
        return nativeSetTimeout(callback, 1_200, ...args);
      }
      return nativeSetTimeout(callback, delay, ...args);
    };
  });
  await page.goto("/", { waitUntil: "domcontentloaded" });
  const heroFilm = page.locator("[data-home-hero-audio]");
  await expect(page.locator("[data-startup-video]")).toBeHidden();
  await expect(heroFilm).toBeVisible();
  const scanBars = await page.locator(".hero-copy").evaluate((hero) => {
    const panelScan = getComputedStyle(hero, "::before");
    const fieldScan = getComputedStyle(document.querySelector(".home-sphere-scanline"));
    return {
      panelAnimation: panelScan.animationName,
      panelHeight: panelScan.height,
      panelOpacity: Number(panelScan.opacity),
      panelBackground: panelScan.backgroundImage,
      performanceMode: document.documentElement.classList.contains("lm-mobile-performance"),
      reducedMotion: matchMedia("(prefers-reduced-motion: reduce)").matches,
      fieldDisplay: fieldScan.display,
      fieldVisibility: fieldScan.visibility,
    };
  });
  if (!scanBars.performanceMode && !scanBars.reducedMotion) {
    expect(scanBars.panelAnimation).toContain("homeHeroScanBars");
  }
  expect(parseFloat(scanBars.panelHeight)).toBeGreaterThan(0);
  expect(scanBars.panelBackground).not.toBe("none");
  expect(scanBars.fieldDisplay).not.toBe("none");
  expect(scanBars.fieldVisibility).toBe("visible");
  await expect.poll(() => page.locator(".hero-copy").evaluate((hero) => Number(getComputedStyle(hero, "::before").opacity))).toBeGreaterThan(0.5);
  await expect.poll(() => heroFilm.evaluate((video) => Number(video.dataset.lmPlayAttempts || "0"))).toBeGreaterThan(0);
  await expect(page.locator("[data-home-hero-sound]")).toBeVisible();
  expect(await page.evaluate(() => window.__lmStartupDelay)).toBeUndefined();
  await page.waitForTimeout(1_500);
  await expect(page.locator("[data-startup-video]")).toHaveCount(0);
  expect(removedCommercialRequests).toEqual([]);
  expect(soundtrackRequests).toEqual([]);
  await expect.poll(() => heroFilm.evaluate((video) => ({ muted: video.muted, paused: video.paused }))).toEqual({ muted: true, paused: false });

  await page.locator("[data-home-hero-sound]").click();
  await expect.poll(() => heroFilm.evaluate((video) => ({ muted: video.muted, paused: video.paused }))).toEqual({ muted: false, paused: false });
  expect(soundtrackRequests).toEqual([]);
});

test("membership hero film autoplays muted without an entry popup and enables sound on request", async ({ page }) => {
  const filmRequests = [];
  const soundtrackRequests = [];
  page.on("request", (request) => {
    if (/assets\/merch\/.*commercial.*\.mp4/i.test(request.url())) filmRequests.push(request.url());
    if (/home-screen-song\.mp3/i.test(request.url())) soundtrackRequests.push(request.url());
  });

  await page.goto("/memberships.html", { waitUntil: "domcontentloaded" });
  const commercial = page.locator("[data-membership-commercial-modal]");
  const featuredFilm = page.locator("[data-membership-featured-commercial]");
  await expect(commercial).toBeHidden();
  await expect(page.locator(".lm-temporal-loader")).toHaveCount(0);
  await expect(featuredFilm).toBeVisible();
  await featuredFilm.scrollIntoViewIfNeeded();
  await expect.poll(() => filmRequests.length).toBeGreaterThan(0);
  expect(soundtrackRequests).toEqual([]);
  await expect(page.locator("[data-membership-featured-sound]")).toHaveText("Play with sound");
  await expect.poll(() => featuredFilm.evaluate((video) => ({ muted: video.muted, paused: video.paused }))).toEqual({ muted: true, paused: false });

  await page.locator("[data-membership-featured-sound]").click();
  await expect.poll(() => featuredFilm.evaluate((video) => video.muted)).toBe(false);
  await expect.poll(() => page.locator("#lmMembership").getAttribute("data-audio-reactive-source")).toBe("featured-commercial");
  await expect.poll(() => page.locator("#lmMembership").evaluate((node) =>
    Number.parseFloat(node.style.getPropertyValue("--lm-membership-audio-energy")) || 0
  )).toBeGreaterThan(0.05);
});

test("Guardian card uses the supplied gun-range commercial", async ({ page }) => {
  const filmRequests = [];
  page.on("request", (request) => {
    if (/lottomind-guardian-commercial-clip-on-20260716\.mp4/i.test(request.url())) filmRequests.push(request.url());
  });
  await page.goto("/memberships.html", { waitUntil: "domcontentloaded" });
  const video = page.locator(".membership-guardian-bottom [data-membership-hero-commercial]");
  await video.scrollIntoViewIfNeeded();
  await expect(video.locator("source")).toHaveAttribute(
    "data-src",
    /lottomind-guardian-commercial-clip-on-20260716\.mp4$/,
  );
  await expect(video).toHaveAttribute(
    "poster",
    /lottomind-guardian-commercial-gun-range-poster-20260722\.jpg$/,
  );
  await expect(video).toHaveAttribute("autoplay", "");
  await expect(video).toHaveAttribute("preload", "metadata");
  await expect.poll(() => filmRequests.length).toBeGreaterThan(0);
  await expect.poll(() => video.evaluate((node) => ({ muted: node.muted, paused: node.paused }))).toEqual({ muted: true, paused: false });
});

test("Vault Pass displays the approved one-time price and included Luggage Charm", async ({ page }) => {
  await page.goto("/memberships.html", { waitUntil: "domcontentloaded" });
  const vault = page.locator('[data-lm-tier="vault"]');
  await expect(vault.locator("h3")).toHaveText("$29.99");
  await expect(vault).toContainText("Little Man Luggage Charm included");
  await expect(vault.locator('[data-stripe-lookup-key="vault_founder_once"]')).toHaveCount(1);
});

test("route commercial gate starts muted and enables sound on request", async ({ page }) => {
  const filmRequests = [];
  page.on("request", (request) => {
    if (/assets\/merch\/.*commercial.*\.mp4/i.test(request.url())) filmRequests.push(request.url());
  });

  await page.goto("/how-to-use.html", { waitUntil: "domcontentloaded" });
  const gate = page.locator(".lm-commercial-gate");
  await expect(gate).toBeVisible();
  await expect.poll(() => filmRequests.length).toBeGreaterThan(0);
  await expect(gate.locator(".lm-commercial-gate__sound")).toHaveText("Play with sound");
  await expect.poll(() => gate.locator("video").evaluate((video) => ({ muted: video.muted, paused: video.paused }))).toEqual({ muted: true, paused: false });

  await gate.locator(".lm-commercial-gate__sound").click();
  await expect.poll(() => gate.locator("video").evaluate((video) => video.muted)).toBe(false);

});

test("Features staging preserves the cinematic identity and playable Arcade directory", async ({ page }) => {
  await blockHeavyMedia(page);
  await page.goto("/features-app.html", { waitUntil: "domcontentloaded" });

  await expect(page.locator("[data-lm-staging-banner]")).toHaveText("LottoMind Upgrade Preview — Not Production");
  await expect(page.locator('meta[name="robots"]')).toHaveAttribute("content", "noindex,nofollow,noarchive");
  const gate = page.locator(".lm-commercial-gate");
  await expect(gate).toBeVisible();
  await expect.poll(() => gate.locator("video").evaluate((video) => video.muted)).toBe(true);
  await gate.locator(".lm-commercial-gate__skip").click();

  await expect(page.locator(".arcade-pilot-label")).toHaveText("LottoMind Features / Arcade + Creative Systems");
  await expect(page.locator('.arcade-pilot-hero__art[src*="lottomind-little-man-membership-hero-v2.png"]')).toBeVisible();
  await expect(page.locator("#featureEntity.feature-entity")).toHaveCount(1);
  await expect(page.locator("[data-shape]")).toHaveCount(8);
  await expect.poll(() => page.evaluate(() => document.body.classList.contains("feature-entity-ready"))).toBe(true);
  expect(await page.locator("#arcade-title").evaluate((title) => getComputedStyle(title).fontFamily)).not.toMatch(/Impact/i);
  await expect(page.locator(".feature-channel")).toHaveCount(5);
  await expect(page.locator("[data-arcade-grid] .arcade-game-card")).toHaveCount(8);
  await expect(page.locator(".arcade-game-card__status")).toHaveText(Array(8).fill("Playable"));

  await page.getByRole("button", { name: "Action", exact: true }).click();
  await expect(page.locator("[data-arcade-grid] .arcade-game-card")).toHaveCount(3);
  await expect(page.locator("[data-arcade-visible-count]")).toHaveText("3");
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth + 1)).toBe(true);
});

test("merch route and click-opened commercial use the safe sound handoff", async ({ page }) => {
  const filmRequests = [];
  page.on("request", (request) => {
    if (/lottomind-community-signal-commercial-20260717\.mp4/i.test(request.url())) {
      filmRequests.push(request.url());
    }
  });

  await page.goto("/merch-store.html", { waitUntil: "domcontentloaded" });
  const gate = page.locator(".lm-commercial-gate");
  await expect(gate).toBeVisible();
  await expect.poll(() => filmRequests.length).toBeGreaterThan(0);
  await expect.poll(() => gate.locator("video").evaluate((video) => video.muted)).toBe(true);
  await gate.locator(".lm-commercial-gate__skip").click();
  await expect(gate).toBeHidden();
  const capsuleFilm = page.locator("[data-merch-sound-video]");
  await expect.poll(() => capsuleFilm.evaluate((video) => ({ muted: video.muted, paused: video.paused }))).toEqual({ muted: true, paused: false });
  await expect(page.locator("[data-merch-sound-toggle]")).toHaveText("Play sound");
  await expect(page.getByRole("button", { name: "Preorder", exact: true })).toHaveCount(10);
  await page.getByRole("button", { name: "Preorder", exact: true }).first().evaluate((button) => button.click());
  await expect(page.locator("[data-bag-drawer]")).toHaveClass(/is-open/);
  await expect(page.locator("[data-cart-note]")).toContainText("No order or payment was submitted");
  await expect(page.locator("footer.site-footer-standard .site-legal-links a")).toHaveCount(4);
  await page.locator("[data-bag-close]").evaluate((button) => button.click());

  await page.locator("[data-merch-commercial-open]").evaluate((button) => button.click());
  const modal = page.locator("[data-merch-commercial-modal]");
  await expect(modal).toBeVisible();
  await expect.poll(() => modal.locator("video").evaluate((video) => ({ muted: video.muted, paused: video.paused }))).toEqual({ muted: false, paused: false });
});

test("Live Events renders a complete channel hub without invented live or commerce data", async ({ page }) => {
  await page.addInitScript(() => {
    const originalPlay = HTMLMediaElement.prototype.play;
    HTMLMediaElement.prototype.play = function (...args) {
      this.dataset.lmPlayAttempts = String(Number(this.dataset.lmPlayAttempts || "0") + 1);
      return originalPlay.apply(this, args);
    };
  });
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
  await expect.poll(() => page.locator("[data-live-hero-film-audio]").evaluate((audio) => Number(audio.dataset.lmPlayAttempts || "0"))).toBeGreaterThan(0);
  await expect(page.locator("[data-live-hero-film-video]")).toHaveAttribute("data-sound-state", /^(?:blocked|playing|ready)$/);
  await expect(page.locator("[data-live-hero-film-audio]")).toHaveAttribute("loop", "");
});

test("Shadow Ops defers campaign assets until the run starts", async ({ page }) => {
  const assetRequests = [];
  page.on("request", (request) => {
    if (/shadow-ops-canvas\/assets\//i.test(request.url())) assetRequests.push(request.url());
  });

  await page.goto("/games/shadow-ops-canvas/", { waitUntil: "domcontentloaded" });
  await expect(page.getByRole("heading", { name: "ROBOT RAHBE" })).toBeVisible();
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
  await expect(page.locator(".article-grid .news-card__media img").first()).toBeVisible();
  await expect.poll(() => page.locator(".article-grid .news-card__media img").first().evaluate((image) => image.complete && image.naturalWidth > 0)).toBe(true);
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
