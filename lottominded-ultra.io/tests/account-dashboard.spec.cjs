const { test, expect } = require("@playwright/test");

async function blockMedia(page) {
  await page.route(/\.(?:mp4|webm|mp3|wav)(?:\?.*)?$/i, (route) => route.abort());
}

test("account dashboard keeps verified and device-only data boundaries clear", async ({ page }) => {
  await blockMedia(page);
  await page.addInitScript(() => {
    localStorage.setItem("lottomind.oracle.real.history.v1", JSON.stringify([
      { id: "set-1", gameName: "Powerball", numbers: [3, 12, 28, 41, 59], createdAt: "2026-08-05T12:00:00Z" },
    ]));
    localStorage.setItem("lottomind.oracle.real.dreams.v1", JSON.stringify([
      { id: "dream-1", title: "Dream meaning unlocked", tone: "Opportunity", createdAt: "2026-08-05T12:00:00Z" },
    ]));
    localStorage.setItem("lottomindArcadeRecent", JSON.stringify(["jackpot-maze"]));
  });

  await page.goto("/account.html", { waitUntil: "domcontentloaded" });

  await expect(page.getByRole("heading", { name: "Your plan, credits, and recent signals." })).toBeVisible();
  await expect(page.locator("[data-dashboard-plan-name]")).toHaveText("Sign in to verify");
  await expect(page.locator("[data-dashboard-credit-balance]")).toHaveText("--");
  await expect(page.locator("[data-dashboard-saved-count]")).toHaveText("1 saved");
  await expect(page.locator("[data-dashboard-saved-list]")).toContainText("Powerball");
  await expect(page.locator("[data-dashboard-dream-list]")).toContainText("Dream meaning unlocked");
  await expect(page.locator("[data-dashboard-recent-list]")).toContainText("LottoMind: Jackpot Maze");
  await expect(page.getByText("local activity can help you continue where you left off", { exact: false })).toBeVisible();
});

test("connected account snapshot populates verified dashboard fields", async ({ page }) => {
  await blockMedia(page);
  await page.addInitScript(() => {
    const snapshot = {
      authenticated: true,
      offline: false,
      user: { email: "collector@example.com" },
      wallet: { balance: 275 },
      memberships: [{ planCode: "ultra", status: "active", currentPeriodEnd: "2026-09-05T12:00:00Z" }],
      collector: { redeemed: true, complimentaryUntil: "2026-11-05T12:00:00Z" },
    };
    window.LottoMindAccountService = {
      getSnapshot: async () => snapshot,
      subscribeToWallet: (callback) => {
        callback(snapshot);
        return () => {};
      },
      isConfigured: () => true,
    };
  });

  await page.goto("/account.html", { waitUntil: "domcontentloaded" });

  await expect(page.locator("[data-dashboard-plan-name]")).toHaveText("Ultra");
  await expect(page.locator("[data-dashboard-plan-detail]")).toContainText("active");
  await expect(page.locator("[data-dashboard-credit-balance]")).toHaveText("275");
  await expect(page.locator("[data-dashboard-collector-state]")).toHaveText("Guardian linked");
});

test("account dashboard remains usable at 390 by 844", async ({ page }) => {
  await blockMedia(page);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/account.html#account-dashboard-title", { waitUntil: "domcontentloaded" });

  await expect(page.locator(".lm-account-dashboard__grid")).toHaveCSS("grid-template-columns", "358px");
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(overflow).toBeLessThanOrEqual(1);
  await expect(page.locator("#credits")).toBeVisible();
});

test("account dashboard keeps the Robot RAHBEE depth treatment", async ({ page }) => {
  await blockMedia(page);
  await page.goto("/account.html", { waitUntil: "domcontentloaded" });

  const depth = await page.locator("body").evaluate((element) => ({
    background: getComputedStyle(element).backgroundImage,
    before: getComputedStyle(element, "::before").backgroundImage,
  }));
  expect(depth.background).toContain("startup-3d-mid.webp");
  expect(depth.before).toContain("startup-3d-emissive.webp");

  const cards = page.locator(".lm-dashboard-card");
  await expect(cards).toHaveCount(6);
  const cardStyle = await cards.first().evaluate((element) => {
    const styles = getComputedStyle(element);
    return { background: styles.backgroundImage, shadow: styles.boxShadow, transformStyle: styles.transformStyle };
  });
  expect(cardStyle.background).not.toBe("none");
  expect(cardStyle.shadow).not.toBe("none");
  expect(cardStyle.transformStyle).toBe("preserve-3d");
});
