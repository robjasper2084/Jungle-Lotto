import { ASSET_URLS, PACK_ROOT, SPRITE_OVERRIDES } from "../config/assets.js?v=fighter-prop1";

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
  }

  async load() {
    this.manifest = await fetch(ASSET_URLS.manifest).then((r) => r.json());
    const baseImages = {
      logo: ASSET_URLS.logo,
      titleBackdrop: ASSET_URLS.titleBackdrop,
      background: ASSET_URLS.background,
      farTrees: ASSET_URLS.farTrees,
      fog: ASSET_URLS.fog,
      embers: ASSET_URLS.embers,
      ground: ASSET_URLS.ground,
      hitSpark: ASSET_URLS.effects.hitSpark,
      blockShield: ASSET_URLS.effects.blockShield,
      dust: ASSET_URLS.effects.dust,
      kalyxFireSlash: ASSET_URLS.effects.kalyxFireSlash,
      kalyxShadowClaw: ASSET_URLS.effects.kalyxShadowClaw,
      ezraBlueBurst: ASSET_URLS.effects.ezraBlueBurst,
      ezraOwlArc: ASSET_URLS.effects.ezraOwlArc,
      smoke: ASSET_URLS.effects.smoke,
      assistOwl: ASSET_URLS.assists.owl,
      assistRaven: ASSET_URLS.assists.raven,
      assistNocturna: ASSET_URLS.assists.nocturna,
      dossierVespera: ASSET_URLS.dossiers.vespera,
      dossierMalach: ASSET_URLS.dossiers.malach,
      ...Object.fromEntries(
        Object.entries(SPRITE_OVERRIDES).map(([characterId, override]) => [
          `${characterId}_override`,
          override.image
        ])
      )
    };

    const characterEntries = [];
    for (const [characterId, character] of Object.entries(this.manifest.characters)) {
      this.animations[characterId] = {};
      const overrideMotions = SPRITE_OVERRIDES[characterId]?.motions ?? {};
      for (const [motion, data] of Object.entries(character.motions)) {
        if (Object.prototype.hasOwnProperty.call(overrideMotions, motion)) continue;
        const key = `${characterId}_${motion}`;
        characterEntries.push([key, `${PACK_ROOT}/${data.sheet}`, characterId, motion, data]);
      }
    }

    const all = [
      ...Object.entries(baseImages).map(([key, url]) => ({ key, url })),
      ...characterEntries.map(([key, url]) => ({ key, url }))
    ];

    const loadGroups = new Map();
    for (const item of all) {
      if (!loadGroups.has(item.url)) loadGroups.set(item.url, []);
      loadGroups.get(item.url).push(item);
    }

    let done = 0;
    await Promise.all(
      [...loadGroups.entries()].map(async ([url, items]) => {
        const image = await loadImage(items[0].key, url);
        for (const { key } of items) this.images[key] = image;
        done += 1;
        this.onProgress(done / loadGroups.size);
      })
    );

    for (const [key, , characterId, motion, data] of characterEntries) {
      this.animations[characterId][motion] = {
        ...data,
        image: this.images[key],
        frameCount: data.frame_count,
        cellWidth: data.cell_width,
        cellHeight: data.cell_height
      };
    }

    this.applySpriteOverrides();
    return this;
  }

  applySpriteOverrides() {
    for (const [characterId, override] of Object.entries(SPRITE_OVERRIDES)) {
      const image = this.images[`${characterId}_override`];
      if (!image) continue;
      this.animations[characterId] ??= {};
      const frameWidth = override.frameWidth ?? override.frameSize ?? 256;
      const frameHeight = override.frameHeight ?? override.frameSize ?? 256;
      const frameDuration = override.frameDuration ?? 58;
      for (const [motion, frameIndexes] of Object.entries(override.motions ?? {})) {
        this.animations[characterId][motion] = {
          image,
          frameCount: frameIndexes.length,
          cellWidth: frameWidth,
          cellHeight: frameHeight,
          sourceFacing: override.sourceFacing ?? 1,
          override: true,
          frames: frameIndexes.map((frameIndex) => ({
            x: frameIndex * frameWidth,
            y: 0,
            w: frameWidth,
            h: frameHeight,
            duration_ms: frameDuration
          }))
        };
      }
    }
  }
}

export const drawSpriteFrame = (ctx, animation, frameIndex, x, y, options = {}) => {
  if (!animation?.image) return false;
  const frame = animation.frames[frameIndex % animation.frames.length];
  if (!frame || frame.w <= 0 || frame.h <= 0) return false;
  const scale = options.scale ?? 1;
  const w = frame.w * scale;
  const h = frame.h * scale;
  ctx.save();
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";
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
      frame.x,
      frame.y,
      frame.w,
      frame.h,
      (-w * underScale) / 2,
      -h * underScale,
      w * underScale,
      h * underScale
    );
    ctx.restore();
  }
  ctx.filter = options.filter ?? "none";
  ctx.globalAlpha = options.alpha ?? 1;
  ctx.drawImage(animation.image, frame.x, frame.y, frame.w, frame.h, -w / 2, -h, w, h);
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
  ctx.imageSmoothingQuality = "high";
  ctx.translate(x, y);
  if (options.flip) ctx.scale(-1, 1);
  ctx.globalAlpha = options.alpha ?? 1;
  ctx.drawImage(image, sx, sy, cellW, cellH, (-cellW * scale) / 2, -cellH * scale, cellW * scale, cellH * scale);
  ctx.restore();
  return true;
};
