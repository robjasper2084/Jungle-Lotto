import { mkdir, writeFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const require = createRequire(import.meta.url);
const { chromium } = require("playwright");
const packageRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const outputRoot = resolve(packageRoot, "..", "docs", "staging-reviews", "trivia-vault", "screenshots");
const baseUrl = process.env.TRIVIA_CAPTURE_BASE_URL || "http://127.0.0.1:8594";
const captures = [
  { name: "launcher-desktop-1440x900", width: 1440, height: 900, state: "launcher" },
  { name: "question-mobile-390x844", width: 390, height: 844, state: "question", isMobile: true },
];

await mkdir(outputRoot, { recursive: true });
const browser = await chromium.launch({ headless: true });
const results = [];

try {
  for (const capture of captures) {
    const context = await browser.newContext({
      viewport: { width: capture.width, height: capture.height },
      isMobile: Boolean(capture.isMobile),
      hasTouch: Boolean(capture.isMobile),
      reducedMotion: "reduce",
    });
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

    const response = await page.goto(`${baseUrl}/games/lottomind-trivia/`, { waitUntil: "domcontentloaded" });
    await page.getByRole("heading", { name: "LottoMind Trivia Vault" }).waitFor();
    if (capture.state === "question") {
      await page.getByRole("button", { name: /Quick Play/ }).click();
      await page.locator("[data-question-text]").waitFor();
    }
    await page.waitForTimeout(250);

    const output = resolve(outputRoot, `${capture.name}.png`);
    await page.screenshot({ path: output, fullPage: false });
    const layout = await page.evaluate(() => ({
      innerWidth: window.innerWidth,
      scrollWidth: document.documentElement.scrollWidth,
      touchTargets: [...document.querySelectorAll("button, a")]
        .filter((element) => {
          const style = getComputedStyle(element);
          const rect = element.getBoundingClientRect();
          return style.visibility !== "hidden" && style.display !== "none" && rect.width > 0 && rect.height > 0;
        })
        .map((element) => {
          const rect = element.getBoundingClientRect();
          return { label: element.getAttribute("aria-label") || element.textContent.trim(), width: rect.width, height: rect.height };
        }),
    }));
    results.push({
      name: capture.name,
      viewport: `${capture.width}x${capture.height}`,
      state: capture.state,
      output,
      status: response?.status() || 0,
      horizontalOverflow: layout.scrollWidth > layout.innerWidth,
      undersizedGameControls: layout.touchTargets.filter((target) => target.height < 44 && /Quick Play|Daily Vault|Survival|Category Run|Pause|Sound|Exit|answer/i.test(target.label)),
      consoleErrors,
      pageErrors,
      assetFailures,
    });
    await context.close();
  }
} finally {
  await browser.close();
}

await writeFile(resolve(outputRoot, "capture-report.json"), `${JSON.stringify({ capturedAt: new Date().toISOString(), results }, null, 2)}\n`, "utf8");

const failures = results.filter((result) => (
  result.status !== 200 ||
  result.horizontalOverflow ||
  result.undersizedGameControls.length ||
  result.consoleErrors.length ||
  result.pageErrors.length ||
  result.assetFailures.length
));
if (failures.length) throw new Error(`Trivia capture verification failed for ${failures.length} view(s).`);
console.log(`Captured and verified ${results.length} Trivia Vault states in ${outputRoot}.`);
