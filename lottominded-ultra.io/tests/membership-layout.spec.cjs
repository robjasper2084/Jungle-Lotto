const { test, expect } = require("@playwright/test");

async function prepareMembershipPage(page) {
  await page.route(/\.(?:mp3|mp4|wav|webm)(?:\?.*)?$/i, (route) => route.fulfill({ status: 204, body: "" }));
  await page.route(/https:\/\/sqdasdbvlkgpbbiyeune\.supabase\.co\/functions\/v1\/lottomind-api.*/i, (route) =>
    route.fulfill({ status: 503, contentType: "application/json", body: '{"error":{"message":"Layout test backend offline"}}' })
  );
  await page.goto("/memberships.html", { waitUntil: "domcontentloaded" });
  await page.locator("[data-membership-commercial-close]").click();
}

test("membership deck leads the page and keeps Vault beside Ultra on desktop", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "desktop-chromium", "Responsive layout is covered once from the desktop project.");
  await page.setViewportSize({ width: 1440, height: 900 });
  await prepareMembershipPage(page);

  const deck = page.locator("#membership-plans");
  const hero = page.locator("#dust");
  const collector = page.locator(".membership-support-card--collector");
  const guardian = page.locator(".membership-support-card--guardian");
  const ultra = page.locator('[data-lm-tier="ultra"]');
  const vault = page.locator('[data-lm-tier="vault"]');
  const [deckBox, heroBox, collectorBox, guardianBox, ultraBox, vaultBox] = await Promise.all([
    deck.boundingBox(),
    hero.boundingBox(),
    collector.boundingBox(),
    guardian.boundingBox(),
    ultra.boundingBox(),
    vault.boundingBox(),
  ]);

  expect(deckBox).not.toBeNull();
  expect(heroBox).not.toBeNull();
  expect(collectorBox).not.toBeNull();
  expect(guardianBox).not.toBeNull();
  expect(ultraBox).not.toBeNull();
  expect(vaultBox).not.toBeNull();
  const deckPrecedesHeroInDom = await deck.evaluate((node) =>
    Boolean(node.compareDocumentPosition(document.querySelector("#dust")) & Node.DOCUMENT_POSITION_FOLLOWING)
  );
  const collectorPrecedesGuardianInDom = await collector.evaluate((node) =>
    Boolean(node.compareDocumentPosition(document.querySelector(".membership-support-card--guardian")) & Node.DOCUMENT_POSITION_FOLLOWING)
  );
  expect(deckPrecedesHeroInDom).toBe(true);
  expect(collectorPrecedesGuardianInDom).toBe(true);
  expect(deckBox.y).toBeLessThan(heroBox.y);
  expect(Math.abs(collectorBox.y - guardianBox.y)).toBeLessThan(2);
  expect(collectorBox.x).toBeLessThan(guardianBox.x);
  expect(Math.abs(ultraBox.y - vaultBox.y)).toBeLessThan(2);
  expect(vaultBox.x).toBeGreaterThan(ultraBox.x);

  await page.setViewportSize({ width: 390, height: 844 });
  const [mobileDeckBox, mobileHeroBox, mobileCollectorBox, mobileGuardianBox, mobileUltraBox, mobileVaultBox] = await Promise.all([
    deck.boundingBox(),
    hero.boundingBox(),
    collector.boundingBox(),
    guardian.boundingBox(),
    ultra.boundingBox(),
    vault.boundingBox(),
  ]);
  const mobileWidths = await page.evaluate(() => ({
    viewport: document.documentElement.clientWidth,
    content: document.documentElement.scrollWidth,
  }));

  expect(mobileDeckBox.y).toBeLessThan(mobileHeroBox.y);
  expect(mobileGuardianBox.y).toBeGreaterThan(mobileCollectorBox.y);
  expect(mobileVaultBox.y).toBeGreaterThan(mobileUltraBox.y);
  expect(mobileWidths.content).toBeLessThanOrEqual(mobileWidths.viewport);
});
