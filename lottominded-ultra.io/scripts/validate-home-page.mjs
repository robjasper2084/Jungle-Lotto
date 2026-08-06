import { existsSync, readFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { resolve } from "node:path";

const root = resolve(process.cwd());
const htmlPath = resolve(root, "index.html");
const html = readFileSync(htmlPath, "utf8");
const membershipsHtml = readFileSync(resolve(root, "memberships.html"), "utf8");
const storefrontHtml = readFileSync(resolve(root, "merch-store.html"), "utf8");
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

if (!/data-startup-video/i.test(html) || !/lottomind-home-apparel-commercial-20260804\.opt\.mp4/i.test(html)) {
  failures.push("The optional inline homepage story is missing.");
}

if (!/data-startup-video-play/i.test(html) || !/Watch the Story/i.test(html)) {
  failures.push("The inline homepage story is missing its explicit user-triggered playback control.");
}

const sharedCommercialStylesheet = /assets\/css\/lm-commercial-hud\.css/i;
if (!sharedCommercialStylesheet.test(html) || !sharedCommercialStylesheet.test(storefrontHtml)) {
  failures.push("Home and Storefront are not loading the shared commercial HUD stylesheet.");
}

for (const requiredClass of [
  "merch-commercial-modal__panel",
  "merch-commercial-modal__header",
  "merch-commercial-modal__body",
  "merch-commercial-modal__stage",
  "merch-commercial-modal__telemetry",
  "merch-commercial-modal__footer",
]) {
  if (!html.includes(requiredClass)) failures.push(`The homepage commercial is missing ${requiredClass}.`);
}

for (const collectorRequirement of [
  /data-collector-access\b/i,
  /id=["']collectorAccessPanel["']/i,
  /data-collector-forgot-password\b/i,
  /data-collector-recovery-form\b/i,
  /data-collector-redeem-form\b/i,
  /assets\/css\/beat2lotto-collector-access\.css/i,
  /assets\/js\/lottomind-account-service\.js/i,
  /assets\/js\/beat2lotto-collector-access\.js/i,
]) {
  if (!collectorRequirement.test(html)) failures.push(`The homepage Collector Access move is incomplete: ${collectorRequirement}.`);
}

if (/data-collector-access\b/i.test(membershipsHtml) || /id=["']collectorAccessPanel["']/i.test(membershipsHtml)) {
  failures.push("Collector Access is still mounted on memberships.html instead of Home.");
}

if (!/index\.html\?collector=access(?:&amp;|&)return=memberships#lottomind-refined/i.test(membershipsHtml)) {
  failures.push("Memberships is missing its Collector Access handoff to Home.");
}

if (!/shouldSuppressStartupVideo[\s\S]*collector["']\)\s*===\s*["']access/i.test(siteScript)) {
  failures.push("The Home commercial is not suppressed while Collector Access is requested.");
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
