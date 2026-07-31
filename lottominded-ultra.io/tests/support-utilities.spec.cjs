const { test, expect } = require("@playwright/test");

test("shared support utilities expose Search, Credits, Account, Help, Contact, and Accessibility", async ({ page }) => {
  await page.goto("/index.html#top");

  const utilities = page.getByLabel("Account and support utilities");
  await expect(utilities.getByRole("button", { name: "Search LottoMind routes" })).toBeVisible();
  await expect(utilities.getByRole("link", { name: "Credits" })).toHaveAttribute("href", /account\.html#credits$/);
  await expect(utilities.getByRole("link", { name: "Account", exact: true })).toHaveAttribute("href", /account\.html$/);

  await utilities.getByRole("button", { name: "Search LottoMind routes" }).click();
  const dialog = page.getByRole("dialog", { name: "Search LottoMind" });
  await expect(dialog).toBeVisible();
  await dialog.getByRole("searchbox").fill("support");
  await expect(dialog.getByRole("option", { name: /Help/ })).toBeVisible();
  await expect(dialog.getByRole("option", { name: /Contact/ })).toBeVisible();
  await expect(dialog.getByRole("option", { name: /Accessibility/ })).toBeVisible();
  await dialog.getByRole("button", { name: "Close search" }).click();

  const supportLinks = page.getByRole("navigation", { name: "Support and account" });
  await expect(supportLinks.getByRole("link", { name: "Help" })).toBeVisible();
  await expect(supportLinks.getByRole("link", { name: "Contact" })).toBeVisible();
  await expect(supportLinks.getByRole("link", { name: "Accessibility" })).toBeVisible();
});

test("account route stays read-only in local preview and exposes support links", async ({ page }) => {
  await page.goto("/account.html");

  await expect(page.getByRole("heading", { name: "Your LottoMind signal." })).toBeVisible();
  await expect(page.getByRole("status")).toContainText("read-only");
  await expect(page.getByRole("link", { name: "Need account or password support?" })).toHaveAttribute("href", /contact\.html/);
  await expect(page.getByRole("link", { name: "Read Account and Credits Help" })).toHaveAttribute("href", /how-to-use\.html#lottocredits$/);
});
