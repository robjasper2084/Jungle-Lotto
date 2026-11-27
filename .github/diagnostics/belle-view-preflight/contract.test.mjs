import assert from 'node:assert/strict';
import test from 'node:test';
import {PIN,SITES,assertPins,buildOutputContract,verifyArtifactMetadata,isGameUrl,assertObservation,assertGraphics,assertNativeEvidence,assertConsumedResponses,assertDurationOnlyBuildReceipt} from './contract.mjs';
import {CASE_MS,CLEANUP_MS,CaseBudget,cleanupWithin} from './budget.mjs';
import {rawJson,parseRaw,evidencePath} from './evidence.mjs';
import {gridShape} from './grid-capture.mjs';

const clone=value=>structuredClone(value);
function fixtureObservation(){
 const bounds={min:[-1,0,-1],max:[1,2,1],center:[0,1,0]},camera={fov:75,aspect:1.6,position:[3,2,4],direction:[0,0,1]},shape=gridShape(bounds,camera);
 const exterior={id:SITES[0].id,ready:true,bounds,camera,selectedLevels:[0]};
 const observation={version:1,id:SITES[0].id,target:bounds,camera:clone(camera),selectedLevels:[0],range:shape.range+shape.radius,boxes:[],unsupported:[],verticesRead:0,refinementVerticesRead:0,refinedMeshGroups:0,refinementSteps:0,indexBlocksRead:0,indexBlocksRetained:0,clippingPlanesRead:0,selectedTreePools:2,selectedTreeInstances:4,selectedTreeMatrixElements:64,currentRenderedTreeInstances:1};
 return{exterior,observation};
}
function fixtureNative(){
 const events=[{type:'click',target:'#start'}],sites=[];
 for(const [i,site]of SITES.entries()){
  events.push({type:'click',landmark:site.title,text:site.action},{type:'keydown',code:'KeyF',phase:'dismount-'+site.id},{type:'keyup',code:'KeyF',phase:'dismount-'+site.id});
  const receipt={changed:i===0,phase:'first-person-'+site.id,before:{actor:{firstPerson:i!==0}},after:{actor:{firstPerson:true}}};sites.push({id:site.id,nativeFirstPerson:receipt});
  if(receipt.changed)events.push({type:'keydown',code:'KeyV',phase:receipt.phase},{type:'keyup',code:'KeyV',phase:receipt.phase});
 }
 return{sites,evidence:{events:events.map((row,i)=>({trusted:true,at:i+1,...row})),overflow:false,held:[],focusLossDuringInput:[],traces:{}}};
}
test('only the reviewed future fixed source can run; unresolved and historical pins fail closed',()=>{
 assert.equal(assertPins(),PIN);
 for(const mutation of [pin=>pin.state='awaiting-fixed-source-commit',pin=>pin.head=null,pin=>pin.head='28ca0a857cc114a976c86fd0bd6fc86c93747e62',pin=>pin.sourceFiles.pop()]){const pin=clone(PIN);mutation(pin);assert.throws(()=>assertPins(pin));}
});
test('same-run build identity requires actual artifact, index and inventory outputs',()=>{
 const env={PREFLIGHT_BUILD_ARTIFACT_ID:'123',GITHUB_RUN_ID:'456',PREFLIGHT_BUILD_ARTIFACT_SHA256:'a'.repeat(64),PREFLIGHT_BUILD_INVENTORY_SHA256:'b'.repeat(64),PREFLIGHT_BUILD_INDEX_SHA256:'c'.repeat(64),DIAGNOSTIC_EXPECTED_HEAD:'d'.repeat(40)};
 const binding=buildOutputContract(env),metadata={id:123,name:PIN.artifactName,expired:false,workflow_run:{id:456,head_sha:'d'.repeat(40)},digest:'sha256:'+'a'.repeat(64),size_in_bytes:12345};verifyArtifactMetadata(metadata,binding);
 for(const key of Object.keys(env)){const bad={...env};delete bad[key];assert.throws(()=>buildOutputContract(bad));}
 for(const mutate of [m=>m.workflow_run.id++,m=>m.workflow_run.head_sha='e'.repeat(40),m=>m.digest='sha256:'+'f'.repeat(64),m=>m.expired=true,m=>m.name='belle-staged-architecture-verified-build']){const bad=clone(metadata);mutate(bad);assert.throws(()=>verifyArtifactMetadata(bad,binding));}
});
test('exact original staged proof URL is required, with no alternate modes or flags',()=>{
 assert(isGameUrl('http://127.0.0.1:1234/?stagedArchitectureProof=1&profile=1'));
 for(const url of ['http://127.0.0.1:1234/?profile=1','http://127.0.0.1:1234/?profile=1&locationPerf=1','http://127.0.0.1:1234/?profile=1&stagedArchitectureProof=1&reduced=1','https://example.com/?profile=1&stagedArchitectureProof=1'])assert.equal(isGameUrl(url),false);
});
test('lossless raw records preserve nonfinite terrain values, undefined and negative zero',()=>{
 const value={rows:[{height:NaN,x:-0,z:Infinity,hits:[null,-Infinity,undefined]}],missing:undefined};const result=parseRaw(rawJson(value));
 assert.deepEqual(result,value);assert(Object.is(result.rows[0].x,-0));assert(Object.hasOwn(result,'missing'));
 assert.throws(()=>rawJson({$bellePreflightScalar:'NaN'}));assert.throws(()=>parseRaw('{"$bellePreflightScalar":"bogus"}'));
});
test('raw evidence paths cannot escape their retained directory',()=>{
 assert.equal(evidencePath('/tmp/evidence','aquarium/grid-000.json'),'/tmp/evidence/aquarium/grid-000.json');
 for(const path of ['../escape','/absolute','a/../x','a//x','a\\x','./x'])assert.throws(()=>evidencePath('/tmp/evidence',path));
});
test('fixed observation requires complete tree-source counters and original work envelopes',()=>{
 const {exterior,observation}=fixtureObservation();assertObservation(observation,SITES[0].id,exterior);
 for(const mutate of [o=>delete o.selectedTreeInstances,o=>o.selectedTreeMatrixElements--,o=>o.selectedTreeInstances=40001,o=>o.refinementSteps=1000001,o=>o.verticesRead=20000001,o=>o.range++,o=>o.boxes=Array(40001).fill({})]){
  const bad=clone(observation);mutate(bad);assert.throws(()=>assertObservation(bad,SITES[0].id,exterior));
 }
});
test('atomic original view/exterior camera pose, projection and active LOD must match',()=>{
 const {exterior,observation}=fixtureObservation();assertObservation(observation,SITES[0].id,exterior);
 for(const mutate of [o=>o.camera.position[1]+=.000001,o=>o.camera.fov++,o=>o.selectedLevels=[1]]){const bad=clone(observation);mutate(bad);assert.throws(()=>assertObservation(bad,SITES[0].id,exterior));}
});
test('normal graphics are observed at the original automatic/60/automatic values without selecting alternatives',()=>{
 assertGraphics({quality:'automatic',fps:'60',antiAliasing:'automatic'});for(const bad of [{quality:'High',fps:'60',antiAliasing:'automatic'},{quality:'automatic',fps:'30',antiAliasing:'automatic'},{quality:'automatic',fps:'60',antiAliasing:'off'}])assert.throws(()=>assertGraphics(bad));
});
test('unsupported geometry is preserved as raw advice without creating visibility acceptance',()=>{
 const {exterior,observation}=fixtureObservation();observation.unsupported=[{mesh:'animated-tree',reason:'Unresolved deformation'}];assertObservation(observation,SITES[0].id,exterior);assert.equal(observation.unsupported.length,1);
});
test('native receipt requires both public arrivals, dismounts and any necessary V transition',()=>{
 const {evidence,sites}=fixtureNative();assertNativeEvidence(evidence,sites);
 for(const mutate of [e=>e.events.find(x=>x.code==='KeyV').trusted=false,e=>e.events.find(x=>x.code==='KeyF').code='KeyW',e=>e.events.filter(x=>x.code==='KeyF').forEach(x=>x.phase='dismount-'+SITES[0].id),e=>e.events.find(x=>x.landmark).text='Teleport',e=>e.held=['KeyF'],e=>e.overflow=true,e=>e.focusLossDuringInput.push({reason:'blur'}),e=>e.events=e.events.filter(x=>x.code!=='KeyV')]){
  const bad=clone(evidence);mutate(bad);assert.throws(()=>assertNativeEvidence(bad,sites));
 }
});
test('actual consumed document, entry and main bytes must all match the immutable inventory',()=>{
 const url='http://127.0.0.1:1234/?profile=1&stagedArchitectureProof=1',files=[{file:'index.html',bytes:10,sha256:'a'.repeat(64)},{file:'assets/index-x.js',bytes:20,sha256:'b'.repeat(64)},{file:'assets/main-x.js',bytes:30,sha256:'c'.repeat(64)}];
 const input={files,build:{entryScripts:['assets/index-x.js'],mainScript:'assets/main-x.js'}},rows=files.map(row=>({url:row.file==='index.html'?url:'http://127.0.0.1:1234/'+row.file,status:200,fromServiceWorker:false,bytes:row.bytes,sha256:row.sha256}));
 assertConsumedResponses(rows,input,url);for(const mutate of [r=>r.pop(),r=>r[2].sha256='d'.repeat(64),r=>r[1].url='https://example.com/assets/index-x.js',r=>r[0].status=304,r=>r[2].fromServiceWorker=true]){const bad=clone(rows);mutate(bad);assert.throws(()=>assertConsumedResponses(bad,input,url));}
});
test('ten-minute budget refuses a late action and remains stopped after a deadline',async()=>{
 let now=0,calls=0;const budget=new CaseBudget({now:()=>now});assert.equal(budget.remaining(),CASE_MS);await budget.run('first',()=>{calls++;return 1;});
 now=CASE_MS;await assert.rejects(()=>budget.run('late',()=>calls++));assert.equal(calls,1);budget.stop();now=0;assert.throws(()=>budget.check());
});
test('an operation that crosses the absolute case bound cannot report success',async()=>{
 let now=0;const budget=new CaseBudget({now:()=>now});await assert.rejects(()=>budget.run('overrun',()=>{now=CASE_MS;return 'finished';}));
});
test('cleanup has one absolute thirty-second bound rather than resetting after failure',async()=>{
 let now=0,later=false;const receipt=await cleanupWithin([{name:'first',maximumMs:10000,run:()=>{now=CLEANUP_MS;throw Error('failed cleanup');}},{name:'later',maximumMs:10000,run:()=>{later=true;}}],{now:()=>now});
 assert.equal(later,false);assert.equal(receipt.complete,false);assert.equal(receipt.steps[1].error,'Absolute cleanup deadline exhausted');
});
test('original build duration may change only as a finite nonnegative number',()=>{
 const baseline={boxes:46034,signs:55,buildMs:3601.5,notes:['unchanged']},original=JSON.stringify(baseline);
 assert.deepEqual(assertDurationOnlyBuildReceipt(original,JSON.stringify({...baseline,buildMs:12.3})),{originalBuildMs:3601.5,generatedBuildMs:12.3});
 for(const generated of [{...baseline,boxes:1},{...baseline,notes:['changed']},{...baseline,extra:true},{...baseline,buildMs:-1},{...baseline,buildMs:null},{...baseline,buildMs:'12'}])assert.throws(()=>assertDurationOnlyBuildReceipt(original,JSON.stringify(generated)));
});
