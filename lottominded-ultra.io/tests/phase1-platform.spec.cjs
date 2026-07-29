const { readFileSync } = require("node:fs");
const { join } = require("node:path");
const { test, expect } = require("@playwright/test");

const root = join(__dirname, "..");
const manifest = JSON.parse(readFileSync(join(root, "data", "site-routes.json"), "utf8"));

async function blockHeavyMedia(page) {
  await page.route(/\.(?:mp4|webm|mp3|wav|ogg)(?:\?.*)?$/i, (route) =>
    route.fulfill({ status: 204, contentType: "application/octet-stream", body: "" })
  );
}

async function dismissCommercial(page) {
  const gate = page.locator(".lm-commercial-gate");
  await gate.waitFor({ state: "attached", timeout: 3_000 }).catch(() => {});
  if (await gate.count()) {
    await expect(gate).toBeVisible({ timeout: 15_000 });
    await gate.locator(".lm-commercial-gate__skip").click();
    await expect(gate).toBeHidden();
    await expect(page.locator("body")).not.toHaveClass(/has-lm-commercial-gate/, { timeout: 5_000 });
  }
}

test("route manifest defines the Phase 1 platform contract", () => {
  const ids = manifest.routes.map((route) => route.id);
  expect(new Set(ids).size).toBe(ids.length);
  expect(manifest.routes.filter((route) => route.desktopNav).map((route) => route.label)).toEqual([
    "Home",
    "App",
    "Arcade",
    "News + Events",
    "Store",
    "Membership",
  ]);
  expect(manifest.routes.some((route) => route.id === "studio")).toBe(false);
  expect(manifest.routes.find((route) => route.id === "account").indexable).toBe(false);
  expect(manifest.routes.find((route) => route.id === "arcade").aliases).toContain("./features-app.html");
});

test("legacy Features URL preserves query and hash while redirecting to Arcade", async ({ page }) => {
  await page.goto("/features-app.html?source=legacy#arcade-library", { waitUntil: "domcontentloaded" });
  await page.waitForURL(/\/arcade\.html\?source=legacy#arcade-library$/);
  await expect(page.locator("h1")).toContainText("Ultra Arcade");
});

test("command palette supports keyboard route search and focus return", async ({ page }, testInfo) => {
  await blockHeavyMedia(page);
  await page.goto("/features.html", { waitUntil: "domcontentloaded" });

  const trigger = page.locator("[data-command-search-open]");
  await trigger.focus();
  await page.keyboard.press("Control+K");
  const dialog = page.locator(".lm-command-palette");
  await expect(dialog).toBeVisible();
  await expect(page.locator("[data-command-search-input]")).toBeFocused();
  await page.locator("[data-command-search-input]").fill("RAHBE");
  await expect(page.locator("[data-command-result]")).toHaveCount(2);
  await expect(page.locator('[data-command-result][href$="robot-rahbe.html"]')).toContainText("Robot RAHBE");
  await page.keyboard.press("Escape");
  await expect(dialog).toBeHidden();
  if (!testInfo.project.name.startsWith("mobile")) await expect(trigger).toBeFocused();
});

test("mobile shell exposes five stable primary destinations without overflow", async ({ page }, testInfo) => {
  test.skip(!testInfo.project.name.startsWith("mobile"), "Mobile shell assertion");
  await blockHeavyMedia(page);
  await page.goto("/features.html", { waitUntil: "domcontentloaded" });
  const nav = page.locator(".lm-mobile-bottom-nav");
  await expect(nav.locator(":scope > a")).toHaveText(["Home", "App", "Play", "Help", "Account"]);
  await expect(nav).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth + 1)).toBe(true);
});

test("Help Center search, categories, and deep links remain usable", async ({ page }) => {
  await blockHeavyMedia(page);
  await page.goto("/how-to-use.html#robot-rahbe", { waitUntil: "domcontentloaded" });
  await expect(page.locator(".lm-commercial-gate")).toBeVisible({ timeout: 15_000 });
  await dismissCommercial(page);
  await expect(page.locator("#robot-rahbe")).toHaveAttribute("open", "");

  await page.locator("[data-help-search]").fill("LottoCredits");
  await expect(page.locator(".lm-help-article:not([hidden])")).toHaveCount(1);
  await expect(page.locator("[data-help-status]")).toContainText("1 help topic");

  await page.locator("[data-help-search]").fill("");
  await page.getByRole("button", { name: "Accessibility", exact: true }).click();
  await expect(page.locator(".lm-help-article:not([hidden])")).toHaveCount(1);
  await expect(page.locator("#accessibility")).toBeVisible();
});

test("canonical game launchers preserve games, controls, and commercial behavior", async ({ page }) => {
  await blockHeavyMedia(page);

  await page.goto("/static-wave.html", { waitUntil: "domcontentloaded" });
  await expect(page.locator(".lm-commercial-gate")).toBeVisible();
  await dismissCommercial(page);
  await expect(page.locator("[data-static-wave-frame]")).toHaveAttribute("src", /opengw-levels/);
  await expect(page.locator("[data-launcher-fullscreen]")).toBeVisible();
  await expect(page.locator(".header-click-toggle")).toBeVisible();

  await page.goto("/robot-rahbe.html", { waitUntil: "domcontentloaded" });
  await expect(page.locator(".lm-commercial-gate")).toBeVisible();
  await dismissCommercial(page);
  await expect(page.locator("[data-beat2-game-frame]")).toHaveAttribute("src", /shadow-ops-canvas/);
  await expect(page.locator("[data-launcher-fullscreen]")).toBeVisible();
  await expect(page.locator(".header-click-toggle")).toBeVisible();
});

test("Beat2Lotto+ owns the generator and Prompt Lab links to it", async ({ page }) => {
  await blockHeavyMedia(page);
  await page.goto("/beat2lotto-plus.html", { waitUntil: "domcontentloaded" });
  await expect(page.locator(".beat2lotto-console")).toHaveCount(1);
  await page.locator("#lottoCount").fill("3");
  await page.locator("#generateLotto").click();
  await expect(page.locator("#lottoOutput .lotto-set-card")).toHaveCount(3);

  await page.goto("/prompt-lab.html#beat2lotto", { waitUntil: "domcontentloaded" });
  await expect(page.locator("#beat2lotto .beat2lotto-console")).toHaveCount(0);
  await expect(page.locator('#beat2lotto a[href="./beat2lotto-plus.html"]')).toBeVisible();
});

test("Account hub clearly separates signed-out and verified states", async ({ page }) => {
  await page.addInitScript(() => {
    window.LottoMindAccountService = {
      getSnapshot: async () => ({ authenticated: false, offline: true }),
      subscribeToWallet: () => () => {},
    };
  });
  await page.goto("/account.html", { waitUntil: "domcontentloaded" });
  await expect(page.locator('meta[name="robots"]')).toHaveAttribute("content", /noindex/);
  await expect(page.locator("[data-account-signed-out]")).toBeVisible();
  await expect(page.locator("[data-account-status]")).toContainText("verification is offline");
  await expect(page.locator("[data-account-signed-in]")).toBeHidden();
});
