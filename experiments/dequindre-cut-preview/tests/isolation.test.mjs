import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile,mkdtemp,writeFile,symlink,rm} from 'node:fs/promises';
import {resolve,join} from 'node:path';
import {tmpdir} from 'node:os';
import {createServer} from 'node:http';
import {createHash} from 'node:crypto';
import {repoRoot,previewRoot,outputRoot,assertPreviewOutput} from '../scripts/paths.mjs';
import {SOURCE_DIGESTS,BELLE_ROOT,GAME_ROOT,digest,applyEdits,belleMainEdits,belleWorldEdits,belleDistrictEdits,belleCompanionEdits,swoopEdits,previewHtml,replaceExactlyOnce,assertOfflineRoomBoundary} from '../scripts/source-transforms.mjs';
import {previewAssets,parseRange} from '../scripts/asset-server.mjs';
import {verifyIsolation} from '../scripts/verify-isolation.mjs';

test('preview patches are exact, in memory only, and original sources remain intact',async()=>{
  for(const [file,sha]of Object.entries(SOURCE_DIGESTS))assert.equal(digest(await readFile(resolve(repoRoot,file))),sha,file);
  const main=await readFile(resolve(repoRoot,BELLE_ROOT,'src/belle/main.ts'),'utf8');
  const patched=applyEdits(main,belleMainEdits(main));
  assert.match(patched,/from '@dequindre-preview\/host'/);
  assert.match(patched,/from '@dequindre-preview\/terrain'/);
  assert.match(patched,/import \{inside,type Landmark,type ParkMap\} from '\.\/terrain\.ts'/);
  assert.equal(digest(await readFile(resolve(repoRoot,BELLE_ROOT,'src/belle/main.ts'))),SOURCE_DIGESTS[BELLE_ROOT+'/src/belle/main.ts']);
});

test('missing, repeated and changed source hooks fail closed',async()=>{
  const hook="import {createWorld} from './world.ts';import {ParkTerrain,inside,type Landmark,type ParkMap} from './terrain.ts';";
  assert.throws(()=>belleMainEdits('unrelated',{verify:false}),/exactly one/);
  assert.throws(()=>belleMainEdits(hook+hook,{verify:false}),/exactly one/);
  const actual=await readFile(resolve(repoRoot,BELLE_ROOT,'src/belle/main.ts'),'utf8');
  assert.throws(()=>belleMainEdits(actual+'\n// changed'),/source has changed/);
  assert.throws(()=>replaceExactlyOnce('aaa','a','b','fixture'),/exactly one/);
});

test('both room imports are isolated and production transports fail closed',async()=>{
  const source=await readFile(resolve(repoRoot,BELLE_ROOT,'src/belle/main.ts'),'utf8');
  const changed=applyEdits(source,belleMainEdits(source));
  assert.match(changed,/import type \{BelleOnlineRooms\} from '@dequindre-preview\/offlineRooms'/);
  assert.match(changed,/void import\('@dequindre-preview\/offlineRooms'\)/);
  assert.doesNotMatch(changed,/from '\.\/onlineRooms\.ts'|import\('\.\/onlineRooms\.ts'\)/);
  for(const needle of ["import type {BelleOnlineRooms} from './onlineRooms.ts';","void import('./onlineRooms.ts').then(({BelleOnlineRooms})=>"]){
    assert.throws(()=>belleMainEdits(source.replace(needle,''),{verify:false}),/exactly one/);
    assert.throws(()=>belleMainEdits(source+needle,{verify:false}),/exactly one/);
  }
  for(const id of [resolve(repoRoot,BELLE_ROOT,'src/belle/onlineRooms.ts'),'/work/node_modules/@supabase/realtime-js/dist/module/index.js'])assert.throws(()=>assertOfflineRoomBoundary([id]),/Production online rooms/);
  assert.doesNotThrow(()=>assertOfflineRoomBoundary([resolve(previewRoot,'src/offlineRooms.ts'),resolve(repoRoot,BELLE_ROOT,'src/belle/coop.ts')]));
  assert.match(changed,/import \{CoopSession\} from '\.\/coop\/session\.ts'/);
  assert.match(changed,/coop=new CoopSession\(scene,terrain,wheel,\{/);
});

test('companion obstacle provider observes only the visible active ground dog',async()=>{
  const file=BELLE_ROOT+'/src/belle/parkCompanion.ts',source=await readFile(resolve(repoRoot,file),'utf8');
  const changed=applyEdits(source,belleCompanionEdits(source));
  assert.match(changed,/get previewNavigationPose\(\)\{return this\.view\?\.root\.visible&&this\.enabled&&!this\.inVehicle\?this\.dog:undefined;\}/);
  assert.match(changed,/relocate\(\)\{if\(this\.enabled\)this\.previewGround\.reset\(\(\)=>this\.dog\.reset\(this\.anchor\)\);\}/);
  assert.match(changed,/this\.previewGround=new CompanionGround\(terrain,\(\)=>this\.dog\)/);
  assert.match(changed,/this\.previewGround\.sampleGround\(x,z,ground\)/);
  assert.match(changed,/this\.previewGround\.anchor\(this\.anchor,rider\)/);
  assert.equal((changed.match(/this\.previewGround\.reset\(\(\)=>this\.dog\.reset\(this\.anchor\)\)/g)||[]).length,3);
  assert.equal((changed.match(/this\.dog\.update\(/g)||[]).length,(source.match(/this\.dog\.update\(/g)||[]).length);
  assert.throws(()=>belleCompanionEdits(source.replace(' relocate(){',' missing(){'),{verify:false}),/exactly one/);
  assert.throws(()=>belleCompanionEdits(source.replace('this.dog.reset(this.anchor);',''),{verify:false}),/exactly three/);
  const main=await readFile(resolve(repoRoot,BELLE_ROOT,'src/belle/main.ts'),'utf8');
  assert.match(applyEdits(main,belleMainEdits(main)),/const companion=new ParkCompanion\(scene,terrain\);registerCompanionProvider\(\(\)=>companion\.previewNavigationPose\);/);
});

test('visual overlap adapters preserve original terrain-height import',async()=>{
  for(const name of ['detroitScene.ts','detroitAssets.ts','detroitProps.ts']){
    const file=BELLE_ROOT+'/src/belle/'+name,source=await readFile(resolve(repoRoot,file),'utf8');
    const changed=applyEdits(source,belleDistrictEdits(source,file));
    assert.match(changed,/from '@dequindre-preview\/visualDistricts'/);
    if(name==='detroitScene.ts')assert.match(changed,/import \{districtHeight\} from '\.\/detroitGround\.ts'/);
  }
  const source=await readFile(resolve(repoRoot,BELLE_ROOT,'src/belle/world.ts'),'utf8');
  assert.match(applyEdits(source,belleWorldEdits(source)),/from '@dequindre-preview\/hostDistrict'/);
});

test('source scenery gets separate settings without mutating host DOM quality',()=>{
  const file=GAME_ROOT+'/swoop-source/src/detroit/fixture.ts';
  const source="const x=document.documentElement.dataset.drawDistance; const y=document.documentElement.dataset.renderQuality==='compact';";
  const changed=applyEdits(source,swoopEdits(source,file));
  assert.match(changed,/globalThis\.__dequindrePreviewSettings\.drawDistance/);
  assert.match(changed,/globalThis\.__dequindrePreviewSettings\.renderQuality==='compact'/);
  assert.doesNotMatch(changed,/document\.documentElement/);
  assert.throws(()=>swoopEdits("document.documentElement.dataset.drawDistance='150'",file),/global quality writer/);
  assert.throws(()=>swoopEdits('',GAME_ROOT+'/swoop-source/src/detroit/main.ts'),/second Swoop entry/);
  assert.deepEqual(swoopEdits(source,BELLE_ROOT+'/src/belle/fixture.ts'),[]);
});

test('Swoop asset roots are isolated without rewriting module or external URLs',()=>{
  const source="import './world.ts'; const a='/exports/tree.glb', b=`/textures/${id}.png`, c='./audio/test.mp3', external='https://example.com/exports/tree.glb';";
  const changed=applyEdits(source,swoopEdits(source,GAME_ROOT+'/swoop-source/src/detroit/fixture.ts'));
  assert.match(changed,/'\/__swoop-assets__\/exports\/tree.glb'/);
  assert.match(changed,/`\/__swoop-assets__\/textures\/\$\{id\}.png`/);
  assert.match(changed,/'\/__swoop-assets__\/audio\/test.mp3'/);
  assert.match(changed,/import '\.\/world.ts'/);
  assert.match(changed,/'https:\/\/example.com\/exports\/tree.glb'/);
});

test('original texture sizes and scene geometry are retained on compact screens',async()=>{
  for(const name of ['compressedGLTFLoader.ts','scenery.ts','foodTrucks.ts']){
    const file=GAME_ROOT+'/swoop-source/src/detroit/'+name,source=await readFile(resolve(repoRoot,file),'utf8');
    const changed=applyEdits(source,swoopEdits(source,file));
    if(name==='compressedGLTFLoader.ts'){
      assert.equal((changed.match(/mobile:false,maxSize:Number.POSITIVE_INFINITY/g)||[]).length,2);
      assert.doesNotMatch(changed,/startupTextureBudget|from '\.\/graphicsQuality\.ts'/);
    }else if(name==='scenery.ts'){
      assert.match(changed,/mobile=\{matches:false\}/);
      assert.match(changed,/prefers-reduced-motion/);
    }else assert.match(changed,/@dequindre-preview\/staticVendorMedia/);
  }
});

test('traffic activation is shared across observers without relaxing source safety thresholds',async()=>{
  const file=GAME_ROOT+'/swoop-source/src/detroit/world.ts',source=await readFile(resolve(repoRoot,file),'utf8');
  const changed=applyEdits(source,swoopEdits(source,file));
  for(const threshold of [180,160])assert.match(changed,new RegExp('previewTrafficDistance\\(x,z,px,pz\\)>'+threshold));
  assert.match(changed,/previewTrafficDistance\(t.x,t.z,px,pz\)>115/);
  assert.match(changed,/previewTrafficDistance\(pos.x,pos.z,px,pz\)>1.5/);
  assert.match(changed,/some\(o=>Math.abs\(o.speed\)>1&&!encounterOptions/);
  assert.match(changed,/this.rejectedEncounters\+\+;continue/);
  assert.equal((changed.match(/createCollider\(/g)||[]).length,(source.match(/createCollider\(/g)||[]).length);
});

test('preview HTML retains original accessible UI and replaces only bootstrap scripts',async()=>{
  const source=await readFile(resolve(repoRoot,BELLE_ROOT,'index.html'),'utf8');
  const changed=previewHtml(source);
  assert.match(changed,/__dequindre-preview-bootstrap__/);
  assert.match(changed,/__dequindre-belle-entry__/);
  assert.equal((changed.match(/id="start"/g)||[]).length,1);
  assert.equal((changed.match(/id="game"/g)||[]).length,1);
  assert.throws(()=>previewHtml(source+' '),/source has changed/);
});

test('preview build cannot write into production or source paths',()=>{
  assert.equal(assertPreviewOutput(outputRoot),outputRoot);
  for(const file of [repoRoot,resolve(repoRoot,'_site'),resolve(repoRoot,BELLE_ROOT,'dist'),previewRoot,resolve(previewRoot,'src'),resolve(previewRoot,'src/dist'),resolve(previewRoot,'package.json')])assert.throws(()=>assertPreviewOutput(file));
});

test('actual candidate has no production changes or deployment path',async()=>{
  const result=await verifyIsolation();
  assert.equal(result.passed,true);assert.equal(result.productionDeployment,false);
});

test('range parser handles media seeks and rejects malformed ranges',()=>{
  assert.deepEqual(parseRange('bytes=2-5',10),{start:2,end:5});
  assert.deepEqual(parseRange('bytes=-3',10),{start:7,end:9});
  assert.deepEqual(parseRange('bytes=4-',10),{start:4,end:9});
  assert.deepEqual(parseRange('bytes=0-99',10),{start:0,end:9});
  for(const range of ['bytes=11-','bytes=5-2','bytes=-0','bytes=','bytes=0-1,3-5'])assert.throws(()=>parseRange(range,10));
});

test('asset server verifies exact bytes, supports real ranges, and blocks escaping symlinks',async()=>{
  const directory=await mkdtemp(join(tmpdir(),'dequindre-assets-'));
  const outside=await mkdtemp(join(tmpdir(),'dequindre-outside-'));
  const content=Buffer.from('0123456789');
  await writeFile(join(directory,'sample.mp3'),content);await writeFile(join(outside,'private.json'),'private');
  await symlink(join(outside,'private.json'),join(directory,'escape.json'));
  const gitBlob=createHash('sha1').update('blob '+content.length+'\0').update(content).digest('hex');
  const middleware=previewAssets([{prefix:'/__swoop-assets__/',directory}],{manifest:{'/__swoop-assets__/sample.mp3':{gitBlob}}});
  const server=createServer((req,res)=>middleware(req,res,()=>res.writeHead(404).end()));
  try{
    await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
    const url='http://127.0.0.1:'+server.address().port;
    const part=await fetch(url+'/__swoop-assets__/sample.mp3',{headers:{Range:'bytes=2-5'}});
    assert.equal(part.status,206);assert.equal(part.headers.get('content-range'),'bytes 2-5/10');assert.equal(await part.text(),'2345');
    assert.equal((await fetch(url+'/__swoop-assets__/escape.json')).status,403);
    const missing=await fetch(url+'/__swoop-assets__/missing.glb');assert.equal(missing.status,404);assert.doesNotMatch(await missing.text(),/<html/i);
    assert.equal((await fetch(url+'/__swoop-assets__/sample.mp3',{headers:{Range:'bytes=50-'}})).status,416);
    await writeFile(join(directory,'sample.mp3'),'changed media');
    assert.equal((await fetch(url+'/__swoop-assets__/sample.mp3')).status,409);
  }finally{await new Promise(resolve=>server.close(resolve));await rm(directory,{recursive:true,force:true});await rm(outside,{recursive:true,force:true});}
});
