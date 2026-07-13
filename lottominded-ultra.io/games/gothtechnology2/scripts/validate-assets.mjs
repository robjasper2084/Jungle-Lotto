import { access, readFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { ASSET_URLS, PACK_ROOT, SPRITE_OVERRIDES } from "../src/config/assets.js";

const root = resolve(import.meta.dirname, "..");
const failures = [];

const collectUrls = (value, urls = new Set()) => {
  if (typeof value === "string") urls.add(value);
  else if (value && typeof value === "object") Object.values(value).forEach((entry) => collectUrls(entry, urls));
  return urls;
};

const urls = collectUrls(ASSET_URLS);
Object.values(SPRITE_OVERRIDES).forEach((override) => urls.add(override.image));

const manifestPath = join(root, ASSET_URLS.manifest);
const manifest = JSON.parse(await readFile(manifestPath, "utf8"));
for (const character of Object.values(manifest.characters || {})) {
  for (const motion of Object.values(character.motions || {})) {
    urls.add(`${PACK_ROOT}/${motion.sheet}`);
  }
}

urls.add("../../assets/js/lm-game-rewards-sdk.js");
for (const url of urls) {
  const filePath = resolve(root, url);
  try {
    await access(filePath);
  } catch {
    failures.push(url);
  }
}

for (const [characterId, character] of Object.entries(manifest.characters || {})) {
  const overrideMotions = SPRITE_OVERRIDES[characterId]?.motions || {};
  const missing = Object.keys(character.motions || {}).filter((motion) => !overrideMotions[motion]);
  if (missing.length) {
    console.log(`${characterId}: ${missing.length} motions use the manifest runtime atlas.`);
  } else {
    console.log(`${characterId}: every manifest motion is covered by the lightweight override atlas.`);
  }
}

if (failures.length) {
  console.error(`Missing assets:\n${failures.join("\n")}`);
  process.exitCode = 1;
} else {
  console.log(`Validated ${urls.size} asset paths.`);
}
