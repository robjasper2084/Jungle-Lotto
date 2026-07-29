import { existsSync, readFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { resolve } from "node:path";

const root = resolve(process.cwd());
const htmlPath = resolve(root, "index.html");
const html = readFileSync(htmlPath, "utf8");
const siteScript = readFileSync(resolve(root, "site.js"), "utf8");
const styles = readFileSync(resolve(root, "styles.css"), "utf8");
const failures = [];

function loadTrackedPaths() {
  try {
    const prefix = execFileSync("git", ["rev-parse", "--show-prefix"], {
      cwd: root,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
    }).trim().replaceAll("\\", "/");
    const files = execFileSync("git", ["ls-files", "--cached", "--full-name", "-z"], {
      cwd: root,
      encoding: "utf8",
      maxBuffer: 16 * 1024 * 1024,
      stdio: ["ignore", "pipe", "ignore"],
    });
    return { prefix, files: new Set(files.split("\0").filter(Boolean)) };
  } catch {
    return { prefix: "", files: new Set() };
  }
}

const tracked = loadTrackedPaths();

function existsLocallyOrTracked(absolutePath) {
  if (existsSync(absolutePath)) return true;
  const relativePath = absolutePath.slice(root.length + 1).replaceAll("\\", "/");
  return Boolean(relativePath && tracked.files.has(`${tracked.prefix}${relativePath}`));
}

if (/lm-healing-generator|healing-frequency\.js/i.test(html)) {
  failures.push("The removed healing-frequency generator is still referenced by index.html.");
}

if (/data-startup-video|startup-video-modal/i.test(html)) {
  failures.push("The removed homepage startup popup is still present in index.html.");
}

if (!/class=["']home-sphere-scanline["']/i.test(html) || !/@keyframes\s+homeHeroScanBars/i.test(styles)) {
  failures.push("The homepage scan-bar treatment is missing.");
}

const ids = [...html.matchAll(/\bid=["']([^"']+)["']/gi)].map((match) => match[1]);
const duplicateIds = ids.filter((id, index) => ids.indexOf(id) !== index);
if (duplicateIds.length) failures.push(`Duplicate IDs: ${[...new Set(duplicateIds)].join(", ")}`);

const references = [...html.matchAll(/\b(?:href|src)=["']([^"']+)["']/gi)].map((match) => match[1]);
for (const reference of references) {
  if (/^(?:[a-z]+:|#|\/\/)/i.test(reference)) continue;
  const cleanPath = decodeURIComponent(reference.split(/[?#]/, 1)[0]);
  if (!cleanPath) continue;
  if (cleanPath.startsWith("../")) continue;
  const absolutePath = resolve(root, cleanPath);
  if (!absolutePath.startsWith(root) || !existsLocallyOrTracked(absolutePath)) {
    failures.push(`Missing local asset or route: ${reference}`);
  }
}

if (failures.length) {
  console.error(failures.join("\n"));
  process.exitCode = 1;
} else {
  console.log(`Homepage static check passed (${ids.length} IDs, ${references.length} local/external references scanned).`);
}
