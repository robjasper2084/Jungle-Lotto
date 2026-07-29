const { test, expect } = require("@playwright/test");

async function openHome(page) {
  await page.route(/\.(?:mp3|mp4|wav|webm)(?:\?.*)?$/i, (route) => route.fulfill({ status: 204, body: "" }));
  await page.goto("/index.html#top", { waitUntil: "domcontentloaded" });
  await page.waitForLoadState("networkidle").catch(() => {});
  await page.waitForTimeout(1_200);

  const startup = page.locator("[data-startup-video]");
  if (await startup.isVisible().catch(() => false)) {
    await page.locator("[data-startup-video-close]").last().click();
  }
  await expect(startup).toBeHidden();
  await expect(page.locator("body.home-page")).toBeVisible();
}

test("homepage has no console errors, broken images, or removed healing widget", async ({ page }) => {
  const consoleErrors = [];
  page.on("console", (message) => {
    if (message.type() === "error") consoleErrors.push(message.text());
  });

  await openHome(page);
  await expect(page.locator("aside.lm-healing-generator")).toHaveCount(0);

  const brokenImages = await page.locator("img").evaluateAll((images) =>
    images.filter((image) => image.complete && image.naturalWidth === 0).map((image) => image.currentSrc || image.src)
  );
  expect(brokenImages).toEqual([]);
  expect(consoleErrors).toEqual([]);
});

test("HUD menu routes Home correctly and the visible close button works", async ({ page }) => {
  await openHome(page);
  await page.locator("[data-universal-menu-toggle]").click();

  const menu = page.locator("#universalPageMenu");
  const home = menu.locator('a[href$="index.html#top"]').first();
  await expect(menu).toHaveClass(/is-open/);
  await expect(home).toHaveAttribute("href", /\/index\.html#top$/);
  await expect(home).toHaveClass(/is-active/);

  await menu.getByRole("button", { name: "Close page menu" }).click();
  await expect(menu).not.toHaveClass(/is-open/);
  await expect(page.locator("[data-universal-menu-toggle]")).toHaveAttribute("aria-expanded", "false");
});

test("kinetic headings expose one clean accessible name", async ({ page }) => {
  await openHome(page);
  const names = [
    "Lottery Spheres in Motion",
    "Turn ideas into your LottoMind app flow.",
    "Enter the LottoMind Refined App"
  ];
  for (const name of names) {
    await expect(page.getByRole("heading", { name, exact: true })).toHaveAccessibleName(name);
  }
});

test("bridge headings wrap only between words", async ({ page }) => {
  await openHome(page);
  const splitWords = await page.locator(".refined-bridge-grid h3").evaluateAll((headings) => {
    const broken = [];
    for (const heading of headings) {
      const node = heading.firstChild;
      if (!node || node.nodeType !== Node.TEXT_NODE) continue;
      const text = node.textContent || "";
      for (const match of text.matchAll(/[A-Za-z0-9+]+/g)) {
        const range = document.createRange();
        range.setStart(node, match.index);
        range.setEnd(node, match.index + match[0].length);
        if (range.getClientRects().length > 1) broken.push(match[0]);
      }
    }
    return broken;
  });
  expect(splitWords).toEqual([]);
});

test("mobile fixed controls do not cover the first hero action", async ({ page }, testInfo) => {
  test.skip(!testInfo.project.name.startsWith("mobile"), "Mobile layout assertion");
  await openHome(page);

  const overlapRatio = await page.evaluate(() => {
    const badge = document.querySelector(".vault-credit-badge")?.getBoundingClientRect();
    const action = document.querySelector(".hero-actions a")?.getBoundingClientRect();
    if (!badge || !action) return 0;
    const width = Math.max(0, Math.min(badge.right, action.right) - Math.max(badge.left, action.left));
    const height = Math.max(0, Math.min(badge.bottom, action.bottom) - Math.max(badge.top, action.top));
    return (width * height) / Math.max(1, action.width * action.height);
  });
  expect(overlapRatio).toBeLessThan(0.05);
});

test("mobile Home anchor keeps the hero title below sticky chrome", async ({ page }, testInfo) => {
  test.skip(!testInfo.project.name.startsWith("mobile"), "Mobile layout assertion");
  await openHome(page);

  const positions = await page.evaluate(() => ({
    scrollY: Math.round(window.scrollY),
    headingTop: document.querySelector(".hero-copy h1")?.getBoundingClientRect().top ?? -1,
    marqueeBottom: document.querySelector(".home-signal-marquee")?.getBoundingClientRect().bottom ?? 0
  }));
  expect(positions.scrollY).toBe(0);
  expect(positions.headingTop).toBeGreaterThanOrEqual(positions.marqueeBottom);
});

test("mobile app anchor lands below sticky page chrome", async ({ page }, testInfo) => {
  test.skip(!testInfo.project.name.startsWith("mobile"), "Mobile layout assertion");
  await openHome(page);
  await page.locator('a[href="#lottomind-refined"]').click();
  await page.waitForTimeout(350);

  const positions = await page.evaluate(() => {
    const target = document.querySelector("#lottomind-refined")?.getBoundingClientRect();
    const chrome = [document.querySelector(".site-header"), document.querySelector(".home-signal-marquee")]
      .map((element) => element?.getBoundingClientRect())
      .filter(Boolean);
    return {
      targetTop: target?.top ?? -1,
      chromeBottom: Math.max(0, ...chrome.map((rect) => rect.bottom))
    };
  });
  expect(positions.targetTop).toBeGreaterThanOrEqual(positions.chromeBottom - 2);
});

test("mobile performance mode stops audited infinite animation families", async ({ page }, testInfo) => {
  test.skip(!testInfo.project.name.startsWith("mobile"), "Mobile performance assertion");
  await openHome(page);
  await expect(page.locator("html")).toHaveClass(/lm-mobile-performance/);

  const blockedAnimations = await page.evaluate(() => {
    const audited = new Set([
      "home-signal-marquee",
      "homeNavSignalSweep",
      "homeAppTextExplodeImpact",
      "lmEqualizer",
      "lmFloatOrb",
      "lmGlitch",
      "lmPulseGlow",
      "lmScanline",
      "lmTextReveal",
      "lmTextShine"
    ]);
    return document.getAnimations()
      .filter((animation) => animation.playState === "running" && audited.has(animation.animationName))
      .map((animation) => animation.animationName);
  });
  expect(blockedAnimations).toEqual([]);
});
