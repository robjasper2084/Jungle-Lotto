import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const manifestPath = path.join(root, "games", "games-manifest.json");
const loaderPath = path.join(root, "assets", "js", "arcade-games.js");
const required = ["id", "title", "route", "thumbnail", "status", "membershipRequirement", "estimatedSessionTime", "supportedControls", "rewardEligibility", "version"];

function resolveSitePath(value) {
  return path.resolve(root, String(value).replace(/^\.\//, "").split(/[?#]/, 1)[0]);
}

function routeExists(value) {
  const target = resolveSitePath(value);
  return fs.existsSync(target) && (fs.statSync(target).isFile() || fs.existsSync(path.join(target, "index.html")));
}

if (!fs.existsSync(manifestPath)) throw new Error("games/games-manifest.json is missing");
const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8"));
if (!Array.isArray(manifest.games) || !manifest.games.length) throw new Error("Game manifest has no records");

const ids = new Set();
for (const [index, game] of manifest.games.entries()) {
  for (const field of required) {
    if (!String(game[field] ?? "").trim()) throw new Error(`Game ${index + 1} is missing ${field}`);
  }
  if (ids.has(game.id)) throw new Error(`Duplicate game ID: ${game.id}`);
  ids.add(game.id);
  if (!routeExists(game.route)) throw new Error(`Missing game route for ${game.id}: ${game.route}`);
  if (!fs.existsSync(resolveSitePath(game.thumbnail))) throw new Error(`Missing thumbnail for ${game.id}: ${game.thumbnail}`);
  for (const action of game.actions || []) {
    if (!action.label || !routeExists(action.route)) throw new Error(`Invalid action route for ${game.id}: ${action.route || "(empty)"}`);
  }
}

const payload = JSON.stringify(manifest);
const fallback = JSON.stringify(manifest.games);
const output = `(function exposeArcadeManifest(global, document) {\n  "use strict";\n\n  // Generated from games/games-manifest.json. Do not maintain game records here.\n  const manifestUrl = new URL("../../games/games-manifest.json", document.currentScript.src).href;\n  const fallbackManifest = Object.freeze(${payload});\n\n  function normalize(manifest, source, error) {\n    const games = Object.freeze(manifest.games.map((game) => Object.freeze({\n      ...game,\n      path: game.route,\n      image: game.thumbnail,\n      controls: game.supportedControls,\n      actions: Array.isArray(game.actions) ? game.actions.map((action) => ({ ...action, path: action.route })) : undefined\n    })));\n    global.LottoMindArcadeGames = games;\n    global.LottoMindArcadeManifest = Object.freeze({\n      schemaVersion: manifest.schemaVersion,\n      version: manifest.version,\n      lastChecked: manifest.lastChecked,\n      source,\n      error: error ? String(error.message || error) : ""\n    });\n    return Object.freeze({ games, manifest: global.LottoMindArcadeManifest, error: error || null });\n  }\n\n  const fallbackGames = ${fallback};\n  normalize({ ...fallbackManifest, games: fallbackGames }, "fallback", null);\n\n  async function load(options = {}) {\n    try {\n      const response = await fetch(manifestUrl, { cache: options.cache || "no-cache", credentials: "same-origin" });\n      if (!response.ok) throw new Error(\`Manifest request failed with \${response.status}\`);\n      const manifest = await response.json();\n      if (!Array.isArray(manifest.games) || !manifest.games.length) throw new Error("Manifest contains no games");\n      return normalize(manifest, "network", null);\n    } catch (error) {\n      return normalize({ ...fallbackManifest, games: fallbackGames }, "fallback", error);\n    } finally {\n      document.dispatchEvent(new CustomEvent("lottomind:games-ready"));\n    }\n  }\n\n  global.LottoMindLoadArcadeGames = load;\n  global.LottoMindArcadeGamesReady = load();\n})(window, document);\n`;

if (process.argv.includes("--check")) {
  if (!fs.existsSync(loaderPath) || fs.readFileSync(loaderPath, "utf8") !== output) {
    throw new Error("assets/js/arcade-games.js is stale; run npm run games:sync");
  }
  console.log(`Validated ${manifest.games.length} manifest routes, thumbnails, fields, and generated fallback records.`);
} else {
  fs.writeFileSync(loaderPath, output);
  console.log(`Generated arcade-games.js from ${manifest.games.length} manifest records.`);
}
