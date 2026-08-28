import { copyFile, mkdir, readdir, stat } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';

export const gothtechnologyPath = 'lottominded-ultra.io/games/gothtechnology2';
export const requiredStoreFiles = [
  'index.html', 'shop/index.html', 'lookbook/index.html', 'about/index.html',
  'play/index.html', 'legacy-game/index.html', 'legacy-game/bridge.js',
  'legacy-game/reward-sdk.js', 'src/main.js',
  'media/home-charm-commercial.mp4', 'media/lookbook-detroit-film.mp4',
  'media/about-detroit-film.mp4',
  'media/lookbook-riverfront-film.mp4', 'media/lookbook-riverfront-film-poster.webp',
];

export async function readGothtechnologyBuild(repoRoot) {
  const dist = resolve(repoRoot, gothtechnologyPath, 'dist');
  for (const file of requiredStoreFiles) {
    if (!(await stat(resolve(dist, file)).catch(() => null))?.isFile()) {
      throw new Error('GothTechnology build is missing ' + file + '. Run npm ci and npm run build in ' + gothtechnologyPath + '.');
    }
  }
  const files = [];
  async function walk(directory, prefix = '') {
    for (const entry of await readdir(directory, {withFileTypes:true})) {
      const local = prefix + entry.name;
      const source = resolve(directory, entry.name);
      if (entry.isDirectory()) await walk(source, local + '/');
      else if (entry.isFile()) {
        if (/(^|\/)(node_modules|store|\.env[^/]*)(\/|$)|\.(astro|ts|map)$/.test(local)) {
          throw new Error('Refusing to publish store source or private build files: ' + local);
        }
        files.push({source, path:gothtechnologyPath + '/' + local, bytes:(await stat(source)).size});
      } else throw new Error('Refusing non-file build entry: ' + local);
    }
  }
  await walk(dist);
  return files;
}

export async function copyGothtechnologyBuild(files, outputRoot) {
  let bytes = 0;
  for (const file of files) {
    const target = resolve(outputRoot, file.path);
    await mkdir(dirname(target), {recursive:true});
    await copyFile(file.source, target);
    bytes += file.bytes;
  }
  return bytes;
}
