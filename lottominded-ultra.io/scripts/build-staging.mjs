import { spawn, spawnSync } from "node:child_process";
import { constants } from "node:fs";
import {
  access,
  copyFile,
  mkdir,
  readFile,
  readdir,
  rm,
  stat,
  writeFile,
} from "node:fs/promises";
import { dirname, extname, join, relative, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";

const packageRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const repositoryRoot = resolve(packageRoot, "..");
const outputRoot = resolve(packageRoot, "dist-staging");
const sourceCommitArgumentIndex = process.argv.indexOf("--source-commit");
const requestedSourceCommit = sourceCommitArgumentIndex >= 0
  ? String(process.argv[sourceCommitArgumentIndex + 1] || "").trim()
  : "HEAD";
if (!/^(?:HEAD|[0-9a-f]{40})$/i.test(requestedSourceCommit)) {
  throw new Error("--source-commit must be HEAD or a full 40-character commit SHA.");
}
const sourceTree = `${requestedSourceCommit}:lottominded-ultra.io`;
const environmentSource = join(packageRoot, "assets", "js", "lm-environment.js");
const guardSource = join(packageRoot, "assets", "js", "lm-staging-guard.js");
const manifestPath = join(outputRoot, "staging-manifest.json");
const bannerText = "LottoMind Upgrade Preview — Not Production";
const markerName = "lottomind-upgrade-preview-v1";
const gitCommand = process.platform === "win32" ? "C:\\Program Files\\Git\\cmd\\git.exe" : "git";
const tarCommand = process.platform === "win32" ? "C:\\Windows\\System32\\tar.exe" : "tar";
const skippedFiles = new Set();

const skipRoots = [
  ".circleci",
  ".github",
  "node_modules",
  "playwright-report",
  "test-results",
  "tests",
  "scripts",
  "supabase",
  "news-hub/server",
  "news-hub/src",
  "news-hub/scripts",
  "games/lottomind-313-fortune-grid/app",
  "games/lottomind-313-fortune-grid/tests",
  "games/lottomind-313-fortune-grid/scripts",
  "games/lottomind-313-fortune-grid/assets/art/source",
];
const skipFiles = new Set([
  "assets/video/video_background_snippet.html",
  "features-app.backup.html",
  "package.json",
  "package-lock.json",
  "playwright.config.cjs",
  "STRIPE_TEST_SETUP.md",
  "games/lottomind-313-fortune-grid/package.json",
  "games/lottomind-313-fortune-grid/package-lock.json",
  "games/lottomind-313-fortune-grid/playwright.config.ts",
  "games/lottomind-313-fortune-grid/tsconfig.json",
  "games/lottomind-313-fortune-grid/vite.config.ts",
  "games/lottomind-313-fortune-grid/vitest.config.ts",
]);
const textExtensions = new Set([
  ".css", ".html", ".js", ".json", ".map", ".mjs", ".svg", ".txt", ".webmanifest", ".xml",
]);
const secretPatterns = [
  { label: "Stripe live secret key", pattern: /\b(?:sk|rk)_live_[A-Za-z0-9]{12,}\b/g },
  { label: "private key", pattern: /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/g },
  { label: "assigned production secret", pattern: /\b(?:STRIPE_SECRET_KEY|SUPABASE_SERVICE_ROLE_KEY|DATABASE_PASSWORD|PRIVATE_KEY)\b\s*[:=]\s*["']?[^\s"']{12,}/gi },
];

function runGit(args, options = {}) {
  const result = spawnSync(gitCommand, args, {
    cwd: repositoryRoot,
    encoding: "utf8",
    ...options,
  });
  if (result.status !== 0) {
    throw new Error(`git ${args.join(" ")} failed: ${(result.stderr || result.stdout || "unknown error").trim()}`);
  }
  return String(result.stdout || "").trim();
}

function processExit(child, label, stderr) {
  return new Promise((resolvePromise, rejectPromise) => {
    child.once("error", rejectPromise);
    child.once("close", (code) => {
      if (code === 0) resolvePromise();
      else rejectPromise(new Error(`${label} failed with exit code ${code}: ${stderr.value.trim()}`));
    });
  });
}

async function extractCommittedSite() {
  const archive = spawn(gitCommand, ["archive", "--format=tar", sourceTree], {
    cwd: repositoryRoot,
    stdio: ["ignore", "pipe", "pipe"],
  });
  const extractor = spawn(tarCommand, ["-xf", "-", "-C", outputRoot], {
    cwd: packageRoot,
    stdio: ["pipe", "ignore", "pipe"],
  });
  const archiveError = { value: "" };
  const extractorError = { value: "" };
  archive.stderr.on("data", (chunk) => { archiveError.value += chunk; });
  extractor.stderr.on("data", (chunk) => { extractorError.value += chunk; });
  archive.stdout.pipe(extractor.stdin);
  await Promise.all([
    processExit(archive, "git archive", archiveError),
    processExit(extractor, "tar extraction", extractorError),
  ]);
}

async function overlayWorkingTreeChanges() {
  if (requestedSourceCommit !== "HEAD") return [];
  const prefix = "lottominded-ultra.io/";
  const collectPaths = (output) => output
    .split(/\r?\n/)
    .map((value) => value.trim())
    .filter((value) => value.startsWith(prefix))
    .map((value) => value.slice(prefix.length));
  const changedPaths = [...new Set([
    ...collectPaths(runGit(["diff", "--name-only", "HEAD", "--", "lottominded-ultra.io"])),
    ...collectPaths(runGit(["ls-files", "--others", "--exclude-standard", "--", "lottominded-ultra.io"])),
  ])];

  for (const relativePath of changedPaths) {
    const sourcePath = resolve(packageRoot, relativePath);
    const destinationPath = resolve(outputRoot, relativePath);
    if (!sourcePath.startsWith(`${packageRoot}${sep}`) || !destinationPath.startsWith(`${outputRoot}${sep}`)) {
      throw new Error(`Refusing to overlay path outside the staging roots: ${relativePath}`);
    }
    try {
      const details = await stat(sourcePath);
      if (!details.isFile()) continue;
      await mkdir(dirname(destinationPath), { recursive: true });
      await copyFile(sourcePath, destinationPath);
    } catch (error) {
      if (error && error.code === "ENOENT") await rm(destinationPath, { force: true });
      else throw error;
    }
  }
  return changedPaths;
}

function toPosix(pathValue) {
  return pathValue.split(sep).join("/");
}

async function walk(directory, files = []) {
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const absolute = join(directory, entry.name);
    if (entry.isDirectory()) await walk(absolute, files);
    else if (entry.isFile()) files.push(absolute);
  }
  return files;
}

async function listRelativeFiles(absolutePath) {
  try {
    const details = await stat(absolutePath);
    const files = details.isDirectory() ? await walk(absolutePath) : [absolutePath];
    return files.map((file) => toPosix(relative(outputRoot, file)));
  } catch (error) {
    if (error && error.code === "ENOENT") return [];
    throw error;
  }
}

async function removeGeneratedPath(relativePath) {
  const absolute = resolve(outputRoot, relativePath);
  if (absolute !== outputRoot && !absolute.startsWith(`${outputRoot}${sep}`)) {
    throw new Error(`Refusing to remove path outside staging output: ${relativePath}`);
  }
  for (const file of await listRelativeFiles(absolute)) skippedFiles.add(file);
  await rm(absolute, { recursive: true, force: true });
}

async function removeDevelopmentFiles() {
  for (const relativePath of skipRoots) await removeGeneratedPath(relativePath);
  for (const relativePath of skipFiles) await removeGeneratedPath(relativePath);
  for (const file of await walk(outputRoot)) {
    const relativePath = toPosix(relative(outputRoot, file));
    if (/(^|\/)\.env(?:\.|$)/.test(relativePath)) await removeGeneratedPath(relativePath);
  }
}

function readBoolean(name) {
  return /^(?:1|true|yes)$/i.test(String(process.env[name] || ""));
}

function validatedPublicUrl(name, value, expectedOrigin = "") {
  if (!value) return "";
  let parsed;
  try { parsed = new URL(value); }
  catch { throw new Error(`${name} must be an absolute URL.`); }
  const localHttp = parsed.protocol === "http:" && /^(?:127\.0\.0\.1|localhost)$/i.test(parsed.hostname);
  if (parsed.protocol !== "https:" && !localHttp) throw new Error(`${name} must use HTTPS, except for localhost.`);
  if (parsed.username || parsed.password || parsed.search || parsed.hash) throw new Error(`${name} must not contain credentials, query parameters, or fragments.`);
  if (expectedOrigin && parsed.origin !== expectedOrigin) throw new Error(`${name} must use the isolated staging backend origin.`);
  return parsed.href.replace(/\/$/, "");
}

function stagingMarker() {
  const backendUrl = validatedPublicUrl("LOTTOMIND_STAGING_BACKEND_URL", String(process.env.LOTTOMIND_STAGING_BACKEND_URL || "").trim());
  const isolatedStagingBackend = Boolean(backendUrl && readBoolean("LOTTOMIND_STAGING_BACKEND_ISOLATED"));
  const backendOrigin = backendUrl ? new URL(backendUrl).origin : "";
  const supabaseUrl = validatedPublicUrl(
    "LOTTOMIND_STAGING_SUPABASE_URL",
    String(process.env.LOTTOMIND_STAGING_SUPABASE_URL || "").trim(),
    backendOrigin
  );
  const supabasePublishableKey = String(process.env.LOTTOMIND_STAGING_SUPABASE_PUBLISHABLE_KEY || "").trim();
  const stripePublishableKey = String(process.env.LOTTOMIND_STAGING_STRIPE_PUBLISHABLE_KEY || "").trim();

  if (supabasePublishableKey && !supabasePublishableKey.startsWith("sb_publishable_")) {
    throw new Error("Only a Supabase publishable key may be included in a staging artifact.");
  }
  if (stripePublishableKey && !stripePublishableKey.startsWith("pk_test_")) {
    throw new Error("Only a Stripe test-mode publishable key may be included in a staging artifact.");
  }

  const stripeTestModeVerified = Boolean(
    isolatedStagingBackend &&
    stripePublishableKey.startsWith("pk_test_") &&
    readBoolean("LOTTOMIND_STAGING_STRIPE_TEST_MODE_VERIFIED")
  );

  return Object.freeze({
    marker: markerName,
    name: "staging",
    isolatedStagingBackend,
    stagingBackendUrl: isolatedStagingBackend ? backendUrl : "",
    stagingBackendOrigin: isolatedStagingBackend ? backendOrigin : "",
    stagingSupabaseUrl: isolatedStagingBackend ? supabaseUrl : "",
    stagingSupabasePublishableKey: isolatedStagingBackend ? supabasePublishableKey : "",
    stripeTestModeVerified,
    allowAccountWrites: Boolean(isolatedStagingBackend && readBoolean("LOTTOMIND_STAGING_ALLOW_ACCOUNT_WRITES")),
    allowTestRedemptions: Boolean(isolatedStagingBackend && readBoolean("LOTTOMIND_STAGING_ALLOW_TEST_REDEMPTIONS")),
  });
}

function environmentInjection(htmlRelativePath, marker) {
  const pageDirectory = dirname(resolve(outputRoot, htmlRelativePath));
  const environmentUrl = toPosix(relative(pageDirectory, join(outputRoot, "assets", "js", "lm-environment.js")));
  const guardUrl = toPosix(relative(pageDirectory, join(outputRoot, "assets", "js", "lm-staging-guard.js")));
  const markerJson = JSON.stringify(marker).replace(/</g, "\\u003c");
  return [
    '<meta name="robots" content="noindex,nofollow,noarchive" data-lm-staging-robots />',
    '<style data-lm-staging-style>[data-lm-staging-banner]{position:relative;z-index:2147483647;display:flex;align-items:center;justify-content:center;min-height:28px;padding:5px 12px;border-bottom:1px solid rgba(238,213,106,.48);background:#050a12;color:#f4dd79;font:700 12px/1.4 system-ui,sans-serif;letter-spacing:0;text-align:center}#lm-staging-guard-status{position:relative;z-index:2147483646;padding:4px 12px;border-bottom:1px solid rgba(62,222,239,.22);background:#081522;color:#bfefff;font:600 11px/1.4 system-ui,sans-serif;letter-spacing:0;text-align:center}@media print{[data-lm-staging-banner],#lm-staging-guard-status{display:none!important}}</style>',
    `<script data-lm-staging-marker>window.__LOTTOMIND_ENVIRONMENT_MARKER__=Object.freeze(${markerJson});</script>`,
    `<script src="${environmentUrl}" data-lm-environment></script>`,
    `<script src="${guardUrl}" data-lm-staging-guard></script>`,
  ].join("\n");
}

function processHtml(source, relativePath, marker) {
  if (!/<html\b/i.test(source) || !/<head\b[^>]*>/i.test(source) || !/<body\b[^>]*>/i.test(source)) {
    throw new Error(`${relativePath}: expected a complete HTML document with head and body.`);
  }
  const analyticsScript = /<script\b[^>]*\bsrc\s*=\s*["'][^"']*(?:googletagmanager\.com|google-analytics\.com|doubleclick\.net|segment\.com|segment\.io|mixpanel\.com|amplitude\.com)[^"']*["'][^>]*>\s*<\/script>/gi;
  let html = source.replace(analyticsScript, "");
  if (relativePath === "news-hub/index.html") {
    html = html.replace(
      /<script\s+type=["']module["']\s+src=["']\/src\/main\.tsx["']><\/script>/i,
      '<script data-lm-staging-news-redirect>window.location.replace("../news/");</script>'
    );
  }
  html = html.replace(/<meta\b[^>]*\bname\s*=\s*["']robots["'][^>]*>/gi, "");
  html = html.replace(/<head\b[^>]*>/i, (head) => `${head}\n${environmentInjection(relativePath, marker)}`);
  html = html.replace(/<body\b[^>]*>/i, (body) => `${body}\n<div data-lm-staging-banner role="note">${bannerText}</div>`);
  if (!html.includes("data-lm-staging-marker") || !html.includes("data-lm-staging-guard")) {
    throw new Error(`${relativePath}: staging environment marker or guard injection is missing.`);
  }
  return html;
}

function routeForHtml(relativePath) {
  const normalized = toPosix(relativePath);
  if (normalized === "index.html") return "/";
  if (normalized.endsWith("/index.html")) return `/${normalized.slice(0, -"index.html".length)}`;
  return `/${normalized}`;
}

async function scanForSecrets() {
  const findings = [];
  for (const file of await walk(outputRoot)) {
    if (!textExtensions.has(extname(file).toLowerCase())) continue;
    const content = await readFile(file, "utf8");
    for (const check of secretPatterns) {
      check.pattern.lastIndex = 0;
      if (check.pattern.test(content)) findings.push(`${toPosix(relative(outputRoot, file))}: ${check.label}`);
    }
  }
  if (findings.length) throw new Error(`Production secret pattern found in generated output:\n- ${findings.join("\n- ")}`);
}

async function main() {
  const packageDetails = await stat(packageRoot).catch(() => null);
  if (!packageDetails || !packageDetails.isDirectory()) throw new Error(`Required source directory is missing: ${packageRoot}`);
  await access(environmentSource, constants.R_OK);
  await access(guardSource, constants.R_OK);
  runGit(["cat-file", "-e", `${sourceTree}/index.html`]);
  const sourceCommitSHA = runGit(["rev-parse", requestedSourceCommit]);

  if (dirname(outputRoot) !== packageRoot || outputRoot === packageRoot) throw new Error("Unsafe staging output path.");
  await rm(outputRoot, { recursive: true, force: true });
  await mkdir(outputRoot, { recursive: true });
  await extractCommittedSite();
  const workingTreeFiles = await overlayWorkingTreeChanges();
  await removeDevelopmentFiles();

  const generatedAssets = join(outputRoot, "assets", "js");
  await mkdir(generatedAssets, { recursive: true });
  await copyFile(environmentSource, join(generatedAssets, "lm-environment.js"));
  await copyFile(guardSource, join(generatedAssets, "lm-staging-guard.js"));
  const marker = stagingMarker();
  const injectedPages = [];
  for (const file of await walk(outputRoot)) {
    if (extname(file).toLowerCase() !== ".html") continue;
    const relativePath = toPosix(relative(outputRoot, file));
    try {
      const source = await readFile(file, "utf8");
      await writeFile(file, processHtml(source, relativePath, marker), "utf8");
      injectedPages.push(relativePath);
    } catch (error) {
      throw new Error(`Unable to process staging HTML ${relativePath}: ${error.message}`);
    }
  }
  if (!injectedPages.length) throw new Error("No staging HTML pages were processed.");

  const copiedRoutes = injectedPages.map(routeForHtml).sort();
  const manifest = {
    buildTimestamp: new Date().toISOString(),
    sourceCommitSHA,
    sourceIncludesWorkingTreeChanges: workingTreeFiles.length > 0,
    workingTreeFiles,
    copiedRoutes,
    injectedPages: injectedPages.sort(),
    skippedFiles: Array.from(skippedFiles).sort(),
  };
  await writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`, "utf8");

  for (const relativePath of manifest.injectedPages) {
    const html = await readFile(join(outputRoot, relativePath), "utf8");
    if (!/<meta\s+name="robots"\s+content="noindex,nofollow,noarchive"/i.test(html)) {
      throw new Error(`${relativePath}: staging robots metadata is missing.`);
    }
    if (!html.includes("data-lm-staging-marker") || !html.includes("lm-staging-guard.js")) {
      throw new Error(`${relativePath}: staging environment marker is missing.`);
    }
  }
  await scanForSecrets();

  console.log(`Built ${manifest.injectedPages.length} staging pages from ${sourceCommitSHA}.`);
  console.log(`Output: ${outputRoot}`);
}

main().catch((error) => {
  console.error(`Staging build failed: ${error.message}`);
  process.exitCode = 1;
});
