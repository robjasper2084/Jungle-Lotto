import { expect, test } from "playwright/test";

const gameUrl = "/games/gothtechnology2/";

const phase = (page) => page.evaluate(() => window.__gothTechnologyGame?.phase);

const clickGame = async (page, gameX, gameY) => {
  const canvas = page.locator("#game");
  const box = await canvas.boundingBox();
  if (!box) throw new Error("Game canvas is not visible");
  await canvas.click({ position: { x: gameX / 1280 * box.width, y: gameY / 720 * box.height } });
};

const advanceVersusToFight = async (page) => {
  await expect.poll(() => page.evaluate(() => ["versus", "fight"].includes(window.__gothTechnologyGame?.phase))).toBe(true);
  if (await phase(page) === "versus") {
    await expect.poll(
      () => page.evaluate(() => window.__gothTechnologyGame?.matchAssetsReady),
      { timeout: 15_000 }
    ).toBe(true);
    await page.evaluate(() => {
      const game = window.__gothTechnologyGame;
      game.roundMessageTimer = 0;
      game.update(game.fixedStep ?? 1 / 60);
    });
  }
  await page.evaluate(() => { window.__gothTechnologyGame.roundMessageTimer = 0; });
  await expect.poll(() => phase(page), { timeout: 2_000 }).toBe("fight");
};

const enterTrainingFight = async (page) => {
  await expect.poll(() => phase(page), { timeout: 30_000 }).toBe("title");
  await page.evaluate(() => window.__gothTechnologyGame.openMode("training"));
  await expect.poll(() => phase(page), { timeout: 30_000 }).toBe("select");
  await expect.poll(() => page.evaluate(() => window.__gothTechnologyGame?.matchAssetsReady), { timeout: 60_000 }).toBe(true);
  await clickGame(page, 804, 594);
  await advanceVersusToFight(page);
};

test("cross-browser smoke boots, starts a fight, and accepts pause input", async ({ page }) => {
  test.setTimeout(120_000);
  const pageErrors = [];
  page.on("pageerror", (error) => pageErrors.push(error.message));
  await page.goto(gameUrl);
  await expect.poll(() => phase(page), { timeout: 30_000 }).toBe("title");
  await page.evaluate(() => window.__gothTechnologyGame.openMode("versus"));
  await expect.poll(() => phase(page), { timeout: 30_000 }).toBe("select");
  await expect.poll(() => page.evaluate(() => window.__gothTechnologyGame?.matchAssetsReady), { timeout: 60_000 }).toBe(true);
  await clickGame(page, 804, 594);
  await advanceVersusToFight(page);
  const visibleSamples = await page.locator("#game").evaluate((canvas) => {
    const pixels = canvas.getContext("2d", { willReadFrequently: true }).getImageData(0, 0, canvas.width, canvas.height).data;
    let visible = 0;
    for (let offset = 0; offset < pixels.length; offset += 1600) {
      if (pixels[offset] + pixels[offset + 1] + pixels[offset + 2] > 24) visible += 1;
    }
    return visible;
  });
  expect(visibleSamples).toBeGreaterThan(100);
  await page.keyboard.press("KeyP");
  await expect.poll(() => phase(page)).toBe("pause");
  expect(pageErrors).toEqual([]);
});

test("boots, reaches versus, fights, and pauses without page errors", async ({ page }, testInfo) => {
  test.setTimeout(120_000);
  const pageErrors = [];
  page.on("pageerror", (error) => pageErrors.push(error.message));
  await page.goto(gameUrl);
  await expect.poll(() => phase(page)).toBe("title");
  const titleActions = await page.locator("#accessibleActions button").allTextContents();
  expect(titleActions.slice(0, 5)).toEqual(["Game select", "VERSUS", "ARCADE", "TRAINING", "REPLAY"]);
  expect(titleActions).not.toContain("SURVIVAL");
  expect(titleActions).not.toContain("CHALLENGE");
  await page.evaluate(() => window.__gothTechnologyGame.openMode("survival"));
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
  expect(loadedResources.some((url) => url.includes("gothtechnology-cover-start-bg.webp"))).toBe(false);
  expect(loadedResources.some((url) => url.includes("robot-rahbe-title-card.webp"))).toBe(false);
  expect(loadedResources.some((url) => url.includes("marquee-gameplay-keyart.webp"))).toBe(false);

  await clickGame(page, 280, 575);
  await expect.poll(() => phase(page)).toBe("gameSelect");
  await expect(page.locator("#accessibleActions")).toContainText("Play 2084 Static WAV");
  await expect.poll(() => page.evaluate(() => {
    const images = window.__gothTechnologyGame?.assets?.images;
    return images?.gameTitleGothtechnology?.naturalWidth > 0
      && images?.gameTitleRobotRahbe?.naturalWidth > 0
      && images?.gameTitleStaticWave?.naturalWidth > 0;
  })).toBe(true);
  const gameSelectResources = await page.evaluate(() => performance.getEntriesByType("resource").map((entry) => entry.name));
  expect(gameSelectResources.some((url) => url.includes("gothtechnology-cover-start-bg.webp"))).toBe(true);
  expect(gameSelectResources.some((url) => url.includes("robot-rahbe-title-card.webp"))).toBe(true);
  expect(gameSelectResources.some((url) => url.includes("marquee-gameplay-keyart.webp"))).toBe(true);
  if (!process.env.NO_TEST_ARTIFACTS) await page.screenshot({ path: testInfo.outputPath(`${testInfo.project.name}-game-select.png`) });
  await clickGame(page, 640, 623);
  await expect.poll(() => phase(page)).toBe("title");

  const nonBlankSamples = await page.locator("#game").evaluate((canvas) => {
    const data = canvas.getContext("2d").getImageData(0, 0, canvas.width, canvas.height).data;
    let visible = 0;
    for (let i = 0; i < data.length; i += 1600) {
      if (data[i] + data[i + 1] + data[i + 2] > 24) visible += 1;
    }
    return visible;
  });
  expect(nonBlankSamples).toBeGreaterThan(100);

  await page.evaluate(() => { window.__gothTechnologyGame.titleMenuIndex = 1; });
  await page.keyboard.down("Enter");
  await page.waitForTimeout(80);
  await page.keyboard.up("Enter");
  await expect.poll(() => phase(page), { timeout: 30_000 }).toBe("select");
  await expect.poll(() => page.evaluate(() => window.__gothTechnologyGame?.assets?.loadedCharacterMotions?.size), { timeout: 60_000 }).toBe(2);
  const selectedResources = await page.evaluate(() => performance.getEntriesByType("resource").map((entry) => entry.name));
  expect(selectedResources.filter((url) => url.includes("motion-atlases/") && new URL(url).pathname.endsWith(".webp"))).toHaveLength(6);
  expect(selectedResources.some((url) => url.includes("approved-poses/"))).toBe(false);
  expect(selectedResources.some((url) => url.includes("runtime_atlas_user"))).toBe(false);
  expect(selectedResources.some((url) => url.includes("user-sheets/"))).toBe(false);
  const spriteIntegrity = await page.evaluate(() => {
    const animations = window.__gothTechnologyGame.assets.animations;
    const emptyFrames = [];
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
          let visiblePixels = 0;
          for (let y = 0; y < frame.h; y += 1) {
            for (let x = 0; x < frame.w; x += 1) {
              if (rgba[(y * frame.w + x) * 4 + 3] <= 24) continue;
              visiblePixels += 1;
            }
          }
          if (!visiblePixels) emptyFrames.push(`${characterId}/${motionName}/${frameIndex + 1}`);
        });
      }
    }
    return { frameCount, insufficientUnique, emptyFrames };
  });
  expect(spriteIntegrity.frameCount).toBe(468);
  expect(spriteIntegrity.insufficientUnique).toEqual([]);
  expect(spriteIntegrity.emptyFrames).toEqual([]);
  const unstableRenderedMotions = await page.evaluate(async () => {
    const { drawSpriteFrame } = await import("./src/engine/assets.js?v=heartline29-amara-test");
    const animations = window.__gothTechnologyGame.assets.animations;
    const checkedMotions = [
      "IDLE", "READY_STANCE", "WALK_FORWARD", "RUN_FORWARD", "DASH_FORWARD",
      "CROUCH_IDLE", "CROUCH_WALK", "LIGHT_PUNCH", "HEAVY_KICK"
    ];
    const failures = [];
    for (const [characterId, motions] of Object.entries(animations)) {
      for (const motionName of checkedMotions) {
        const motion = motions[motionName];
        if (!motion) continue;
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
  await clickGame(page, 804, 594);
  await advanceVersusToFight(page);
  const hudIdentity = await page.evaluate(() => {
    const context = document.getElementById("game").getContext("2d", { willReadFrequently: true });
    const score = (x, width) => {
      const rgba = context.getImageData(x, 14, width, 6).data;
      let cyan = 0;
      let red = 0;
      for (let offset = 0; offset < rgba.length; offset += 4) {
        cyan = Math.max(cyan, rgba[offset + 1] + rgba[offset + 2] - rgba[offset]);
        red = Math.max(red, rgba[offset] * 2 - rgba[offset + 1] - rgba[offset + 2]);
      }
      return { cyan, red };
    };
    return { playerOne: score(40, 470), opponent: score(770, 470) };
  });
  expect(hudIdentity.playerOne.cyan).toBeGreaterThan(hudIdentity.playerOne.red);
  expect(hudIdentity.opponent.red).toBeGreaterThan(hudIdentity.opponent.cyan);
  if (!process.env.NO_TEST_ARTIFACTS) await page.screenshot({ path: testInfo.outputPath(`${testInfo.project.name}-fight.png`) });

  const companionWeapons = await page.evaluate(() => {
    const game = window.__gothTechnologyGame;
    game.hitstop = 10;
    game.effects.length = 0;
    game.projectiles.length = 0;
    const kalyx = game.fighters.find((fighter) => fighter.config.manifestKey === "KALYX");
    const ezra = game.fighters.find((fighter) => fighter.config.manifestKey === "MASTER_EZRA");
    game.spawnProjectile(kalyx, "special");
    game.spawnProjectile(ezra, "special");
    const raven = game.projectiles.find((projectile) => projectile.kind === "shadow-raven");
    const owl = game.projectiles.find((projectile) => projectile.kind === "arcane-owl");
    raven.x = 760;
    raven.y = 430;
    raven.age = 0.16;
    owl.x = 520;
    owl.y = 430;
    owl.age = 0.16;
    game.render();
    return {
      kinds: game.projectiles.map((projectile) => projectile.kind).sort(),
      ravenSize: [raven.image.naturalWidth, raven.image.naturalHeight],
      owlSize: [owl.image.naturalWidth, owl.image.naturalHeight],
      effects: game.effects.length
    };
  });
  expect(companionWeapons).toEqual({
    kinds: ["arcane-owl", "shadow-raven"],
    ravenSize: [1536, 256],
    owlSize: [1536, 256],
    effects: 0
  });
  if (!process.env.NO_TEST_ARTIFACTS) await page.screenshot({ path: testInfo.outputPath(`${testInfo.project.name}-companion-weapons.png`) });
  await page.evaluate(() => {
    const game = window.__gothTechnologyGame;
    game.projectiles.length = 0;
    game.hitstop = 0;
  });

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
  expect(touchLabels).toContain("MOD");
  expect(touchLabels).not.toContain("TAUNT");
  if (!process.env.NO_TEST_ARTIFACTS) await page.screenshot({ path: testInfo.outputPath(`${testInfo.project.name}-pause.png`) });
  expect(pageErrors).toEqual([]);
});

test("game grid selects and launches 2084 Static WAV", async ({ page }) => {
  await page.goto(gameUrl);
  await expect.poll(() => phase(page)).toBe("title");
  await page.evaluate(() => window.__gothTechnologyGame.openGameSelect());
  await expect.poll(() => phase(page)).toBe("gameSelect");
  await expect.poll(() => page.evaluate(() => window.__gothTechnologyGame.assets.images.gameTitleStaticWave?.naturalWidth > 0)).toBe(true);

  await page.keyboard.press("ArrowRight");
  await expect.poll(() => page.evaluate(() => window.__gothTechnologyGame.gameSelectIndex)).toBe(1);
  await page.keyboard.press("ArrowRight");
  await expect.poll(() => page.evaluate(() => window.__gothTechnologyGame.gameSelectIndex)).toBe(2);

  await Promise.all([
    page.waitForURL(/\/games\/opengw-levels\//),
    page.keyboard.press("Enter")
  ]);
  await expect(page).toHaveTitle(/2084 Static Wave/i);
});

test("keyboard movement remaps, swaps conflicts, and persists", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "desktop-chromium", "Keyboard persistence needs one desktop browser pass");
  await page.goto(gameUrl);
  await expect.poll(() => phase(page)).toBe("title");
  await page.evaluate(() => window.__gothTechnologyGame.openSettings());
  await expect(page.locator("#settingsPanel")).toBeVisible();

  await page.getByRole("button", { name: "MOVE LEFT, player 1, A" }).click();
  await page.keyboard.press("KeyQ");
  await expect(page.getByRole("button", { name: "MOVE LEFT, player 1, Q" })).toBeVisible();

  await page.getByRole("button", { name: "MOVE RIGHT, player 1, D" }).click();
  await page.keyboard.press("KeyQ");
  await expect(page.getByRole("button", { name: "MOVE RIGHT, player 1, Q" })).toBeVisible();
  await expect(page.getByRole("button", { name: "MOVE LEFT, player 1, D" })).toBeVisible();
  await expect(page.locator("#bindingStatus")).toContainText("moved to D");

  await page.getByRole("button", { name: "Close control settings" }).click();
  await page.evaluate(() => { window.__gothTechnologyGame.titleMenuIndex = 0; });
  await page.keyboard.press("KeyQ");
  await expect.poll(() => page.evaluate(() => window.__gothTechnologyGame.titleMenuIndex)).toBe(1);
  await page.keyboard.press("KeyD");
  await expect.poll(() => page.evaluate(() => window.__gothTechnologyGame.titleMenuIndex)).toBe(0);

  await page.reload();
  await expect.poll(() => phase(page)).toBe("title");
  await page.evaluate(() => window.__gothTechnologyGame.openSettings());
  await expect(page.getByRole("button", { name: "MOVE RIGHT, player 1, Q" })).toBeVisible();
  await expect(page.getByRole("button", { name: "MOVE LEFT, player 1, D" })).toBeVisible();
  await page.getByRole("button", { name: "MOVE LEFT, player 1, D" }).scrollIntoViewIfNeeded();
  if (!process.env.NO_TEST_ARTIFACTS) await page.screenshot({ path: testInfo.outputPath("keyboard-remapping.png") });
  await page.getByRole("button", { name: "MOVE LEFT, player 1, D" }).click();
  await page.keyboard.press("Backspace");
  await expect(page.getByRole("button", { name: "MOVE LEFT, player 1, Unbound" })).toBeVisible();
  await page.getByRole("button", { name: "RESET KEYS" }).click();
  await expect(page.getByRole("button", { name: "MOVE LEFT, player 1, A" })).toBeVisible();
  await expect(page.getByRole("button", { name: "MOVE RIGHT, player 1, D" })).toBeVisible();
});

test("repaired motion pixels remain unclipped single-body silhouettes", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "desktop-chromium", "Atlas pixels only need one browser pass");
  test.setTimeout(120_000);
  await page.goto(gameUrl);
  await expect.poll(() => phase(page)).toBe("title");

  const results = await page.evaluate(async () => {
    const [manifest, qa] = await Promise.all([
      fetch("assets/motion-atlases/motion-atlas-manifest.json").then((response) => response.json()),
      fetch("assets/motion-atlases/motion-semantic-qa.json").then((response) => response.json())
    ]);
    const images = new Map();
    const loadImage = async (url) => {
      if (!images.has(url)) {
        images.set(url, new Promise((resolve, reject) => {
          const image = new Image();
          image.onload = () => resolve(image);
          image.onerror = () => reject(new Error(`Unable to load ${url}`));
          image.src = `${url}?semantic-pixel-test=1`;
        }));
      }
      return images.get(url);
    };
    const canvas = document.createElement("canvas");
    canvas.width = 96;
    canvas.height = 96;
    const context = canvas.getContext("2d", { willReadFrequently: true });
    const dividerCanvas = document.createElement("canvas");
    dividerCanvas.width = 192;
    dividerCanvas.height = 192;
    const dividerContext = dividerCanvas.getContext("2d", { willReadFrequently: true });
    const connectedComponents = (mask, width, height) => {
      const visited = new Uint8Array(mask.length);
      const components = [];
      for (let start = 0; start < mask.length; start += 1) {
        if (!mask[start] || visited[start]) continue;
        const stack = [start];
        visited[start] = 1;
        let area = 0;
        let minX = width;
        let maxX = 0;
        let minY = height;
        let maxY = 0;
        while (stack.length) {
          const current = stack.pop();
          const x = current % width;
          const y = Math.floor(current / width);
          area += 1;
          minX = Math.min(minX, x);
          maxX = Math.max(maxX, x);
          minY = Math.min(minY, y);
          maxY = Math.max(maxY, y);
          for (const [nextX, nextY] of [[x - 1, y], [x + 1, y], [x, y - 1], [x, y + 1]]) {
            if (nextX < 0 || nextX >= width || nextY < 0 || nextY >= height) continue;
            const next = nextY * width + nextX;
            if (!mask[next] || visited[next]) continue;
            visited[next] = 1;
            stack.push(next);
          }
        }
        const componentWidth = maxX - minX + 1;
        const componentHeight = maxY - minY + 1;
        components.push({
          area,
          width: componentWidth,
          height: componentHeight,
          density: area / (componentWidth * componentHeight)
        });
      }
      return components;
    };
    const countStraightAlphaDividers = (pixels) => {
      const width = 192;
      const height = 192;
      const radius = 18;
      const alpha = new Uint8Array(width * height);
      for (let index = 0; index < alpha.length; index += 1) {
        alpha[index] = pixels[index * 4 + 3] > 24 ? 1 : 0;
      }
      let count = 0;
      for (const horizontal of [true, false]) {
        const bridge = new Uint8Array(alpha.length);
        if (horizontal) {
          for (let y = radius; y < height - radius; y += 1) {
            for (let x = 0; x < width; x += 1) {
              if (alpha[y * width + x]) continue;
              let above = 0;
              let below = 0;
              for (let offset = 1; offset <= radius && !above; offset += 1) above = alpha[(y - offset) * width + x];
              for (let offset = 1; offset <= radius && !below; offset += 1) below = alpha[(y + offset) * width + x];
              if (above && below) bridge[y * width + x] = 1;
            }
          }
        } else {
          for (let y = 0; y < height; y += 1) {
            for (let x = radius; x < width - radius; x += 1) {
              if (alpha[y * width + x]) continue;
              let left = 0;
              let right = 0;
              for (let offset = 1; offset <= radius && !left; offset += 1) left = alpha[y * width + x - offset];
              for (let offset = 1; offset <= radius && !right; offset += 1) right = alpha[y * width + x + offset];
              if (left && right) bridge[y * width + x] = 1;
            }
          }
        }
        count += connectedComponents(bridge, width, height).filter((component) => {
          const length = horizontal ? component.width : component.height;
          const thickness = horizontal ? component.height : component.width;
          return length >= 44 && thickness <= 10 && length >= thickness * 8 && component.density >= 0.88;
        }).length;
      }
      return count;
    };
    const inspectFrame = async (motion, frame) => {
      const image = await loadImage(motion.sheet);
      context.clearRect(0, 0, 96, 96);
      context.drawImage(image, frame.x, frame.y, frame.w, frame.h, 0, 0, 96, 96);
      const pixels = context.getImageData(0, 0, 96, 96).data;
      dividerContext.clearRect(0, 0, 192, 192);
      dividerContext.drawImage(image, frame.x, frame.y, frame.w, frame.h, 0, 0, 192, 192);
      const straightAlphaDividers = countStraightAlphaDividers(
        dividerContext.getImageData(0, 0, 192, 192).data
      );
      const mask = new Uint8Array(96 * 96);
      const dark = new Uint8Array(96 * 96);
      let opaque = 0;
      let edge = 0;
      let minOpaqueX = 96;
      let maxOpaqueX = -1;
      let hash = 2166136261;
      for (let index = 0; index < mask.length; index += 1) {
        const visible = pixels[index * 4 + 3] > 24 ? 1 : 0;
        mask[index] = visible;
        dark[index] = visible && Math.max(pixels[index * 4], pixels[index * 4 + 1], pixels[index * 4 + 2]) < 40 ? 1 : 0;
        hash = Math.imul(hash ^ visible, 16777619) >>> 0;
        if (!visible) continue;
        opaque += 1;
        const x = index % 96;
        const y = Math.floor(index / 96);
        minOpaqueX = Math.min(minOpaqueX, x);
        maxOpaqueX = Math.max(maxOpaqueX, x);
        if (x < 2 || y < 2 || x > 93 || y > 93) edge += 1;
      }
      const dilated = new Uint8Array(mask.length);
      for (let y = 0; y < 96; y += 1) {
        for (let x = 0; x < 96; x += 1) {
          if (!mask[y * 96 + x]) continue;
          for (let dy = -1; dy <= 1; dy += 1) {
            for (let dx = -1; dx <= 1; dx += 1) {
              const nx = x + dx;
              const ny = y + dy;
              if (nx >= 0 && nx < 96 && ny >= 0 && ny < 96) dilated[ny * 96 + nx] = 1;
            }
          }
        }
      }
      const visited = new Uint8Array(mask.length);
      let largeComponents = 0;
      for (let start = 0; start < dilated.length; start += 1) {
        if (!dilated[start] || visited[start]) continue;
        const stack = [start];
        visited[start] = 1;
        let area = 0;
        while (stack.length) {
          const current = stack.pop();
          area += 1;
          const x = current % 96;
          const y = Math.floor(current / 96);
          for (const next of [current - 1, current + 1, current - 96, current + 96]) {
            if (next < 0 || next >= dilated.length || visited[next] || !dilated[next]) continue;
            const nx = next % 96;
            const ny = Math.floor(next / 96);
            if (Math.abs(nx - x) + Math.abs(ny - y) !== 1) continue;
            visited[next] = 1;
            stack.push(next);
          }
        }
        if (area >= 6) largeComponents += 1;
      }
      const isolatedDarkLinePixels = connectedComponents(dark, 96, 96)
        .filter((component) => {
          const length = Math.max(component.width, component.height);
          const thickness = Math.min(component.width, component.height);
          return length >= 48 && thickness <= 4 && length >= thickness * 10 && component.density >= 0.85;
        })
        .reduce((sum, component) => sum + component.area, 0);
      return {
        opaque,
        opaqueWidth: maxOpaqueX >= minOpaqueX ? maxOpaqueX - minOpaqueX + 1 : 0,
        edgeRatio: edge / Math.max(1, opaque),
        hash,
        largeComponents,
        isolatedDarkLinePixels,
        straightAlphaDividers
      };
    };

    const output = [];
    for (const [key, rule] of Object.entries(qa.motions)) {
      const [characterId, motionName] = key.split("/");
      const character = manifest.characters[characterId];
      const motion = character.motions[motionName];
      const idle = character.motions.IDLE;
      const idleFrames = await Promise.all(idle.frames.map((frame) => inspectFrame(idle, frame)));
      const idleArea = idleFrames.reduce((sum, frame) => sum + frame.opaque, 0) / idleFrames.length;
      const idleWidth = idleFrames.reduce((sum, frame) => sum + frame.opaqueWidth, 0) / idleFrames.length;
      const frames = await Promise.all(motion.frames.map((frame) => inspectFrame(motion, frame)));
      output.push({
        key,
        uniqueSilhouettes: new Set(frames.map((frame) => frame.hash)).size,
        maxEdgePixelRatio: Math.max(...frames.map((frame) => frame.edgeRatio)),
        maxOpaqueAreaRatioToIdle: Math.max(...frames.map((frame) => frame.opaque / idleArea)),
        wideFrameCount: rule.minWideFrameWidthRatioToIdle
          ? frames.filter((frame) => frame.opaqueWidth / idleWidth >= rule.minWideFrameWidthRatioToIdle).length
          : null,
        maxLargeComponents: Math.max(...frames.map((frame) => frame.largeComponents)),
        maxIsolatedDarkLinePixels: Math.max(...frames.map((frame) => frame.isolatedDarkLinePixels)),
        maxStraightAlphaDividers: Math.max(...frames.map((frame) => frame.straightAlphaDividers)),
        rule
      });
    }
    return output;
  });

  for (const result of results) {
    expect(result.uniqueSilhouettes, `${result.key} repeated a silhouette`).toBeGreaterThanOrEqual(result.rule.minUniqueSilhouettes);
    expect(result.maxEdgePixelRatio, `${result.key} touches a frame edge`).toBeLessThanOrEqual(result.rule.maxEdgePixelRatio);
    expect(result.maxOpaqueAreaRatioToIdle, `${result.key} likely contains an extra figure`).toBeLessThanOrEqual(result.rule.maxOpaqueAreaRatioToIdle);
    if (result.rule.minWideFrameCount) {
      expect(result.wideFrameCount, `${result.key} loses its extended striking limb`).toBeGreaterThanOrEqual(result.rule.minWideFrameCount);
    }
    expect(result.maxLargeComponents, `${result.key} contains detached body fragments`).toBeLessThanOrEqual(result.rule.maxLargeComponents);
    expect(result.maxIsolatedDarkLinePixels, `${result.key} contains an isolated dark atlas line`).toBeLessThanOrEqual(result.rule.maxIsolatedDarkLinePixels);
    expect(result.maxStraightAlphaDividers, `${result.key} contains a straight transparent atlas cut`).toBe(0);
  }
});

test("Detroit Lens Noir loads the Boerboel, eye laser, and six arenas", async ({ page }, testInfo) => {
  test.setTimeout(180_000);
  const pageErrors = [];
  page.on("pageerror", (error) => pageErrors.push(error.message));
  await page.goto(gameUrl);
  await expect.poll(() => phase(page)).toBe("title");
  await expect.poll(() => page.evaluate(() => {
    const images = window.__gothTechnologyGame?.assets?.images;
    return [
      images?.kalyxPortrait,
      images?.masterEzraPortrait,
      images?.detroitLensNoirPortrait,
      images?.amaraValentinePortrait,
      images?.kalyxHeadshot,
      images?.masterEzraHeadshot,
      images?.detroitLensNoirHeadshot,
      images?.amaraValentineHeadshot
    ]
      .map((image) => image?.naturalWidth ?? 0);
  })).toEqual([256, 256, 256, 256, 256, 256, 256, 256]);
  const portraitMetrics = await page.evaluate(() => {
    const images = window.__gothTechnologyGame.assets.images;
    return [images.kalyxPortrait, images.masterEzraPortrait, images.detroitLensNoirPortrait, images.amaraValentinePortrait].map((image) => {
      const canvas = document.createElement("canvas");
      canvas.width = image.naturalWidth;
      canvas.height = image.naturalHeight;
      const context = canvas.getContext("2d", { willReadFrequently: true });
      context.drawImage(image, 0, 0);
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
      return { height: maxY - minY + 1, bottom: maxY };
    });
  });
  expect(Math.max(...portraitMetrics.map(({ height }) => height)) - Math.min(...portraitMetrics.map(({ height }) => height))).toBeLessThanOrEqual(2);
  expect(Math.min(...portraitMetrics.map(({ height }) => height))).toBeGreaterThanOrEqual(232);
  expect(Math.max(...portraitMetrics.map(({ bottom }) => bottom)) - Math.min(...portraitMetrics.map(({ bottom }) => bottom))).toBeLessThanOrEqual(2);
  const headshotMetrics = await page.evaluate(() => {
    const images = window.__gothTechnologyGame.assets.images;
    return [images.kalyxHeadshot, images.masterEzraHeadshot, images.detroitLensNoirHeadshot, images.amaraValentineHeadshot].map((image) => {
      const canvas = document.createElement("canvas");
      canvas.width = image.naturalWidth;
      canvas.height = image.naturalHeight;
      const context = canvas.getContext("2d", { willReadFrequently: true });
      context.drawImage(image, 0, 0);
      const rgba = context.getImageData(0, 0, canvas.width, canvas.height).data;
      let opaque = 0;
      let bottom = -1;
      for (let y = 0; y < canvas.height; y += 1) {
        for (let x = 0; x < canvas.width; x += 1) {
          if (rgba[(y * canvas.width + x) * 4 + 3] <= 8) continue;
          opaque += 1;
          bottom = y;
        }
      }
      return { opaque, bottom };
    });
  });
  expect(Math.min(...headshotMetrics.map(({ opaque }) => opaque))).toBeGreaterThan(24_000);
  expect(Math.max(...headshotMetrics.map(({ bottom }) => bottom)) - Math.min(...headshotMetrics.map(({ bottom }) => bottom))).toBeLessThanOrEqual(2);
  await page.evaluate(() => window.__gothTechnologyGame.openMode("training"));
  await expect.poll(() => phase(page), { timeout: 30_000 }).toBe("select");
  await expect.poll(() => page.evaluate(() => window.__gothTechnologyGame?.matchAssetsReady), { timeout: 60_000 }).toBe(true);
  const rosterActions = await page.locator("#accessibleActions button").allTextContents();
  expect(rosterActions).toEqual(expect.arrayContaining([
    "Choose KALYX for Player 1",
    "Choose MASTER EZRA for Player 1",
    "Choose DETROIT LENS NOIR for Player 1",
    "Choose AMARA VALENTINE for Player 1"
  ]));
  expect(rosterActions.some((label) => label.includes("Choose DETROIT LENS for"))).toBe(false);
  expect(rosterActions.some((label) => label.includes("KALYX ECLIPSE"))).toBe(false);
  expect(rosterActions.some((label) => label.includes("EZRA ASCENDANT"))).toBe(false);

  await clickGame(page, 793, 330);
  await expect.poll(() => page.evaluate(() => window.__gothTechnologyGame?.player1Id)).toBe("DETROIT_LENS_NOIR");
  await expect.poll(() => page.evaluate(() => window.__gothTechnologyGame?.assets?.loadedCharacterMotions?.has("DETROIT_LENS_NOIR")), { timeout: 10_000 }).toBe(true);
  const noirIntegrity = await page.evaluate(() => {
    const motions = window.__gothTechnologyGame.assets.animations.DETROIT_LENS_NOIR;
    return {
      count: Object.keys(motions).length,
      complete: Object.values(motions).every((motion) => motion.frames.length === 6 && motion.uniqueFrames >= 6),
      source: motions.IDLE.image.src
    };
  });
  expect(noirIntegrity.count).toBe(39);
  expect(noirIntegrity.complete).toBe(true);
  expect(noirIntegrity.source).toContain("detroit-lens-noir-locomotion.webp");
  if (!process.env.NO_TEST_ARTIFACTS) await page.screenshot({ path: testInfo.outputPath("detroit-lens-noir-select.png") });

  while (await page.evaluate(() => window.__gothTechnologyGame.stageIndex) !== 1) {
    await clickGame(page, 476, 596);
  }
  await clickGame(page, 804, 594);
  await advanceVersusToFight(page);

  const expansionState = await page.evaluate(async () => {
    const game = window.__gothTechnologyGame;
    const { STAGES } = await import("./src/config/content.js?v=browser-stage-audit");
    const fighter = game.fighters[0];
    const target = game.fighters[1];
    game.stopped = true;
    game.projectiles.length = 0;
    game.effects.length = 0;
    fighter.x = 220;
    fighter.facing = 1;
    target.x = 1040;
    target.y = fighter.y;
    target.facing = -1;
    target.health = target.config.maxHealth;
    target.currentAttack = null;
    target.hitstun = 0;
    target.blockstun = 0;
    target.knockdown = 0;
    target.invulnerable = 0;
    target.parryTimer = 0;
    target.lastActions = {};
    target.setMotion("IDLE", true);
    fighter.comboHits = 0;
    fighter.comboDamage = 0;
    fighter.comboTimer = 0;
    game.spawnProjectile(fighter, "special");
    const dog = game.projectiles[0];
    const dogPhases = [dog.phase];
    const dogHealthBefore = target.health;
    for (let frame = 0; frame < 180 && !dog.dead; frame += 1) {
      const previousPhase = dog.phase;
      dog.update(1 / 60, game);
      if (dog.phase !== previousPhase) dogPhases.push(dog.phase);
    }
    const dogDamage = dogHealthBefore - target.health;

    target.health = target.config.maxHealth;
    target.currentAttack = null;
    target.hitstun = 0;
    target.blockstun = 0;
    target.knockdown = 0;
    target.invulnerable = 0;
    target.parryTimer = 0;
    target.lastActions = {};
    target.setMotion("IDLE", true);
    fighter.comboHits = 0;
    fighter.comboDamage = 0;
    fighter.comboTimer = 0;
    game.spawnProjectile(fighter, "super");
    const laser = game.projectiles.at(-1);
    const originalPosition = { x: fighter.x, y: fighter.y };
    fighter.x += 48;
    fighter.y -= 18;
    const laserHealthBefore = target.health;
    const targetHurtboxBeforeLaser = { ...target.hurtbox };
    laser.update(0.01, game);
    const laserSocket = { x: laser.x - fighter.x, y: laser.y - fighter.y };
    const laserAnchored = laserSocket.x === 34 && laserSocket.y === -238;
    const laserSpansOpponent = laser.rect.x <= targetHurtboxBeforeLaser.x
      && laser.rect.x + laser.rect.w >= targetHurtboxBeforeLaser.x + targetHurtboxBeforeLaser.w;
    const laserOverlapsOpponent = laser.rect.y <= targetHurtboxBeforeLaser.y + targetHurtboxBeforeLaser.h
      && laser.rect.y + laser.rect.h >= targetHurtboxBeforeLaser.y;
    laser.update(0.08, game);
    laser.update(0.08, game);
    const laserDamage = laserHealthBefore - target.health;
    fighter.x = originalPosition.x;
    fighter.y = originalPosition.y;
    laser.update(0, game);
    game.effects.length = 0;
    game.spawnFighterVfx(fighter, "special", "charge");
    return {
      projectileKinds: game.projectiles.map((projectile) => projectile.kind),
      laserSocket,
      laserAnchored,
      laserSpansOpponent,
      laserOverlapsOpponent,
      laserHitCount: laser.hitCount,
      dogDamage,
      laserDamage,
      dogPhases,
      hasTabletEffect: game.effects.some((effect) => effect.constructor.name === "AttachedImageEffect"),
      duplicateSpecialEffects: game.effects.length,
      idleDisplayMotion: fighter.config.motionRemap?.IDLE,
      specialDisplayMotion: fighter.config.motionRemap?.SPECIAL_START,
      dogReady: game.assets.images.detroitBoerboel?.naturalWidth === 1152,
      stage: game.stageIndex,
      stageIds: STAGES.map((stage) => stage.id),
      stageReady: game.assets.images.detroitMidnightMile?.naturalWidth > 0,
      deferredStages: [
        game.assets.images.detroitRiverfront,
        game.assets.images.easternMarketAfterDark,
        game.assets.images.michiganCentralConcourse
      ].every((image) => !image)
    };
  });
  expect(expansionState).toEqual({
    projectileKinds: ["boerboel-rush", "eye-laser"],
    laserSocket: { x: 34, y: -238 },
    laserAnchored: true,
    laserSpansOpponent: true,
    laserOverlapsOpponent: true,
    laserHitCount: 3,
    dogDamage: 104,
    laserDamage: 249,
    dogPhases: ["summon", "run", "attack", "recover"],
    hasTabletEffect: false,
    duplicateSpecialEffects: 0,
    idleDisplayMotion: "READY_STANCE",
    specialDisplayMotion: "SPECIAL_PROJECTILE",
    dogReady: true,
    stage: 1,
    stageIds: [
      "forest-ruin",
      "detroit-midnight-mile",
      "motor-city-assembly",
      "detroit-riverfront",
      "eastern-market-after-dark",
      "michigan-central-concourse"
    ],
    stageReady: true,
    deferredStages: true
  });
  const laserScaleProfile = await page.evaluate(() => {
    const fighter = window.__gothTechnologyGame.fighters[0];
    const canvas = document.createElement("canvas");
    canvas.width = 1280;
    canvas.height = 720;
    const context = canvas.getContext("2d", { willReadFrequently: true });
    const originalMotion = fighter.motion;
    const originalElapsed = fighter.motionElapsed;
    const originalFrameResolver = fighter.getMotionFrameIndex;
    const originalInvulnerable = fighter.invulnerable;
    fighter.invulnerable = 0;
    const maxHeight = (motion) => Math.max(...fighter.assets.animations.DETROIT_LENS_NOIR[motion].frames.map((_, frameIndex) => {
      context.clearRect(0, 0, canvas.width, canvas.height);
      fighter.motion = motion;
      fighter.motionElapsed = 0;
      fighter.getMotionFrameIndex = () => frameIndex;
      fighter.render(context, false);
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
      return maxY - minY + 1;
    }));
    const heights = { idle: maxHeight("IDLE"), laser: maxHeight("SUPER_RELEASE") };
    fighter.motion = originalMotion;
    fighter.motionElapsed = originalElapsed;
    fighter.getMotionFrameIndex = originalFrameResolver;
    fighter.invulnerable = originalInvulnerable;
    return heights;
  });
  expect(laserScaleProfile.laser / laserScaleProfile.idle).toBeGreaterThanOrEqual(0.98);
  expect(laserScaleProfile.laser / laserScaleProfile.idle).toBeLessThanOrEqual(1.02);
  await page.evaluate(() => {
    const game = window.__gothTechnologyGame;
    const fighter = game.fighters[0];
    game.stopped = true;
    game.effects.length = 0;
    game.projectiles.length = 0;
    fighter.invulnerable = 0;
    fighter.setMotion("SUPER_RELEASE", true);
    game.spawnProjectile(fighter, "super");
    game.render();
  });
  if (!process.env.NO_TEST_ARTIFACTS) await page.screenshot({ path: testInfo.outputPath(`${testInfo.project.name}-detroit-eye-laser.png`) });
  await page.evaluate(() => {
    const game = window.__gothTechnologyGame;
    const fighter = game.fighters[0];
    game.stopped = true;
    game.effects.length = 0;
    game.projectiles.length = 0;
    fighter.setMotion("SPECIAL_START", true);
    game.spawnProjectile(fighter, "special");
    const dog = game.projectiles[0];
    dog.setPhase("run");
    dog.x = fighter.x + fighter.facing * 150;
    dog.phaseAge = 0.14;
    game.render();
  });
  if (!process.env.NO_TEST_ARTIFACTS) await page.screenshot({ path: testInfo.outputPath(`${testInfo.project.name}-detroit-boerboel-clean.png`) });
  if (!process.env.NO_TEST_ARTIFACTS) await page.screenshot({ path: testInfo.outputPath(`${testInfo.project.name}-detroit-midnight-mile.png`) });

  const secondStageReady = await page.evaluate(async () => {
    const game = window.__gothTechnologyGame;
    game.stageIndex = 2;
    game.stageCache = null;
    await game.prepareStageAssets();
    game.render();
    return game.assets.images.motorCityAssembly?.naturalWidth > 0;
  });
  expect(secondStageReady).toBe(true);
  if (!process.env.NO_TEST_ARTIFACTS) await page.screenshot({ path: testInfo.outputPath(`${testInfo.project.name}-motor-city-assembly.png`) });

  for (const [stageIndex, slug] of [[3, "detroit-riverfront"], [4, "eastern-market-after-dark"], [5, "michigan-central-concourse"]]) {
    const ready = await page.evaluate(async (index) => {
      const game = window.__gothTechnologyGame;
      game.stageIndex = index;
      game.stageCache = null;
      await game.prepareStageAssets();
      game.render();
      return Boolean(game.stageCache);
    }, stageIndex);
    expect(ready).toBe(true);
    if (!process.env.NO_TEST_ARTIFACTS) await page.screenshot({ path: testInfo.outputPath(`${testInfo.project.name}-${slug}.png`) });
  }
  expect(pageErrors).toEqual([]);
});

test("versus lets the player choose the CPU fighter independently", async ({ page }, testInfo) => {
  test.setTimeout(120_000);
  await page.goto(gameUrl);
  await expect.poll(() => phase(page)).toBe("title");
  await page.evaluate(() => window.__gothTechnologyGame.openMode("versus"));
  await expect.poll(() => phase(page)).toBe("select");

  await clickGame(page, 792, 114);
  await expect.poll(() => page.evaluate(() => window.__gothTechnologyGame.selectTarget)).toBe("p2");
  await clickGame(page, 793, 330);
  await expect.poll(() => page.evaluate(() => ({
    player1Id: window.__gothTechnologyGame.player1Id,
    player2Id: window.__gothTechnologyGame.player2Id
  }))).toEqual({ player1Id: "MASTER_EZRA", player2Id: "DETROIT_LENS_NOIR" });

  await clickGame(page, 488, 114);
  await clickGame(page, 179, 330);
  await expect.poll(() => page.evaluate(() => ({
    player1Id: window.__gothTechnologyGame.player1Id,
    player2Id: window.__gothTechnologyGame.player2Id
  }))).toEqual({ player1Id: "KALYX", player2Id: "DETROIT_LENS_NOIR" });
  await expect(page.locator("#accessibleActions")).toContainText("Select CPU opponent");
  if (!process.env.NO_TEST_ARTIFACTS) await page.screenshot({ path: testInfo.outputPath("independent-cpu-selection.png") });
});

test("fighter cards advance from Player 1 to the opponent choice", async ({ page }, testInfo) => {
  test.setTimeout(120_000);
  await page.goto(gameUrl);
  await expect.poll(() => phase(page)).toBe("title");
  await page.evaluate(() => window.__gothTechnologyGame.openMode("versus"));
  await expect.poll(() => phase(page)).toBe("select");

  await clickGame(page, 1100, 330);
  await expect.poll(() => page.evaluate(() => ({
    player1Id: window.__gothTechnologyGame.player1Id,
    player2Id: window.__gothTechnologyGame.player2Id,
    selectTarget: window.__gothTechnologyGame.selectTarget
  }))).toEqual({
    player1Id: "AMARA_VALENTINE",
    player2Id: "KALYX",
    selectTarget: "p2"
  });
  await expect(page.locator("#accessibleActions")).toContainText("Choose DETROIT LENS NOIR for CPU opponent");

  await clickGame(page, 793, 330);
  await expect.poll(() => page.evaluate(() => ({
    player1Id: window.__gothTechnologyGame.player1Id,
    player2Id: window.__gothTechnologyGame.player2Id,
    selectTarget: window.__gothTechnologyGame.selectTarget
  }))).toEqual({
    player1Id: "AMARA_VALENTINE",
    player2Id: "DETROIT_LENS_NOIR",
    selectTarget: "p2"
  });
  if (!process.env.NO_TEST_ARTIFACTS) await page.screenshot({ path: testInfo.outputPath("guided-fighter-selection.png") });
});

test("fighter selection finishes the latest requested motion load", async ({ page }, testInfo) => {
  test.setTimeout(120_000);
  test.skip(testInfo.project.name.includes("mobile"), "Cold-load race check runs on desktop");
  await page.route("**/motion-atlases/*.webp*", async (route) => {
    await new Promise((resolve) => setTimeout(resolve, 350));
    await route.continue();
  });
  await page.goto(gameUrl);
  await expect.poll(() => phase(page)).toBe("title");
  await page.evaluate(() => {
    const game = window.__gothTechnologyGame;
    game.openMode("versus");
    game.setSelectionTarget("p2");
    game.selectCharacter("DETROIT_LENS_NOIR");
  });
  await expect.poll(() => page.evaluate(() => window.__gothTechnologyGame.motionAssetsReady), { timeout: 60_000 }).toBe(true);
  const state = await page.evaluate(() => {
    const game = window.__gothTechnologyGame;
    return {
      selected: [game.player1Id, game.player2Id],
      loaded: [...game.assets.loadedCharacterMotions],
      p2Animation: Boolean(game.fighters[1].activeAnimation)
    };
  });
  expect(state.selected).toEqual(["MASTER_EZRA", "DETROIT_LENS_NOIR"]);
  expect(state.loaded).toEqual(expect.arrayContaining(state.selected));
  expect(state.p2Animation).toBe(true);
});

test("controller-style directions and attack buttons navigate menus", async ({ page }) => {
  await page.goto(gameUrl);
  await expect.poll(() => phase(page)).toBe("title");
  const result = await page.evaluate(() => {
    const game = window.__gothTechnologyGame;
    const tap = (action) => {
      game.input.press(action);
      game.handleGlobalInput();
      game.input.release(action);
      game.input.endFrame();
    };
    tap("p1.right");
    const selectedIndex = game.titleMenuIndex;
    tap("p1.lightPunch");
    return { selectedIndex, phase: game.phase, mode: game.gameMode };
  });
  expect(result).toEqual({ selectedIndex: 1, phase: "select", mode: "versus" });
});

test("standard Gamepad API controller navigates, fights, pauses, rumbles, and keeps player slots", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "desktop-chromium", "Virtual Gamepad API coverage only needs one browser pass");
  test.setTimeout(120_000);
  await page.addInitScript(() => {
    const makePad = (index, id) => {
      const buttons = Array.from({ length: 17 }, () => ({ pressed: false, touched: false, value: 0 }));
      const pad = {
        id,
        index,
        connected: true,
        mapping: "standard",
        axes: [0, 0, 0, 0],
        buttons,
        vibrationActuator: {
          playEffect: (type, options) => {
            window.__gamepadRumbleCalls.push({ index, type, options });
            return Promise.resolve("complete");
          }
        }
      };
      return pad;
    };
    const pads = [makePad(0, "Virtual Xbox Controller"), makePad(1, "Virtual PlayStation Controller")];
    const connected = new Set();
    window.__gamepadRumbleCalls = [];
    Object.defineProperty(navigator, "getGamepads", {
      configurable: true,
      value: () => pads.map((pad, index) => connected.has(index) ? pad : null)
    });
    const dispatch = (name, pad) => {
      const event = new Event(name);
      Object.defineProperty(event, "gamepad", { value: pad });
      window.dispatchEvent(event);
    };
    window.__virtualGamepads = {
      connect(index) {
        connected.add(index);
        pads[index].connected = true;
        dispatch("gamepadconnected", pads[index]);
      },
      disconnect(index) {
        connected.delete(index);
        pads[index].connected = false;
        dispatch("gamepaddisconnected", pads[index]);
      },
      setAxis(index, axis, value) {
        pads[index].axes[axis] = value;
      },
      setButton(index, button, active) {
        pads[index].buttons[button] = { pressed: active, touched: active, value: active ? 1 : 0 };
      }
    };
  });
  const tapButton = async (button) => {
    await page.evaluate((index) => window.__virtualGamepads.setButton(0, index, true), button);
    await page.waitForTimeout(80);
    await page.evaluate((index) => window.__virtualGamepads.setButton(0, index, false), button);
    await page.waitForTimeout(80);
  };

  await page.goto(gameUrl);
  await expect.poll(() => phase(page)).toBe("title");
  await page.evaluate(() => window.__virtualGamepads.connect(0));
  await expect.poll(() => page.evaluate(() => window.__gothTechnologyGame.input.getGamepadStatus())).toEqual([
    expect.objectContaining({ player: 1, index: 0, id: "Virtual Xbox Controller" })
  ]);
  await tapButton(15);
  await expect.poll(() => page.evaluate(() => window.__gothTechnologyGame.titleMenuIndex)).toBe(1);
  await tapButton(0);
  await expect.poll(() => phase(page)).toBe("select");
  await expect.poll(() => page.evaluate(() => window.__gothTechnologyGame.matchAssetsReady), { timeout: 60_000 }).toBe(true);
  await tapButton(0);
  await advanceVersusToFight(page);

  const startX = await page.evaluate(() => window.__gothTechnologyGame.fighters[0].x);
  await page.evaluate(() => window.__virtualGamepads.setAxis(0, 0, 0.9));
  await expect.poll(() => page.evaluate(() => window.__gothTechnologyGame.fighters[0].x)).toBeGreaterThan(startX + 8);
  await page.evaluate(() => window.__virtualGamepads.setAxis(0, 0, 0));
  await page.evaluate(() => window.__virtualGamepads.setButton(0, 0, true));
  await expect.poll(() => page.evaluate(() => window.__gothTechnologyGame.fighters[0].motion)).toBe("LIGHT_PUNCH");
  await page.evaluate(() => window.__virtualGamepads.setButton(0, 0, false));
  await page.waitForTimeout(80);
  await page.evaluate(() => window.__gothTechnologyGame.audio.beep("hit"));
  await expect.poll(() => page.evaluate(() => window.__gamepadRumbleCalls.length)).toBeGreaterThan(0);
  await tapButton(9);
  await expect.poll(() => phase(page)).toBe("pause");

  await page.evaluate(() => window.__virtualGamepads.connect(1));
  await expect.poll(() => page.evaluate(() => window.__gothTechnologyGame.input.getGamepadStatus().map(({ player, index }) => ({ player, index })))).toEqual([
    { player: 1, index: 0 },
    { player: 2, index: 1 }
  ]);
  await page.evaluate(() => window.__virtualGamepads.disconnect(0));
  await expect.poll(() => page.evaluate(() => window.__gothTechnologyGame.input.getGamepadStatus().map(({ player, index }) => ({ player, index })))).toEqual([
    { player: 2, index: 1 }
  ]);
  await page.evaluate(() => window.__gothTechnologyGame.openSettings());
  await expect(page.locator("#controllerStatus")).toContainText("P2: Virtual PlayStation Controller");
  if (!process.env.NO_TEST_ARTIFACTS) await page.screenshot({ path: testInfo.outputPath("real-controller-settings.png") });
});

test("Replay Vault exports and deletes a saved match", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name.includes("mobile"), "Archive download check runs on desktop");
  await page.goto(gameUrl);
  await expect.poll(() => phase(page)).toBe("title");
  await page.evaluate(() => {
    const game = window.__gothTechnologyGame;
    game.writeReplayLibrary([{
      id: "browser-replay",
      savedAt: new Date().toISOString(),
      player1Id: "KALYX",
      player2Id: "MASTER_EZRA",
      winnerId: "KALYX",
      stageIndex: 1,
      mode: "versus",
      frames: [{ p1: { lightPunch: true }, p2: {} }]
    }]);
    game.openReplaySelect();
  });
  await expect.poll(() => phase(page)).toBe("replaySelect");
  await expect(page.getByRole("button", { name: /Play replay 1/ })).toBeAttached();
  const downloadPromise = page.waitForEvent("download");
  await page.getByRole("button", { name: "Export selected replay" }).focus();
  await page.keyboard.press("Enter");
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toMatch(/gothtechnology-replay/);
  await page.getByRole("button", { name: "Delete selected replay" }).focus();
  await page.keyboard.press("Enter");
  await expect(page.getByRole("button", { name: /Play replay 1/ })).toHaveCount(0);
});

test("Arcade levels alternate lazy skippable commercial breaks", async ({ page }) => {
  test.setTimeout(120_000);
  await page.goto(gameUrl);
  await expect.poll(() => phase(page)).toBe("title");
  await page.evaluate(() => {
    const game = window.__gothTechnologyGame;
    game.gameMode = "arcade";
    game.arcadeStage = 1;
    game.modeCanContinue = true;
    game.phase = "matchEnd";
    game.render();
  });
  await page.locator("#roundContinue").click();
  await expect.poll(() => phase(page)).toBe("commercial");
  await expect(page.locator("#commercialBreak")).toBeVisible();
  await expect(page.locator("#commercialVideo")).toHaveAttribute("src", /detroit-commercial-01\.mp4/);
  await page.getByRole("button", { name: "SKIP // A OR B" }).click();
  await expect(page.locator("#commercialBreak")).toBeHidden();
  await expect.poll(() => phase(page)).toBe("versus");
  const next = await page.evaluate(() => {
    const game = window.__gothTechnologyGame;
    return { stageIndex: game.stageIndex, modeCanContinue: game.modeCanContinue, opponent: game.player2Id };
  });
  expect(next).toMatchObject({ stageIndex: 2, modeCanContinue: false });
});

test("Master Ezra plays a complete takeoff, apex, fall, and clean landing", async ({ page }, testInfo) => {
  test.setTimeout(120_000);
  await page.goto(gameUrl);
  await expect.poll(() => phase(page)).toBe("title");
  await enterTrainingFight(page);
  await expect.poll(() => page.evaluate(() => window.__gothTechnologyGame?.fighters?.[0]?.id)).toBe("MASTER_EZRA");

  const renderedScaleProfile = await page.evaluate(async () => {
    const { GROUND_Y } = await import("./src/config/constants.js?v=ezra-render-scale-test");
    const fighter = window.__gothTechnologyGame.fighters[0];
    const canvas = document.createElement("canvas");
    canvas.width = 1280;
    canvas.height = 720;
    const context = canvas.getContext("2d", { willReadFrequently: true });
    const original = {
      x: fighter.x,
      y: fighter.y,
      motion: fighter.motion,
      motionElapsed: fighter.motionElapsed,
      getMotionFrameIndex: fighter.getMotionFrameIndex,
      invulnerable: fighter.invulnerable,
      shieldTimer: fighter.shieldTimer,
      guardFlash: fighter.guardFlash,
      dashTimer: fighter.dashTimer
    };
    fighter.x = 320;
    fighter.invulnerable = 0;
    fighter.shieldTimer = 0;
    fighter.guardFlash = 0;
    fighter.dashTimer = 0;
    const heightForFrame = (motion, frameIndex) => {
      context.clearRect(0, 0, canvas.width, canvas.height);
      fighter.motion = motion;
      fighter.motionElapsed = 0;
      fighter.y = motion === "IDLE" || motion === "LANDING" ? GROUND_Y : GROUND_Y - 100;
      fighter.getMotionFrameIndex = () => frameIndex;
      fighter.render(context, false);
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
      return maxY - minY + 1;
    };
    const motions = ["IDLE", "CROUCH_IDLE", "CROUCH_WALK", "JUMP_START", "JUMP_RISE", "JUMP_PEAK", "JUMP_FALL", "LANDING", "AIR_ATTACK"];
    const heights = Object.fromEntries(motions.map((motion) => [
      motion,
      Math.max(...fighter.assets.animations.MASTER_EZRA[motion].frames.map((_, frameIndex) => heightForFrame(motion, frameIndex)))
    ]));
    Object.assign(fighter, original);
    fighter.getMotionFrameIndex = original.getMotionFrameIndex;
    return heights;
  });
  for (const motion of ["JUMP_START", "JUMP_RISE", "JUMP_PEAK", "JUMP_FALL", "LANDING", "AIR_ATTACK"]) {
    expect(renderedScaleProfile[motion] / renderedScaleProfile.IDLE).toBeGreaterThanOrEqual(0.98);
    expect(renderedScaleProfile[motion] / renderedScaleProfile.IDLE).toBeLessThanOrEqual(1.02);
  }
  for (const motion of ["CROUCH_IDLE", "CROUCH_WALK"]) {
    expect(renderedScaleProfile[motion] / renderedScaleProfile.IDLE).toBeGreaterThanOrEqual(0.84);
    expect(renderedScaleProfile[motion] / renderedScaleProfile.IDLE).toBeLessThanOrEqual(0.86);
  }

  const crouchMotion = await page.evaluate(() => {
    const game = window.__gothTechnologyGame;
    const fighter = game.fighters[0];
    game.stopped = true;
    fighter.update(1 / 60, { down: true }, game.fighters[1], game);
    game.render();
    return fighter.motion;
  });
  expect(crouchMotion).toBe("CROUCH_IDLE");
  if (!process.env.NO_TEST_ARTIFACTS) await page.screenshot({ path: testInfo.outputPath("ezra-crouch.png") });

  const ascentSequence = await page.evaluate(() => {
    const game = window.__gothTechnologyGame;
    const fighter = game.fighters[0];
    const opponent = game.fighters[1];
    const seen = new Set();
    game.stopped = true;
    fighter.update(1 / 60, { up: true }, opponent, game);
    for (let frame = 0; frame < 120; frame += 1) {
      seen.add(fighter.motion);
      if (fighter.motion === "JUMP_PEAK") break;
      fighter.update(1 / 60, {}, opponent, game);
    }
    const canvas = document.createElement("canvas");
    canvas.width = 1280;
    canvas.height = 720;
    const context = canvas.getContext("2d", { willReadFrequently: true });
    const invulnerable = fighter.invulnerable;
    fighter.invulnerable = 0;
    fighter.render(context, false);
    fighter.invulnerable = invulnerable;
    const rgba = context.getImageData(0, 0, canvas.width, canvas.height).data;
    let top = canvas.height;
    for (let y = 0; y < canvas.height; y += 1) {
      for (let x = 0; x < canvas.width; x += 1) {
        if (rgba[(y * canvas.width + x) * 4 + 3] > 8) top = Math.min(top, y);
      }
    }
    game.render();
    return { motions: [...seen], top };
  });
  expect(ascentSequence.motions).toEqual(expect.arrayContaining(["JUMP_START", "JUMP_RISE", "JUMP_PEAK"]));
  expect(ascentSequence.top).toBeGreaterThanOrEqual(148);
  if (!process.env.NO_TEST_ARTIFACTS) await page.screenshot({ path: testInfo.outputPath("ezra-jump-peak.png") });
  const landingSequence = await page.evaluate(() => {
    const game = window.__gothTechnologyGame;
    const fighter = game.fighters[0];
    const opponent = game.fighters[1];
    const seen = new Set();
    for (let frame = 0; frame < 180; frame += 1) {
      fighter.update(1 / 60, {}, opponent, game);
      seen.add(fighter.motion);
      if (fighter.grounded && fighter.motion === "IDLE") break;
    }
    game.render();
    return [...seen];
  });
  expect(landingSequence).toEqual(expect.arrayContaining(["JUMP_FALL", "LANDING", "IDLE"]));
});

test("Amara aerial frames and Heartlink counter play cleanly in a real match", async ({ page }, testInfo) => {
  test.setTimeout(120_000);
  await page.goto(gameUrl);
  await expect.poll(() => phase(page)).toBe("title");
  await page.evaluate(() => window.__gothTechnologyGame.openMode("training"));
  await expect.poll(() => phase(page)).toBe("select");
  await page.evaluate(() => window.__gothTechnologyGame.selectPlayer1("AMARA_VALENTINE"));
  await expect.poll(() => page.evaluate(() => window.__gothTechnologyGame?.matchAssetsReady), { timeout: 60_000 }).toBe(true);
  await clickGame(page, 804, 594);
  await advanceVersusToFight(page);

  const audit = await page.evaluate(async () => {
    const game = window.__gothTechnologyGame;
    const amara = game.fighters[0];
    const opponent = game.fighters[1];
    const { applyHit, resolveMelee } = await import("./src/gameplay/combat.js?v=amara-heartlink-browser-test");
    const { drawSpriteFrame } = await import("./src/engine/assets.js?v=amara-aerial-browser-test");
    game.stopped = true;

    const detachedRatio = (motion, frameIndex) => {
      const canvas = document.createElement("canvas");
      canvas.width = 420;
      canvas.height = 420;
      const context = canvas.getContext("2d", { willReadFrequently: true });
      drawSpriteFrame(context, amara.assets.animations.AMARA_VALENTINE[motion], frameIndex, 210, 350, {
        scale: amara.config.stableScale
      });
      const rgba = context.getImageData(0, 0, canvas.width, canvas.height).data;
      const mask = new Uint8Array(canvas.width * canvas.height);
      let total = 0;
      for (let index = 0; index < mask.length; index += 1) {
        if (rgba[index * 4 + 3] > 24) {
          mask[index] = 1;
          total += 1;
        }
      }
      const analysisMask = new Uint8Array(mask.length);
      for (let y = 0; y < canvas.height; y += 1) {
        for (let x = 0; x < canvas.width; x += 1) {
          if (!mask[y * canvas.width + x]) continue;
          for (let dy = -1; dy <= 1; dy += 1) {
            for (let dx = -1; dx <= 1; dx += 1) {
              const nx = x + dx;
              const ny = y + dy;
              if (nx >= 0 && nx < canvas.width && ny >= 0 && ny < canvas.height) {
                analysisMask[ny * canvas.width + nx] = 1;
              }
            }
          }
        }
      }
      total = analysisMask.reduce((sum, value) => sum + value, 0);
      const seen = new Uint8Array(analysisMask.length);
      const areas = [];
      for (let start = 0; start < analysisMask.length; start += 1) {
        if (!analysisMask[start] || seen[start]) continue;
        const queue = [start];
        seen[start] = 1;
        let area = 0;
        while (queue.length) {
          const current = queue.pop();
          area += 1;
          const x = current % canvas.width;
          const neighbors = [current - canvas.width, current + canvas.width];
          if (x > 0) neighbors.push(current - 1);
          if (x < canvas.width - 1) neighbors.push(current + 1);
          for (const neighbor of neighbors) {
            if (neighbor >= 0 && neighbor < analysisMask.length && analysisMask[neighbor] && !seen[neighbor]) {
              seen[neighbor] = 1;
              queue.push(neighbor);
            }
          }
        }
        areas.push(area);
      }
      areas.sort((left, right) => right - left);
      return (areas[1] ?? 0) / Math.max(1, total);
    };

    const airAnimation = amara.assets.animations.AMARA_VALENTINE.AIR_ATTACK;
    const peakAnimation = amara.assets.animations.AMARA_VALENTINE.JUMP_PEAK;
    const fragmentRatios = airAnimation.frames.map((_, index) => detachedRatio("AIR_ATTACK", index));

    amara.resetRound(360, 1);
    opponent.resetRound(650, -1);
    amara.invulnerable = 0;
    opponent.invulnerable = 0;
    amara.meter = 100;
    opponent.vx = 0;
    amara.useCharacterSkill(opponent, game);
    const preCounter = { motion: amara.motion, opponentVx: opponent.vx };
    applyHit(opponent, amara, { damage: 80, stun: 0.24, knockback: 160, meter: 4, level: "mid" }, game, { sourceName: "heavyPunch" });
    const postCounter = { opponentVx: opponent.vx, charmedTimer: opponent.charmedTimer };

    game.effects.length = 0;
    game.spawnFighterVfx(amara, "super", "charge");
    const superCharge = game.effects.at(-1);
    superCharge.update(1 / 60);
    const superOffset = { x: superCharge.x - amara.x, y: superCharge.y - amara.y };
    game.effects.length = 0;

    const registeredMelee = {};
    for (const move of ["lightPunch", "heavyPunch", "lightKick", "heavyKick", "crouchAttack", "airAttack", "combo1", "combo2"]) {
      amara.resetRound(400, 1);
      opponent.resetRound(620, -1);
      amara.invulnerable = 0;
      opponent.invulnerable = 0;
      if (move === "airAttack") amara.y -= 96;
      const healthBefore = opponent.health;
      amara.beginAttack(move, game);
      for (let frame = 0; frame < 48 && opponent.health === healthBefore; frame += 1) {
        amara.update(1 / 60, {}, opponent, game);
        resolveMelee(amara, opponent, game);
      }
      registeredMelee[move] = opponent.health < healthBefore;
    }

    amara.resetRound(400, 1);
    opponent.resetRound(620, -1);
    amara.invulnerable = 0;
    opponent.invulnerable = 0;
    game.projectiles.length = 0;
    const pulseHealthBefore = opponent.health;
    amara.beginAttack("special", game);
    for (let frame = 0; frame < 80 && opponent.health === pulseHealthBefore; frame += 1) {
      amara.update(1 / 60, {}, opponent, game);
      game.projectiles.forEach((projectile) => projectile.update(1 / 60, game));
      game.projectiles = game.projectiles.filter((projectile) => !projectile.dead);
    }
    const pulseRegistered = opponent.health < pulseHealthBefore && opponent.charmedTimer > 0;

    amara.resetRound(360, 1);
    const seen = new Set();
    amara.update(1 / 60, { up: true }, opponent, game);
    for (let frame = 0; frame < 120; frame += 1) {
      seen.add(amara.motion);
      if (amara.motion === "JUMP_PEAK") break;
      amara.update(1 / 60, {}, opponent, game);
    }
    amara.beginAttack("airAttack", game);
    seen.add(amara.motion);
    game.render();

    return {
      fighterId: amara.id,
      peakSource: peakAnimation.source,
      airSource: airAnimation.source,
      fragmentRatios,
      preCounter,
      postCounter,
      superOffset,
      registeredMelee,
      pulseRegistered,
      motions: [...seen]
    };
  });

  expect(audit.fighterId).toBe("AMARA_VALENTINE");
  expect(audit.peakSource).toBe("higgsfield-v3-aerial-locomotion");
  expect(audit.airSource).toBe("higgsfield-v3-aerial-locomotion");
  expect(Math.max(...audit.fragmentRatios)).toBeLessThan(0.035);
  expect(audit.preCounter).toEqual({ motion: "SPECIAL_START", opponentVx: 0 });
  expect(audit.postCounter.opponentVx).toBeLessThan(0);
  expect(audit.postCounter.charmedTimer).toBeGreaterThan(0);
  expect(audit.superOffset).toEqual({ x: 48, y: -132 });
  expect(Object.values(audit.registeredMelee)).not.toContain(false);
  expect(audit.pulseRegistered).toBe(true);
  expect(audit.motions).toEqual(expect.arrayContaining(["JUMP_START", "JUMP_RISE", "JUMP_PEAK", "AIR_ATTACK"]));
  if (!process.env.NO_TEST_ARTIFACTS) await page.screenshot({ path: testInfo.outputPath("amara-air-attack.png") });
});

test("Kalyx reaches every aerial phase and a distinct air attack", async ({ page }, testInfo) => {
  test.setTimeout(120_000);
  await page.goto(gameUrl);
  await expect.poll(() => phase(page)).toBe("title");
  await clickGame(page, 470, 400);
  await expect.poll(() => phase(page)).toBe("select");
  await expect.poll(() => page.evaluate(() => window.__gothTechnologyGame?.matchAssetsReady), { timeout: 10_000 }).toBe(true);
  await clickGame(page, 300, 210);
  await clickGame(page, 804, 594);
  await advanceVersusToFight(page);
  await expect.poll(() => page.evaluate(() => window.__gothTechnologyGame?.fighters?.[0]?.id)).toBe("KALYX");

  const airSequence = await page.evaluate(() => {
    const game = window.__gothTechnologyGame;
    const fighter = game.fighters[0];
    const opponent = game.fighters[1];
    const seen = new Set();
    game.stopped = true;
    fighter.update(1 / 60, { up: true }, opponent, game);
    for (let frame = 0; frame < 120; frame += 1) {
      seen.add(fighter.motion);
      const action = fighter.motion === "JUMP_FALL" && !seen.has("AIR_ATTACK") ? { lightKick: true } : {};
      fighter.update(1 / 60, action, opponent, game);
      if (fighter.motion === "AIR_ATTACK") {
        seen.add("AIR_ATTACK");
        break;
      }
    }
    game.render();
    return [...seen];
  });
  expect(airSequence).toEqual(expect.arrayContaining(["JUMP_START", "JUMP_RISE", "JUMP_PEAK", "JUMP_FALL", "AIR_ATTACK"]));
  if (!process.env.NO_TEST_ARTIFACTS) await page.screenshot({ path: testInfo.outputPath("kalyx-air-attack.png") });
  const landingSequence = await page.evaluate(() => {
    const game = window.__gothTechnologyGame;
    const fighter = game.fighters[0];
    const opponent = game.fighters[1];
    const seen = new Set();
    for (let frame = 0; frame < 120; frame += 1) {
      seen.add(fighter.motion);
      fighter.update(1 / 60, {}, opponent, game);
      seen.add(fighter.motion);
      if (fighter.grounded && fighter.motion === "IDLE") break;
    }
    game.render();
    return [...seen];
  });
  expect(landingSequence).toEqual(expect.arrayContaining(["AIR_ATTACK", "LANDING", "IDLE"]));
});

test("real attacks connect and training exposes expanded frame data", async ({ page }) => {
  test.setTimeout(120_000);
  await page.goto(gameUrl);
  await enterTrainingFight(page);
  const hitResult = await page.evaluate(() => {
    const game = window.__gothTechnologyGame;
    const attacker = game.fighters[0];
    const defender = game.fighters[1];
    game.stopped = true;
    attacker.x = 500;
    defender.x = 626;
    attacker.setMotion("IDLE", true);
    defender.setMotion("IDLE", true);
    attacker.invulnerable = 0;
    defender.invulnerable = 0;
    game.showFrameData = true;
    game.trainingHitboxes = true;
    const healthBefore = defender.health;
    let frame = 0;
    game.input.actions = (slot) => slot === 1 && frame === 0 ? { lightPunch: true } : {};
    for (; frame < 60 && defender.health >= healthBefore; frame += 1) game.update(1 / 60);
    game.render();
    return { healthBefore, healthAfter: defender.health, readout: game.trainingReadout };
  });
  expect(hitResult.healthAfter).toBeLessThan(hitResult.healthBefore);
  expect(hitResult.readout).toMatchObject({ outcome: "HIT" });
  expect(hitResult.readout).toHaveProperty("advantageFrames");
  expect(hitResult.readout).toHaveProperty("comboScale");
});

test("mobile portrait keeps compact primary controls adjacent and collapses match tools", async ({ page }, testInfo) => {
  test.setTimeout(120_000);
  test.skip(!testInfo.project.name.includes("mobile"), "Mobile layout check");
  await page.goto(gameUrl);
  await expect.poll(() => phase(page)).toBe("title");
  await expect(page.locator("#mobileControls")).toBeHidden();
  await enterTrainingFight(page);
  await expect(page.locator("#mobileControls")).toBeVisible();
  const layout = await page.evaluate(() => {
    const canvas = document.getElementById("game").getBoundingClientRect();
    const controls = document.getElementById("mobileControls").getBoundingClientRect();
    return {
      canvasWidth: canvas.width,
      canvasHeight: canvas.height,
      canvasTop: canvas.top,
      gap: controls.top - canvas.bottom,
      primaryButtons: document.querySelectorAll("#mobileControls .pad .touch:not(.blank), #mobileControls .buttons .touch").length,
      toolsHidden: document.getElementById("mobileUtilityActions").hidden,
      toolsExpanded: document.getElementById("mobileUtilityToggle").getAttribute("aria-expanded"),
      controlsBottom: controls.bottom,
      viewportHeight: innerHeight,
      topSpace: canvas.top,
      bottomSpace: innerHeight - controls.bottom,
      controlsVisible: getComputedStyle(document.getElementById("mobileControls")).display !== "none"
    };
  });
  expect(layout.controlsVisible).toBe(true);
  const viewportWidth = page.viewportSize()?.width ?? 412;
  expect(layout.canvasWidth).toBeGreaterThanOrEqual(Math.min(360, viewportWidth - 8));
  expect(layout.canvasHeight).toBeGreaterThan(190);
  expect(Math.abs(layout.topSpace - layout.bottomSpace)).toBeLessThan(100);
  expect(layout.gap).toBeGreaterThanOrEqual(0);
  expect(layout.gap).toBeLessThan(32);
  expect(layout.primaryButtons).toBe(10);
  expect(layout.toolsHidden).toBe(true);
  expect(layout.toolsExpanded).toBe("false");
  expect(layout.controlsBottom).toBeLessThanOrEqual(layout.viewportHeight + 2);
  if (!process.env.NO_TEST_ARTIFACTS) await page.screenshot({ path: testInfo.outputPath("mobile-title.png") });
  await page.getByRole("button", { name: "Open match tools" }).click();
  await expect(page.locator("#mobileUtilityActions")).toBeVisible();
  await expect(page.getByRole("button", { name: "Open match tools" })).toHaveAttribute("aria-expanded", "true");
});

test("mobile landscape keeps primary controls in side rails", async ({ page }, testInfo) => {
  test.setTimeout(120_000);
  test.skip(!testInfo.project.name.includes("mobile"), "Mobile layout check");
  await page.setViewportSize({ width: 915, height: 412 });
  await page.goto(gameUrl);
  await expect.poll(() => phase(page)).toBe("title");
  await expect(page.locator("#mobileControls")).toBeHidden();
  await enterTrainingFight(page);
  await expect(page.locator("#mobileControls")).toBeVisible();
  await expect.poll(() => page.evaluate(() => {
    const canvas = document.getElementById("game").getBoundingClientRect();
    const pad = document.querySelector("#mobileControls .pad").getBoundingClientRect();
    const actions = document.querySelector("#mobileControls .buttons").getBoundingClientRect();
    return Math.min(canvas.left - pad.right, actions.left - canvas.right);
  })).toBeGreaterThanOrEqual(0);
  const layout = await page.evaluate(() => {
    const canvas = document.getElementById("game").getBoundingClientRect();
    const controls = document.getElementById("mobileControls").getBoundingClientRect();
    const pad = document.querySelector("#mobileControls .pad").getBoundingClientRect();
    const actions = document.querySelector("#mobileControls .buttons").getBoundingClientRect();
    const buttons = [...document.querySelectorAll("#mobileControls .pad .touch:not(.blank), #mobileControls .buttons .touch")].map((button) => button.getBoundingClientRect());
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

test("mobile modifier supports simultaneous super input and movable controls", async ({ page }, testInfo) => {
  test.setTimeout(120_000);
  test.skip(!testInfo.project.name.includes("mobile"), "Mobile multi-touch check");
  await page.goto(gameUrl);
  await enterTrainingFight(page);
  await page.evaluate(() => {
    const modifier = document.querySelector('[data-touch="p1.modifier"]');
    const heavyPunch = document.querySelector('[data-touch="p1.heavyPunch"]');
    modifier.dispatchEvent(new PointerEvent("pointerdown", { bubbles: true, pointerId: 41, pointerType: "touch" }));
    heavyPunch.dispatchEvent(new PointerEvent("pointerdown", { bubbles: true, pointerId: 42, pointerType: "touch" }));
  });
  await expect.poll(() => page.evaluate(() => window.__gothTechnologyGame.fighters[0].currentAttack?.name)).toBe("super");
  await page.evaluate(() => {
    for (const [selector, pointerId] of [['[data-touch="p1.modifier"]', 41], ['[data-touch="p1.heavyPunch"]', 42]]) {
      document.querySelector(selector).dispatchEvent(new PointerEvent("pointerup", { bubbles: true, pointerId, pointerType: "touch" }));
    }
  });

  const before = await page.locator("#padZone").evaluate((zone) => getComputedStyle(zone).transform);
  const handle = page.locator("#movePad");
  const box = await handle.boundingBox();
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width / 2 + 32, box.y + box.height / 2 + 12);
  await page.mouse.up();
  const after = await page.locator("#padZone").evaluate((zone) => getComputedStyle(zone).transform);
  expect(after).not.toBe(before);
  expect(await page.evaluate(() => localStorage.getItem("gothtechnology.touch.positions.v1"))).toContain("padZone");
});

test("mobile control positions recover after reload, rotation, and reset", async ({ page }, testInfo) => {
  test.setTimeout(120_000);
  test.skip(!testInfo.project.name.includes("mobile"), "Mobile layout recovery check");
  await page.goto(gameUrl);
  await page.evaluate(() => localStorage.setItem("gothtechnology.touch.positions.v1", JSON.stringify({
    padZone: { x: -999, y: 999 },
    combatZone: { x: 999, y: -999 }
  })));
  await page.reload();
  await enterTrainingFight(page);

  const expectZonesInsideViewport = async () => {
    await expect.poll(() => page.evaluate(() => [...document.querySelectorAll("#padZone, #combatZone")].every((zone) => {
      const rect = zone.getBoundingClientRect();
      return rect.left >= 7 && rect.top >= 7 && rect.right <= innerWidth - 7 && rect.bottom <= innerHeight - 7;
    }))).toBe(true);
  };

  await expectZonesInsideViewport();
  await page.setViewportSize({ width: 915, height: 412 });
  await expectZonesInsideViewport();
  await page.evaluate(() => document.getElementById("resetTouchPositions").click());
  await expect.poll(() => page.evaluate(() => localStorage.getItem("gothtechnology.touch.positions.v1"))).toBeNull();
  const offsets = await page.evaluate(() => ["padZone", "combatZone"].map((id) => {
    const style = document.getElementById(id).style;
    return [style.getPropertyValue("--zone-x"), style.getPropertyValue("--zone-y")];
  }));
  expect(offsets).toEqual([["0px", "0px"], ["0px", "0px"]]);
});

test("round end exposes a visible continuation control", async ({ page }) => {
  test.setTimeout(120_000);
  await page.goto(gameUrl);
  await enterTrainingFight(page);
  await page.evaluate(() => {
    const game = window.__gothTechnologyGame;
    game.phase = "roundEnd";
    game.roundResultText = "TIME UP";
    game.roundResultSubtext = "NEXT ROUND";
    game.lastAccessibleState = "";
    game.syncAccessibleState();
    game.render();
  });
  const continueButton = page.locator("#roundContinue");
  await expect(continueButton).toBeVisible();
  await expect(continueButton).toHaveText("NEXT ROUND");
  await continueButton.click();
  await expect.poll(() => phase(page)).toBe("fight");
  await expect(continueButton).toBeHidden();
});

test("selected match stays within resource, simulation-frame, and heap budgets", async ({ page }, testInfo) => {
  test.setTimeout(120_000);
  await page.goto(gameUrl);
  await enterTrainingFight(page);
  const metrics = await page.evaluate(() => {
    const game = window.__gothTechnologyGame;
    game.stopped = true;
    const deltas = [];
    const renderDeltas = [];
    for (let frame = 0; frame < 140; frame += 1) {
      const started = performance.now();
      game.update(game.fixedStep ?? 1 / 60);
      if (frame >= 20) deltas.push(performance.now() - started);
    }
    for (let frame = 0; frame < 40; frame += 1) {
      const started = performance.now();
      game.render();
      if (frame >= 8) renderDeltas.push(performance.now() - started);
    }
    const canvas = document.getElementById("game");
    const pixels = canvas.getContext("2d").getImageData(0, 0, canvas.width, canvas.height).data;
    let visibleSamples = 0;
    for (let offset = 0; offset < pixels.length; offset += 1600) {
      if (pixels[offset] + pixels[offset + 1] + pixels[offset + 2] > 24) visibleSamples += 1;
    }
    const resources = performance.getEntriesByType("resource");
    deltas.sort((a, b) => a - b);
    renderDeltas.sort((a, b) => a - b);
    return {
      resourceBytes: resources.reduce((sum, entry) => sum + (entry.encodedBodySize || 0), 0),
      p95SimulationMs: deltas[Math.floor(deltas.length * 0.95)],
      p95RenderMs: renderDeltas[Math.floor(renderDeltas.length * 0.95)],
      visibleSamples,
      heapBytes: performance.memory?.usedJSHeapSize ?? 0,
      profile: game.performanceProfile.id,
      backingSize: [canvas.width, canvas.height],
      loadedCharacters: game.assets.loadedCharacterMotions.size,
      loadedStages: game.assets.loadedStageAssets.size
    };
  });
  const mobileProject = testInfo.project.name.includes("mobile") || testInfo.project.name.includes("galaxy-a16");
  expect(metrics.resourceBytes).toBeLessThan(10.5 * 1024 * 1024);
  expect(metrics.p95SimulationMs).toBeLessThan(mobileProject ? 12 : 8);
  expect(metrics.p95RenderMs).toBeLessThan(mobileProject ? 18 : 14);
  expect(metrics.visibleSamples).toBeGreaterThan(100);
  expect(metrics.loadedCharacters).toBe(2);
  expect(metrics.loadedStages).toBe(1);
  expect(metrics.profile).toBe(mobileProject ? "mobile-constrained" : "desktop");
  expect(metrics.backingSize).toEqual(mobileProject ? [800, 450] : [1280, 720]);
  if (metrics.heapBytes) expect(metrics.heapBytes).toBeLessThan(128 * 1024 * 1024);
});
