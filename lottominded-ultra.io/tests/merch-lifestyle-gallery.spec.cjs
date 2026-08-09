const { test, expect } = require("@playwright/test");

test("merch lifestyle gallery exposes the four supplied campaign photos", async ({ page }) => {
  await page.route(/\.(?:mp4|webm|mp3|wav)(?:\?.*)?$/i, (route) => route.abort());
  await page.goto("/merch-store.html", { waitUntil: "domcontentloaded" });

  const gallery = page.locator(".merch-lifestyle-gallery");
  await expect(gallery).toBeVisible();
  const images = gallery.locator("img");
  await expect(images).toHaveCount(4);

  const sources = await images.evaluateAll((items) => items.map((item) => item.getAttribute("src")));
  expect(sources).toEqual([
    "./assets/merch/guardian-bundle-boxed-20260807.webp",
    "./assets/merch/guardian-carry-couple-20260807.webp",
    "./assets/merch/guardian-package-pair-20260807.webp",
    "./assets/merch/guardian-camera-pair-20260807.webp",
  ]);
  await expect(gallery.getByRole("heading", { name: "See the apparel and Guardian together." })).toBeVisible();

  await page.setViewportSize({ width: 390, height: 844 });
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(overflow).toBeLessThanOrEqual(1);
});
