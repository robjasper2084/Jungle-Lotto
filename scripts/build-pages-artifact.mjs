import { execFileSync } from "node:child_process";
import { copyFile, mkdir, readFile, rm, stat, writeFile } from "node:fs/promises";
import { basename, dirname, extname, relative, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const outputRoot = resolve(repoRoot, "_site");
const rootFiles = new Set([
  ".nojekyll",
  "404.html",
  "index.html",
  "public-site.css",
  "public-site.js",
]);
const publicRoots = [
  "lottominded-ultra.io/",
  "lotto mind refined/",
  "lottomind-stem-studio/",
];
const requiredRoutes = [
  "index.html",
  "404.html",
  "lottominded-ultra.io/index.html",
  "lottominded-ultra.io/features-app.html",
  "lottominded-ultra.io/games/lottomind-trivia/index.html",
  "lotto mind refined/index.html",
  "lottomind-stem-studio/index.html",
];
const referenceTextExtensions = new Set([
  ".cjs",
  ".css",
  ".html",
  ".js",
  ".json",
  ".md",
  ".mjs",
  ".svg",
  ".txt",
  ".webmanifest",
  ".xml",
]);
const optionalMediaExtensions = new Set([
  ".aac",
  ".avif",
  ".gif",
  ".jpeg",
  ".jpg",
  ".m4a",
  ".m4v",
  ".mov",
  ".mp3",
  ".mp4",
  ".ogg",
  ".png",
  ".wav",
  ".webm",
  ".webp",
]);
const smallMediaMaxBytes = 256 * 1024;
const defaultMaxBytes = 1_200 * 1024 * 1024;
const maxBytes = Number(process.env.PAGES_ARTIFACT_MAX_BYTES || defaultMaxBytes);

function git(args) {
  return execFileSync("git", args, {
    cwd: repoRoot,
    encoding: "utf8",
    maxBuffer: 16 * 1024 * 1024,
  }).trim();
}

function isPublicFile(file) {
  return rootFiles.has(file) || publicRoots.some((root) => file.startsWith(root));
}

function outputPathFor(file) {
  const destination = resolve(outputRoot, file.split("/").join(sep));
  const outputRelative = relative(outputRoot, destination);

  if (outputRelative.startsWith("..") || resolve(destination) === outputRoot) {
    throw new Error(`Refusing unsafe artifact path: ${file}`);
  }

  return destination;
}

async function copyTrackedFile(file) {
  const source = resolve(repoRoot, file.split("/").join(sep));
  const destination = outputPathFor(file);
  const sourceStats = await stat(source);

  if (!sourceStats.isFile()) {
    throw new Error(`Tracked public path is not a file: ${file}`);
  }

  await mkdir(dirname(destination), { recursive: true });
  await copyFile(source, destination);
  return sourceStats.size;
}

async function copyInBatches(files, batchSize = 16) {
  let totalBytes = 0;

  for (let index = 0; index < files.length; index += batchSize) {
    const batch = files.slice(index, index + batchSize);
    const sizes = await Promise.all(batch.map(copyTrackedFile));
    totalBytes += sizes.reduce((sum, size) => sum + size, 0);
  }

  return totalBytes;
}

async function buildReferenceCorpus(files, batchSize = 32) {
  const textFiles = files.filter((file) =>
    referenceTextExtensions.has(extname(file).toLowerCase()),
  );
  const chunks = [];

  for (let index = 0; index < textFiles.length; index += batchSize) {
    const batch = textFiles.slice(index, index + batchSize);
    const contents = await Promise.all(
      batch.map(async (file) => {
        const source = resolve(repoRoot, file.split("/").join(sep));
        return readFile(source, "utf8");
      }),
    );
    chunks.push(...contents);
  }

  return chunks.join("\n").toLowerCase();
}

function mediaReferenceTokens(file) {
  const normalizedFile = file.toLowerCase();
  const fileName = basename(file).toLowerCase();
  return [
    normalizedFile,
    encodeURI(normalizedFile).toLowerCase(),
    fileName,
    encodeURIComponent(fileName).toLowerCase(),
  ];
}

async function planArtifact(files) {
  const referenceCorpus = await buildReferenceCorpus(files);
  const includedFiles = [];
  const omittedFiles = [];
  let omittedBytes = 0;

  for (const file of files) {
    const extension = extname(file).toLowerCase();

    if (!optionalMediaExtensions.has(extension)) {
      includedFiles.push(file);
      continue;
    }

    const source = resolve(repoRoot, file.split("/").join(sep));
    const sourceStats = await stat(source);
    const isSmall = sourceStats.size <= smallMediaMaxBytes;
    const isReferenced = mediaReferenceTokens(file).some((token) =>
      referenceCorpus.includes(token),
    );

    if (isSmall || isReferenced) {
      includedFiles.push(file);
      continue;
    }

    omittedFiles.push(file);
    omittedBytes += sourceStats.size;
  }

  return { includedFiles, omittedFiles, omittedBytes };
}

if (!Number.isFinite(maxBytes) || maxBytes <= 0) {
  throw new Error("PAGES_ARTIFACT_MAX_BYTES must be a positive number.");
}

if (dirname(outputRoot) !== repoRoot) {
  throw new Error(`Refusing to clean artifact path outside the repository: ${outputRoot}`);
}

// Include intended, untracked working-tree additions so a dirty release preview
// is validated as it is actually served. Ignored build output stays excluded.
const sourceFiles = git(["ls-files", "-z", "--cached", "--others", "--exclude-standard"])
  .split("\0")
  .filter(Boolean)
  .filter(isPublicFile);

if (!sourceFiles.length) {
  throw new Error("No public source files were found for the Pages artifact.");
}

const artifactPlan = await planArtifact(sourceFiles);

await rm(outputRoot, { recursive: true, force: true });
await mkdir(outputRoot, { recursive: true });

const totalBytes = await copyInBatches(artifactPlan.includedFiles);

for (const route of requiredRoutes) {
  const routeStats = await stat(outputPathFor(route)).catch(() => null);
  if (!routeStats?.isFile()) {
    throw new Error(`Required Pages route is missing from the artifact: ${route}`);
  }
}

if (totalBytes > maxBytes) {
  throw new Error(
    `Pages artifact is ${(totalBytes / 1024 / 1024).toFixed(1)} MiB, above the ` +
      `${(maxBytes / 1024 / 1024).toFixed(1)} MiB limit.`,
  );
}

const manifest = {
  generatedAt: new Date().toISOString(),
  branch: process.env.GITHUB_REF_NAME || git(["branch", "--show-current"]),
  commit: git(["rev-parse", "HEAD"]),
  sourceFileCount: sourceFiles.length,
  fileCount: artifactPlan.includedFiles.length,
  omittedMediaFileCount: artifactPlan.omittedFiles.length,
  omittedMediaBytes: artifactPlan.omittedBytes,
  omittedMediaMebibytes: Number((artifactPlan.omittedBytes / 1024 / 1024).toFixed(1)),
  bytes: totalBytes,
  mebibytes: Number((totalBytes / 1024 / 1024).toFixed(1)),
  maxMebibytes: Number((maxBytes / 1024 / 1024).toFixed(1)),
  includedRoots: ["root launcher", ...publicRoots.map((root) => root.slice(0, -1))],
  requiredRoutes,
};

await writeFile(
  resolve(outputRoot, "pages-artifact-manifest.json"),
  `${JSON.stringify(manifest, null, 2)}\n`,
  "utf8",
);

console.log(
  `Pages artifact ready: ${manifest.fileCount} source files, ${manifest.mebibytes} MiB ` +
    `(limit ${manifest.maxMebibytes} MiB). Omitted ` +
    `${manifest.omittedMediaFileCount} unreferenced media files ` +
    `(${manifest.omittedMediaMebibytes} MiB).`,
);
