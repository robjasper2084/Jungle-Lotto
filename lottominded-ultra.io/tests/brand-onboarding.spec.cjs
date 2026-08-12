const { test, expect } = require("@playwright/test");

async function openHome(page) {
  await page.route(/\.(?:mp3|mp4|wav|webm)(?:\?.*)?$/i, (route) => route.fulfill({ status: 204, body: "" }));
  await page.goto("/index.html#choose-your-path", { waitUntil: "domcontentloaded" });
  const startup = page.locator("[data-startup-video]");
  await expect(startup).toBeVisible({ timeout: 12_000 });
  await startup.getByRole("button", { name: "Enter Site", exact: true }).click();
  await expect(startup).toBeHidden();
  await expect(page.locator("#choose-your-path")).toBeVisible();
}

test("LottoMind is presented as the master brand without changing header order", async ({ page }) => {
  await openHome(page);
  await expect(page.locator(".brand-copy strong")).toHaveText("LottoMind");
  await expect(page.locator("#ecosystem-title")).toHaveText("LottoMind connects every experience.");
  await expect(page.getByText("Robot RAHBEE, Static Wav, and individual games live inside LottoMind Arcade.")).toBeVisible();

  const labels = await page.locator("[data-site-header] nav a").allTextContents();
  expect(labels).toEqual(["Home", "Events", "News", "Games", "Static Wav", "Storefront", "Memberships", "LottoMind App"]);
});

test("guest first use produces and saves a local result without verified credits", async ({ page }) => {
  await openHome(page);
  await page.getByRole("button", { name: /Explore My Numbers/ }).click();
  await expect(page.locator("[data-first-use-dialog]")).toBeVisible();
  await page.getByRole("button", { name: "Generate my set" }).click();
  await expect(page.getByRole("heading", { name: "Creative number set" })).toBeVisible();
  await page.getByRole("button", { name: "Save on this device" }).click();
  await expect(page.locator("[data-first-use-summary]")).toContainText("saved on this device");

  const stored = await page.evaluate(() => JSON.parse(localStorage.getItem("lottomind.guest.first-use.v1") || "[]"));
  expect(stored).toHaveLength(1);
  expect(JSON.stringify(stored)).not.toContain("LottoCredits");
});

test("free access presents action limits and no ten-minute offer", async ({ page }) => {
  await openHome(page);
  await expect(page.getByText("Free access is action-based.")).toBeVisible();
  await expect(page.getByText("10 creative number sets")).toBeVisible();
  await expect(page.getByText("1 Studio export preview")).toBeVisible();
  await expect(page.getByText(/10-minute demo/i)).toHaveCount(0);
  await expect(page.getByRole("link", { name: "See what membership adds" })).toBeHidden();
});

test("upgrade prompt appears only after the selected action allowance is reached", async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem("lottomind.guest.usage.v1", JSON.stringify({ numbers: 10, dream: 0, beat: 0, game: 0, saves: 0 }));
  });
  await openHome(page);
  await page.getByRole("button", { name: /Explore My Numbers/ }).click();
  await expect(page.getByText(/used the free Explore My Numbers allowance/i)).toBeVisible();
  await expect(page.getByRole("link", { name: "See what membership adds" })).toBeVisible();
});
