const { readFileSync } = require("node:fs");
const { join } = require("node:path");
const { test, expect } = require("@playwright/test");

const root = join(__dirname, "..");
const manifest = JSON.parse(readFileSync(join(root, "games", "games-manifest.json"), "utf8"));

test("Arcade and Memberships render the same verified manifest routes", async ({ page, request }) => {
  await page.goto("/features-app.html", { waitUntil: "domcontentloaded" });
  await expect(page.locator("[data-arcade-grid] .arcade-game-card")).toHaveCount(manifest.games.length);
  await expect(page.locator("[data-arcade-count]")).toHaveText(String(manifest.games.length));
  await expect(page.locator("[data-arcade-visible-count]")).toHaveText(String(manifest.games.length));
  await expect(page.locator("[data-arcade-last-checked]")).toContainText(manifest.lastChecked);
  await expect(page.locator("[data-arcade-load-error]")).toBeHidden();

  for (const game of manifest.games) {
    const response = await request.get(game.route);
    expect(response.ok(), `${game.title} should open at ${game.route}`).toBe(true);
  }

  await page.goto("/memberships.html", { waitUntil: "domcontentloaded" });
  await expect(page.locator("[data-lm-worlds-track] .lm-world-game-card")).toHaveCount(manifest.games.length);
  await expect(page.locator("[data-membership-game-count]")).toHaveText(String(manifest.games.length));
  await expect(page.locator("[data-membership-games-checked]")).toContainText(manifest.lastChecked);
});

test("Arcade shows checked fallback cards and recovers on retry", async ({ page }) => {
  const manifestPattern = /\/games\/games-manifest\.json(?:\?.*)?$/;
  await page.route(manifestPattern, (route) => route.abort("failed"));
  await page.goto("/features-app.html", { waitUntil: "domcontentloaded" });

  await expect(page.locator("[data-arcade-load-error]")).toBeVisible();
  await expect(page.locator("[data-arcade-load-error]")).toContainText("Unable to load games");
  await expect(page.locator("[data-arcade-grid] .arcade-game-card")).toHaveCount(manifest.games.length);
  await expect(page.locator("[data-arcade-count]")).toHaveText(String(manifest.games.length));

  await page.unroute(manifestPattern);
  await page.locator("[data-arcade-retry]").click();
  await expect(page.locator("[data-arcade-load-error]")).toBeHidden();
  await expect(page.locator("[data-arcade-last-checked]")).toContainText(manifest.lastChecked);
});

test("Memberships has no independently maintained game cards", async () => {
  const source = readFileSync(join(root, "memberships.html"), "utf8");
  expect(source).not.toMatch(/<a class="lm-epoch-card lm-world-game-card"/);
  expect(source).toContain("lm-membership-games.js");
});
