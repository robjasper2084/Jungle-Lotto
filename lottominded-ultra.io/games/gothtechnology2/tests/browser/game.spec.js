import { expect, test } from "@playwright/test";

const gameUrl = "/games/gothtechnology2/";

const phase = (page) => page.evaluate(() => window.__gothTechnologyGame?.phase);

const clickGame = async (page, gameX, gameY) => {
  const canvas = page.locator("#game");
  const box = await canvas.boundingBox();
  if (!box) throw new Error("Game canvas is not visible");
  await canvas.click({ position: { x: gameX / 1280 * box.width, y: gameY / 720 * box.height } });
};

test("boots, reaches versus, fights, and pauses without page errors", async ({ page }, testInfo) => {
  const pageErrors = [];
  page.on("pageerror", (error) => pageErrors.push(error.message));
  await page.goto(gameUrl);
  await expect.poll(() => phase(page)).toBe("title");

  const loadedResources = await page.evaluate(() => performance.getEntriesByType("resource").map((entry) => entry.name));
  expect(loadedResources.some((url) => url.includes("runtime_atlas_user"))).toBe(false);
  expect(loadedResources.some((url) => url.includes("motion-atlases/") && url.endsWith(".webp"))).toBe(false);
  expect(loadedResources.some((url) => url.includes("lottomind-live-startup.mp4"))).toBe(false);
  expect(loadedResources.some((url) => url.includes("gothtechnology-startup-bg.png"))).toBe(false);

  const nonBlankSamples = await page.locator("#game").evaluate((canvas) => {
    const data = canvas.getContext("2d").getImageData(0, 0, canvas.width, canvas.height).data;
    let visible = 0;
    for (let i = 0; i < data.length; i += 1600) {
      if (data[i] + data[i + 1] + data[i + 2] > 24) visible += 1;
    }
    return visible;
  });
  expect(nonBlankSamples).toBeGreaterThan(100);

  await clickGame(page, 640, 342);
  await expect.poll(() => phase(page)).toBe("select");
  await expect.poll(() => page.evaluate(() => window.__gothTechnologyGame?.assets?.loadedCharacterMotions?.size), { timeout: 10_000 }).toBe(2);
  const selectedResources = await page.evaluate(() => performance.getEntriesByType("resource").map((entry) => entry.name));
  expect(selectedResources.filter((url) => url.includes("motion-atlases/") && url.endsWith(".webp"))).toHaveLength(6);
  expect(selectedResources.some((url) => url.includes("runtime_atlas_user"))).toBe(false);
  await clickGame(page, 640, 594);
  await expect.poll(() => phase(page)).toBe("versus");
  await expect.poll(() => phase(page), { timeout: 4_000 }).toBe("fight");

  await page.keyboard.press("KeyL");
  await page.waitForTimeout(140);
  await page.keyboard.press("KeyP");
  await expect.poll(() => phase(page)).toBe("pause");
  const controlSettings = page.getByRole("button", { name: "Control settings", exact: true });
  await controlSettings.focus();
  await expect(page.locator("#accessibleActions")).toHaveCSS("overflow", "visible");
  await page.keyboard.press("Enter");
  await expect(page.locator("#settingsPanel")).toBeVisible();
  await page.getByRole("button", { name: "Close control settings" }).click();
  await page.evaluate(() => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve))));
  const touchLabels = await page.locator("#mobileControls .touch:not(.blank)").allTextContents();
  expect(touchLabels.every((label) => label.trim().length > 0)).toBe(true);
  if (!process.env.NO_TEST_ARTIFACTS) await page.screenshot({ path: testInfo.outputPath(`${testInfo.project.name}-pause.png`) });
  expect(pageErrors).toEqual([]);
});

test("mobile portrait keeps controls adjacent to a useful playfield", async ({ page }, testInfo) => {
  test.skip(!testInfo.project.name.includes("mobile"), "Mobile layout check");
  await page.goto(gameUrl);
  await expect.poll(() => phase(page)).toBe("title");
  const layout = await page.evaluate(() => {
    const canvas = document.getElementById("game").getBoundingClientRect();
    const controls = document.getElementById("mobileControls").getBoundingClientRect();
    return {
      canvasWidth: canvas.width,
      canvasHeight: canvas.height,
      gap: controls.top - canvas.bottom,
      controlsVisible: getComputedStyle(document.getElementById("mobileControls")).display !== "none"
    };
  });
  expect(layout.controlsVisible).toBe(true);
  expect(layout.canvasWidth).toBeGreaterThan(360);
  expect(layout.canvasHeight).toBeGreaterThan(190);
  expect(layout.gap).toBeLessThan(32);
  if (!process.env.NO_TEST_ARTIFACTS) await page.screenshot({ path: testInfo.outputPath("mobile-title.png") });
});
