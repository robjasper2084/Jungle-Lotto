import { chromium } from "@playwright/test";
import { mkdir, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const packageRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const repositoryRoot = resolve(packageRoot, "..");
const outputDirectory = resolve(repositoryRoot, "docs", "staging-reviews", "storefront-bundles-assets");
const baseUrl = process.env.LOTTOMIND_CAPTURE_BASE_URL || "http://127.0.0.1:8143";
const viewports = [
  { width: 1440, height: 900 },
  { width: 390, height: 844 },
];

await mkdir(outputDirectory, { recursive: true });

const browser = await chromium.launch({ headless: true });
const report = [];

try {
  for (const viewport of viewports) {
    const page = await browser.newPage({ viewport });
    const errors = [];
    page.on("console", (message) => {
      if (message.type() === "error") errors.push(message.text());
    });
    page.on("pageerror", (error) => errors.push(error.message));

    await page.goto(`${baseUrl}/merch-store.html?bundle=capture#drop`, { waitUntil: "domcontentloaded" });
    const commercialClose = page.locator("[data-merch-commercial-close]");
    try {
      await commercialClose.waitFor({ state: "visible", timeout: 5_000 });
      await commercialClose.click();
    } catch {}

    const bundleSection = page.locator(".bundle-showcase");
    await bundleSection.scrollIntoViewIfNeeded();
    await page.waitForTimeout(500);

    const result = await page.evaluate(() => ({
      bundleCount: document.querySelectorAll(".bundle-card").length,
      imagesLoaded: Array.from(document.querySelectorAll(".bundle-card img")).every((image) => image.naturalWidth > 0),
      horizontalOverflow: document.documentElement.scrollWidth > document.documentElement.clientWidth,
      stagingNoindex: document.querySelector('meta[name="robots"]')?.content || "",
      stagingBanner: document.body.textContent.includes("LottoMind Upgrade Preview"),
    }));

    if (result.bundleCount !== 2 || !result.imagesLoaded || result.horizontalOverflow || errors.length) {
      throw new Error(`Storefront bundle capture failed at ${viewport.width}x${viewport.height}: ${JSON.stringify({ ...result, errors })}`);
    }

    const fileName = `storefront-bundles-${viewport.width}x${viewport.height}.png`;
    await page.screenshot({ path: resolve(outputDirectory, fileName) });
    report.push({ viewport, fileName, ...result, errors });
    await page.close();
  }
} finally {
  await browser.close();
}

await writeFile(
  resolve(outputDirectory, "capture-report.json"),
  `${JSON.stringify({ baseUrl, capturedAt: new Date().toISOString(), captures: report }, null, 2)}\n`,
  "utf8",
);

console.log(`Captured ${report.length} Storefront bundle views from ${baseUrl}.`);
