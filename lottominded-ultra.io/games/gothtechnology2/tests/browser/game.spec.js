import { expect, test } from "playwright/test";

const gameUrl = "/games/gothtechnology2/";

const phase = (page) => page.evaluate(() => window.__gothTechnologyGame?.phase);

const clickGame = async (page, gameX, gameY) => {
  const canvas = page.locator("#game");
  const box = await canvas.boundingBox();
  if (!box) throw new Error("Game canvas is not visible");
  await canvas.click({ position: { x: gameX / 1280 * box.width, y: gameY / 720 * box.height } });
};

const enterTrainingFight = async (page) => {
  await clickGame(page, 640, 400);
  await expect.poll(() => phase(page)).toBe("select");
  await expect.poll(() => page.evaluate(() => window.__gothTechnologyGame?.matchAssetsReady), { timeout: 10_000 }).toBe(true);
  await clickGame(page, 640, 594);
  await expect.poll(() => phase(page)).toBe("versus");
  await expect.poll(() => phase(page), { timeout: 4_000 }).toBe("fight");
};

test("boots, reaches versus, fights, and pauses without page errors", async ({ page }, testInfo) => {
  const pageErrors = [];
  page.on("pageerror", (error) => pageErrors.push(error.message));
  await page.goto(gameUrl);
  await expect.poll(() => phase(page)).toBe("title");
  if (!process.env.NO_TEST_ARTIFACTS) await page.screenshot({ path: testInfo.outputPath(`${testInfo.project.name}-title.png`) });

  const loadedResources = await page.evaluate(() => performance.getEntriesByType("resource").map((entry) => entry.name));
  expect(loadedResources.some((url) => url.includes("runtime_atlas_user"))).toBe(false);
  expect(loadedResources.some((url) => url.includes("motion-atlases/") && new URL(url).pathname.endsWith(".webp"))).toBe(false);
  expect(loadedResources.some((url) => url.includes("approved-poses/"))).toBe(false);
  expect(loadedResources.some((url) => url.includes("lottomind-live-startup.mp4"))).toBe(false);
  expect(loadedResources.some((url) => url.includes("gothtechnology-startup-bg.png"))).toBe(false);
  expect(loadedResources.some((url) => url.includes("user-sheets/"))).toBe(false);
  expect(loadedResources.some((url) => url.endsWith(".mp3"))).toBe(false);
  expect(loadedResources.some((url) => url.includes("effects/sheets/"))).toBe(false);

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
  expect(selectedResources.filter((url) => url.includes("motion-atlases/") && new URL(url).pathname.endsWith(".webp"))).toHaveLength(6);
  expect(selectedResources.some((url) => url.includes("approved-poses/"))).toBe(false);
  expect(selectedResources.some((url) => url.includes("runtime_atlas_user"))).toBe(false);
  expect(selectedResources.some((url) => url.includes("user-sheets/"))).toBe(false);
  const spriteIntegrity = await page.evaluate(() => {
    const animations = window.__gothTechnologyGame.assets.animations;
    const splitFrames = [];
    const insufficientUnique = [];
    let frameCount = 0;
    for (const [characterId, motions] of Object.entries(animations)) {
      for (const [motionName, motion] of Object.entries(motions)) {
        if ((motion.uniqueFrames ?? 0) < 6) insufficientUnique.push(`${characterId}/${motionName}`);
        motion.frames.forEach((frame, frameIndex) => {
          frameCount += 1;
          const canvas = document.createElement("canvas");
          canvas.width = frame.w;
          canvas.height = frame.h;
          const context = canvas.getContext("2d", { willReadFrequently: true });
          context.drawImage(motion.image, frame.x, frame.y, frame.w, frame.h, 0, 0, frame.w, frame.h);
          const rgba = context.getImageData(0, 0, frame.w, frame.h).data;
          const mask = Array.from({ length: frame.h }, () => new Uint8Array(frame.w));
          let minX = frame.w;
          let maxX = -1;
          let minY = frame.h;
          let maxY = -1;
          for (let y = 0; y < frame.h; y += 1) {
            for (let x = 0; x < frame.w; x += 1) {
              if (rgba[(y * frame.w + x) * 4 + 3] <= 24) continue;
              mask[y][x] = 1;
              minX = Math.min(minX, x);
              maxX = Math.max(maxX, x);
              minY = Math.min(minY, y);
              maxY = Math.max(maxY, y);
            }
          }
          if (maxX < 0) {
            splitFrames.push(`${characterId}/${motionName}/${frameIndex + 1}:empty`);
            return;
          }
          const projections = [
            Array.from({ length: maxX - minX + 1 }, (_, x) => {
              let sum = 0;
              for (let y = minY; y <= maxY; y += 1) sum += mask[y][x + minX];
              return sum;
            }),
            Array.from({ length: maxY - minY + 1 }, (_, y) => {
              let sum = 0;
              for (let x = minX; x <= maxX; x += 1) sum += mask[y + minY][x];
              return sum;
            })
          ];
          for (const projection of projections) {
            const total = projection.reduce((sum, value) => sum + value, 0);
            let runStart = -1;
            for (let index = 0; index <= projection.length; index += 1) {
              const empty = index < projection.length && projection[index] === 0;
              if (empty && runStart < 0) runStart = index;
              if ((!empty || index === projection.length) && runStart >= 0) {
                const width = index - runStart;
                const before = projection.slice(0, runStart).reduce((sum, value) => sum + value, 0);
                const after = projection.slice(index).reduce((sum, value) => sum + value, 0);
                if (width >= 2 && width <= 16 && before > total * 0.2 && after > total * 0.2) {
                  splitFrames.push(`${characterId}/${motionName}/${frameIndex + 1}`);
                  return;
                }
                runStart = -1;
              }
            }
          }
        });
      }
    }
    return { frameCount, insufficientUnique, splitFrames };
  });
  expect(spriteIntegrity.frameCount).toBe(468);
  expect(spriteIntegrity.insufficientUnique).toEqual([]);
  expect(spriteIntegrity.splitFrames).toEqual([]);
  const unstableRenderedMotions = await page.evaluate(async () => {
    const { drawSpriteFrame } = await import("./src/engine/assets.js?v=motion-atlas8-ezra-jump-test");
    const animations = window.__gothTechnologyGame.assets.animations;
    const checkedMotions = [
      "IDLE", "READY_STANCE", "WALK_FORWARD", "RUN_FORWARD", "DASH_FORWARD",
      "CROUCH_IDLE", "CROUCH_WALK", "LIGHT_PUNCH", "HEAVY_KICK"
    ];
    const failures = [];
    for (const [characterId, motions] of Object.entries(animations)) {
      for (const motionName of checkedMotions) {
        const motion = motions[motionName];
        const heights = [];
        const bottoms = [];
        for (let frameIndex = 0; frameIndex < motion.frames.length; frameIndex += 1) {
          const canvas = document.createElement("canvas");
          canvas.width = 320;
          canvas.height = 340;
          const context = canvas.getContext("2d", { willReadFrequently: true });
          drawSpriteFrame(context, motion, frameIndex, 160, 330);
          const rgba = context.getImageData(0, 0, canvas.width, canvas.height).data;
          let minY = canvas.height;
          let maxY = -1;
          for (let y = 0; y < canvas.height; y += 1) {
            for (let x = 0; x < canvas.width; x += 1) {
              if (rgba[(y * canvas.width + x) * 4 + 3] <= 8) continue;
              minY = Math.min(minY, y);
              maxY = Math.max(maxY, y);
            }
          }
          heights.push(maxY - minY + 1);
          bottoms.push(maxY);
        }
        const heightSpread = Math.max(...heights) - Math.min(...heights);
        const bottomSpread = Math.max(...bottoms) - Math.min(...bottoms);
        if (heightSpread > 2 || bottomSpread > 2) {
          failures.push(`${characterId}/${motionName}:height=${heightSpread},bottom=${bottomSpread}`);
        }
      }
    }
    return failures;
  });
  expect(unstableRenderedMotions).toEqual([]);
  if (!process.env.NO_TEST_ARTIFACTS) await page.screenshot({ path: testInfo.outputPath(`${testInfo.project.name}-character-select.png`) });
  await clickGame(page, 640, 594);
  await expect.poll(() => phase(page)).toBe("versus");
  await expect.poll(() => phase(page), { timeout: 4_000 }).toBe("fight");
  if (!process.env.NO_TEST_ARTIFACTS) await page.screenshot({ path: testInfo.outputPath(`${testInfo.project.name}-fight.png`) });

  await page.keyboard.press("KeyL");
  await page.waitForTimeout(140);
  await page.keyboard.press("KeyP");
  await expect.poll(() => phase(page)).toBe("pause");
  const controlSettings = page.getByRole("button", { name: "Control settings", exact: true });
  await controlSettings.focus();
  await expect(page.locator("#accessibleActions")).toHaveCSS("overflow", "visible");
  await page.keyboard.press("Enter");
  await expect(page.locator("#settingsPanel")).toBeVisible();
  await expect(page.locator("#keyBindings")).toContainText("TAUNT");
  await page.getByRole("button", { name: "Close control settings" }).click();
  await page.evaluate(() => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve))));
  const touchLabels = await page.locator("#mobileControls .touch:not(.blank)").allTextContents();
  expect(touchLabels.every((label) => label.trim().length > 0)).toBe(true);
  expect(touchLabels).toContain("TAUNT");
  if (!process.env.NO_TEST_ARTIFACTS) await page.screenshot({ path: testInfo.outputPath(`${testInfo.project.name}-pause.png`) });
  expect(pageErrors).toEqual([]);
});

test("Master Ezra plays a complete takeoff, apex, fall, and clean landing", async ({ page }, testInfo) => {
  await page.goto(gameUrl);
  await expect.poll(() => phase(page)).toBe("title");
  await enterTrainingFight(page);
  await expect.poll(() => page.evaluate(() => window.__gothTechnologyGame?.fighters?.[0]?.id)).toBe("MASTER_EZRA");

  const fighterMotion = () => page.evaluate(() => window.__gothTechnologyGame?.fighters?.[0]?.motion);
  await expect.poll(fighterMotion, { timeout: 1_500, intervals: [20] }).toBe("IDLE");
  await page.keyboard.down("KeyW");
  await expect.poll(fighterMotion, { timeout: 300, intervals: [10] }).toBe("JUMP_START");
  await page.keyboard.up("KeyW");
  await expect.poll(fighterMotion, { timeout: 600, intervals: [10] }).toBe("JUMP_RISE");
  await expect.poll(fighterMotion, { timeout: 600, intervals: [10] }).toBe("JUMP_PEAK");
  if (!process.env.NO_TEST_ARTIFACTS) await page.screenshot({ path: testInfo.outputPath("ezra-jump-peak.png") });
  await expect.poll(fighterMotion, { timeout: 600, intervals: [10] }).toBe("JUMP_FALL");
  await expect.poll(fighterMotion, { timeout: 800, intervals: [10] }).toBe("LANDING");
  await expect.poll(fighterMotion, { timeout: 500, intervals: [10] }).toBe("IDLE");
});

test("mobile portrait keeps controls adjacent to a useful playfield", async ({ page }, testInfo) => {
  test.skip(!testInfo.project.name.includes("mobile"), "Mobile layout check");
  await page.goto(gameUrl);
  await expect.poll(() => phase(page)).toBe("title");
  await expect(page.locator("#mobileControls")).toBeHidden();
  await enterTrainingFight(page);
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

test("mobile landscape reserves the combat controls below the playfield", async ({ page }, testInfo) => {
  test.skip(!testInfo.project.name.includes("mobile"), "Mobile layout check");
  await page.setViewportSize({ width: 915, height: 412 });
  await page.goto(gameUrl);
  await expect.poll(() => phase(page)).toBe("title");
  await expect(page.locator("#mobileControls")).toBeHidden();
  await enterTrainingFight(page);
  const layout = await page.evaluate(() => {
    const canvas = document.getElementById("game").getBoundingClientRect();
    const controls = document.getElementById("mobileControls").getBoundingClientRect();
    const pad = document.querySelector("#mobileControls .pad").getBoundingClientRect();
    const actions = document.querySelector("#mobileControls .buttons").getBoundingClientRect();
    const buttons = [...document.querySelectorAll("#mobileControls .touch:not(.blank)")].map((button) => button.getBoundingClientRect());
    return {
      gap: controls.top - canvas.bottom,
      minButtonWidth: Math.min(...buttons.map((button) => button.width)),
      minButtonHeight: Math.min(...buttons.map((button) => button.height)),
      controlsBottom: controls.bottom,
      viewportHeight: innerHeight,
      canvasWidth: canvas.width,
      canvasHeight: canvas.height,
      leftGap: canvas.left - pad.right,
      rightGap: actions.left - canvas.right
    };
  });
  expect(layout.canvasWidth).toBeGreaterThan(580);
  expect(layout.canvasHeight).toBeGreaterThan(320);
  expect(layout.leftGap).toBeGreaterThanOrEqual(0);
  expect(layout.rightGap).toBeGreaterThanOrEqual(0);
  expect(layout.minButtonWidth).toBeGreaterThanOrEqual(44);
  expect(layout.minButtonHeight).toBeGreaterThanOrEqual(44);
  expect(layout.controlsBottom).toBeLessThanOrEqual(layout.viewportHeight);
  if (!process.env.NO_TEST_ARTIFACTS) await page.screenshot({ path: testInfo.outputPath("mobile-landscape-title.png") });
});
