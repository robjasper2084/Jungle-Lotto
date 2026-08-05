import { chromium } from "@playwright/test";
import { mkdir, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const packageRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const repositoryRoot = resolve(packageRoot, "..");
const outputDirectory = resolve(repositoryRoot, "docs", "staging-reviews", "store-membership-definition-assets");
const baseUrl = process.env.LOTTOMIND_CAPTURE_BASE_URL || "http://127.0.0.1:8143";
const routes = [
  {
    name: "storefront",
    path: "/merch-store.html#launch-catalog",
    dismiss: "[data-merch-commercial-close]",
    focus: "#launch-catalog",
  },
  {
    name: "memberships",
    path: "/memberships.html#membership-plans",
    dismiss: "[data-membership-commercial-close]",
    focus: "#membership-plans",
  },
];
const viewports = [
  { width: 1440, height: 900 },
  { width: 390, height: 844, isMobile: true, hasTouch: true },
];

await mkdir(outputDirectory, { recursive: true });
const browser = await chromium.launch({ headless: true });
const report = [];

try {
  for (const viewport of viewports) {
    const context = await browser.newContext({
      viewport: { width: viewport.width, height: viewport.height },
      isMobile: viewport.isMobile || false,
      hasTouch: viewport.hasTouch || false,
      reducedMotion: "reduce",
    });
    for (const route of routes) {
      const page = await context.newPage();
      const errors = [];
      const assetFailures = [];
      page.on("console", (message) => {
        if (message.type() === "error") errors.push(message.text());
      });
      page.on("pageerror", (error) => errors.push(error.message));
      page.on("response", (response) => {
        const url = new URL(response.url());
        if (url.origin === baseUrl && response.status() >= 400 && !url.pathname.endsWith("favicon.ico")) {
          assetFailures.push(`${response.status()} ${url.pathname}`);
        }
      });

      const response = await page.goto(`${baseUrl}${route.path}`, { waitUntil: "domcontentloaded" });
      const dismiss = page.locator(route.dismiss);
      if (await dismiss.count() && await dismiss.first().isVisible()) await dismiss.first().click();
      await page.locator(route.focus).scrollIntoViewIfNeeded();
      await page.waitForTimeout(500);

      const result = await page.evaluate(() => ({
        launchProductCount: document.querySelectorAll("#launch-catalog [data-launch-product]").length,
        comparisonTableCount: document.querySelectorAll(".membership-comparison table").length,
        horizontalOverflow: document.documentElement.scrollWidth > document.documentElement.clientWidth,
        stagingNoindex: document.querySelector('meta[name="robots"]')?.content || "",
        stagingBanner: Boolean(document.querySelector("[data-lm-staging-banner]")),
      }));
      if (
        response?.status() !== 200 ||
        result.horizontalOverflow ||
        result.stagingNoindex !== "noindex,nofollow,noarchive" ||
        !result.stagingBanner ||
        errors.length ||
        assetFailures.length
      ) {
        throw new Error(`Capture failed for ${route.name} at ${viewport.width}x${viewport.height}: ${JSON.stringify({ ...result, errors, assetFailures })}`);
      }
      if (route.name === "storefront" && result.launchProductCount !== 3) throw new Error("Storefront must show exactly three launch products.");
      if (route.name === "memberships" && result.comparisonTableCount !== 1) throw new Error("Membership comparison table is missing.");

      const fileName = `${route.name}-${viewport.width}x${viewport.height}.png`;
      await page.screenshot({ path: resolve(outputDirectory, fileName), fullPage: false });
      report.push({ route: route.path, viewport, fileName, ...result, errors, assetFailures });
      await page.close();
    }
    await context.close();
  }
} finally {
  await browser.close();
}

await writeFile(
  resolve(outputDirectory, "capture-report.json"),
  `${JSON.stringify({ baseUrl, capturedAt: new Date().toISOString(), captures: report }, null, 2)}\n`,
  "utf8",
);

console.log(`Captured and verified ${report.length} Storefront and Membership views from ${baseUrl}.`);
