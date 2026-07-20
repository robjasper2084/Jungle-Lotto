import { chromium } from "@playwright/test";
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { dirname, extname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { getRouteInventory, productionUrlForRoute } from "./route-inventory.mjs";

const packageRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const repositoryRoot = resolve(packageRoot, "..");
const outputRoot = resolve(repositoryRoot, "docs", "visual-baseline", "v1");
const productionReference = {
  branch: "main",
  commit: "975c637cea7003533cdc30aed9d96be51929bfc8",
  tag: "v1-final",
};
const viewports = [
  { name: "desktop", width: 1440, height: 900 },
  { name: "tablet", width: 768, height: 1024 },
  { name: "mobile", width: 390, height: 844 },
];

function slugForRoute(route) {
  if (route === "/") return "home";
  return route.replace(/^\//, "").replace(/\/$/, "-index").replace(/\.html/i, "").replace(/[^a-z0-9]+/gi, "-").replace(/^-|-$/g, "").toLowerCase();
}

async function createContactSheet(browser, viewport, entries) {
  const cards = [];
  for (const entry of entries) {
    const file = resolve(outputRoot, entry.screenshotFilename);
    const data = await readFile(file);
    cards.push(`<article><img src="data:image/${extname(file).slice(1)};base64,${data.toString("base64")}" alt=""><strong>${entry.route}</strong><span>${entry.loadedSuccessfully ? "Loaded" : "Review"}</span></article>`);
  }
  const page = await browser.newPage({ viewport: { width: 1600, height: 900 } });
  await page.setContent(`<!doctype html><meta charset="utf-8"><style>
    *{box-sizing:border-box}body{margin:0;padding:24px;background:#080a12;color:#f5f3ed;font:14px Arial,sans-serif}h1{margin:0 0 20px;color:#f5bf42}main{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:16px}article{min-width:0;border:1px solid #31576b;background:#10141d;padding:8px}img{display:block;width:100%;aspect-ratio:${viewport.width}/${viewport.height};object-fit:cover;object-position:top;background:#000}strong,span{display:block;padding-top:7px;overflow-wrap:anywhere}span{color:#78e8ff;font-size:12px}</style><h1>LottoMind v1 ${viewport.name} visual baseline</h1><main>${cards.join("")}</main>`);
  await page.screenshot({ path: resolve(outputRoot, `${viewport.name}-contact-sheet.png`), fullPage: true });
  await page.close();
}

async function main() {
  const { publicRoutes } = await getRouteInventory();
  await rm(outputRoot, { recursive: true, force: true });
  await mkdir(outputRoot, { recursive: true });
  const browser = await chromium.launch({ args: ["--autoplay-policy=user-gesture-required"] });
  const entries = [];
  try {
    for (const viewport of viewports) {
      const context = await browser.newContext({
        viewport: { width: viewport.width, height: viewport.height },
        reducedMotion: "reduce",
        colorScheme: "dark",
      });
      await context.addInitScript(() => {
        const originalPlay = HTMLMediaElement.prototype.play;
        HTMLMediaElement.prototype.play = function mutedBaselinePlay() {
          this.muted = true;
          return originalPlay.call(this);
        };
      });
      await context.route("**/*", (route) => {
        const request = route.request();
        const url = request.url();
        if (!['GET', 'HEAD'].includes(request.method())) return route.abort("blockedbyclient");
        if (/(?:stripe\.com|supabase\.co|google-analytics\.com|googletagmanager\.com)/i.test(url)) return route.abort("blockedbyclient");
        if (/\.(?:mp3|wav|ogg)(?:\?.*)?$/i.test(url)) return route.fulfill({ status: 204, body: "" });
        return route.continue();
      });

      for (const item of publicRoutes) {
        const page = await context.newPage();
        const consoleFailures = [];
        const responseFailures = [];
        page.on("console", (message) => { if (message.type() === "error") consoleFailures.push(message.text()); });
        page.on("pageerror", (error) => consoleFailures.push(`Uncaught: ${error.message}`));
        page.on("response", (response) => {
          const url = new URL(response.url());
          if (url.origin === new URL(productionUrlForRoute(item.route)).origin && response.status() >= 400) responseFailures.push(`${response.status()} ${url.pathname}`);
        });
        const url = productionUrlForRoute(item.route);
        let response = null;
        let navigationError = "";
        try {
          response = await page.goto(url, { waitUntil: "domcontentloaded", timeout: 30_000 });
          await Promise.race([page.evaluate(() => document.fonts?.ready), page.waitForTimeout(2500)]).catch(() => {});
          await page.waitForTimeout(800);
        } catch (error) {
          navigationError = error.message;
          consoleFailures.push(`Navigation: ${error.message}`);
        }
        const screenshotFilename = `${slugForRoute(item.route)}--${viewport.name}.png`;
        await page.screenshot({ path: resolve(outputRoot, screenshotFilename), fullPage: false });
        const title = await page.title().catch(() => "");
        const heading = await page.locator("h1, h2, h3, [role=heading]").first().textContent().catch(() => "");
        const overflow = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1).catch(() => false);
        entries.push({
          route: item.route,
          fullProductionUrl: url,
          viewport,
          screenshotFilename,
          captureTimestamp: new Date().toISOString(),
          productionReference,
          loadedSuccessfully: Boolean(response && response.status() < 400 && !navigationError),
          responseStatus: response?.status() ?? null,
          consoleFailures: [...consoleFailures, ...responseFailures],
          visualNotes: `Title: ${title || "missing"}; first heading: ${(heading || "missing").trim().slice(0, 140)}; horizontal overflow: ${overflow ? "yes" : "no"}.${item.route === "/games/lottomind-jackpot-maze/" ? " Captured viewport appears blank white despite HTTP 200; review the runtime bundle." : ""}`,
        });
        console.log(`${viewport.name} ${item.route} -> ${response?.status() ?? "navigation error"}`);
        await page.close();
      }
      await context.close();
      await createContactSheet(browser, viewport, entries.filter((entry) => entry.viewport.name === viewport.name));
    }
  } finally {
    await browser.close();
  }

  const manifest = {
    generatedAt: new Date().toISOString(),
    format: "PNG (Playwright capture; no repository WebP conversion tool was available)",
    productionReference,
    routeCount: publicRoutes.length,
    screenshotCount: entries.length,
    entries,
  };
  await writeFile(resolve(outputRoot, "baseline-manifest.json"), `${JSON.stringify(manifest, null, 2)}\n`);
  console.log(`Captured ${entries.length} production baselines across ${publicRoutes.length} routes.`);
}

main().catch((error) => {
  console.error(`Visual baseline capture failed: ${error.message}`);
  process.exitCode = 1;
});
