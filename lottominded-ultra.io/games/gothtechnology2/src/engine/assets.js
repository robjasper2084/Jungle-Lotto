import { ASSET_URLS, MOTION_ASSET_VERSION, MOTION_PLAYBACK } from "../config/assets.js?v=galaxy-a16-performance-v1";

const imageCache = new Map();

export const loadImage = (key, url) => {
  if (imageCache.has(url)) return imageCache.get(url);
  const promise = new Promise((resolve) => {
    const img = new Image();
    img.decoding = "async";
    img.onload = () => {
      resolve(img);
    };
    img.onerror = () => {
      console.warn(`[GOTHTECHNOLOGY] Asset failed: ${key} ${url}`);
      resolve(null);
    };
    img.src = url;
  });
  imageCache.set(url, promise);
  return promise;
};

export class AssetLoader {
  constructor(onProgress = () => {}) {
    this.onProgress = onProgress;
    this.images = {};
    this.manifest = null;
    this.animations = {};
    this.loadedCharacterMotions = new Set();
    this.characterMotionLoads = new Map();
    this.characterSheetAssets = new Map();
    this.groupLoads = new Map();
    this.loadedGroups = new Set();
    this.loadedStageAssets = new Set();
    this.stageAssetLoads = new Map();
    this.stageAssetGroups = new Map();
  }

  async load() {
    this.manifest = await fetch(ASSET_URLS.manifest).then((r) => r.json());
    await this.loadGroup("boot", {
      titleBackdrop: ASSET_URLS.titleBackdrop,
      menuBackdrop: ASSET_URLS.menuBackdrop
    }, this.onProgress);

    for (const characterId of Object.keys(this.manifest.characters)) {
      this.animations[characterId] = {};
    }

    return this;
  }

  loadMenuAssets(onProgress = () => {}) {
    return this.loadGroup("menu", {
      logo: ASSET_URLS.logo,
      kalyxPortrait: ASSET_URLS.rosterPortraits.kalyx,
      masterEzraPortrait: ASSET_URLS.rosterPortraits.masterEzra,
      detroitLensNoirPortrait: ASSET_URLS.rosterPortraits.detroitLensNoir,
      amaraValentinePortrait: ASSET_URLS.rosterPortraits.amaraValentine,
      kalyxHeadshot: ASSET_URLS.rosterHeadshots.kalyx,
      masterEzraHeadshot: ASSET_URLS.rosterHeadshots.masterEzra,
      detroitLensNoirHeadshot: ASSET_URLS.rosterHeadshots.detroitLensNoir,
      amaraValentineHeadshot: ASSET_URLS.rosterHeadshots.amaraValentine
    }, onProgress, { strict: false });
  }

  loadGameSelectAssets(onProgress = () => {}) {
    return this.loadGroup("gameSelect", {
      gameTitleGothtechnology: ASSET_URLS.gameTitles.gothtechnology,
      gameTitleRobotRahbe: ASSET_URLS.gameTitles.robotRahbe,
      gameTitleStaticWave: ASSET_URLS.gameTitles.staticWave
    }, onProgress, { strict: false });
  }

  loadFightAssets(onProgress = () => {}) {
    return this.loadGroup("fight", {
      hitSpark: ASSET_URLS.effects.hitSpark,
      blockShield: ASSET_URLS.effects.blockShield,
      dust: ASSET_URLS.effects.dust,
      kalyxFireSlash: ASSET_URLS.effects.kalyxFireSlash,
      kalyxShadowClaw: ASSET_URLS.effects.kalyxShadowClaw,
      ezraBlueBurst: ASSET_URLS.effects.ezraBlueBurst,
      ezraOwlArc: ASSET_URLS.effects.ezraOwlArc,
      smoke: ASSET_URLS.effects.smoke,
      detroitBoerboel: ASSET_URLS.assists.boerboel,
      assistOwl: ASSET_URLS.assists.owl,
      assistRaven: ASSET_URLS.assists.raven,
      assistNocturna: ASSET_URLS.assists.nocturna
    }, onProgress);
  }

  loadStageAssets(stage, onProgress = () => {}, options = {}) {
    if (!stage?.id || !stage.backgroundKey) return Promise.reject(new Error("Invalid stage asset request"));
    if (this.loadedStageAssets.has(stage.id)) {
      onProgress(1);
      return Promise.resolve(this);
    }
    if (this.stageAssetLoads.has(stage.id)) return this.stageAssetLoads.get(stage.id);

    const backgroundUrl = ASSET_URLS.stageBackgrounds[stage.backgroundKey];
    if (!backgroundUrl) return Promise.reject(new Error(`Unknown stage background: ${stage.backgroundKey}`));
    const imageMap = { [stage.backgroundKey]: backgroundUrl };
    if (stage.legacyLayers) {
      imageMap.farTrees = ASSET_URLS.farTrees;
      imageMap.ground = ASSET_URLS.ground;
    }
    if (options.dynamicStageEffects ?? true) {
      imageMap.fog = ASSET_URLS.fog;
      imageMap.embers = ASSET_URLS.embers;
    }

    const groupName = `stage:${stage.id}`;
    const loadPromise = this.loadGroup(groupName, imageMap, onProgress).then(() => {
      this.loadedStageAssets.add(stage.id);
      this.stageAssetGroups.set(stage.id, new Map(Object.entries(imageMap)));
      return this;
    }).finally(() => {
      this.stageAssetLoads.delete(stage.id);
    });
    this.stageAssetLoads.set(stage.id, loadPromise);
    return loadPromise;
  }

  releaseStageAssetsExcept(stageId) {
    const keepAssets = this.stageAssetGroups.get(stageId) ?? new Map();
    const keepKeys = new Set(keepAssets.keys());
    for (const [loadedStageId, assets] of [...this.stageAssetGroups]) {
      if (loadedStageId === stageId) continue;
      for (const [key, url] of assets) {
        if (keepKeys.has(key)) continue;
        delete this.images[key];
        imageCache.delete(url);
      }
      this.loadedStageAssets.delete(loadedStageId);
      this.loadedGroups.delete(`stage:${loadedStageId}`);
      this.stageAssetGroups.delete(loadedStageId);
    }
  }

  loadGroup(name, imageMap, onProgress = () => {}, options = {}) {
    if (this.loadedGroups.has(name)) {
      onProgress(1);
      return Promise.resolve(this);
    }
    if (this.groupLoads.has(name)) return this.groupLoads.get(name);

    const loadPromise = this.loadImages(imageMap, onProgress).then((failed) => {
      if ((options.strict ?? true) && failed.length) throw new Error(`Unable to load ${name} assets: ${failed.join(", ")}`);
      this.loadedGroups.add(name);
      return this;
    }).finally(() => {
      this.groupLoads.delete(name);
    });
    this.groupLoads.set(name, loadPromise);
    return loadPromise;
  }

  async loadImages(imageMap, onProgress = () => {}) {
    const all = Object.entries(imageMap).map(([key, url]) => ({ key, url }));

    const loadGroups = new Map();
    for (const item of all) {
      if (!loadGroups.has(item.url)) loadGroups.set(item.url, []);
      loadGroups.get(item.url).push(item);
    }

    let done = 0;
    const failed = [];
    await Promise.all(
      [...loadGroups.entries()].map(async ([url, items]) => {
        const image = await loadImage(items[0].key, url);
        if (!image) failed.push(items.map(({ key }) => key).join("/"));
        for (const { key } of items) this.images[key] = image;
        done += 1;
        onProgress(done / loadGroups.size);
      })
    );
    return failed;
  }

  async loadCharacterMotions(characterIds, onProgress = () => {}) {
    const uniqueIds = [...new Set(characterIds)].filter((characterId) => this.manifest.characters[characterId]);
    const totalSheets = uniqueIds.reduce((sum, characterId) => {
      if (this.loadedCharacterMotions.has(characterId)) return sum;
      const motions = Object.values(this.manifest.characters[characterId].motions);
      return sum + new Set(motions.map((motion) => motion.sheet)).size;
    }, 0);
    let done = 0;
    await Promise.all(uniqueIds.map(async (characterId) => {
      await this.loadCharacterMotion(characterId, (sheet) => {
        done += 1;
        onProgress(totalSheets ? done / totalSheets : 1, `${characterId}:${sheet}`);
      });
    }));
    if (!totalSheets) onProgress(1, "cached");
    return this;
  }

  async loadCharacterMotion(characterId, onSheetLoaded = () => {}) {
    if (this.loadedCharacterMotions.has(characterId)) return;
    if (this.characterMotionLoads.has(characterId)) return this.characterMotionLoads.get(characterId);

    const loadPromise = (async () => {
      const character = this.manifest.characters[characterId];
      if (!character) throw new Error(`Unknown character motion atlas: ${characterId}`);
      const sheetImages = new Map();
      const sheets = [...new Set(Object.values(character.motions).map((motion) => motion.sheet))];
      const sheetAssets = sheets.map((sheet, index) => ({
        key: `${characterId}_motions_${index}`,
        sheet,
        url: `${sheet}?v=${MOTION_ASSET_VERSION}`
      }));
      this.characterSheetAssets.set(characterId, sheetAssets);
      await Promise.all(sheetAssets.map(async ({ key, sheet, url }) => {
        const image = await loadImage(key, url);
        if (!image) throw new Error(`Unable to load character motion atlas: ${characterId} ${sheet}`);
        this.images[key] = image;
        sheetImages.set(sheet, image);
        onSheetLoaded(sheet);
      }));
      this.animations[characterId] ??= {};
      for (const [motion, data] of Object.entries(character.motions)) {
        this.animations[characterId][motion] = {
          ...data,
          image: sheetImages.get(data.sheet),
          playbackOrder: MOTION_PLAYBACK[characterId]?.[motion] ?? null
        };
      }
      this.loadedCharacterMotions.add(characterId);
    })();

    this.characterMotionLoads.set(characterId, loadPromise);
    try {
      await loadPromise;
    } finally {
      this.characterMotionLoads.delete(characterId);
    }
  }

  releaseCharacterMotionsExcept(characterIds) {
    const keep = new Set(characterIds);
    for (const characterId of [...this.loadedCharacterMotions]) {
      if (keep.has(characterId)) continue;
      for (const { key, url } of this.characterSheetAssets.get(characterId) ?? []) {
        delete this.images[key];
        imageCache.delete(url);
      }
      this.animations[characterId] = {};
      this.loadedCharacterMotions.delete(characterId);
      this.characterSheetAssets.delete(characterId);
    }
  }

}

export const drawSpriteFrame = (ctx, animation, frameIndex, x, y, options = {}) => {
  if (!animation?.image) return false;
  const frame = animation.frames[frameIndex % animation.frames.length];
  if (!frame || frame.w <= 0 || frame.h <= 0) return false;
  const content = frame.content;
  const sourceX = frame.x + (content?.x ?? 0);
  const sourceY = frame.y + (content?.y ?? 0);
  const sourceW = content?.w ?? frame.w;
  const sourceH = content?.h ?? frame.h;
  const scale = (options.scale ?? 1) * (animation.renderScale ?? 1) * (content?.scale ?? 1);
  const w = sourceW * scale;
  const h = sourceH * scale;
  ctx.save();
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = ctx.gothPerformance?.smoothingQuality ?? "high";
  ctx.globalCompositeOperation = options.composite ?? "source-over";
  ctx.translate(x, y);
  if (options.flip) ctx.scale(-1, 1);
  if (options.underpaint) {
    const underScale = options.underpaintScale ?? 1.018;
    ctx.save();
    ctx.globalAlpha = options.underpaintAlpha ?? 0.42;
    ctx.filter = options.underpaintFilter ?? "brightness(0) saturate(1)";
    ctx.drawImage(
      animation.image,
      sourceX,
      sourceY,
      sourceW,
      sourceH,
      (-w * underScale) / 2,
      -h * underScale,
      w * underScale,
      h * underScale
    );
    ctx.restore();
  }
  ctx.filter = options.filter ?? "none";
  ctx.globalAlpha = options.alpha ?? 1;
  ctx.drawImage(animation.image, sourceX, sourceY, sourceW, sourceH, -w / 2, -h, w, h);
  ctx.restore();
  return true;
};

export const drawSheetFrame = (ctx, image, frameIndex, cellW, cellH, x, y, options = {}) => {
  if (!image) return false;
  const cols = Math.max(1, Math.floor(image.width / cellW));
  const sx = (frameIndex % cols) * cellW;
  const sy = Math.floor(frameIndex / cols) * cellH;
  const scale = options.scale ?? 1;
  ctx.save();
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = ctx.gothPerformance?.smoothingQuality ?? "high";
  ctx.translate(x, y);
  if (options.flip) ctx.scale(-1, 1);
  ctx.globalAlpha = options.alpha ?? 1;
  ctx.drawImage(image, sx, sy, cellW, cellH, (-cellW * scale) / 2, -cellH * scale, cellW * scale, cellH * scale);
  ctx.restore();
  return true;
};
