import {fileURLToPath} from 'node:url';
import {dirname,resolve,relative,isAbsolute,sep} from 'node:path';

export const previewRoot=resolve(dirname(fileURLToPath(import.meta.url)),'..');
export const repoRoot=resolve(previewRoot,'../..');
export const gameRoot=resolve(repoRoot,'lottominded-ultra.io/games/gothtechnology2');
export const belleRoot=resolve(gameRoot,'belle-isle-source/game');
export const swoopRoot=resolve(gameRoot,'swoop-source');
export const generatedRoot=resolve(previewRoot,'.generated');
export const outputRoot=resolve(previewRoot,'dist');

export function insidePath(parent,child){
  const rel=relative(resolve(parent),resolve(child));
  return rel!==''&&rel!=='..'&&!rel.startsWith('..'+sep)&&!isAbsolute(rel);
}

export function assertPreviewOutput(directory){
  if(!insidePath(previewRoot,directory))throw Error('Preview output must stay inside experiments/dequindre-cut-preview');
  if(insidePath(resolve(previewRoot,'src'),directory)||resolve(directory)===resolve(previewRoot,'src'))throw Error('Build output must not overwrite preview source');
  if(!['dist','.generated','output'].includes(relative(previewRoot,directory).split(sep)[0]))throw Error('Unapproved preview output directory');
  return resolve(directory);
}

export const assetRoots=Object.freeze([
  {prefix:'/__swoop-assets__/',directory:resolve(swoopRoot,'public')},
  {prefix:'/',directory:resolve(belleRoot,'public')},
]);
