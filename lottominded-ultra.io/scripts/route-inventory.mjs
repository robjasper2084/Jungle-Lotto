import { readFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { runInNewContext } from "node:vm";

const packageRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const siteManifest = JSON.parse(await readFile(resolve(packageRoot, "data", "site-routes.json"), "utf8"));
export const productionBaseUrl = siteManifest.productionBaseUrl;

function normalizeRoute(value) {
  const route = String(value || "").trim().replace(/^\.\//, "/");
  if (!route || route === "/") return "/";
  return route.startsWith("/") ? route : `/${route}`;
}

function uniqueRoutes(routes) {
  const seen = new Set();
  return routes.filter((entry) => {
    if (seen.has(entry.route)) return false;
    seen.add(entry.route);
    return true;
  });
}

export async function getRouteInventory() {
  const sitemapRoutes = siteManifest.routes
    .filter((route) => route.indexable && route.includeInSitemap)
    .map((route) => ({ route: normalizeRoute(route.href.split(/[?#]/)[0]), source: "manifest", id: route.id }));

  const arcadeSource = await readFile(resolve(packageRoot, "assets", "js", "arcade-games.js"), "utf8");
  const sandbox = {};
  sandbox.window = sandbox;
  runInNewContext(arcadeSource, sandbox, { filename: "assets/js/arcade-games.js" });
  const arcadeRoutes = (sandbox.LottoMindArcadeGames || []).map((game) => ({
    route: normalizeRoute(game.path),
    source: "arcade",
    id: game.id,
    title: game.title,
  }));

  const requiredRoutes = [
    ...siteManifest.routes
      .filter((route) => !route.includeInSitemap)
      .map((route) => ({ route: normalizeRoute(route.href.split(/[?#]/)[0]), source: "manifest-required", id: route.id })),
    { route: "/lottomind-stem-studio/", source: "required" },
    { route: "/404.html", source: "required" },
  ];

  return {
    sitemapRoutes,
    arcadeRoutes,
    requiredRoutes,
    publicRoutes: uniqueRoutes([...sitemapRoutes, ...requiredRoutes, ...arcadeRoutes]),
  };
}

export function productionUrlForRoute(route) {
  const normalized = normalizeRoute(route);
  return new URL(normalized.replace(/^\//, ""), productionBaseUrl).href;
}
