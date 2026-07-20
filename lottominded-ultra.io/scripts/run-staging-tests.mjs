import { spawn } from "node:child_process";
import { createRequire } from "node:module";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const packageRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const require = createRequire(import.meta.url);
const playwrightCli = require.resolve("@playwright/test/cli");
const serverUrl = "http://127.0.0.1:8143/index.html";
let server;

function waitForExit(child) {
  return new Promise((resolvePromise, rejectPromise) => {
    child.once("error", rejectPromise);
    child.once("exit", (code, signal) => resolvePromise({ code, signal }));
  });
}

async function waitForServer(timeoutMs = 30_000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (server.exitCode !== null) throw new Error(`Staging server exited early with code ${server.exitCode}.`);
    try {
      const response = await fetch(serverUrl, { cache: "no-store" });
      if (response.ok) return;
    } catch {}
    await new Promise((resolvePromise) => setTimeout(resolvePromise, 200));
  }
  throw new Error(`Staging server did not become ready at ${serverUrl}.`);
}

async function stopServer() {
  if (!server || server.exitCode !== null) return;
  const exited = waitForExit(server);
  server.kill();
  await Promise.race([
    exited,
    new Promise((resolvePromise) => setTimeout(resolvePromise, 5_000)),
  ]);
  if (server.exitCode === null) server.kill("SIGKILL");
}

async function main() {
  server = spawn(process.execPath, ["scripts/serve-site.mjs", "dist-staging", "8143"], {
    cwd: packageRoot,
    stdio: ["ignore", "inherit", "inherit"],
  });
  try {
    await waitForServer();
    const tests = spawn(process.execPath, [playwrightCli, "test", "--config=playwright.staging.config.cjs"], {
      cwd: packageRoot,
      stdio: "inherit",
    });
    const result = await waitForExit(tests);
    if (result.code !== 0) throw new Error(`Staging browser tests failed with exit code ${result.code ?? result.signal}.`);
  } finally {
    await stopServer();
  }
}

main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
