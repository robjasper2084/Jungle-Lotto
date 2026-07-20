import { existsSync } from "node:fs";
import { readFile, readdir } from "node:fs/promises";
import { dirname, extname, join, relative, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { runInNewContext } from "node:vm";

const packageRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const outputRoot = join(packageRoot, "dist-staging");
const manifest = JSON.parse(await readFile(join(outputRoot, "staging-manifest.json"), "utf8"));
const failures = [];
const references = [];

const environmentSource = await readFile(join(packageRoot, "assets", "js", "lm-environment.js"), "utf8");
const productionSandbox = {};
productionSandbox.window = productionSandbox;
runInNewContext(environmentSource, productionSandbox);
if (
  productionSandbox.LottoMindEnvironment?.name !== "production" ||
  productionSandbox.LottoMindEnvironment?.isProduction !== true ||
  productionSandbox.LottoMindEnvironment?.allowLivePayments !== true
) {
  failures.push("lm-environment.js: production must remain the default without a staging marker");
}

function toPosix(value) {
  return value.split(sep).join("/");
}

async function walk(directory, files = []) {
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const absolute = join(directory, entry.name);
    if (entry.isDirectory()) await walk(absolute, files);
    else if (entry.isFile()) files.push(absolute);
  }
  return files;
}

function cleanReference(raw) {
  const withoutQuery = String(raw || "").trim().split(/[?#]/, 1)[0];
  try { return decodeURIComponent(withoutQuery); }
  catch { return withoutQuery; }
}

function isLocalAsset(reference) {
  return Boolean(reference) &&
    !reference.startsWith("#") &&
    !reference.startsWith("//") &&
    !/^(?:https?:|data:|blob:|mailto:|tel:|javascript:)/i.test(reference) &&
    !/[{}]/.test(reference);
}

function assetPath(owner, raw) {
  let reference = cleanReference(raw);
  if (!isLocalAsset(reference)) return null;
  reference = reference.replace(/^\/Jungle-Lotto\/lottominded-ultra\.io\//i, "/");
  const candidate = reference.startsWith("/")
    ? resolve(outputRoot, reference.replace(/^[/\\]+/, ""))
    : resolve(dirname(owner), reference);
  if (candidate !== outputRoot && !candidate.startsWith(`${outputRoot}${sep}`)) return null;
  return candidate;
}

function record(owner, raw) {
  const candidate = assetPath(owner, raw);
  if (candidate) references.push({ owner, raw, candidate });
}

if (!Array.isArray(manifest.copiedRoutes) || !manifest.copiedRoutes.length) failures.push("manifest: copiedRoutes is empty");
if (!Array.isArray(manifest.injectedPages) || !manifest.injectedPages.length) failures.push("manifest: injectedPages is empty");
if (!Array.isArray(manifest.skippedFiles)) failures.push("manifest: skippedFiles is missing");
if (!manifest.buildTimestamp || !manifest.sourceCommitSHA) failures.push("manifest: build timestamp or source commit SHA is missing");

for (const relativePath of manifest.injectedPages || []) {
  const file = join(outputRoot, relativePath);
  const html = await readFile(file, "utf8");
  if (!/<meta\s+name="robots"\s+content="noindex,nofollow,noarchive"/i.test(html)) failures.push(`${relativePath}: noindex metadata missing`);
  if (!html.includes("LottoMind Upgrade Preview — Not Production")) failures.push(`${relativePath}: staging banner missing`);
  const markerIndex = html.indexOf("data-lm-staging-marker");
  const guardIndex = html.indexOf("lm-staging-guard.js");
  const accountIndex = html.search(/lottomind-account-service|lm-stripe-memberships|redeemCollectible|google-analytics|googletagmanager/i);
  if (markerIndex < 0 || guardIndex < markerIndex) failures.push(`${relativePath}: environment marker or staging guard order is invalid`);
  if (accountIndex >= 0 && markerIndex > accountIndex) failures.push(`${relativePath}: environment marker loads after a protected integration`);

  for (const match of html.matchAll(/\b(?:src|poster)\s*=\s*["']([^"']+)["']/gi)) record(file, match[1]);
  for (const match of html.matchAll(/\bsrcset\s*=\s*["']([^"']+)["']/gi)) {
    match[1].split(",").forEach((candidate) => record(file, candidate.trim().split(/\s+/, 1)[0]));
  }
  for (const match of html.matchAll(/<link\b([^>]*?)>/gi)) {
    const tag = match[1];
    if (!/\brel\s*=\s*["'][^"']*(?:stylesheet|icon|manifest|preload|modulepreload)[^"']*["']/i.test(tag)) continue;
    const href = tag.match(/\bhref\s*=\s*["']([^"']+)["']/i);
    if (href) record(file, href[1]);
  }
}

for (const file of await walk(outputRoot)) {
  if (extname(file).toLowerCase() !== ".css") continue;
  const css = await readFile(file, "utf8");
  for (const match of css.matchAll(/url\(\s*(["']?)([^)'"\s]+)\1\s*\)/gi)) {
    if (!match[2].startsWith("var(")) record(file, match[2]);
  }
}

for (const reference of references) {
  const exists = existsSync(reference.candidate) || (!extname(reference.candidate) && existsSync(join(reference.candidate, "index.html")));
  if (!exists) failures.push(`${toPosix(relative(outputRoot, reference.owner))}: missing same-origin asset ${reference.raw}`);
}

if (failures.length) {
  console.error(`Staging static verification failed with ${failures.length} issue(s):`);
  failures.forEach((failure) => console.error(`- ${failure}`));
  process.exitCode = 1;
} else {
  console.log(`Verified ${manifest.injectedPages.length} injected pages and ${references.length} same-origin asset references.`);
}
