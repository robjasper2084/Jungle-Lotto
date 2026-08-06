const { test, expect } = require("@playwright/test");

test("Live Events waits for the start action, plays the film audibly, and hands off to the page mix", async ({ page }) => {
  await page.goto("/live-events.html", { waitUntil: "domcontentloaded" });

  const film = page.locator("[data-live-hero-film-video]");
  const filmAudio = page.locator("[data-live-hero-film-audio]");
  const start = page.getByRole("button", { name: "Start with sound" });
  const pageMix = page.locator("[data-live-player-audio]");

  await expect(start).toBeVisible();
  await expect(film).not.toHaveAttribute("autoplay", "");
  await expect(film).not.toHaveAttribute("muted", "");
  await expect.poll(() => film.evaluate((video) => video.paused)).toBe(true);
  await expect.poll(() => filmAudio.evaluate((audio) => audio.paused)).toBe(true);

  await start.click();
  await expect(page.getByRole("button", { name: "Stop performance" })).toBeVisible();
  await expect.poll(() => film.evaluate((video) => video.paused)).toBe(false);
  await expect.poll(() => filmAudio.evaluate((audio) => audio.paused)).toBe(false);
  await expect.poll(async () => {
    const [filmTime, audioTime] = await Promise.all([
      film.evaluate((video) => video.currentTime),
      filmAudio.evaluate((audio) => audio.currentTime),
    ]);
    return Math.abs(filmTime - audioTime);
  }).toBeLessThan(0.75);

  await film.evaluate((video) => video.dispatchEvent(new Event("ended")));
  await expect.poll(() => pageMix.evaluate((audio) => audio.paused)).toBe(false);
  await expect(page.getByRole("button", { name: "Start with sound" })).toBeVisible();
});

test("Live Events uses the supplied puck field instead of the particle entity", async ({ page }) => {
  await page.goto("/live-events.html", { waitUntil: "domcontentloaded" });

  await expect(page.locator(".lm-live-puck")).toHaveCount(6);
  await expect(page.locator("#featureEntity")).toBeHidden();
  const puckImage = await page.locator(".lm-live-puck").first().evaluate((element) => getComputedStyle(element).backgroundImage);
  expect(puckImage).toContain("lottomind-floating-puck-20260417.webp");
});

test("News presents verified draw results in the signal banner and keeps the dock wide", async ({ page }) => {
  await page.goto("/news/", { waitUntil: "domcontentloaded" });
  await page.waitForFunction(() => (document.querySelector("#root")?.textContent || "").includes("LottoMind News Intelligence"));

  const banner = page.locator(".news-results-marquee");
  await expect(banner).toContainText("Powerball");
  await expect(banner).toContainText("8 30 41 48 54");
  await expect(banner).toContainText("Mega Millions");
  await expect(banner).toContainText("4 18 26 43 51");

  const dock = page.locator(".lm-healing-generator--news-dock");
  await expect(dock).toBeVisible();
  const widthRatio = await dock.evaluate((element) => element.getBoundingClientRect().width / window.innerWidth);
  expect(widthRatio).toBeGreaterThan(0.94);

  const utilityBackgrounds = await page.locator(".lm-header-utilities > *").evaluateAll((items) => (
    items.map((item) => getComputedStyle(item).backgroundImage)
  ));
  expect(new Set(utilityBackgrounds).size).toBe(3);
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
