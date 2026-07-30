const { test, expect } = require("@playwright/test");

async function blockHeavyMedia(page) {
  await page.route(/\.(?:mp3|mp4|wav|webm)(?:\?.*)?$/i, (route) =>
    route.fulfill({ status: 204, body: "" })
  );
}

test("platform navigation keeps correct routes with Memberships last", async ({ page }) => {
  await blockHeavyMedia(page);
  await page.goto("/features.html", { waitUntil: "domcontentloaded" });

  const navLinks = page.locator(".site-header nav a");
  await expect(navLinks).toHaveCount(7);
  await expect(navLinks).toHaveText([
    "Home",
    "App",
    "Arcade",
    "Games",
    "News + Events",
    "Storefront",
    "Memberships",
  ]);

  const destinations = await navLinks.evaluateAll((links) =>
    links.map((link) => new URL(link.href).pathname)
  );
  expect(destinations).toEqual([
    "/index.html",
    "/features.html",
    "/arcade.html",
    "/features-app.html",
    "/news/",
    "/merch-store.html",
    "/memberships.html",
  ]);
});

test("News and Events opens the large route chooser", async ({ page }) => {
  await blockHeavyMedia(page);
  await page.goto("/features.html", { waitUntil: "domcontentloaded" });

  await page.getByRole("link", { name: "News + Events" }).click();
  const dialog = page.getByRole("dialog", { name: "News + Events" });
  await expect(dialog).toBeVisible();
  await expect(dialog.getByRole("link", { name: /Open News/ })).toHaveAttribute("href", /\/news\/$/);
  await expect(dialog.getByRole("link", { name: /Open Live Events/ })).toHaveAttribute("href", /live-events\.html$/);
});

test("platform footer and account utilities are available without a Studio launcher", async ({ page }) => {
  await blockHeavyMedia(page);
  await page.goto("/arcade.html", { waitUntil: "domcontentloaded" });

  if (test.info().project.name === "mobile-chromium") {
    await expect(page.locator(".lm-mobile-bottom-nav")).toBeVisible();
    await expect(page.locator(".lm-mobile-bottom-nav").getByRole("button", { name: "Search" })).toBeVisible();
    await expect(page.locator(".lm-mobile-bottom-nav").getByRole("link", { name: "Account" })).toBeVisible();
  } else {
    await expect(page.locator(".lm-header-utilities")).toBeVisible();
  }
  await expect(page.locator(".lm-site-footer-map")).toBeAttached();
  await expect(page.locator(".site-header .direct-launch")).toHaveCount(0);
  await expect(page.getByRole("link", { name: "Launch Studio" })).toHaveCount(0);

  await page.goto("/beat2lotto-plus.html#beat2lotto", { waitUntil: "domcontentloaded" });
  await expect(page.locator(".site-header .direct-launch")).toBeHidden();
});

test("Arcade cards use the current game names and HTML destinations", async ({ page }) => {
  await blockHeavyMedia(page);
  await page.goto("/arcade.html", { waitUntil: "domcontentloaded" });

  const cards = page.locator("[data-arcade-grid] .arcade-game-card");
  await expect(cards).toHaveCount(8);

  const cardRoutes = await cards.evaluateAll((items) =>
    items.map((item) => ({
      name: item.querySelector("h3")?.textContent.trim(),
      href: item.querySelector(".arcade-game-card__media")?.getAttribute("href"),
    }))
  );
  expect(cardRoutes).toEqual(expect.arrayContaining([
    { name: "GOTHTECHNOLOGY", href: "./games/gothtechnology2/" },
    { name: "LottoMind: Jackpot Maze", href: "./games/lottomind-jackpot-maze/" },
    { name: "2084 Static Wave", href: "./games/opengw-levels/" },
    { name: "Robot Rahbe", href: "./games/shadow-ops-canvas/" },
    { name: "RAYCHASE PONG", href: "./games/raytrace-pong-background/" },
  ]));
});

test("route search restores Help, Contact, and account support", async ({ page }) => {
  await blockHeavyMedia(page);
  await page.goto("/features.html", { waitUntil: "domcontentloaded" });

  await page.locator("button[data-command-search-open]:visible").click();
  const dialog = page.getByRole("dialog", { name: "Search LottoMind" });
  await expect(dialog).toBeVisible();
  await dialog.getByRole("searchbox").fill("support");
  await expect(dialog.getByRole("option", { name: /Contact Support/ })).toBeVisible();
  await expect(dialog.getByRole("option", { name: /Account Recovery/ })).toBeVisible();
  await expect(page.locator(".lm-site-footer-map").getByRole("link", { name: "Help Center" })).toBeAttached();
  await expect(page.locator(".lm-site-footer-map").getByRole("link", { name: "Contact" })).toBeAttached();
});

test("News uses the RAHBE artwork with a distinct depth color treatment", async ({ page }) => {
  await blockHeavyMedia(page);
  await page.goto("/news/", { waitUntil: "domcontentloaded" });

  const newsNav = page.locator(".site-header nav a");
  await expect(newsNav).toHaveText([
    "Home",
    "App",
    "Arcade",
    "Games",
    "News + Events",
    "Storefront",
    "Memberships",
  ]);
  await expect(page.locator(".lm-header-utilities")).toBeAttached();
  await expect(page.locator(".site-header .direct-launch")).toHaveCount(0);

  const background = await page.locator("body").evaluate((body) => {
    const style = getComputedStyle(body, "::before");
    return {
      image: style.backgroundImage,
      filter: style.filter,
      opacity: style.opacity,
    };
  });
  expect(background.image).toContain("robot-rahbe-gameplay-keyart.png");
  expect(background.filter).toContain("hue-rotate");
  expect(Number(background.opacity)).toBeGreaterThan(0.2);
});
