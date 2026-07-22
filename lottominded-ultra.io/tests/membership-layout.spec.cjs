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
  const ultra = page.locator('[data-lm-tier="ultra"]');
  const vault = page.locator('[data-lm-tier="vault"]');
  const [deckBox, heroBox, ultraBox, vaultBox] = await Promise.all([
    deck.boundingBox(),
    hero.boundingBox(),
    ultra.boundingBox(),
    vault.boundingBox(),
  ]);

  expect(deckBox).not.toBeNull();
  expect(heroBox).not.toBeNull();
  expect(ultraBox).not.toBeNull();
  expect(vaultBox).not.toBeNull();
  const deckPrecedesHeroInDom = await deck.evaluate((node) =>
    Boolean(node.compareDocumentPosition(document.querySelector("#dust")) & Node.DOCUMENT_POSITION_FOLLOWING)
  );
  expect(deckPrecedesHeroInDom).toBe(true);
  expect(deckBox.y).toBeLessThan(heroBox.y);
  expect(Math.abs(ultraBox.y - vaultBox.y)).toBeLessThan(2);
  expect(vaultBox.x).toBeGreaterThan(ultraBox.x);

  await page.setViewportSize({ width: 390, height: 844 });
  const [mobileDeckBox, mobileHeroBox, mobileUltraBox, mobileVaultBox] = await Promise.all([
    deck.boundingBox(),
    hero.boundingBox(),
    ultra.boundingBox(),
    vault.boundingBox(),
  ]);
  const mobileWidths = await page.evaluate(() => ({
    viewport: document.documentElement.clientWidth,
    content: document.documentElement.scrollWidth,
  }));

  expect(mobileDeckBox.y).toBeLessThan(mobileHeroBox.y);
  expect(mobileVaultBox.y).toBeGreaterThan(mobileUltraBox.y);
  expect(mobileWidths.content).toBeLessThanOrEqual(mobileWidths.viewport);
});
