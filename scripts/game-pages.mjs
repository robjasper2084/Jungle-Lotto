import { copyFile, mkdir, readdir, stat } from "node:fs/promises";
import { dirname, resolve } from "node:path";

export const gameBuilds = [
  {
    id: "fortune-grid",
    path: "lottominded-ultra.io/games/lottomind-313-fortune-grid",
    dist: "dist",
    required: [
      "index.html",
      "manifest.webmanifest",
      "sw.js",
      "assets/art/detroit-fortune-grid-board.png",
      "assets/art/mascot/01.png",
    ],
    generated: [/^assets\/build\/.*\.js$/, /^assets\/build\/.*\.css$/],
  },
  {
    id: "jackpot-maze",
    path: "lottominded-ultra.io/games/lottomind-jackpot-maze",
    dist: "source/dist",
    required: ["index.html", "manifest.webmanifest", "sw.js"],
    generated: [/^assets\/.*\.js$/, /^assets\/.*\.css$/],
  },
];

export const requiredGameRoutes = gameBuilds.flatMap(({ path, required }) =>
  required.slice(0, 3).map((file) => `${path}/${file}`),
);

async function walkBuild(directory, prefix = "") {
  const files = [];
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const local = `${prefix}${entry.name}`;
    const source = resolve(directory, entry.name);
    if (entry.isDirectory()) files.push(...await walkBuild(source, `${local}/`));
    else if (entry.isFile()) {
      if (/(^|\/)(node_modules|src|\.env[^/]*)(\/|$)|\.(?:map|ts|tsx)$/.test(local)) {
        throw new Error(`Refusing to publish game source or private build file: ${local}`);
      }
      files.push({ local, source, bytes: (await stat(source)).size });
    } else {
      throw new Error(`Refusing non-file game build entry: ${local}`);
    }
  }
  return files;
}

export async function readGameBuilds(repoRoot) {
  const builds = [];
  for (const game of gameBuilds) {
    const directory = resolve(repoRoot, game.path, game.dist);
    for (const file of game.required) {
      if (!(await stat(resolve(directory, file)).catch(() => null))?.isFile()) {
        throw new Error(`${game.id} build is missing ${file}. Run its production build first.`);
      }
    }
    const files = await walkBuild(directory);
    for (const pattern of game.generated) {
      if (!files.some(({ local }) => pattern.test(local))) {
        throw new Error(`${game.id} build is missing generated output matching ${pattern}.`);
      }
    }
    builds.push(...files.map((file) => ({ ...file, path: `${game.path}/${file.local}` })));
  }
  return builds;
}

export async function copyGameBuilds(files, outputRoot) {
  let bytes = 0;
  for (const file of files) {
    const target = resolve(outputRoot, file.path);
    await mkdir(dirname(target), { recursive: true });
    await copyFile(file.source, target);
    bytes += file.bytes;
  }
  return bytes;
}
