import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const nativeRoot = path.resolve(scriptDir, "..");
const packageManifest = path.join(nativeRoot, "ios", "App", "CapApp-SPM", "Package.swift");
const relativeManifest = path.relative(nativeRoot, packageManifest);

if (relativeManifest !== path.join("ios", "App", "CapApp-SPM", "Package.swift")) {
  throw new Error(`Refusing to edit unexpected Swift package manifest: ${packageManifest}`);
}

const source = await readFile(packageManifest, "utf8");
const normalized = source.replaceAll("\\", "/");

if (normalized !== source) {
  await writeFile(packageManifest, normalized, "utf8");
  console.log("Normalized iOS Swift package paths for cross-platform builds.");
} else {
  console.log("iOS Swift package paths already use portable separators.");
}
