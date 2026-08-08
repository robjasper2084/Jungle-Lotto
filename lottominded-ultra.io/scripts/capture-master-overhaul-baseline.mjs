import { chromium } from "@playwright/test";
import { spawn } from "node:child_process";
import { mkdir, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const packageRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const repositoryRoot = resolve(packageRoot, "..");
const outputRoot = resolve(repositoryRoot, "docs", "lottomind-master-overhaul", "baseline-screenshots");
const port = 8588;
const baseUrl = `http://127.0.0.1:${port}`;
const routes = [
  { name: "home", path: "/index.html#top" },
  { name: "memberships", path: "/memberships.html" },
  { name: "account", path: "/account.html" },
  { name: "arcade", path: "/features-app.html" },
  { name: "news", path: "/news/" },
  { name: "events", path: "/live-events.html" },
  { name: "shop", path: "/merch-store.html" },
  { name: "services", path: "/services/" },
];
const viewports = [
  { name: "desktop", width: 1440, height: 900 },
  { name: "tablet", width: 768, height: 1024 },
  { name: "mobile", width: 390, height: 844 },
];

async function waitForServer() {
  for (let attempt = 0; attempt < 40; attempt += 1) {
    try {
      const response = await fetch(`${baseUrl}/index.html`, { signal: AbortSignal.timeout(500) });
      if (response.ok) return;
    } catch {
      // The local server may still be starting.
    }
    await new Promise((resolveDelay) => setTimeout(resolveDelay, 250));
  }
  throw new Error(`Baseline server did not start at ${baseUrl}`);
}

async function main() {
  await mkdir(outputRoot, { recursive: true });
  const server = spawn(process.execPath, ["scripts/serve-site.mjs", "dist-staging", String(port)], {
    cwd: packageRoot,
    stdio: ["ignore", "pipe", "pipe"],
  });
  const browser = await chromium.launch({ args: ["--autoplay-policy=user-gesture-required"] });
  const captures = [];

  try {
    await waitForServer();
    for (const viewport of viewports) {
      const context = await browser.newContext({
        viewport: { width: viewport.width, height: viewport.height },
        reducedMotion: "reduce",
        colorScheme: "dark",
      });
      await context.addInitScript(() => {
        Object.defineProperty(window, "__LOTTOMIND_BASELINE_CAPTURE__", { value: true });
        const originalPlay = HTMLMediaElement.prototype.play;
        HTMLMediaElement.prototype.play = function baselinePlay() {
          this.muted = true;
          return originalPlay.call(this);
        };
      });
      await context.route("**/*", async (route) => {
        const request = route.request();
        const url = request.url();
        if (!["GET", "HEAD"].includes(request.method())) return route.abort("blockedbyclient");
        if (!url.startsWith(baseUrl)) return route.abort("blockedbyclient");
        if (/\.(?:mp3|wav|ogg)(?:\?.*)?$/i.test(url)) return route.fulfill({ status: 204, body: "" });
        return route.continue();
      });

      for (const route of routes) {
        const page = await context.newPage();
        const errors = [];
        page.on("console", (message) => {
          if (message.type() === "error") errors.push(message.text());
        });
        page.on("pageerror", (error) => errors.push(error.message));
        const response = await page.goto(`${baseUrl}${route.path}`, { waitUntil: "domcontentloaded", timeout: 30_000 });
        await page.waitForTimeout(1200);
        const filename = `${route.name}--${viewport.name}.png`;
        await page.screenshot({ path: resolve(outputRoot, filename), fullPage: false });
        captures.push({
          route: route.path,
          viewport,
          filename,
          status: response?.status() ?? null,
          title: await page.title(),
          horizontalOverflow: await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1),
          consoleErrors: errors,
        });
        await page.close();
      }
      await context.close();
    }
  } finally {
    await browser.close();
    server.kill();
  }

  await writeFile(resolve(outputRoot, "baseline-manifest.json"), `${JSON.stringify({
    generatedAt: new Date().toISOString(),
    sourceCommit: "6b3d6ae289f93d7a1389944ddbbf61319e9230d0",
    artifact: "dist-staging",
    externalRequests: "blocked",
    audio: "muted and blocked",
    captures,
  }, null, 2)}\n`);
  console.log(`Captured ${captures.length} guarded staging baselines in ${outputRoot}`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
