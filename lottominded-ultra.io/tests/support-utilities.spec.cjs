const { test, expect } = require("@playwright/test");

test("shared support utilities expose Search, Credits, Account, Help, Contact, and Accessibility", async ({ page }) => {
  await page.goto("/index.html#top");
  await page.waitForFunction(() =>
    [...document.styleSheets].some((sheet) => sheet.href?.includes("lm-support-utilities.css"))
  );

  const utilities = page.getByLabel("Account and support utilities");
  await expect(utilities.getByRole("button", { name: "Search LottoMind routes" })).toBeVisible();
  await expect(utilities.getByRole("link", { name: "Credits" })).toHaveAttribute("href", /account\.html#credits$/);
  await expect(utilities.getByRole("link", { name: "Account", exact: true })).toHaveAttribute("href", /account\.html$/);
  const sphereTabs = page.getByRole("navigation", { name: "LOTTOMINDED ULTRA sphere navigation" }).getByRole("link");
  await expect(sphereTabs).toHaveText([
    "Home",
    "Events",
    "News",
    "Games",
    "Static Wav",
    "Robot RAHBEE",
    "Storefront",
    "Memberships",
    "LottoMind App",
  ]);
  await expect(sphereTabs.filter({ hasText: "Robot RAHBEE" })).toHaveCount(1);
  await expect(sphereTabs.filter({ hasText: "Static Wav" })).toHaveCount(1);
  const utilityShapes = await utilities.locator("a, button").evaluateAll((items) => items.map((item) => {
    const styles = getComputedStyle(item);
    return { radius: Number.parseFloat(styles.borderRadius), height: item.getBoundingClientRect().height };
  }));
  utilityShapes.forEach(({ radius, height }) => expect(radius).toBeGreaterThanOrEqual(height / 2));
  if (page.viewportSize()?.width <= 470) {
    const utilityBox = await utilities.boundingBox();
    const navBox = await page.getByRole("navigation", { name: "LOTTOMINDED ULTRA sphere navigation" }).boundingBox();
    expect(utilityBox.y + utilityBox.height).toBeLessThanOrEqual(navBox.y + 1);
  }

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
  await expect(supportLinks.getByRole("link", { name: "Credits" })).toBeVisible();
  await expect(supportLinks.getByRole("link", { name: "Account" })).toBeVisible();
  const legalLinks = page.getByRole("navigation", { name: "Legal and support" });
  await expect(legalLinks.getByRole("link", { name: "Accessibility" })).toBeVisible();
});

test("footer links are unique and use the canonical support destinations globally", async ({ page }) => {
  const expectedLinks = [
    ["Help", "/help.html"],
    ["Contact", "/contact.html"],
    ["Credits", "/account.html#credits"],
    ["Account", "/account.html"],
    ["Privacy", "/privacy.html"],
    ["Terms", "/terms.html"],
    ["Accessibility", "/accessibility.html"],
  ];

  for (const route of ["/index.html#top", "/accessibility.html", "/memberships.html", "/merch-store.html"]) {
    await page.goto(route, { waitUntil: "domcontentloaded" });
    const links = await page.locator("body > footer :is(.lm-footer-support-links, .site-legal-links) a").evaluateAll((items) =>
      items.map((item) => [item.textContent.trim(), `${new URL(item.href).pathname}${new URL(item.href).hash}`])
    );
    expect(links).toEqual(expectedLinks);
    expect(new Set(links.map(([, href]) => href)).size).toBe(links.length);

    if (page.viewportSize()?.width <= 760) {
      const footerPadding = await page.locator("body > footer").evaluate((element) => Number.parseFloat(getComputedStyle(element).paddingBottom));
      expect(footerPadding, `${route} should reserve space below footer links`).toBeGreaterThanOrEqual(112);
    }
  }
});

test("account route stays read-only in local preview and exposes support links", async ({ page }) => {
  await page.goto("/account.html");

  await expect(page.getByRole("heading", { name: "Your LottoMind signal." })).toBeVisible();
  const heroVideo = page.locator(".lm-platform-hero__video");
  await expect(heroVideo).toHaveAttribute("muted", "");
  await expect(heroVideo).toHaveAttribute("data-autoplay-on-visible", "true");
  const heroVideoSource = await heroVideo.locator("source").evaluate((source) => source.getAttribute("src") || source.dataset.src);
  expect(heroVideoSource).toMatch(/lm-feature-portal-loop\.mp4$/);
  await expect(page.getByRole("status")).toContainText("read-only");
  await expect(page.getByRole("link", { name: "Need account or password support?" })).toHaveAttribute("href", /contact\.html/);
  await expect(page.getByRole("link", { name: "Read Account and Credits Help" })).toHaveAttribute("href", /help\.html#lottocredits$/);
});

test("Help Center is searchable and Account, Terms, and Privacy share RAHBEE depth", async ({ page }) => {
  await page.goto("/help.html");
  await expect(page).toHaveTitle("Help Center | LOTTOMINDED ULTRA");
  await expect(page.getByRole("heading", { name: "Find the right route fast." })).toBeVisible();
  await page.getByRole("searchbox", { name: "Search Help Center" }).fill("credits");
  await expect(page.getByRole("status")).toContainText("help topic");
  await expect(page.getByText("How accounts and LottoCredits work")).toBeVisible();
  await expect(page.getByText("How to play Robot RAHBEE")).toBeHidden();

  for (const route of ["/account.html", "/terms.html", "/privacy.html"]) {
    await page.goto(route, { waitUntil: "domcontentloaded" });
    await expect(page.locator("body")).toHaveClass(/lm-rahbee-depth-page/);
    const depth = await page.locator("body").evaluate((element) => ({
      background: getComputedStyle(element).backgroundImage,
      before: getComputedStyle(element, "::before").backgroundImage,
      overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
    }));
    expect(depth.background).toContain("startup-3d-mid.webp");
    expect(depth.before).toContain("startup-3d-emissive.webp");
    expect(depth.overflow).toBeLessThanOrEqual(1);
  }
});

test("Robot RAHBEE and Static Wav expose the requested page identity", async ({ page }) => {
  await page.goto("/beat2lotto-plus.html#beat2lotto");
  await expect(page).toHaveTitle("Robot RAHBEE | LOTTOMINDED ULTRA");
  await expect(page.getByRole("heading", { name: "Robot RAHBEE: Shadow Ops Canvas" })).toBeAttached();

  await page.goto("/how-to-use.html");
  await expect(page).toHaveTitle("Static Wav | LOTTOMINDED ULTRA");
});
