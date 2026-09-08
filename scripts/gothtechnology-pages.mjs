import { copyFile, mkdir, readdir, readFile, stat, writeFile } from 'node:fs/promises';
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
    if(file.content!==undefined)await writeFile(target,file.content);
    else await copyFile(file.source, target);
    bytes += file.bytes;
  }
  return bytes;
}

// The embedded cabinet uses the same media as the existing standalone game.
// Only share byte-identical assets that are already in the assembled artifact;
// keep the standalone Astro preview self-contained and leave its build intact.
export async function shareShadowOpsAssets(files, outputRoot) {
  const cabinet=gothtechnologyPath+'/arcade/shadow-ops-canvas/';
  const assets=cabinet+'assets/';
  const duplicates=files.filter(file=>file.path.startsWith(assets));
  if(!duplicates.length)return files;
  for(const file of duplicates){
    const canonical=resolve(outputRoot,'lottominded-ultra.io/games/shadow-ops-canvas/assets',file.path.slice(assets.length));
    const existing=await readFile(canonical).catch(()=>null);
    if(!existing||!existing.equals(await readFile(file.source)))return files;
  }
  return Promise.all(files.filter(file=>!file.path.startsWith(assets)).map(async file=>{
    if(!file.path.startsWith(cabinet)||! /\.(js|css|html)$/.test(file.path))return file;
    const text=await readFile(file.source,'utf8');
    const content=text.replace(/(\.\.\/|\.\/)assets\//g,(_,prefix)=>prefix==='../'?'../../../../shadow-ops-canvas/assets/':'../../../shadow-ops-canvas/assets/');
    return {...file,content,bytes:Buffer.byteLength(content)};
  }));
}
