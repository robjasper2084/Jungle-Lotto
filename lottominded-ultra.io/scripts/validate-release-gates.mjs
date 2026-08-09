import fs from "node:fs";
import path from "node:path";

const siteRoot = process.cwd();
const repositoryRoot = path.resolve(siteRoot, "..");
const productionBaseUrl = "https://robjasper2084.github.io/Jungle-Lotto/lottominded-ultra.io/";
const failures = [];
const checks = [];

function fail(message) {
  failures.push(message);
}

function pass(message) {
  checks.push(message);
}

function read(relativePath, root = siteRoot) {
  const absolutePath = path.resolve(root, relativePath);
  if (!fs.existsSync(absolutePath)) {
    fail(`${path.relative(repositoryRoot, absolutePath)} is missing`);
    return "";
  }
  return fs.readFileSync(absolutePath, "utf8");
}

function routeFile(route) {
  const pathname = new URL(route, productionBaseUrl).pathname;
  const basePath = new URL(productionBaseUrl).pathname;
  let relativePath = pathname.slice(basePath.length);
  if (!relativePath || relativePath.endsWith("/")) relativePath += "index.html";
  return relativePath;
}

const sitemap = read("sitemap.xml");
const routes = [...sitemap.matchAll(/<loc>([^<]+)<\/loc>/gi)].map((match) => match[1]);
if (!routes.length) fail("sitemap.xml contains no production routes");

let structuredDataBlocks = 0;
let transitionRoutes = 0;
for (const route of routes) {
  if (!route.startsWith(productionBaseUrl)) {
    fail(`sitemap route is outside the production base URL: ${route}`);
    continue;
  }

  const relativePath = routeFile(route);
  const html = read(relativePath);
  if (!html) continue;

  if (!/<title>\s*[^<]+\s*<\/title>/i.test(html)) fail(`${relativePath}: title is missing`);
  if (!/<meta\s+[^>]*name=["']description["'][^>]*content=["'][^"']+["'][^>]*>/i.test(html)) {
    fail(`${relativePath}: meta description is missing`);
  }
  if (/noindex\s*,?\s*nofollow\s*,?\s*noarchive/i.test(html)) {
    fail(`${relativePath}: staging noindex metadata leaked into production source`);
  }
  if (html.includes("LottoMind Upgrade Preview")) {
    fail(`${relativePath}: staging preview banner leaked into production source`);
  }

  if (html.includes("data-lm-page-transition")) {
    transitionRoutes += 1;
    if (!html.includes("lm-page-transition.js?v=transition-every-route-6")) {
      fail(`${relativePath}: shared page transition controller is stale`);
    }
  }

  for (const match of html.matchAll(/<script\s+[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)) {
    structuredDataBlocks += 1;
    try {
      JSON.parse(match[1]);
    } catch {
      fail(`${relativePath}: structured data is not valid JSON`);
    }
  }
}
pass(`${routes.length} sitemap routes have production-safe metadata`);
if (!transitionRoutes) fail("no transition-enabled production routes were found");
else pass(`${transitionRoutes} transition-enabled routes share the current controller`);

if (!structuredDataBlocks) fail("no structured-data blocks were found");
else pass(`${structuredDataBlocks} structured-data blocks parse as JSON`);

const manifest = JSON.parse(read("manifest.webmanifest") || "{}");
if (!manifest.name || !manifest.start_url || !manifest.scope || !Array.isArray(manifest.icons) || !manifest.icons.length) {
  fail("manifest.webmanifest is missing required install metadata");
} else {
  for (const icon of manifest.icons) {
    const iconPath = String(icon.src || "").replace(/^\.\//, "");
    if (!iconPath || !fs.existsSync(path.resolve(siteRoot, iconPath))) {
      fail(`manifest icon is missing: ${icon.src || "(empty)"}`);
    }
  }
  pass("PWA manifest and icons are present");
}

const siteRuntime = read("site.js");
const serviceWorker = read("service-worker.js");
if (!siteRuntime.includes("navigator.serviceWorker.register")) fail("site.js does not register the service worker");
if (!serviceWorker.includes("MAX_ASSET_BYTES") || !serviceWorker.includes("NEVER_CACHE_EXTENSIONS")) {
  fail("service-worker.js does not enforce bounded media-safe caching");
} else {
  pass("PWA registration and bounded runtime caching are configured");
}

const checkout = read("assets/js/lm-stripe-memberships.js");
const stagingGuard = read("assets/js/lm-staging-guard.js");
if (!checkout.includes('expectedHost = kind === "portal" ? "billing.stripe.com" : "checkout.stripe.com"')) {
  fail("checkout redirect host validation is missing");
}
if (!checkout.includes('validatedRedirect(payload, "checkout")')) {
  fail("checkout does not use the validated redirect path");
}
const environmentRuntime = read("assets/js/lm-environment.js");
if (
  !environmentRuntime.includes("allowLivePayments: false")
  || !stagingGuard.includes("allowTestPayments")
  || !stagingGuard.includes("allowRedemptions")
) {
  fail("staging payment or redemption protection is missing");
}
const secretScan = [checkout, stagingGuard, environmentRuntime].join("\n");
if (/\b(?:sk_live_|sk_test_|service_role)\w+/i.test(secretScan)) {
  fail("a secret-like credential appears in frontend integration files");
} else {
  pass("checkout hooks validate Stripe hosts and expose no secret-like credentials");
}

const accountService = read("assets/js/lottomind-account-service.js");
if (!accountService.includes("offline: true") || !accountService.includes("verified balance cannot be changed")) {
  fail("account offline mode does not preserve read-only behavior");
} else {
  pass("account offline mode blocks mutations and preserves read-only state");
}

const accountPage = read("account.html");
const platformStyles = read("assets/css/lm-phase1-platform.css");
if (
  !accountPage.includes('class="lm-platform-hero__art lm-account-hero-film"')
  || !accountPage.includes('src="./assets/video/lottomind-account-vault-film-20260626.mp4"')
  || !accountPage.includes("controls playsinline preload=\"none\"")
  || !fs.existsSync(path.resolve(siteRoot, "assets/video/lottomind-account-vault-film-20260626.mp4"))
) {
  fail("Account hero does not use the user-controlled Collector Vault film");
} else if (
  !platformStyles.includes(".lm-account-page .lm-header-utilities")
  || !platformStyles.includes("border-radius: 4px")
) {
  fail("Account utilities do not retain the compact HUD treatment");
} else {
  pass("Account hero film and non-orb HUD utilities are configured");
}

const articles = JSON.parse(read("articles.json") || "[]");
const externalArticleImages = articles.filter((article) => /^https?:\/\//i.test(article.imageUrl || ""));
const imageHydrator = read("news-hub/scripts/hydrate-static-article-images.ts");
if (externalArticleImages.length) {
  fail(`${externalArticleImages.length} News cards still hotlink external images`);
} else if (!imageHydrator.includes("withoutUncachedExternalImage")) {
  fail("News image hydration does not preserve the local fallback for failed publisher media");
} else {
  pass("News cards use local images or local fallback art without broken external hotlinks");
}

const refinedApp = read("lotto mind refined/app.js", repositoryRoot);
for (const route of ["lotto mind refined/challenges/index.html", "lotto mind refined/viral-studio/index.html"]) {
  read(route, repositoryRoot);
}
if (!refinedApp.includes("challenge-board-panel") || !refinedApp.includes("Save + Share")) {
  fail("challenge or share-card surfaces are missing from LottoMind Refined");
} else {
  pass("challenge and share-card surfaces are present");
}

if (failures.length) {
  console.error(`Release gate audit failed with ${failures.length} issue(s):`);
  for (const failure of failures) console.error(`- ${failure}`);
  process.exitCode = 1;
} else {
  console.log(`Release gate audit passed ${checks.length} groups:`);
  for (const check of checks) console.log(`- ${check}`);
}
