const { test, expect } = require("@playwright/test");

test.describe("LottoMind Trivia Vault", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/games/lottomind-trivia/", { waitUntil: "domcontentloaded" });
  });

  test("launcher exposes four playable modes and the static safety state", async ({ page }) => {
    await expect(page).toHaveTitle(/LottoMind Trivia Vault/);
    await expect(page.locator("[data-screen=launcher]")).toBeVisible();
    await expect(page.locator("[data-start-mode]")).toHaveCount(3);
    await expect(page.locator("[data-open-category]")).toBeVisible();
    await expect(page.locator("[data-service-state]")).toContainText("no LottoCredits are issued");
  });

  test("Quick Play accepts keyboard answers and shows reviewed feedback", async ({ page }) => {
    await page.locator('[data-start-mode="quick"]').click();
    await expect(page.locator("[data-screen=play]")).toBeVisible();
    await expect(page.locator("[data-choices] button")).toHaveCount(4);
    await page.keyboard.press("1");
    await expect(page.locator("[data-feedback]")).toBeVisible();
    await expect(page.locator("[data-feedback-explanation]")).not.toBeEmpty();
    await expect(page.locator("[data-choices] button:disabled")).toHaveCount(4);
  });

  test("Category Run opens an accessible selector and starts the chosen channel", async ({ page }) => {
    await page.locator("[data-open-category]").click();
    await expect(page.locator("[data-category-dialog]")).toBeVisible();
    await page.locator('[data-category="detroit-history-culture"]').click();
    await expect(page.locator("[data-mode-label]")).toHaveText("Category Run");
    await expect(page.locator("span[data-category]")).toHaveText("Detroit History and Culture");
  });

  test("leaderboards never invent rankings when secure services are unavailable", async ({ page }) => {
    await page.locator("[data-open-leaderboards]").click();
    await expect(page.locator("[data-leaderboard-status]")).toContainText("No names, ranks, or community activity are invented");
    await expect(page.locator("[data-leaderboards] tbody tr")).toHaveCount(0);
  });
});
