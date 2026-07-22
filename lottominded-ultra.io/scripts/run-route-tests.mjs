import { spawn } from "node:child_process";
import { createRequire } from "node:module";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const packageRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const require = createRequire(import.meta.url);
const playwrightCli = require.resolve("@playwright/test/cli");
const servers = [];
const sourcePort = String(Number(process.env.LOTTOMIND_ROUTE_SOURCE_PORT || 8142));
const stagingPort = String(Number(process.env.LOTTOMIND_ROUTE_STAGING_PORT || 8143));

function waitForExit(child) {
  return new Promise((resolvePromise, rejectPromise) => {
    child.once("error", rejectPromise);
    child.once("exit", (code, signal) => resolvePromise({ code, signal }));
  });
}

async function waitForServer(url, child, timeoutMs = 30_000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (child.exitCode !== null) throw new Error(`Static server for ${url} exited early with code ${child.exitCode}.`);
    try {
      const response = await fetch(url, { cache: "no-store" });
      if (response.ok) return;
    } catch {}
    await new Promise((resolvePromise) => setTimeout(resolvePromise, 200));
  }
  throw new Error(`Static server did not become ready at ${url}.`);
}

async function stopServer(child) {
  if (!child || child.exitCode !== null) return;
  const exited = waitForExit(child);
  child.kill();
  await Promise.race([exited, new Promise((resolvePromise) => setTimeout(resolvePromise, 5_000))]);
  if (child.exitCode === null) child.kill("SIGKILL");
}

async function main() {
  for (const [directory, port] of [["dist-source-test", sourcePort], ["dist-staging", stagingPort]]) {
    const child = spawn(process.execPath, ["scripts/serve-site.mjs", directory, port], {
      cwd: packageRoot,
      stdio: ["ignore", "inherit", "inherit"],
    });
    servers.push(child);
  }

  try {
    await Promise.all([
      waitForServer(`http://127.0.0.1:${sourcePort}/index.html`, servers[0]),
      waitForServer(`http://127.0.0.1:${stagingPort}/index.html`, servers[1]),
    ]);
    const tests = spawn(process.execPath, [playwrightCli, "test", "--config=playwright.routes.config.cjs"], {
      cwd: packageRoot,
      stdio: "inherit",
    });
    const result = await waitForExit(tests);
    if (result.code !== 0) throw new Error(`Route smoke tests failed with exit code ${result.code ?? result.signal}.`);
  } finally {
    await Promise.all(servers.map(stopServer));
  }
}

main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
