import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {build} from 'esbuild';
import {Group} from 'three';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';

const game=fileURLToPath(new URL('../../',import.meta.url));
const outfile=path.join(game,'.test/cadillac-hero-loader.mjs');
await build({absWorkingDir:game,entryPoints:['src/belle/cadillacHero.ts'],outfile,
 bundle:true,platform:'node',format:'esm',external:['three'],logLevel:'error'});

test('suited Cadillac hero loads on demand, coalesces requests and retries after failure',async t=>{
 const asset={scene:new Group(),animations:[]};
 let attempts=0,requested='';
 t.mock.method(GLTFLoader.prototype,'loadAsync',async url=>{
  requested=String(url);attempts++;
  if(attempts===1)throw Error('temporary model delivery failure');
  return asset;
 });
 const {cadillacHeroModel}=await import(pathToFileURL(outfile).href);
 assert.equal(attempts,0,'importing the game does not fetch the additional hero');
 const first=cadillacHeroModel(),concurrent=cadillacHeroModel();
 assert.equal(first,concurrent,'concurrent entries share one model request');
 await assert.rejects(first,/temporary model delivery failure/);
 assert.equal(attempts,1);
 const retry=cadillacHeroModel();
 assert.notEqual(retry,first);
 assert.equal(await retry,asset);
 assert.equal(await cadillacHeroModel(),asset);
 assert.equal(attempts,2,'successful model data remains cached');
 assert.match(new URL(requested).pathname,/\/swoop-source\/public\/exports\/rigged-heroes\/DS_Man_01\.glb$/);
});
