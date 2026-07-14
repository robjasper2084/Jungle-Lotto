import { access, readFile, stat } from "node:fs/promises";
import { resolve } from "node:path";
import { ASSET_URLS, SPRITE_OVERRIDES } from "../src/config/assets.js";
import { MOTIONS } from "../src/config/constants.js";

const root = resolve(import.meta.dirname, "..");
const failures = [];
const APPROVED_OVERRIDE_MOTIONS = new Set(["IDLE", "READY_STANCE"]);
const MIN_UNIQUE_FRAMES = {
  IDLE: 1,
  READY_STANCE: 2,
  CROUCH_IDLE: 2,
  CROUCH_WALK: 2,
  BLOCK_HIGH: 3,
  BLOCK_LOW: 3,
  SPECIAL_RECOVER: 4,
  HURT_LIGHT: 4,
  HURT_HEAVY: 4,
  KNOCKDOWN: 6,
  DEFEAT: 6
};

const collectUrls = (value, urls = new Set()) => {
  if (typeof value === "string") urls.add(value);
  else if (value && typeof value === "object") Object.values(value).forEach((entry) => collectUrls(entry, urls));
  return urls;
};

const manifestPath = resolve(root, ASSET_URLS.manifest);
const manifest = JSON.parse(await readFile(manifestPath, "utf8"));
const urls = collectUrls(ASSET_URLS);
const motionSheets = new Set();

for (const [characterId, override] of Object.entries(SPRITE_OVERRIDES)) {
  urls.add(override.image);
  const overrideMotions = Object.keys(override.motions ?? {});
  const unapproved = overrideMotions.filter((motion) => !APPROVED_OVERRIDE_MOTIONS.has(motion));
  if (unapproved.length) failures.push(`${characterId}: unapproved boot overrides ${unapproved.join(", ")}`);
}

for (const [characterId, character] of Object.entries(manifest.characters ?? {})) {
  const runtimeMotions = character.motions ?? {};
  const overrideMotions = SPRITE_OVERRIDES[characterId]?.motions ?? {};
  const availableMotions = new Set([...Object.keys(runtimeMotions), ...Object.keys(overrideMotions)]);
  const missingMotions = MOTIONS.filter((motion) => !availableMotions.has(motion));
  if (missingMotions.length) failures.push(`${characterId}: missing motions ${missingMotions.join(", ")}`);

  for (const [motionName, motion] of Object.entries(runtimeMotions)) {
    urls.add(motion.sheet);
    motionSheets.add(motion.sheet);
    if (motion.frameCount !== motion.frames?.length) {
      failures.push(`${characterId}/${motionName}: frameCount does not match frames array`);
    }
    const minimum = MIN_UNIQUE_FRAMES[motionName] ?? 5;
    if ((motion.uniqueFrames ?? 0) < minimum) {
      failures.push(`${characterId}/${motionName}: ${motion.uniqueFrames ?? 0} unique frames, requires ${minimum}`);
    }
    if (motion.frames?.some((frame) => frame.w <= 0 || frame.h <= 0 || frame.x < 0 || frame.y < 0)) {
      failures.push(`${characterId}/${motionName}: invalid packed frame rectangle`);
    }
  }

  for (const [motionName, frameIndexes] of Object.entries(overrideMotions)) {
    const minimum = MIN_UNIQUE_FRAMES[motionName] ?? 1;
    if (new Set(frameIndexes).size < minimum) {
      failures.push(`${characterId}/${motionName}: override has too few unique cells`);
    }
  }

  const signature = (motionName) => JSON.stringify(runtimeMotions[motionName]?.frames?.map(({ x, y }) => [x, y]));
  if (signature("DASH_FORWARD") === signature("RUN_FORWARD") || signature("DASH_FORWARD") === signature("WALK_FORWARD")) {
    failures.push(`${characterId}: DASH_FORWARD reuses a locomotion sequence`);
  }
  if (signature("DASH_BACK") === signature("RUN_BACK") || signature("DASH_BACK") === signature("WALK_BACK")) {
    failures.push(`${characterId}: DASH_BACK reuses a locomotion sequence`);
  }
}

urls.add("../../assets/js/lm-game-rewards-sdk.js");
for (const url of urls) {
  try {
    await access(resolve(root, url));
  } catch {
    failures.push(`Missing asset: ${url}`);
  }
}

let motionAtlasBytes = 0;
for (const sheet of motionSheets) motionAtlasBytes += (await stat(resolve(root, sheet))).size;
if (motionAtlasBytes > 8 * 1024 * 1024) {
  failures.push(`Motion atlases exceed 8 MiB budget: ${motionAtlasBytes} bytes`);
}

if (failures.length) {
  console.error(`Asset validation failed:\n${failures.join("\n")}`);
  process.exitCode = 1;
} else {
  console.log(`Validated ${urls.size} asset paths and ${MOTIONS.length} motions per character.`);
  console.log(`Packed motion atlas payload: ${(motionAtlasBytes / 1024 / 1024).toFixed(2)} MiB.`);
}
