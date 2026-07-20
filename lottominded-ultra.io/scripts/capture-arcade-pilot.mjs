import { chromium } from "playwright";
import { mkdir, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const packageRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const outputRoot = resolve(packageRoot, "..", "docs", "staging-reviews", "arcade-pilot-assets");
const baseUrl = process.env.ARCADE_PILOT_URL || "http://127.0.0.1:8143";
const viewports = [
  { name: "desktop", width: 1440, height: 900, isMobile: false },
  { name: "mobile", width: 390, height: 844, isMobile: true },
];

await mkdir(outputRoot, { recursive: true });
const browser = await chromium.launch();
const results = [];

try {
  for (const viewport of viewports) {
    const context = await browser.newContext({
      viewport: { width: viewport.width, height: viewport.height },
      isMobile: viewport.isMobile,
      hasTouch: viewport.isMobile,
      reducedMotion: "reduce",
    });
    const page = await context.newPage();
    const consoleErrors = [];
    const failedResponses = [];
    const responseSizes = new Map();

    await context.route("**/*", (route) => {
      const request = route.request();
      const url = request.url();
      if (!["GET", "HEAD"].includes(request.method())) return route.abort("blockedbyclient");
      if (/(?:stripe\.com|supabase\.co|google-analytics\.com|googletagmanager\.com)/i.test(url)) {
        return route.abort("blockedbyclient");
      }
      return route.continue();
    });
    page.on("console", (message) => {
      if (message.type() === "error") consoleErrors.push(message.text());
    });
    page.on("response", (response) => {
      const url = new URL(response.url());
      if (url.origin !== new URL(baseUrl).origin) return;
      if (response.status() >= 400) failedResponses.push(`${response.status()} ${url.pathname}`);
      const length = Number(response.headers()["content-length"] || 0);
      if (length > 0) responseSizes.set(url.href, length);
    });

    await page.goto(`${baseUrl}/features-app.html`, { waitUntil: "networkidle" });
    const pageHeight = await page.evaluate(() => document.documentElement.scrollHeight);
    for (let y = 0; y < pageHeight; y += Math.max(500, viewport.height - 120)) {
      await page.evaluate((nextY) => window.scrollTo(0, nextY), y);
      await page.waitForTimeout(120);
    }
    await page.evaluate(() => window.scrollTo(0, 0));
    await page.waitForTimeout(250);

    const imageState = await page.locator(".arcade-game-card__media img").evaluateAll((images) => ({
      total: images.length,
      loaded: images.filter((image) => image.complete && image.naturalWidth > 0).length,
    }));
    const horizontalOverflow = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1);
    await page.screenshot({ path: resolve(outputRoot, `pilot-${viewport.name}.png`), fullPage: true });

    results.push({
      viewport: `${viewport.width}x${viewport.height}`,
      pageHeight,
      horizontalOverflow,
      images: imageState,
      responseCount: responseSizes.size,
      transferredBytesFromContentLength: [...responseSizes.values()].reduce((total, size) => total + size, 0),
      consoleErrors,
      failedResponses: [...new Set(failedResponses)],
    });
    await context.close();
  }
} finally {
  await browser.close();
}

await writeFile(resolve(outputRoot, "pilot-capture-metrics.json"), `${JSON.stringify({ baseUrl, capturedAt: new Date().toISOString(), results }, null, 2)}\n`);
console.log(`Captured Arcade pilot desktop and mobile evidence in ${outputRoot}.`);
