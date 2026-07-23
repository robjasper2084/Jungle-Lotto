import { readFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { runInNewContext } from "node:vm";

const packageRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
export const productionBaseUrl = "https://robjasper2084.github.io/Jungle-Lotto/lottominded-ultra.io/";

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
  const sitemap = await readFile(resolve(packageRoot, "sitemap.xml"), "utf8");
  const sitemapRoutes = [...sitemap.matchAll(/<loc>([^<]+)<\/loc>/gi)].map((match) => {
    const url = new URL(match[1]);
    const base = new URL(productionBaseUrl);
    const relativePath = url.pathname.slice(base.pathname.length);
    return { route: normalizeRoute(relativePath), source: "sitemap" };
  });

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
    { route: "/prompt-lab.html", source: "required" },
    { route: "/lottomind-stem-studio/", source: "required" },
    { route: "/redeem.html", source: "required" },
    { route: "/contact.html", source: "required" },
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
