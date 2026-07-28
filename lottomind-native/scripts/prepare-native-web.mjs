import { cp, mkdir, readdir, rm, stat } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const nativeRoot = path.resolve(scriptDir, "..");
const sourceRoot = path.resolve(nativeRoot, "..", "lotto mind refined");
const targetRoot = path.resolve(nativeRoot, "www");
const targetRelative = path.relative(nativeRoot, targetRoot);

if (targetRelative !== "www") {
  throw new Error(`Refusing to replace unexpected native web target: ${targetRoot}`);
}

const skippedDirectories = new Set(["docs"]);
const skippedFiles = new Set([
  path.normalize("assets/custom/studio/media/lottomind-music-hub-motion.mov"),
  path.normalize("assets/images/powertools-ai-fixed-games.13c13b9fed4bd95d952df4aacd3078ba.png"),
  path.normalize("assets/images/powertools-hero-bg.26c2f5fbc03f6f2f06a78067f283be94.png"),
]);
const jobs = [];
const pngFallbacks = [];

async function collect(relativeDir = "") {
  const sourceDir = path.join(sourceRoot, relativeDir);
  const entries = await readdir(sourceDir, { withFileTypes: true });
  for (const entry of entries) {
    const relativePath = path.join(relativeDir, entry.name);
    if (entry.isDirectory()) {
      if (!relativeDir && skippedDirectories.has(entry.name)) continue;
      await collect(relativePath);
      continue;
    }
    if (!entry.isFile() || skippedFiles.has(path.normalize(relativePath))) continue;
    jobs.push(relativePath);
  }
}

async function copyJob(relativePath) {
  const sourcePath = path.join(sourceRoot, relativePath);
  const targetPath = path.join(targetRoot, relativePath);
  await mkdir(path.dirname(targetPath), { recursive: true });

  if (path.extname(relativePath).toLowerCase() === ".png") {
    try {
      await sharp(sourcePath)
        .resize({ width: 1280, height: 1280, fit: "inside", withoutEnlargement: true })
        .png({ compressionLevel: 9, adaptiveFiltering: true, palette: true, quality: 82, effort: 10 })
        .toFile(targetPath);
    } catch {
      pngFallbacks.push(relativePath);
      await cp(sourcePath, targetPath);
    }
    return;
  }

  await cp(sourcePath, targetPath);
}

await stat(sourceRoot);
await rm(targetRoot, { recursive: true, force: true });
await mkdir(targetRoot, { recursive: true });
await collect();

let cursor = 0;
const workers = Array.from({ length: 4 }, async () => {
  while (cursor < jobs.length) {
    const job = jobs[cursor];
    cursor += 1;
    await copyJob(job);
  }
});

await Promise.all(workers);

const packagedFiles = [];
async function measure(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      await measure(fullPath);
    } else if (entry.isFile()) {
      packagedFiles.push(await stat(fullPath));
    }
  }
}

await measure(targetRoot);
const bytes = packagedFiles.reduce((total, entry) => total + entry.size, 0);
console.log(`Prepared ${packagedFiles.length} native web files (${(bytes / 1024 / 1024).toFixed(1)} MB).`);
if (pngFallbacks.length) {
  console.warn(`Copied ${pngFallbacks.length} PNG file(s) without optimization because they could not be decoded:`);
  pngFallbacks.forEach((file) => console.warn(`- ${file}`));
}
