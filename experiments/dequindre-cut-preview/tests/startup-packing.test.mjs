import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdir,mkdtemp,readFile,writeFile,rm} from 'node:fs/promises';
import {resolve} from 'node:path';
import {createServer} from 'node:http';
import vm from 'node:vm';
import ts from 'typescript';
import {LoaderUtils} from 'three';
import {gunzip} from 'fflate';
import {previewRoot,repoRoot,belleRoot} from '../scripts/paths.mjs';
import {assetManifest} from '../scripts/asset-manifest.mjs';
import {previewAssets} from '../scripts/asset-server.mjs';
import {prepareStartupAssets,STARTUP_PACKING_POLICY} from '../scripts/prepare-startup-assets.mjs';

async function nativeStartupLoader(base,paths){
 const source=await readFile(resolve(belleRoot,'src/belle/startupAssets.ts'),'utf8');
 assert.equal(source.split('import.meta.env.PROD').length,2);
 // Compile the actual original production branch. Only this test's VM gets a
 // base-URL-aware fetch; no application or global fetch implementation changes.
 const {outputText}=ts.transpileModule(source.replace('import.meta.env.PROD','true'),{fileName:'startupAssets.ts',compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,esModuleInterop:true}});
 const module={exports:{}};
 const dependencies={'three':{LoaderUtils},fflate:{gunzip},'./startupAssets.json':paths};
 vm.runInNewContext(outputText,{module,exports:module.exports,Blob,Response,DecompressionStream,fetch:(path,options)=>fetch(new URL(path,base),options),require:specifier=>{
  if(!Object.hasOwn(dependencies,specifier))throw Error('Unexpected native startup dependency: '+specifier);
  return dependencies[specifier];
 }},{filename:'native-startup-assets.cjs'});
 return module.exports;
}

test('all native production startup gzip requests decode to exact original bytes through the real loader',{timeout:60000},async()=>{
 const parent=resolve(previewRoot,'output/tests');await mkdir(parent,{recursive:true});
 const directory=await mkdtemp(resolve(parent,'startup-pack-'));
 let server;
 try{
  const raw=assetManifest(),paths=JSON.parse(await readFile(resolve(belleRoot,'src/belle/startupAssets.json'),'utf8'));
  const packed=await prepareStartupAssets(raw,{directory});
  assert.equal(packed.assetCount,9);assert.equal(packed.assetCount,paths.length);assert.equal(Object.keys(packed.records).length,paths.length);
  assert.deepEqual(packed.policy,STARTUP_PACKING_POLICY);assert.ok(packed.packedBytes<packed.originalBytes);
  const requests=[];
  const middleware=previewAssets([{prefix:'/',directories:[resolve(belleRoot,'public'),directory]}],{manifest:{...raw,...packed.records},sourceBase:repoRoot});
  server=createServer((request,response)=>{requests.push(request.url);middleware(request,response,()=>response.writeHead(404).end());});
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  const base='http://127.0.0.1:'+server.address().port+'/';
  const native=await nativeStartupLoader(base,paths);
  for(const path of paths){
   const record=packed.records['/'+path+'.gz'];
   assert.equal(record.derivedFrom.gitBlob,raw['/'+path].gitBlob);assert.equal(record.derivedFrom.source,raw['/'+path].source);
   assert.deepEqual(record.compression,{format:'gzip',level:9,losslessRoundtrip:true});assert.equal(record.sha256.length,64);
   const expected=await readFile(resolve(belleRoot,'public',path));
   const actual=await native.loadStartupBytes('./'+path+'?packing-proof=1');
   assert.deepEqual(Buffer.from(actual),expected,path+' exact native decompression');
   assert.ok(requests.includes('/'+path+'.gz?packing-proof=1'),path+' uses the native .gz URL');
  }
  const response=await fetch(base+'belle/pavement.bin.gz',{headers:{Range:'bytes=0-1'}});
  assert.equal(response.status,206);assert.equal(response.headers.get('content-type'),'application/gzip');assert.equal(response.headers.get('content-encoding'),null);
  assert.deepEqual(Buffer.from(await response.arrayBuffer()),Buffer.from([0x1f,0x8b]));
  await writeFile(resolve(directory,'belle/pavement.json'),'stale derived filename must not shadow the original');
  const unlisted=await native.loadStartupBytes('./belle/pavement.json');
  assert.deepEqual(Buffer.from(unlisted),await readFile(resolve(belleRoot,'public/belle/pavement.json')));
  assert.ok(requests.includes('/belle/pavement.json'),'unlisted URLs retain original raw delivery');
  await writeFile(resolve(directory,'belle/pavement.bin.gz'),'changed derived asset');
  assert.equal((await fetch(base+'belle/pavement.bin.gz')).status,409,'derived bytes are verified against the build receipt');
  const first='/'+paths[0],invalid={...raw,[first]:{...raw[first],gitBlob:'0'.repeat(40)}};
  await assert.rejects(prepareStartupAssets(invalid,{directory}),/source bytes differ from their Git identity/);
  await assert.rejects(prepareStartupAssets(raw,{directory:resolve(belleRoot,'public')}),/Preview output must stay inside/);
 }finally{if(server)await new Promise(resolve=>server.close(resolve));await rm(directory,{recursive:true,force:true});}
});
