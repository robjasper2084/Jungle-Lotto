const { test, expect } = require("@playwright/test");

test("Live Events attempts audible autoplay, keeps a fallback control, and hands off to the page mix", async ({ page }) => {
  await page.goto("/live-events.html", { waitUntil: "domcontentloaded" });

  const film = page.locator("[data-live-hero-film-video]");
  const soundControl = page.locator("[data-live-hero-film-sound]");
  const pageMix = page.locator("[data-live-player-audio]");

  await expect(soundControl).toBeVisible();
  await expect(film).toHaveAttribute("autoplay", "");
  await expect(film).not.toHaveAttribute("muted", "");
  await expect.poll(() => film.evaluate((video) => video.dataset.soundState)).toMatch(/playing|blocked/);
  if (await film.evaluate((video) => video.paused || video.muted)) {
    await soundControl.click();
  }
  await expect(page.getByRole("button", { name: "Stop performance" })).toBeVisible();
  await expect.poll(() => film.evaluate((video) => video.paused)).toBe(false);
  await expect.poll(() => film.evaluate((video) => video.muted)).toBe(false);

  await film.evaluate((video) => video.dispatchEvent(new Event("ended")));
  await expect.poll(() => pageMix.evaluate((audio) => audio.paused)).toBe(false);
  await expect(page.getByRole("button", { name: "Play with sound" })).toBeVisible();
});

test("Live Events uses the supplied puck field instead of the particle entity", async ({ page }) => {
  await page.goto("/live-events.html", { waitUntil: "domcontentloaded" });

  await expect(page.locator(".lm-live-puck")).toHaveCount(6);
  await expect(page.locator("#featureEntity")).toBeHidden();
  const puckImage = await page.locator(".lm-live-puck").first().evaluate((element) => getComputedStyle(element).backgroundImage);
  expect(puckImage).toContain("lottomind-floating-puck-20260417.webp");
});

test("News presents verified draw results without the retired oracle", async ({ page }) => {
  await page.goto("/news/", { waitUntil: "domcontentloaded" });
  await page.waitForFunction(() => (document.querySelector("#root")?.textContent || "").includes("LottoMind News Intelligence"));

  const banner = page.locator(".news-results-marquee");
  await expect(banner).toContainText("Powerball");
  await expect(banner).toContainText("8 30 41 48 54");
  await expect(banner).toContainText("Mega Millions");
  await expect(banner).toContainText("4 18 26 43 51");

  const dock = page.locator(".lm-healing-generator--news-dock");
  await expect(dock).toHaveCount(1);
  await expect(dock.locator(".lm-healing-generator__oracle")).toHaveCount(0);

  const utilityBackgrounds = await page.locator(".lm-header-utilities > *").evaluateAll((items) => (
    items.map((item) => getComputedStyle(item).backgroundImage)
  ));
  expect(new Set(utilityBackgrounds).size).toBe(2);
});

test("page soundtracks use their assigned local music with accessible controls", async ({ page }) => {
  await page.goto("/index.html#top", { waitUntil: "domcontentloaded" });

  await expect(page.locator("[data-startup-video] video source")).toHaveAttribute(
    "data-src",
    /lottomind-home-apparel-commercial-20260804\.opt\.mp4$/,
  );
  await expect(page.locator("#siteSoundtrack source")).toHaveAttribute(
    "data-src",
    /lottomind-home-theme-untitled-12\.mp3$/,
  );
  await expect(page.locator("#siteSoundtrack")).toHaveAttribute("data-autoplay", "true");
  await expect(page.getByRole("button", { name: /Home Music/ })).toBeVisible();

  await page.goto("/memberships.html", { waitUntil: "domcontentloaded" });
  await expect(page.locator("#siteSoundtrack source")).toHaveAttribute(
    "data-src",
    /lottomind-membership-theme-untitled-14\.mp3$/,
  );
  await expect(page.locator("#siteSoundtrack")).toHaveAttribute("data-autoplay", "true");
  await expect(page.locator(".lm-sound-toggle")).toBeVisible();

  await page.goto("/news/", { waitUntil: "domcontentloaded" });
  await expect(page.locator("#siteSoundtrack source")).toHaveAttribute(
    "data-src",
    /lottomind-news-theme-instrumental\.mp3$/,
  );
  await expect(page.locator("#siteSoundtrack")).toHaveAttribute("data-autoplay", "true");
  await expect(page.getByRole("button", { name: /News Music/ })).toBeVisible();
});
