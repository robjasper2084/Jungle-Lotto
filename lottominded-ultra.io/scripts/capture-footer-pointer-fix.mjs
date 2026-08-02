import { mkdir, writeFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const require = createRequire(import.meta.url);
const { chromium } = require("playwright");

const packageRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const outputRoot = resolve(packageRoot, "..", "docs", "staging-reviews", "footer-pointer-fix", "screenshots");
const baseUrl = "http://127.0.0.1:8143";
const viewports = [
  { name: "1440x900", width: 1440, height: 900 },
  { name: "390x844", width: 390, height: 844, isMobile: true, hasTouch: true },
];

await mkdir(outputRoot, { recursive: true });
const browser = await chromium.launch({ headless: true });
const results = [];

try {
  for (const viewport of viewports) {
    const context = await browser.newContext({
      viewport: { width: viewport.width, height: viewport.height },
      isMobile: viewport.isMobile || false,
      hasTouch: viewport.hasTouch || false,
      reducedMotion: "reduce",
    });

    await context.route(/\.(?:mp3|mp4|wav|webm)(?:\?.*)?$/i, (route) => route.fulfill({ status: 204, body: "" }));

    for (const capture of [
      { name: "home-popup", path: "/index.html#top", focus: "popup" },
      { name: "home-footer", path: "/index.html#top", focus: "footer" },
      { name: "accessibility-footer", path: "/accessibility.html", focus: "footer" },
    ]) {
      const page = await context.newPage();
      const consoleErrors = [];
      const pageErrors = [];
      const assetFailures = [];
      page.on("console", (message) => {
        if (message.type() === "error") consoleErrors.push(message.text());
      });
      page.on("pageerror", (error) => pageErrors.push(error.message));
      page.on("response", (response) => {
        const url = new URL(response.url());
        if (url.origin === baseUrl && response.status() >= 400 && !url.pathname.endsWith("favicon.ico")) {
          assetFailures.push(`${response.status()} ${url.pathname}`);
        }
      });

      const response = await page.goto(`${baseUrl}${capture.path}`, { waitUntil: "domcontentloaded" });
      const startup = page.locator("[data-startup-video]");
      if (capture.focus === "popup") {
        await startup.waitFor({ state: "visible", timeout: 5_000 });
      } else {
        const close = page.locator("[data-startup-video-close]").last();
        if (await close.isVisible().catch(() => false)) await close.click();
        await page.evaluate(() => {
          document.documentElement.style.scrollBehavior = "auto";
          document.body.style.scrollBehavior = "auto";
          document.querySelector("body > footer")?.scrollIntoView({ block: "end", behavior: "instant" });
          const scroller = document.scrollingElement;
          if (scroller) scroller.scrollTop = scroller.scrollHeight;
        });
        await page.waitForTimeout(300);
        await page.locator("body > footer").evaluate((element) => element.scrollIntoView({ block: "end", behavior: "instant" }));
        await page.waitForTimeout(750);
      }

      const footerLinks = await page.locator("body > footer :is(.lm-footer-support-links, .site-legal-links) a").evaluateAll((items) =>
        items.map((item) => ({ label: item.textContent.trim(), href: `${new URL(item.href).pathname}${new URL(item.href).hash}` }))
      );
      const pointer = capture.focus === "popup" ? {
        panel: await startup.evaluate((element) => getComputedStyle(element).cursor),
        action: await startup.getByRole("button", { name: "Enter Site", exact: true }).evaluate((element) => getComputedStyle(element).cursor),
      } : null;
      const output = resolve(outputRoot, `${capture.name}-${viewport.name}.png`);
      await page.screenshot({ path: output, fullPage: false });
      results.push({
        route: capture.path,
        capture: capture.name,
        viewport: viewport.name,
        status: response?.status() || 0,
        output,
        noindex: await page.locator('meta[name="robots"]').getAttribute("content"),
        stagingBannerVisible: await page.locator("[data-lm-staging-banner]").isVisible(),
        footerLinks,
        pointer,
        consoleErrors,
        pageErrors,
        assetFailures,
      });
      await page.close();
    }
    await context.close();
  }
} finally {
  await browser.close();
}

await writeFile(resolve(outputRoot, "capture-report.json"), `${JSON.stringify({ capturedAt: new Date().toISOString(), results }, null, 2)}\n`, "utf8");

const failures = results.filter((result) => (
  result.status !== 200 ||
  result.noindex !== "noindex,nofollow,noarchive" ||
  !result.stagingBannerVisible ||
  result.footerLinks.length !== 7 ||
  new Set(result.footerLinks.map((link) => link.href)).size !== result.footerLinks.length ||
  (result.pointer && (result.pointer.panel === "none" || result.pointer.action === "none")) ||
  result.consoleErrors.length ||
  result.pageErrors.length ||
  result.assetFailures.length
));

if (failures.length) throw new Error(`Footer and pointer capture verification failed for ${failures.length} views.`);
console.log(`Captured and verified ${results.length} footer and popup views in ${outputRoot}.`);
