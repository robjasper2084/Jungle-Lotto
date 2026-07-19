import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const ignoredDirectories = new Set([".git", ".circleci", "node_modules", "playwright-report", "test-results", "previews"]);
const expectedCanonicalPrefix = "https://robjasper2084.github.io/Jungle-Lotto/lottominded-ultra.io/";
const errors = [];

function walk(directory, extension, results = []) {
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    if (entry.name.startsWith(".") && entry.name !== ".well-known") continue;
    const absolute = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      if (!ignoredDirectories.has(entry.name)) walk(absolute, extension, results);
    } else if (entry.name.endsWith(extension)) {
      results.push(absolute);
    }
  }
  return results;
}

function cleanReference(reference) {
  const trimmed = reference.trim().replace(/^['"]|['"]$/g, "");
  let decoded = trimmed;
  try { decoded = decodeURIComponent(trimmed); } catch {}
  return decoded.split(/[?#]/, 1)[0];
}

function isLocalReference(reference) {
  return reference &&
    !reference.startsWith("#") &&
    !reference.startsWith("//") &&
    !/^(?:https?:|data:|blob:|mailto:|tel:|javascript:)/i.test(reference) &&
    !/[{}]/.test(reference);
}

function resolveReference(owner, reference) {
  const normalized = reference.replace(/^\//, "");
  const absolute = reference.startsWith("/")
    ? path.join(root, normalized)
    : path.resolve(path.dirname(owner), normalized);
  if (path.relative(root, absolute).startsWith("..")) return true;
  if (fs.existsSync(absolute)) return true;
  if (!path.extname(absolute) && fs.existsSync(path.join(absolute, "index.html"))) return true;
  return false;
}

const htmlFiles = fs.readdirSync(root, { withFileTypes: true })
  .filter((entry) => entry.isFile() && entry.name.endsWith(".html") && !/\.backup\.html$/i.test(entry.name))
  .map((entry) => path.join(root, entry.name));
for (const file of htmlFiles) {
  const relative = path.relative(root, file);
  const html = fs.readFileSync(file, "utf8");
  const ids = [...html.matchAll(/\bid\s*=\s*["']([^"']+)["']/gi)].map((match) => match[1]);
  const duplicateIds = [...new Set(ids.filter((id, index) => ids.indexOf(id) !== index))];
  if (duplicateIds.length) errors.push(`${relative}: duplicate IDs: ${duplicateIds.join(", ")}`);

  const attributes = [...html.matchAll(/\b(?:src|href|poster)\s*=\s*["']([^"']+)["']/gi)].map((match) => match[1]);
  for (const raw of attributes) {
    const reference = cleanReference(raw);
    if (!isLocalReference(reference)) continue;
    if (!resolveReference(file, reference)) errors.push(`${relative}: missing local reference ${raw}`);
  }
}

const canonicalFiles = walk(root, ".html").filter((file) => {
  const relative = path.relative(root, file);
  return !relative.includes(`node_modules${path.sep}`) && !/\.backup\.html$/i.test(relative);
});
for (const file of canonicalFiles) {
  const relative = path.relative(root, file);
  const html = fs.readFileSync(file, "utf8");
  for (const match of html.matchAll(/<link\s+[^>]*rel=["']canonical["'][^>]*href=["']([^"']+)["'][^>]*>/gi)) {
    const href = match[1];
    if (href.startsWith("https://robjasper2084.github.io/") && !href.startsWith(expectedCanonicalPrefix)) {
      errors.push(`${relative}: canonical must start with ${expectedCanonicalPrefix}`);
    }
  }
}

const requiredStaticRoutes = [
  "news/index.html",
];
for (const route of requiredStaticRoutes) {
  if (!fs.existsSync(path.join(root, route))) errors.push(`${route}: required built static route is missing`);
}

const jackpotRootIndex = path.join(root, "games", "lottomind-jackpot-maze", "index.html");
const jackpotDistIndex = path.join(root, "games", "lottomind-jackpot-maze", "dist", "index.html");
const jackpotRootHtml = fs.existsSync(jackpotRootIndex) ? fs.readFileSync(jackpotRootIndex, "utf8") : "";
const jackpotRootIsBuilt = jackpotRootHtml && !/src\/main\.[jt]sx?/i.test(jackpotRootHtml);
if (!jackpotRootIsBuilt && !fs.existsSync(jackpotDistIndex)) {
  errors.push("games/lottomind-jackpot-maze: required built static route is missing");
}

const newsHub = path.join(root, "news-hub", "index.html");
if (fs.existsSync(newsHub) && !fs.readFileSync(newsHub, "utf8").includes("redirectGitHubPagesNewsHub")) {
  errors.push("news-hub/index.html: missing GitHub Pages redirect to built news route");
}

const builtNewsAssets = fs.existsSync(path.join(root, "news", "assets")) ? walk(path.join(root, "news", "assets"), ".js") : [];
for (const file of builtNewsAssets) {
  const relative = path.relative(root, file);
  const script = fs.readFileSync(file, "utf8");
  if (script.includes("../api/news") || script.includes("/api/news")) {
    errors.push(`${relative}: built news bundle should not fetch missing static-host API`);
  }
}

const serviceWorker = path.join(root, "service-worker.js");
if (fs.existsSync(serviceWorker)) {
  const worker = fs.readFileSync(serviceWorker, "utf8");
  if (!worker.includes("MAX_ASSET_BYTES") || !worker.includes("NEVER_CACHE_EXTENSIONS")) {
    errors.push("service-worker.js: runtime cache must stay bounded and skip large media assets");
  }
}

const cssFiles = [
  ...fs.readdirSync(root, { withFileTypes: true })
    .filter((entry) => entry.isFile() && entry.name.endsWith(".css"))
    .map((entry) => path.join(root, entry.name)),
  ...walk(path.join(root, "assets", "css"), ".css")
];
for (const file of cssFiles) {
  const relative = path.relative(root, file);
  const css = fs.readFileSync(file, "utf8");
  for (const match of css.matchAll(/url\(\s*(["']?)([^)'"\s]+)\1\s*\)/gi)) {
    const raw = match[2];
    const reference = cleanReference(raw);
    if (!isLocalReference(reference) || reference.startsWith("var(")) continue;
    if (!resolveReference(file, reference)) errors.push(`${relative}: missing CSS asset ${raw}`);
  }
}

if (errors.length) {
  console.error(`Site validation failed with ${errors.length} issue(s):`);
  for (const error of errors) console.error(`- ${error}`);
  process.exitCode = 1;
} else {
  console.log(`Validated ${htmlFiles.length} HTML files: no duplicate IDs or missing local assets.`);
}
