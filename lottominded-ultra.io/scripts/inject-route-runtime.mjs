import { readFile, readdir, writeFile } from "node:fs/promises";
import { dirname, relative, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";

const packageRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const excluded = new Set(["dist-staging", "node_modules", "playwright-report", "test-results"]);

async function walk(directory, files = []) {
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    if (entry.isDirectory() && excluded.has(entry.name)) continue;
    const absolute = resolve(directory, entry.name);
    if (entry.isDirectory()) await walk(absolute, files);
    else if (entry.isFile() && entry.name.endsWith(".html") && !entry.name.endsWith(".backup.html")) files.push(absolute);
  }
  return files;
}

let changed = 0;
for (const file of await walk(packageRoot)) {
  let html = await readFile(file, "utf8");
  if (!/(?:src=["'][^"']*site\.js)/i.test(html)) continue;
  if (/lm-route-manifest\.generated\.js/i.test(html)) continue;
  const relativeAsset = relative(dirname(file), resolve(packageRoot, "assets", "js", "lm-route-manifest.generated.js"))
    .split(sep).join("/");
  const source = relativeAsset.startsWith(".") ? relativeAsset : `./${relativeAsset}`;
  const marker = /<script[^>]+src=["'][^"']*site\.js[^>]*><\/script>/i;
  html = html.replace(marker, (siteScript) => `<script src="${source}"></script>\n${siteScript}`);
  await writeFile(file, html, "utf8");
  changed += 1;
}

console.log(`Injected the generated route runtime into ${changed} HTML files.`);
