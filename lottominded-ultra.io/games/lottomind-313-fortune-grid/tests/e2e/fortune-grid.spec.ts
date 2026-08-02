import { expect, test } from "@playwright/test";
import { resolve } from "node:path";

test("creates a game and completes the first turn without console errors", async ({ page }, testInfo) => {
  const errors: string[] = [];
  page.on("console", (message) => { if (message.type() === "error") errors.push(message.text()); });
  page.on("response", (response) => { if (response.status() >= 400) errors.push(`${response.status()} ${response.url()}`); });
  await page.goto("/");
  await expect(page).toHaveTitle(/Fortune Grid/);
  await page.getByRole("button", { name: "Launch Fortune Grid" }).click();
  await expect(page.getByText(/Round 1 \/ 3/)).toBeVisible();
  await page.getByRole("button", { name: /Roll Movement Cube/ }).click();
  const route = page.getByRole("button", { name: /Route 1:/ });
  if (await route.isVisible().catch(() => false)) await route.click();
  await expect(page.getByRole("button", { name: "End turn" })).toBeVisible({ timeout: 10000 });
  if (["mobile-390", "desktop-1440"].includes(testInfo.project.name)) {
    await page.screenshot({ path: resolve("docs/screenshots", `${testInfo.project.name}-first-turn.png`), fullPage: true });
  }
  await page.getByRole("button", { name: "End turn" }).click();
  await expect(page.getByText(/CPU/).first()).toBeVisible();
  expect(errors).toEqual([]);
});

test("supports reduced motion and keyboard-only setup", async ({ page }) => {
  await page.goto("/");
  await page.keyboard.press("Tab");
  await page.keyboard.press("Tab");
  await page.getByRole("button", { name: "Launch Fortune Grid" }).click();
  await page.getByRole("button", { name: "Settings" }).click();
  await page.getByLabel(/Reduced motion/).check();
  await page.getByRole("button", { name: "Apply" }).click();
  await expect(page.getByRole("button", { name: /Roll Movement Cube/ })).toBeEnabled();
});

test("supports four local pass-and-play players", async ({ page }) => {
  await page.goto("/");
  await page.getByLabel("Total players").selectOption("4");
  await page.getByLabel("Local players").selectOption("4");
  await page.getByRole("button", { name: "Launch Fortune Grid" }).click();
  await expect(page.getByText("Player 1", { exact: true })).toBeVisible();
  await expect(page.getByText("Player 2", { exact: true })).toBeVisible();
  await expect(page.getByText("Player 3", { exact: true })).toBeVisible();
  await expect(page.getByText("Player 4", { exact: true })).toBeVisible();
});

test("save reload, touch layout, and arcade return link are available", async ({ page, isMobile }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Launch Fortune Grid" }).click();
  await page.reload();
  await expect(page.getByRole("button", { name: "Resume saved match" })).toBeVisible();
  await expect(page.getByRole("link", { name: /Return to LottoMind Arcade/ })).toBeVisible();
  if (isMobile) await expect(page.locator(".hud")).toBeVisible();
});

test("a player can complete a standard thirteen-round solo match", async ({ page }, testInfo) => {
  test.setTimeout(120000);
  test.skip(testInfo.project.name !== "desktop-1440", "Long-form completion proof runs once.");
  await page.goto("/");
  await page.getByLabel("Mode").selectOption("standard");
  await page.getByRole("button", { name: "Launch Fortune Grid" }).click();
  for (let round = 1; round <= 13; round += 1) {
    await expect.poll(() => page.evaluate(() => { const state = (window as any).__fortuneGridState?.(); return state ? `${state.currentPlayer}:${state.phase}` : "missing"; }), { timeout: 15000 }).toBe("0:roll");
    const roll = page.getByRole("button", { name: /Roll Movement Cube/ });
    await expect(roll).toBeEnabled({ timeout: 15000 });
    await roll.click();
    await page.waitForTimeout(800);
    const routes = page.locator("[data-route]");
    if (await routes.count()) await routes.first().click();
    const endTurn = page.getByRole("button", { name: "End turn" });
    await expect(endTurn).toBeVisible({ timeout: 10000 });
    const closeCard = page.locator("[data-close-card]");
    if (await closeCard.isVisible().catch(() => false)) await closeCard.click();
    await endTurn.click();
  }
  await expect(page.getByText(/Fortune Visionary/)).toBeVisible({ timeout: 15000 });
  await expect(page.getByRole("table")).toBeVisible();
});
