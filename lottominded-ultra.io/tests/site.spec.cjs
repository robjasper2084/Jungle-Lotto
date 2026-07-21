const { test, expect } = require("@playwright/test");

async function blockHeavyMedia(page) {
  await page.route(/\.(?:mp3|mp4|wav|webm)(?:\?.*)?$/i, (route) => route.fulfill({ status: 204, body: "" }));
}

function trackLocalFailures(page) {
  const failures = [];
  page.on("response", (response) => {
    const url = new URL(response.url());
    if (url.origin !== "http://127.0.0.1:8142") return;
    if (url.pathname.includes("favicon")) return;
    if (response.status() >= 400) failures.push(`${response.status()} ${url.pathname}`);
  });
  return failures;
}

test("memberships opens its commercial and hands off to the page without API checkout calls", async ({ page }) => {
  await blockHeavyMedia(page);
  await page.route(/https:\/\/js\.stripe\.com\/.*/i, (route) => route.abort());
  await page.route(/https:\/\/sqdasdbvlkgpbbiyeune\.supabase\.co\/functions\/v1\/lottomind-api.*/i, (route) =>
    route.fulfill({ status: 503, contentType: "application/json", body: '{"error":{"message":"Test billing endpoint offline"}}' })
  );
  const localFailures = trackLocalFailures(page);
  const apiRequests = [];
  page.on("request", (request) => {
    const url = new URL(request.url());
    if (url.origin === "http://127.0.0.1:8142" && url.pathname.includes("/api/")) apiRequests.push(url.pathname);
  });

  await page.goto("/memberships.html", { waitUntil: "domcontentloaded" });
  await page.waitForLoadState("networkidle").catch(() => {});

  const commercial = page.locator("[data-membership-commercial-modal]");
  await expect(commercial).toBeVisible();
  await page.locator("[data-membership-commercial-close]").click();
  await expect(commercial).toBeHidden();
  await expect(page.locator("[data-stripe-lookup-key]").first()).toBeDisabled();
  await expect(page.locator("[data-stripe-membership-status]")).toContainText("billing service is unavailable");
  expect(apiRequests).toEqual([]);
  expect(localFailures).toEqual([]);
});

test("guide commercial returns on every fresh page visit", async ({ page }) => {
  await blockHeavyMedia(page);
  await page.goto("/how-to-use.html", { waitUntil: "domcontentloaded" });

  const gate = page.locator(".lm-commercial-gate");
  await expect(gate).toBeVisible();
  await gate.locator(".lm-commercial-gate__skip").click();
  await expect(gate).toBeHidden();

  await page.reload({ waitUntil: "domcontentloaded" });
  await expect(page.locator(".lm-commercial-gate")).toBeVisible();
});

test("features renders the focused manifest-driven Arcade pilot", async ({ page }) => {
  await blockHeavyMedia(page);
  const localFailures = trackLocalFailures(page);
  await page.goto("/features-app.html", { waitUntil: "domcontentloaded" });
  await expect(page.locator(".arcade-pilot-label")).toHaveText("LottoMind Arcade Pilot — Experimental Preview");
  await expect(page.locator("[data-arcade-grid] .arcade-game-card")).toHaveCount(8);
  await expect(page.locator("[data-arcade-count]")).toHaveText("8");
  await expect(page.locator("video, audio, iframe, #lottery-news")).toHaveCount(0);

  await page.getByRole("button", { name: "Action", exact: true }).click();
  await expect(page.locator("[data-arcade-grid] .arcade-game-card")).toHaveCount(3);
  await expect(page.locator("[data-arcade-visible-count]")).toHaveText("3");

  await page.getByRole("button", { name: "All", exact: true }).click();
  await page.locator("[data-arcade-search]").fill("Stem Studio");
  await expect(page.locator("[data-arcade-grid] .arcade-game-card")).toHaveCount(1);
  await expect(page.getByRole("heading", { name: "LottoMind Stem Studio" })).toBeVisible();

  const overflow = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1);
  expect(overflow).toBe(false);
  expect(localFailures).toEqual([]);
});

test("home commercial media waits for an explicit play command", async ({ page }) => {
  const commercialRequests = [];
  page.on("request", (request) => {
    if (/lottomind-(?:home|refined)-commercial-20260716\.mp4/i.test(request.url())) {
      commercialRequests.push(request.url());
    }
  });

  await page.goto("/", { waitUntil: "domcontentloaded" });
  const startup = page.locator("[data-startup-video]");
  await expect(startup).toBeVisible({ timeout: 15_000 });
  await page.waitForTimeout(500);
  expect(commercialRequests).toEqual([]);

  await page.locator("[data-startup-video-play]").click();
  await expect.poll(() => commercialRequests.length).toBeGreaterThan(0);
});

test("Contact prepares a support request locally", async ({ page }) => {
  const localFailures = trackLocalFailures(page);
  await page.goto("/contact.html", { waitUntil: "domcontentloaded" });

  await page.locator("#supportTopic").selectOption("technical");
  await page.locator("#supportEmail").fill("preview@example.com");
  await page.locator("#supportPage").fill("https://example.test/affected-route");
  await page.locator("#supportDetails").fill("The preview route did not behave as expected during local testing.");
  await page.getByRole("button", { name: "Prepare Support Request" }).click();

  await expect(page.locator("[data-support-status]")).toHaveText("Support request prepared locally. Nothing has been sent.");
  await expect(page.locator("[data-support-draft]")).toHaveAttribute("href", /^mailto:support@lottomind\.one\?/);
  expect(localFailures).toEqual([]);
});

test("Stem Studio contains the workstation at compact mobile width", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/lottomind-stem-studio/", { waitUntil: "domcontentloaded" });
  await expect(page.getByRole("heading", { name: "LottoMind Stem Studio" })).toBeVisible();

  const viewport = await page.evaluate(() => ({
    clientWidth: document.documentElement.clientWidth,
    scrollWidth: document.documentElement.scrollWidth,
  }));
  expect(viewport.scrollWidth).toBeLessThanOrEqual(viewport.clientWidth + 1);
});

test("mobile memberships hero keeps its title inside the viewport", async ({ page }, testInfo) => {
  test.skip(!testInfo.project.name.startsWith("mobile"), "Mobile layout assertion");
  await blockHeavyMedia(page);
  await page.route(/https:\/\/js\.stripe\.com\/.*/i, (route) => route.abort());
  await page.goto("/memberships.html", { waitUntil: "domcontentloaded" });

  const titleBox = await page.locator("#membershipHeroTitle").boundingBox();
  expect(titleBox).toBeTruthy();
  expect(titleBox.x).toBeGreaterThanOrEqual(0);
  expect(titleBox.x + titleBox.width).toBeLessThanOrEqual(537);
});

test("news route renders from the static feed without probing the missing API", async ({ page }) => {
  await blockHeavyMedia(page);
  const localFailures = trackLocalFailures(page);
  const apiRequests = [];
  page.on("request", (request) => {
    const url = new URL(request.url());
    if (url.origin === "http://127.0.0.1:8142" && url.pathname.includes("/api/")) apiRequests.push(url.pathname);
  });

  await page.goto("/news/", { waitUntil: "domcontentloaded" });
  await page.waitForFunction(() => (document.querySelector("#root")?.textContent || "").trim().length > 80);

  await expect(page.locator("#root")).toContainText(/LottoMind|News|Lottery/i);
  expect(apiRequests).toEqual([]);
  expect(localFailures).toEqual([]);
});

test("GothTechnology canvas boots with a visible play surface", async ({ page }) => {
  const localFailures = trackLocalFailures(page);
  await page.goto("/games/gothtechnology2/", { waitUntil: "domcontentloaded" });
  await page.waitForFunction(() => {
    const canvas = document.querySelector("#game");
    if (!canvas) return false;
    const rect = canvas.getBoundingClientRect();
    return rect.width >= 320 && rect.height >= 180;
  });

  const canvas = page.locator("#game");
  await expect(canvas).toBeVisible();
  const pixels = await canvas.evaluate((node) => {
    const context = node.getContext("2d");
    if (!context) return 0;
    const sample = context.getImageData(0, 0, node.width, node.height).data;
    let lit = 0;
    for (let index = 0; index < sample.length; index += 256) {
      if (sample[index] || sample[index + 1] || sample[index + 2]) lit += 1;
    }
    return lit;
  });
  expect(pixels).toBeGreaterThan(20);
  expect(localFailures).toEqual([]);
});

test("Jackpot Maze built route renders instead of a dev shell", async ({ page }) => {
  const localFailures = trackLocalFailures(page);
  await page.goto("/games/lottomind-jackpot-maze/", { waitUntil: "domcontentloaded" });
  await page.waitForFunction(() => (document.querySelector("#root")?.textContent || "").trim().length > 20);

  await expect(page.getByRole("heading", { name: "LottoMind Jackpot Maze" })).toHaveCount(1);
  await expect(page.getByRole("button", { name: /Enter the Maze/i })).toBeVisible();
  expect(localFailures).toEqual([]);
});

for (const game of [
  { name: "OpenGW Levels", route: "/games/opengw-levels/", canvas: "#game" },
  { name: "Raytrace Pong", route: "/games/raytrace-pong-background/", canvas: "#rayPong" },
  { name: "Shadow Ops", route: "/games/shadow-ops-canvas/", canvas: "#game" },
]) {
  test(`${game.name} boots its visible canvas without local asset failures`, async ({ page }) => {
    await blockHeavyMedia(page);
    const localFailures = trackLocalFailures(page);
    await page.goto(game.route, { waitUntil: "domcontentloaded" });
    await page.waitForFunction((selector) => {
      const canvas = document.querySelector(selector);
      if (!canvas) return false;
      const rect = canvas.getBoundingClientRect();
      return rect.width >= 280 && rect.height >= 150;
    }, game.canvas);

    await expect(page.locator(game.canvas)).toBeVisible();
    expect(localFailures).toEqual([]);
  });
}
