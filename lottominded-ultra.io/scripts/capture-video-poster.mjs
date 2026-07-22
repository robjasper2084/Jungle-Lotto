import { createRequire } from "node:module";
import { resolve } from "node:path";

const require = createRequire(import.meta.url);
const { chromium } = require("playwright");

const [sourceUrl, outputPath, seekValue = "2.5"] = process.argv.slice(2);
if (!sourceUrl || !outputPath) {
  throw new Error("Usage: node scripts/capture-video-poster.mjs <video-url> <output-path> [seek-seconds]");
}

const seekSeconds = Math.max(0, Number(seekValue) || 0);
const browser = await chromium.launch({ headless: true });

try {
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
  const escapedSource = sourceUrl.replaceAll("&", "&amp;").replaceAll('"', "&quot;");
  await page.setContent(
    `<style>html,body{margin:0;background:#000}video{display:block;width:1280px;height:720px;object-fit:cover}</style><video muted playsinline preload="auto" src="${escapedSource}"></video>`,
  );
  const video = page.locator("video");
  await video.waitFor({ state: "visible" });
  await video.evaluate(async (node, requestedSeek) => {
    node.muted = true;
    if (node.readyState < 1) {
      await new Promise((resolvePromise, rejectPromise) => {
        node.addEventListener("loadedmetadata", resolvePromise, { once: true });
        node.addEventListener("error", rejectPromise, { once: true });
        node.load();
      });
    }
    const target = Number.isFinite(node.duration)
      ? Math.min(requestedSeek, Math.max(0, node.duration - 0.1))
      : requestedSeek;
    if (Math.abs(node.currentTime - target) > 0.05) {
      node.currentTime = target;
      await new Promise((resolvePromise) => {
        node.addEventListener("seeked", resolvePromise, { once: true });
      });
    }
    node.pause();
  }, seekSeconds);
  await video.screenshot({ path: resolve(outputPath) });
} finally {
  await browser.close();
}

console.log(`Captured poster: ${resolve(outputPath)}`);
