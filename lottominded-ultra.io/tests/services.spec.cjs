const { test, expect } = require("@playwright/test");

test.describe("commercial services route", () => {
  test("publishes the requested capabilities and honest starting prices", async ({ page }) => {
    await page.goto("/services/", { waitUntil: "domcontentloaded" });

    await expect(page).toHaveTitle(/Build a Branded Interactive Experience/);
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Build a Branded Interactive Experience");

    for (const capability of [
      "Branded browser mini-games",
      "Interactive music launch pages",
      "Virtual event rooms",
      "Artist merchandise drop experiences",
      "Cinematic product landing pages",
      "Branded prompt labs",
      "Event installations",
      "White-label creative-number experiences",
      "Custom HUD interfaces",
      "Music visualizers",
      "Web-based promotional worlds",
    ]) {
      await expect(page.locator(".lm-services-capabilities li", { hasText: capability })).toBeVisible();
    }

    await expect(page.getByText("Starting at $750", { exact: true })).toBeVisible();
    await expect(page.getByText("Starting at $2,500", { exact: true })).toBeVisible();
    await expect(page.getByText("Starting at $5,000+", { exact: true })).toBeVisible();
    await expect(page.getByText(/These are starting project prices, not fixed quotes/)).toBeVisible();
    await expect(page.locator("text=/testimonial|client results|trusted by/i")).toHaveCount(0);
  });

  test("prepares a local inquiry without submitting a network request", async ({ page }) => {
    const writes = [];
    page.on("request", (request) => {
      if (!["GET", "HEAD"].includes(request.method())) writes.push(`${request.method()} ${request.url()}`);
    });
    await page.goto("/services/", { waitUntil: "domcontentloaded" });
    await page.locator("#servicesName").fill("Avery Signal");
    await page.locator("#servicesCompany").fill("Signal Workshop");
    await page.locator("#servicesEmail").fill("avery@example.com");
    await page.locator("#servicesProjectType").selectOption({ label: "Interactive music launch" });
    await page.locator("#servicesBudget").selectOption({ label: "$2,500 - $4,999" });
    await page.locator("#servicesLaunchDate").fill("2026-10-15");
    await page.locator("#servicesDescription").fill("A cinematic launch page with an interactive music visualizer and a focused campaign call to action.");
    await page.locator('[name="consent"]').check();
    await page.waitForTimeout(3100);
    await page.getByRole("button", { name: "Prepare inquiry" }).click();

    await expect(page.locator("[data-services-status]")).toContainText("Nothing has been uploaded or sent");
    await expect(page.locator("[data-services-result]")).toBeVisible();
    const href = await page.locator("[data-services-draft]").getAttribute("href");
    expect(href).toMatch(/^mailto:support@lottomind\.one/);
    expect(decodeURIComponent(href)).toContain("Signal Workshop");
    expect(writes).toEqual([]);
  });

  test("honeypot blocks automated inquiry preparation", async ({ page }) => {
    await page.goto("/services/", { waitUntil: "domcontentloaded" });
    await page.locator("#servicesName").fill("Bot Test");
    await page.locator("#servicesCompany").fill("Automation Test");
    await page.locator("#servicesEmail").fill("bot@example.com");
    await page.locator("#servicesProjectType").selectOption({ index: 1 });
    await page.locator("#servicesBudget").selectOption({ index: 1 });
    await page.locator("#servicesLaunchDate").fill("2026-10-15");
    await page.locator("#servicesDescription").fill("This description is long enough to pass browser validation but must fail the hidden spam trap.");
    await page.locator("#servicesWebsite").fill("https://spam.example");
    await page.locator('[name="consent"]').check();
    await page.getByRole("button", { name: "Prepare inquiry" }).click();

    await expect(page.locator("[data-services-status]")).toContainText("could not be prepared");
    await expect(page.locator("[data-services-result]")).toBeHidden();
  });
});
