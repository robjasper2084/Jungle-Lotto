import { spawn } from "node:child_process";
import { createRequire } from "node:module";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { reserveOpenPort } from "./test-server-ports.mjs";

const packageRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const require = createRequire(import.meta.url);
const playwrightCli = require.resolve("@playwright/test/cli");

function waitForExit(child) {
  return new Promise((resolvePromise, rejectPromise) => {
    child.once("error", rejectPromise);
    child.once("exit", (code, signal) => resolvePromise({ code, signal }));
  });
}

async function main() {
  const requestedPort = Number(process.env.LOTTOMIND_TEST_PORT || 0);
  const testPort = String(await reserveOpenPort(requestedPort));
  const tests = spawn(process.execPath, [
    playwrightCli,
    "test",
    ...process.argv.slice(2),
  ], {
    cwd: packageRoot,
    env: {
      ...process.env,
      LOTTOMIND_TEST_PORT: testPort,
      LOTTOMIND_REUSE_TEST_SERVER: "0",
    },
    stdio: "inherit",
  });
  const result = await waitForExit(tests);
  if (result.code !== 0) throw new Error(`Site tests failed with exit code ${result.code ?? result.signal}.`);
}

main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
