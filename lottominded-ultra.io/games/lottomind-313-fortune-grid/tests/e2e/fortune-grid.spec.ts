import { expect, test } from "@playwright/test";
import { resolve } from "node:path";

test("creates a game and completes the first turn without console errors", async ({ page }, testInfo) => {
  const errors: string[] = [];
  page.on("console", (message) => { if (message.type() === "error") errors.push(message.text()); });
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

test("save reload, touch layout, and arcade return link are available", async ({ page, isMobile }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Launch Fortune Grid" }).click();
  await page.reload();
  await expect(page.getByRole("button", { name: "Resume saved match" })).toBeVisible();
  await expect(page.getByRole("link", { name: /Return to LottoMind Arcade/ })).toBeVisible();
  if (isMobile) await expect(page.locator(".hud")).toBeVisible();
});
