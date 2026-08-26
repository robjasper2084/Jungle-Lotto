import { access, readFile, readdir, stat } from "node:fs/promises";
import { resolve } from "node:path";
import { ASSET_URLS, COMMERCIAL_URLS, MOTION_ASSET_VERSION } from "../src/config/assets.js";
import { MOTIONS } from "../src/config/constants.js";

const root = resolve(import.meta.dirname, "..");
const failures = [];
const REQUIRED_FRAME_COUNT = 6;
const REQUIRED_PROVIDER = "Higgsfield Nano Banana Pro";
const REQUIRED_SOURCES = new Set([
  "higgsfield-v2", "higgsfield-v3-body-vfx", "higgsfield-v4-body-only",
  "higgsfield-v3-aerial-locomotion", "derived-body-only-v1", "chatgpt-image-body-only-v1"
]);
const STABLE_HEIGHT_MOTIONS = new Set([
  "IDLE", "READY_STANCE", "WALK_FORWARD", "WALK_BACK", "RUN_FORWARD", "RUN_BACK",
  "DASH_FORWARD", "DASH_BACK", "CROUCH_IDLE", "CROUCH_WALK", "BLOCK_HIGH", "BLOCK_LOW",
  "LIGHT_PUNCH", "HEAVY_PUNCH", "LIGHT_KICK", "HEAVY_KICK", "COMBO_1", "COMBO_2",
  "THROW_GRAB", "THROW_FINISH", "HURT_LIGHT", "TAUNT", "VICTORY"
]);

const collectUrls = (value, urls = new Set()) => {
  if (typeof value === "string") urls.add(value);
  else if (value && typeof value === "object") Object.values(value).forEach((entry) => collectUrls(entry, urls));
  return urls;
};

const localAssetPath = (url) => url.split(/[?#]/, 1)[0];
const manifestPath = resolve(root, localAssetPath(ASSET_URLS.manifest));
const manifest = JSON.parse(await readFile(manifestPath, "utf8"));
const semanticQa = JSON.parse(await readFile(resolve(root, "assets/motion-atlases/motion-semantic-qa.json"), "utf8"));
const companionManifest = JSON.parse(await readFile(resolve(root, "assets/user-assists/companion-projectiles.json"), "utf8"));
const urls = collectUrls(ASSET_URLS);
COMMERCIAL_URLS.forEach((url) => urls.add(url));
const motionSheets = new Set();

const sourceFiles = [];
const collectSourceFiles = async (directory) => {
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const path = resolve(directory, entry.name);
    if (entry.isDirectory()) await collectSourceFiles(path);
    else if (entry.isFile() && entry.name.endsWith(".js")) sourceFiles.push(path);
  }
};

await collectSourceFiles(resolve(root, "src"));
for (const sourceFile of sourceFiles) {
  const source = await readFile(sourceFile, "utf8");
  for (const match of source.matchAll(/from\s+["']([^"']+\.js(?:\?[^"']*)?)["']/g)) {
    if (!match[1].endsWith(`?v=${MOTION_ASSET_VERSION}`)) {
      failures.push(`${sourceFile.slice(root.length + 1)}: unversioned module import ${match[1]}`);
    }
  }
}

const indexSource = await readFile(resolve(root, "index.html"), "utf8");
if (!indexSource.includes(`./src/main.js?v=${MOTION_ASSET_VERSION}`)) {
  failures.push("index.html: main module version does not match MOTION_ASSET_VERSION");
}

const atlasPackerSource = await readFile(resolve(root, "scripts/pack-higgsfield-v2.py"), "utf8");
const destructiveAlphaMutations = [
  /clear_long_dark_runs/,
  /alpha\[:,\s*start:end\]\s*=\s*0/,
  /alpha\[start:end,\s*:\]\s*=\s*0/,
  /alpha\[top:bottom,\s*:\]\s*=\s*0/,
  /alpha\[:,\s*left:right\]\s*=\s*0/
];
if (destructiveAlphaMutations.some((pattern) => pattern.test(atlasPackerSource))) {
  failures.push("Sprite packer must not erase projected atlas rows or columns through character pixels");
}

if (manifest.provider !== REQUIRED_PROVIDER) failures.push(`Unexpected sprite provider: ${manifest.provider}`);
if (semanticQa.version !== 2 || semanticQa.pipeline !== "semantic-sprite-quality-v2") {
  failures.push("Motion semantic QA manifest is missing or unsupported");
}
if (manifest.stabilizationVersion !== 1) failures.push("Motion manifest is missing stabilization metadata");
if (manifest.framesPerMotion !== REQUIRED_FRAME_COUNT) {
  failures.push(`Manifest declares ${manifest.framesPerMotion} frames per motion; requires ${REQUIRED_FRAME_COUNT}`);
}
if (companionManifest.provider !== REQUIRED_PROVIDER) failures.push(`Unexpected companion provider: ${companionManifest.provider}`);
for (const [companionName, companion] of Object.entries(companionManifest.companions ?? {})) {
  urls.add(companion.sheet);
  if (companion.frames !== REQUIRED_FRAME_COUNT || companion.uniqueFrames !== REQUIRED_FRAME_COUNT) {
    failures.push(`${companionName}: companion attack requires six unique frames`);
  }
  if (!companion.jobId) failures.push(`${companionName}: missing Higgsfield job provenance`);
  if (JSON.stringify(companion.sourceFigureCounts) !== "[3,3]") {
    failures.push(`${companionName}: source sheet must contain exactly three poses per row`);
  }
}

for (const [characterId, character] of Object.entries(manifest.characters ?? {})) {
  const runtimeMotions = character.motions ?? {};
  const missingMotions = MOTIONS.filter((motion) => !(motion in runtimeMotions));
  if (missingMotions.length) failures.push(`${characterId}: missing motions ${missingMotions.join(", ")}`);
  const unexpectedMotions = Object.keys(runtimeMotions).filter((motion) => !MOTIONS.includes(motion));
  if (unexpectedMotions.length) failures.push(`${characterId}: unexpected motions ${unexpectedMotions.join(", ")}`);
  if (character.atlasFiles?.length !== 3) failures.push(`${characterId}: expected three selection-loaded atlas files`);

  for (const [motionName, motion] of Object.entries(runtimeMotions)) {
    urls.add(motion.sheet);
    motionSheets.add(motion.sheet);
    if (motion.frameCount !== motion.frames?.length) {
      failures.push(`${characterId}/${motionName}: frameCount does not match frames array`);
    }
    if (motion.frameCount !== REQUIRED_FRAME_COUNT) {
      failures.push(`${characterId}/${motionName}: ${motion.frameCount} frames, requires ${REQUIRED_FRAME_COUNT}`);
    }
    if ((motion.uniqueFrames ?? 0) < REQUIRED_FRAME_COUNT) {
      failures.push(`${characterId}/${motionName}: ${motion.uniqueFrames ?? 0} unique frames, requires ${REQUIRED_FRAME_COUNT}`);
    }
    if (!REQUIRED_SOURCES.has(motion.source)) {
      failures.push(`${characterId}/${motionName}: unexpected source ${motion.source}`);
    }
    const hasHiggsfieldProvenance = Boolean(motion.higgsfieldJobId);
    const hasChatGptImageProvenance = motion.generationProvider === "ChatGPT Image" && Boolean(motion.generationId);
    if (!hasHiggsfieldProvenance && !hasChatGptImageProvenance) {
      failures.push(`${characterId}/${motionName}: missing generation provenance`);
    }
    const semanticKey = `${characterId}/${motionName}`;
    const semanticRule = semanticQa.motions?.[semanticKey];
    if (!semanticRule) failures.push(`${semanticKey}: missing semantic sprite-quality rule`);
    if (
      motion.semantic?.version !== 2
      || motion.semantic?.bodyOnly !== true
      || motion.semantic?.figureCount !== 1
      || motion.semantic?.anchor !== "bottom-center"
      || motion.semantic?.poseClass !== semanticRule?.poseClass
    ) {
      failures.push(`${semanticKey}: semantic metadata does not match the sprite-quality manifest`);
    }
    if (motion.source === "derived-body-only-v1") {
      if (motion.repair !== "semantic-body-only-v1") {
        failures.push(`${semanticKey}: derived sequence lacks semantic QA approval`);
      }
      if (motion.semantic?.bodyOnly !== true || motion.semantic?.figureCount !== 1 || motion.semantic?.anchor !== "bottom-center") {
        failures.push(`${semanticKey}: semantic approval must require one bottom-anchored body-only figure`);
      }
      if (!motion.semantic?.poseClass || motion.semantic.poseClass !== semanticRule?.poseClass) {
        failures.push(`${semanticKey}: semantic pose class does not match the QA manifest`);
      }
      if (motion.repairSourceFrames?.length !== REQUIRED_FRAME_COUNT) {
        failures.push(`${semanticKey}: repaired sequence must declare six source poses`);
      }
    }
    if (motion.frames?.some((frame) => frame.w <= 0 || frame.h <= 0 || frame.x < 0 || frame.y < 0)) {
      failures.push(`${characterId}/${motionName}: invalid packed frame rectangle`);
    }
    const visualHeights = [];
    for (const frame of motion.frames ?? []) {
      const content = frame.content;
      if (!content || content.w <= 0 || content.h <= 0 || content.visibleW <= 0 || content.visibleH <= 0 || content.scale <= 0) {
        failures.push(`${characterId}/${motionName}: missing or invalid stabilized content bounds`);
        continue;
      }
      if (content.x < 0 || content.y < 0 || content.x + content.w > frame.w || content.y + content.h > frame.h) {
        failures.push(`${characterId}/${motionName}: stabilized content bounds exceed the packed frame`);
      }
      visualHeights.push(content.visibleH * content.scale);
    }
    if (STABLE_HEIGHT_MOTIONS.has(motionName) && visualHeights.length) {
      const spread = Math.max(...visualHeights) - Math.min(...visualHeights);
      if (spread > 0.05) failures.push(`${characterId}/${motionName}: visible height still pulses by ${spread.toFixed(3)} pixels`);
    }
  }

  const visualHeight = (motionName) => runtimeMotions[motionName].frames
    .map((frame) => frame.content.visibleH * frame.content.scale)
    .reduce((sum, value) => sum + value, 0) / runtimeMotions[motionName].frames.length;
  const idleHeight = visualHeight("IDLE");
  const runRatio = visualHeight("RUN_FORWARD") / idleHeight;
  for (const motionName of ["CROUCH_IDLE", "CROUCH_WALK"]) {
    const crouchRatio = visualHeight(motionName) / idleHeight;
    if (Math.abs(crouchRatio - 0.72) > 0.02) failures.push(`${characterId}/${motionName}: crouch pose ratio is ${crouchRatio.toFixed(3)}`);
  }
  if (Math.abs(runRatio - 0.90) > 0.02) failures.push(`${characterId}: run scale ratio is ${runRatio.toFixed(3)}`);
  for (const motionName of ["JUMP_START", "JUMP_RISE", "JUMP_PEAK", "JUMP_FALL", "LANDING", "AIR_ATTACK"]) {
    const peakHeight = Math.max(...runtimeMotions[motionName].frames.map((frame) => frame.content.visibleH * frame.content.scale));
    if (Math.abs(peakHeight / idleHeight - 1) > 0.02) {
      failures.push(`${characterId}/${motionName}: full-body scale does not match idle (${(peakHeight / idleHeight).toFixed(3)})`);
    }
  }
  for (const motionName of ["JUMP_START", "JUMP_RISE", "JUMP_PEAK", "JUMP_FALL", "LANDING", "AIR_ATTACK"]) {
    if (runtimeMotions[motionName].source !== "higgsfield-v3-aerial-locomotion") {
      failures.push(`${characterId}/${motionName}: aerial motion must use a direct Higgsfield v3 strip`);
    }
  }

  const signature = (motionName) => JSON.stringify({
    sheet: runtimeMotions[motionName]?.sheet,
    job: runtimeMotions[motionName]?.higgsfieldJobId,
    frames: runtimeMotions[motionName]?.frames?.map(({ x, y }) => [x, y])
  });
  if (signature("DASH_FORWARD") === signature("RUN_FORWARD") || signature("DASH_FORWARD") === signature("WALK_FORWARD")) {
    failures.push(`${characterId}: DASH_FORWARD reuses a locomotion sequence`);
  }
  if (signature("DASH_BACK") === signature("RUN_BACK") || signature("DASH_BACK") === signature("WALK_BACK")) {
    failures.push(`${characterId}: DASH_BACK reuses a locomotion sequence`);
  }
}

if (Object.keys(semanticQa.motions ?? {}).length !== Object.keys(manifest.characters ?? {}).length * MOTIONS.length) {
  failures.push("Semantic sprite-quality manifest must cover every runtime motion");
}
for (const semanticKey of Object.keys(semanticQa.motions ?? {})) {
  const [characterId, motionName] = semanticKey.split("/");
  if (!manifest.characters?.[characterId]?.motions?.[motionName]) failures.push(`${semanticKey}: semantic QA entry has no runtime motion`);
}

urls.add("../../assets/js/lm-game-rewards-sdk.js");
for (const url of urls) {
  try {
    await access(resolve(root, localAssetPath(url)));
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
