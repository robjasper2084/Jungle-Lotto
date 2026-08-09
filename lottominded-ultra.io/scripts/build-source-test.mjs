import { spawnSync } from "node:child_process";
import { copyFile, link, lstat, mkdir, readFile, readdir, rm, unlink, writeFile } from "node:fs/promises";
import { dirname, join, relative, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";

const packageRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const repositoryRoot = resolve(packageRoot, "..");
const stagingRoot = resolve(packageRoot, "dist-staging");
const outputRoot = resolve(packageRoot, "dist-source-test");
const gitCommand = process.platform === "win32" ? "C:\\Program Files\\Git\\cmd\\git.exe" : "git";

function runGit(args, encoding = "utf8") {
  const result = spawnSync(gitCommand, args, { cwd: repositoryRoot, encoding, maxBuffer: 128 * 1024 * 1024 });
  if (result.status !== 0) throw new Error((result.stderr || result.stdout || `git ${args.join(" ")} failed`).toString().trim());
  return result.stdout;
}

async function walk(directory, files = []) {
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const absolute = join(directory, entry.name);
    if (entry.isDirectory()) await walk(absolute, files);
    else if (entry.isFile()) files.push(absolute);
  }
  return files;
}

async function hardlinkArtifact() {
  await lstat(stagingRoot).catch(() => { throw new Error("dist-staging is missing; run the staging build first."); });
  for (const source of await walk(stagingRoot)) {
    const target = join(outputRoot, relative(stagingRoot, source));
    await mkdir(dirname(target), { recursive: true });
    try { await link(source, target); }
    catch (error) {
      if (!["EXDEV", "EPERM", "EACCES", "EISDIR"].includes(error.code)) throw error;
      await copyFile(source, target);
    }
  }
}

async function restoreSourceHtml() {
  const tracked = String(runGit(["ls-files", "--cached", "--others", "--exclude-standard", "--", "lottominded-ultra.io"]))
    .split(/\r?\n/)
    .filter((file) => file.startsWith("lottominded-ultra.io/"))
    .map((file) => file.slice("lottominded-ultra.io/".length));
  const htmlFiles = tracked.filter((file) => file.toLowerCase().endsWith(".html"));
  for (const relativePath of htmlFiles) {
    const target = resolve(outputRoot, relativePath.split("/").join(sep));
    if (target !== outputRoot && !target.startsWith(`${outputRoot}${sep}`)) throw new Error(`Unsafe source-test path: ${relativePath}`);
    await mkdir(dirname(target), { recursive: true });
    await unlink(target).catch((error) => { if (error.code !== "ENOENT") throw error; });
    await copyFile(resolve(packageRoot, relativePath.split("/").join(sep)), target);
  }
  return { tracked, htmlFiles };
}

async function main() {
  await rm(outputRoot, { recursive: true, force: true });
  await mkdir(outputRoot, { recursive: true });
  await hardlinkArtifact();
  const stagingManifest = JSON.parse(await readFile(resolve(stagingRoot, "staging-manifest.json"), "utf8"));
  const sourceCommitSHA = String(stagingManifest.sourceCommitSHA || "");
  if (!/^[0-9a-f]{40}$/i.test(sourceCommitSHA)) {
    throw new Error("Staging manifest is missing a valid source commit SHA.");
  }
  const { tracked, htmlFiles } = await restoreSourceHtml();

  for (const generated of ["staging-manifest.json", "assets/js/lm-support.js"]) {
    if (tracked.includes(generated)) continue;
    await rm(resolve(outputRoot, generated), { force: true });
  }

  await writeFile(resolve(outputRoot, "source-test-manifest.json"), `${JSON.stringify({
    sourceCommitSHA,
    copiedRoutes: stagingManifest.copiedRoutes,
    restoredHtmlFiles: htmlFiles,
  }, null, 2)}\n`);
  console.log(`Built source-test artifact with ${htmlFiles.length} original HTML files and shared immutable assets.`);
}

main().catch((error) => {
  console.error(`Source-test build failed: ${error.message}`);
  process.exitCode = 1;
});
