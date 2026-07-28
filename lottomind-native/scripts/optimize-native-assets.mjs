import { readdir, rename, stat } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const nativeRoot = path.resolve(scriptDir, "..");
const assetRoots = [
  path.join(nativeRoot, "android", "app", "src", "main", "res"),
  path.join(nativeRoot, "ios", "App", "App", "Assets.xcassets", "Splash.imageset"),
];
const splashFiles = [];

async function collect(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      await collect(fullPath);
    } else if (entry.isFile() && entry.name.toLowerCase().endsWith(".png") && entry.name.toLowerCase().includes("splash")) {
      splashFiles.push(fullPath);
    } else if (entry.isFile() && directory.endsWith("Splash.imageset") && entry.name.toLowerCase().endsWith(".png")) {
      splashFiles.push(fullPath);
    }
  }
}

for (const root of assetRoots) await collect(root);

let beforeBytes = 0;
let afterBytes = 0;
for (const sourcePath of splashFiles) {
  const relative = path.relative(nativeRoot, sourcePath);
  if (relative.startsWith("..") || path.isAbsolute(relative)) {
    throw new Error(`Refusing to optimize unexpected asset: ${sourcePath}`);
  }
  const temporaryPath = `${sourcePath}.optimized.png`;
  beforeBytes += (await stat(sourcePath)).size;
  await sharp(sourcePath)
    .png({ compressionLevel: 9, adaptiveFiltering: true, palette: true, quality: 88, effort: 10 })
    .toFile(temporaryPath);
  await rename(temporaryPath, sourcePath);
  afterBytes += (await stat(sourcePath)).size;
}

console.log(`Optimized ${splashFiles.length} splash assets from ${(beforeBytes / 1024 / 1024).toFixed(1)} MB to ${(afterBytes / 1024 / 1024).toFixed(1)} MB.`);
