import { rm } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { build } from "vite";

const gameRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const generatedAssets = join(gameRoot, "assets", "build");
if (dirname(generatedAssets) !== join(gameRoot, "assets")) throw new Error("Unsafe generated asset path.");
await rm(generatedAssets, { recursive: true, force: true });
await build({ configFile: join(gameRoot, "vite.config.ts") });
