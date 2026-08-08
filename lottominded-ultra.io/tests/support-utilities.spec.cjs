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
  await expect(utilities.getByRole("button", { name: /motion/i })).toHaveText("Motion");
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
  const utilityLayout = await utilities.locator("a, button").evaluateAll((items) => items.map((item) => {
    const box = item.getBoundingClientRect();
    return { left: box.left, right: box.right, top: box.top, bottom: box.bottom, width: box.width, height: box.height };
  }));
  utilityLayout.forEach(({ width, height }) => {
    expect(width).toBeGreaterThanOrEqual(40);
    expect(height).toBeGreaterThanOrEqual(40);
  });
  for (let index = 0; index < utilityLayout.length; index += 1) {
    for (let compare = index + 1; compare < utilityLayout.length; compare += 1) {
      const first = utilityLayout[index];
      const second = utilityLayout[compare];
      const overlapWidth = Math.max(0, Math.min(first.right, second.right) - Math.max(first.left, second.left));
      const overlapHeight = Math.max(0, Math.min(first.bottom, second.bottom) - Math.max(first.top, second.top));
      expect(overlapWidth * overlapHeight).toBe(0);
    }
  }
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
    ["Services", "/services/"],
    ["Credits", "/account.html#credits"],
    ["Account", "/account.html"],
    ["Privacy", "/privacy.html"],
    ["Terms", "/terms.html"],
    ["Accessibility", "/accessibility.html"],
  ];

  for (const route of ["/index.html#top", "/accessibility.html", "/memberships.html", "/merch-store.html"]) {
    await page.goto(route, { waitUntil: "domcontentloaded" });
    await expect(page.locator("body > footer")).toHaveClass(/lm-site-footer-hud/);
    const links = await page.locator("body > footer :is(.lm-footer-support-links, .site-legal-links) a").evaluateAll((items) =>
      items.map((item) => [item.textContent.trim(), `${new URL(item.href).pathname}${new URL(item.href).hash}`])
    );
    expect(links).toEqual(expectedLinks);
    expect(new Set(links.map(([, href]) => href)).size).toBe(links.length);

    if (page.viewportSize()?.width <= 760) {
      const footerPadding = await page.locator("body > footer").evaluate((element) => Number.parseFloat(getComputedStyle(element).paddingBottom));
      expect(footerPadding, `${route} should reserve space below footer links`).toBeGreaterThanOrEqual(112);
    }
    expect(await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1)).toBe(false);
  }
});

test("shared signal marquee uses smooth motion and preserves reduced-motion behavior", async ({ page }) => {
  await page.goto("/merch-store.html", { waitUntil: "domcontentloaded" });
  const track = page.locator(".home-signal-marquee-track").first();
  await expect(track).toBeVisible();

  const motion = await track.evaluate((element) => {
    const styles = getComputedStyle(element);
    return { name: styles.animationName, duration: styles.animationDuration };
  });
  if (page.viewportSize()?.width <= 760) {
    expect(motion.name).toBe("none");
  } else {
    expect(motion.name).toBe("home-signal-marquee");
    expect(motion.duration).toBe("31s");
  }

  await page.emulateMedia({ reducedMotion: "reduce" });
  await expect(track).toHaveCSS("animation-name", "none");
});

test("account route stays read-only in local preview and exposes support links", async ({ page }) => {
  await page.goto("/account.html");

  await expect(page.getByRole("heading", { name: "Your LottoMind signal." })).toBeVisible();
  const heroVideo = page.locator(".lm-platform-hero__video");
  await expect(heroVideo).toHaveAttribute("muted", "");
  await expect(heroVideo).toHaveAttribute("data-autoplay-on-visible", "true");
  const heroVideoSource = await heroVideo.locator("source").evaluate((source) => source.getAttribute("src") || source.dataset.src);
  expect(heroVideoSource).toMatch(/lm-feature-portal-loop\.mp4$/);
  await expect(page.locator("[data-account-status]")).toContainText("read-only");
  await expect(page.getByRole("link", { name: "Need account or password support?" })).toHaveAttribute("href", /contact\.html/);
  await expect(page.getByRole("link", { name: "Read Account and Credits Help" })).toHaveAttribute("href", /help\.html#lottocredits$/);
});

test("Help Center is searchable and Account, Terms, and Privacy share RAHBEE depth", async ({ page }) => {
  await page.goto("/help.html");
  await expect(page).toHaveTitle("Help Center | LOTTOMINDED ULTRA");
  await expect(page.getByRole("heading", { name: "Find the right route fast." })).toBeVisible();
  await page.getByRole("searchbox", { name: "Search Help Center" }).fill("credits");
  await expect(page.locator("[data-help-status]")).toContainText("help topic");
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

test("mobile Help actions stay clear of fixed Credits and Menu controls", async ({ page }, testInfo) => {
  test.skip(!testInfo.project.name.startsWith("mobile"), "Mobile layout assertion");
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/help.html", { waitUntil: "domcontentloaded" });

  const overlaps = await page.evaluate(() => {
    const actions = [...document.querySelectorAll(".lm-platform-actions a")];
    const controls = [...document.querySelectorAll(".vault-credit-badge, .universal-menu-toggle")];
    return actions.flatMap((action) => {
      const actionBox = action.getBoundingClientRect();
      return controls.map((control) => {
        const controlBox = control.getBoundingClientRect();
        const width = Math.max(0, Math.min(actionBox.right, controlBox.right) - Math.max(actionBox.left, controlBox.left));
        const height = Math.max(0, Math.min(actionBox.bottom, controlBox.bottom) - Math.max(actionBox.top, controlBox.top));
        return { action: action.textContent.trim(), control: control.textContent.trim(), area: width * height };
      });
    });
  });

  expect(overlaps.every(({ area }) => area === 0), JSON.stringify(overlaps)).toBe(true);
});

test("Robot RAHBEE and Static Wav expose the requested page identity", async ({ page }) => {
  await page.goto("/beat2lotto-plus.html#beat2lotto");
  await expect(page).toHaveTitle("Robot RAHBEE | LOTTOMINDED ULTRA");
  await expect(page.getByRole("heading", { name: "Robot RAHBEE: Shadow Ops Canvas" })).toBeAttached();

  await page.goto("/how-to-use.html");
  await expect(page).toHaveTitle("Static Wav | LOTTOMINDED ULTRA");
});
