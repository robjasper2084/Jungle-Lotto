import { chromium } from "@playwright/test";
import { mkdir, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const packageRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const repositoryRoot = resolve(packageRoot, "..");
const outputDirectory = resolve(repositoryRoot, "docs", "staging-reviews", "arcade-hero-film-assets");
const baseUrl = String(process.env.LOTTOMIND_CAPTURE_BASE_URL || "http://127.0.0.1:8143").replace(/\/$/, "");
const expectsStaging = new URL(baseUrl).port === "8143";
const viewports = [
  { width: 1440, height: 900 },
  { width: 390, height: 844 },
];

await mkdir(outputDirectory, { recursive: true });
const browser = await chromium.launch({ headless: true });
const captures = [];

try {
  for (const viewport of viewports) {
    const page = await browser.newPage({ viewport, reducedMotion: "no-preference" });
    const errors = [];
    page.on("console", (message) => {
      if (message.type() === "error") errors.push(message.text());
    });
    page.on("pageerror", (error) => errors.push(error.message));

    await page.goto(`${baseUrl}/features-app.html?hero-film=capture`, { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(1_200);
    const gateSkip = page.locator(".lm-commercial-gate__skip");
    if (await gateSkip.isVisible().catch(() => false)) {
      await gateSkip.click();
      await page.locator(".lm-commercial-gate").waitFor({ state: "hidden", timeout: 5_000 });
    }
    await page.waitForTimeout(1_600);

    const media = page.locator(".arcade-pilot-hero__media");
    const video = page.locator("[data-arcade-hero-video]");
    await media.waitFor({ state: "visible" });
    await video.evaluate(async (element) => {
      if (element.readyState < 1) {
        await new Promise((resolvePromise) => element.addEventListener("loadedmetadata", resolvePromise, { once: true }));
      }
      element.currentTime = Math.min(7, Math.max(0, element.duration - 0.25));
      await new Promise((resolvePromise) => element.addEventListener("seeked", resolvePromise, { once: true }));
      element.pause();
    });

    const result = await page.evaluate(() => {
      const mediaElement = document.querySelector(".arcade-pilot-hero__media");
      const copyElement = document.querySelector(".arcade-pilot-hero__copy");
      const videoElement = document.querySelector("[data-arcade-hero-video]");
      const mediaRect = mediaElement?.getBoundingClientRect();
      const copyRect = copyElement?.getBoundingClientRect();
      const overlapsCopy = Boolean(
        mediaRect && copyRect
        && mediaRect.left < copyRect.right
        && mediaRect.right > copyRect.left
        && mediaRect.top < copyRect.bottom
        && mediaRect.bottom > copyRect.top
      );
      return {
        videoReady: Boolean(videoElement && videoElement.readyState >= 2),
        aspectRatio: mediaRect ? mediaRect.width / mediaRect.height : 0,
        overlapsCopy,
        horizontalOverflow: document.documentElement.scrollWidth > document.documentElement.clientWidth,
        noindex: document.querySelector('meta[name="robots"]')?.content || "",
        stagingBanner: Boolean(document.querySelector("[data-lm-staging-banner]")),
      };
    });

    if (
      !result.videoReady
      || result.aspectRatio < 1.7
      || result.aspectRatio > 1.85
      || result.overlapsCopy
      || result.horizontalOverflow
      || errors.length
      || (expectsStaging && (result.noindex !== "noindex,nofollow,noarchive" || !result.stagingBanner))
    ) {
      throw new Error(`Arcade hero capture failed at ${viewport.width}x${viewport.height}: ${JSON.stringify({ ...result, errors })}`);
    }

    if (viewport.width <= 390) {
      await media.scrollIntoViewIfNeeded();
      await page.waitForTimeout(250);
    }

    const fileName = `arcade-hero-film-${viewport.width}x${viewport.height}.png`;
    await page.screenshot({ path: resolve(outputDirectory, fileName), fullPage: false });
    captures.push({ viewport, fileName, ...result, errors });
    await page.close();
  }
} finally {
  await browser.close();
}

await writeFile(
  resolve(outputDirectory, "capture-report.json"),
  `${JSON.stringify({ baseUrl, capturedAt: new Date().toISOString(), captures }, null, 2)}\n`,
  "utf8",
);

console.log(`Captured ${captures.length} Arcade hero film views from ${baseUrl}.`);
