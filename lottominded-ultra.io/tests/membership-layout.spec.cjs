const { test, expect } = require("@playwright/test");

async function prepareMembershipPage(page) {
  await page.route(/\.(?:mp3|mp4|wav|webm)(?:\?.*)?$/i, (route) => route.fulfill({ status: 204, body: "" }));
  await page.route(/https:\/\/sqdasdbvlkgpbbiyeune\.supabase\.co\/functions\/v1\/lottomind-api.*/i, (route) =>
    route.fulfill({ status: 503, contentType: "application/json", body: '{"error":{"message":"Layout test backend offline"}}' })
  );
  await page.goto("/memberships.html", { waitUntil: "domcontentloaded" });
}

test("membership hero leads, Collector follows Gaming Showcase, and the Guardian offer closes the page", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "desktop-chromium", "Responsive layout is covered once from the desktop project.");
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.setViewportSize({ width: 1440, height: 900 });
  await prepareMembershipPage(page);

  await expect(page.locator("#lmMembership")).toHaveAttribute("data-audio-reactive-source", "disabled");
  const audioReactiveState = await page.evaluate(() => ({
    energy: window.__lmMembershipAudioEnergy,
    source: window.__lmMembershipAudioReactive?.source,
  }));
  expect(audioReactiveState).toEqual({ energy: 0, source: "disabled" });

  const deck = page.locator("#membership-plans");
  const hero = page.locator("#dust");
  const collector = page.locator(".membership-support-card--collector");
  const guardian = page.locator(".membership-support-card--guardian");
  const guardianSection = page.locator(".membership-guardian-bottom");
  const heroCommercial = page.locator("#dust .membership-hero-commercial");
  const showcase = page.locator("#worlds");
  const life = page.locator("#life");
  const ultra = page.locator('[data-lm-tier="ultra"]');
  const guardianBundle = page.locator('[data-lm-tier="guardian_bundle"]');
  const [deckBox, heroBox, collectorBox, guardianBox, showcaseBox, lifeBox, ultraBox, guardianBundleBox] = await Promise.all([
    deck.boundingBox(),
    hero.boundingBox(),
    collector.boundingBox(),
    guardian.boundingBox(),
    showcase.boundingBox(),
    life.boundingBox(),
    ultra.boundingBox(),
    guardianBundle.boundingBox(),
  ]);

  expect(deckBox).not.toBeNull();
  expect(heroBox).not.toBeNull();
  expect(collectorBox).not.toBeNull();
  expect(guardianBox).not.toBeNull();
  expect(showcaseBox).not.toBeNull();
  expect(lifeBox).not.toBeNull();
  await expect(heroCommercial).toBeVisible();
  await expect(heroCommercial.locator("video")).toHaveAttribute("poster", /membership-feature-commercial-poster/);
  expect(ultraBox).not.toBeNull();
  expect(guardianBundleBox).not.toBeNull();
  const heroPrecedesDeckInDom = await hero.evaluate((node) =>
    Boolean(node.compareDocumentPosition(document.querySelector("#membership-plans")) & Node.DOCUMENT_POSITION_FOLLOWING)
  );
  const guardianIsLastInMain = await guardianSection.evaluate((node) => {
    const sections = [...node.parentElement.querySelectorAll(":scope > section")];
    return sections.at(-1) === node;
  });
  expect(heroPrecedesDeckInDom).toBe(true);
  expect(guardianIsLastInMain).toBe(true);
  expect(await showcase.evaluate((node) =>
    Boolean(node.compareDocumentPosition(document.querySelector("#lm-access-hero")) & Node.DOCUMENT_POSITION_FOLLOWING)
  )).toBe(true);
  await expect(collector.locator("#plansTitle")).toHaveCount(1);
  await expect(page.locator("#membership-plans > .membership-plan-support-grid > *")).toHaveCount(0);
  await expect(page.locator("#membership-plans .membership-collectible-card")).toHaveCount(0);
  await expect(page.locator(".membership-comparison")).toBeVisible();
  await expect(page.locator(".membership-benefit-strip, #lm-credits, .membership-billing-tools")).toHaveCount(0);
  expect(heroBox.y).toBeLessThan(deckBox.y);
  expect(collectorBox.y).toBeGreaterThan(showcaseBox.y);
  expect(collectorBox.y).toBeLessThan(lifeBox.y);
  expect(guardianBox.y).toBeGreaterThan(lifeBox.y);
  expect(Math.abs(ultraBox.y - guardianBundleBox.y)).toBeLessThan(2);
  expect(guardianBundleBox.x).toBeGreaterThan(ultraBox.x);

  await page.setViewportSize({ width: 390, height: 844 });
  const [mobileDeckBox, mobileHeroBox, mobileCollectorBox, mobileGuardianBox, mobileShowcaseBox, mobileUltraBox, mobileGuardianBundleBox] = await Promise.all([
    deck.boundingBox(),
    hero.boundingBox(),
    collector.boundingBox(),
    guardian.boundingBox(),
    showcase.boundingBox(),
    ultra.boundingBox(),
    guardianBundle.boundingBox(),
  ]);
  const mobileWidths = await page.evaluate(() => ({
    viewport: document.documentElement.clientWidth,
    content: document.documentElement.scrollWidth,
  }));

  expect(mobileHeroBox.y).toBeLessThan(mobileDeckBox.y);
  expect(mobileCollectorBox.y).toBeGreaterThan(mobileShowcaseBox.y);
  expect(mobileGuardianBox.y).toBeGreaterThan(mobileCollectorBox.y);
  expect(mobileGuardianBundleBox.y).toBeGreaterThan(mobileUltraBox.y);
  expect(mobileWidths.content).toBeLessThanOrEqual(mobileWidths.viewport);
});
