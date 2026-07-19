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

test("features renders current article cards from the static feed", async ({ page }) => {
  await blockHeavyMedia(page);
  await page.goto("/features-app.html", { waitUntil: "domcontentloaded" });
  await page.locator(".lm-commercial-gate__skip").click();

  const articles = page.locator("#lottery-news .sd-news-card");
  await expect(articles.first()).toBeVisible();
  await expect(articles).toHaveCount(3);
  await expect(page.locator("[data-lottery-news-status]")).toContainText(/briefs available/i);
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
  await page.waitForFunction(() => (document.querySelector("#root")?.textContent || document.querySelector("canvas")?.outerHTML || "").trim().length > 20);

  await expect(page.locator("#root, canvas").first()).toBeVisible();
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
