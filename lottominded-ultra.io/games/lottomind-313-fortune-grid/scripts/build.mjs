import { cp, readFile, readdir, rm, writeFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { build } from "vite";

const gameRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const outputRoot = join(gameRoot, "dist");
const generatedAssets = join(outputRoot, "assets", "build");
if (dirname(outputRoot) !== gameRoot) throw new Error("Unsafe Fortune Grid output path.");
await rm(outputRoot, { recursive: true, force: true });
await build({ configFile: join(gameRoot, "vite.config.ts") });
await cp(join(gameRoot, "assets", "art"), join(outputRoot, "assets", "art"), { recursive: true });
const generatedTextFiles = [
  join(outputRoot, "index.html"),
  ...(await readdir(generatedAssets))
    .filter((name) => name.endsWith(".js") || name.endsWith(".css"))
    .map((name) => join(generatedAssets, name))
];
for (const file of generatedTextFiles) {
  const normalized = (await readFile(file, "utf8"))
    .replace(/\r\n?|\n/g, "\n")
    .replace(/^ +\t/gm, "\t")
    .replace(/[ \t]+$/gm, "");
  await writeFile(file, normalized, "utf8");
}
