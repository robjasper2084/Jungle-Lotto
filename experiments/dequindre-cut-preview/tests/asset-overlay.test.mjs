import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,mkdir,readFile,writeFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {resolve} from 'node:path';
import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {createServer} from 'node:http';
import {assetManifest} from '../scripts/asset-manifest.mjs';
import {previewAssets} from '../scripts/asset-server.mjs';
import {orderedAssetRoots} from '../scripts/asset-roots.mjs';
import {repoRoot,assetRoots} from '../scripts/paths.mjs';

const blob=bytes=>createHash('sha1').update('blob '+bytes.length+'\0').update(bytes).digest('hex');
async function serve(roots,manifest,sourceBase,check){
 const middleware=previewAssets(roots,{manifest,sourceBase});
 const server=createServer((req,res)=>middleware(req,res,()=>res.writeHead(404).end()));
 try{await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));await check('http://127.0.0.1:'+server.address().port);}finally{await new Promise(resolve=>server.close(resolve));}
}

test('actual Cut textures, published model and external original JPEG dependencies are present and exact',async()=>{
 const manifest=assetManifest();
 const published='lottominded-ultra.io/games/gothtechnology2/store/public/arcade/swoop-detroit/';
 const urls=['brick','limestone','mural_heron','mural_detroit','mural_music'].map(name=>'/__swoop-assets__/textures/cut/'+name+'.jpg');
 const modelUrl='/__swoop-assets__/exports/architecture/DS_Detroit_Globe_OAC.glb';
 const model=manifest[modelUrl];assert.equal(model?.source,published+'exports/architecture/DS_Detroit_Globe_OAC.glb');
 const glb=await readFile(resolve(repoRoot,model.source));
 assert.equal(glb.readUInt32LE(0),0x46546c67);assert.equal(glb.readUInt32LE(4),2);
 assert.equal(glb.readUInt32LE(16),0x4e4f534a);
 const json=JSON.parse(glb.subarray(20,20+glb.readUInt32LE(12)).toString('utf8'));
 const images=json.images.filter(image=>image.uri&&!image.uri.startsWith('data:')).map(image=>new URL(image.uri,'http://127.0.0.1'+modelUrl).pathname);
 assert.equal(images.length,2);for(const url of images)assert.ok(url.startsWith('/__swoop-assets__/shared-textures/'));
 urls.push(modelUrl,...images);
 const expected=new Map();
 for(const url of urls){
  const record=manifest[url];assert.ok(record,'actual source record '+url);assert.ok(record.source.startsWith(published));
  const bytes=await readFile(resolve(repoRoot,record.source));assert.equal(blob(bytes),record.gitBlob,url);
  if(url.endsWith('.jpg'))assert.equal(bytes.readUInt16BE(0),0xffd8,url+' original JPEG');
  expected.set(url,bytes.subarray(0,24));
 }
 await serve(assetRoots,manifest,repoRoot,async base=>{
  for(const [url,bytes]of expected){
   const response=await fetch(base+url,{headers:{Range:'bytes=0-23'}});
   assert.equal(response.status,206,url);assert.equal(response.headers.get('x-dequindre-asset-source'),'swoop');
   assert.deepEqual(Buffer.from(await response.arrayBuffer()),bytes,url+' original ranged bytes');
  }
 });
});

test('overlay manifest and server share source-first priority and refuse identity drift',async()=>{
 const fixture=await mkdtemp(resolve(tmpdir(),'dequindre-overlay-'));
 try{
  for(const directory of ['source/exports','published/exports','belle/__swoop-assets__/exports'])await mkdir(resolve(fixture,directory),{recursive:true});
  await writeFile(resolve(fixture,'source/exports/model.glb'),'source-original');
  await writeFile(resolve(fixture,'published/exports/model.glb'),'published-original');
  await writeFile(resolve(fixture,'published/exports/extra.glb'),'published-only');
  await writeFile(resolve(fixture,'belle/__swoop-assets__/exports/extra.glb'),'wrong-game');
  execFileSync('git',['init','--quiet',fixture]);execFileSync('git',['add','.'],{cwd:fixture});
  // Deliberately unsorted: prefix specificity must be deterministic.
  const roots=[{prefix:'/',directory:resolve(fixture,'belle')},{prefix:'/__swoop-assets__/',directory:resolve(fixture,'source')},{prefix:'/__swoop-assets__/exports/',directories:[resolve(fixture,'source/exports'),resolve(fixture,'published/exports')]}];
  const manifest=assetManifest(roots,{repository:fixture});
  assert.equal(manifest['/__swoop-assets__/exports/model.glb'].source,'source/exports/model.glb');
  assert.equal(manifest['/__swoop-assets__/exports/extra.glb'].source,'published/exports/extra.glb');
  await serve(roots,manifest,fixture,async base=>{
   assert.equal(await (await fetch(base+'/__swoop-assets__/exports/model.glb')).text(),'source-original');
   assert.equal(await (await fetch(base+'/__swoop-assets__/exports/extra.glb')).text(),'published-only');
   await writeFile(resolve(fixture,'source/exports/model.glb'),'changed-primary');
   assert.equal((await fetch(base+'/__swoop-assets__/exports/model.glb')).status,409);
   await writeFile(resolve(fixture,'source/exports/extra.glb'),'published-only');
   assert.equal((await fetch(base+'/__swoop-assets__/exports/extra.glb')).status,409,'same bytes cannot silently change source provenance');
  });
  await rm(resolve(fixture,'source/exports/model.glb'));
  assert.throws(()=>assetManifest(roots,{repository:fixture}),/not checked out: source\/exports\/model.glb/);
  assert.throws(()=>orderedAssetRoots([roots[0],roots[0]]),/unique slash-delimited prefixes/);
 }finally{await rm(fixture,{recursive:true,force:true});}
});
