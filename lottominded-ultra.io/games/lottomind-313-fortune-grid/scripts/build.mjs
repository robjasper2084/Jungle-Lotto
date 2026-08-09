import { readFile, readdir, rm, writeFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { build } from "vite";

const gameRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const generatedAssets = join(gameRoot, "assets", "build");
if (dirname(generatedAssets) !== join(gameRoot, "assets")) throw new Error("Unsafe generated asset path.");
await rm(generatedAssets, { recursive: true, force: true });
await build({ configFile: join(gameRoot, "vite.config.ts") });
const generatedTextFiles = [
  join(gameRoot, "index.html"),
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
