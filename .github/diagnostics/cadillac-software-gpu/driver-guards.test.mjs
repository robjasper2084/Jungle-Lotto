import assert from 'node:assert/strict';
import {test} from 'node:test';
import {mkdtemp,readFile,rm,writeFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {resolve} from 'node:path';
import {deriveNativeSetup} from './derive-native-setup.mjs';
import {manifest,verifyManifest,verifyArtifactMetadata,pins} from './provenance.mjs';
import {validateDom,validateObservation} from './validate-observation.mjs';

function sample(){
 const counts={calls:1,triangles:10,lines:0,points:0},zero={calls:0,triangles:0,lines:0,points:0};
 return{ready:true,armed:true,limits:{frames:3},coverage:{renderer:true,render:true,direct:true,fenceSync:true,clientWaitSync:true,deleteSync:true},nestedRenders:0,nestedDirectCalls:0,nativeRenderer:'ANGLE SwiftShader',errors:[],overflow:false,completedFrames:3,
  timer:{status:'unavailable'},pendingQueries:0,frames:[0,1,2].map(i=>({
   startedAtMs:i*10,submittedAtMs:i*10+1,completion:{status:'complete',fenceObservedAtMs:i*10+2,completedAtMs:i*10+3},
   rendererFrameBefore:i,rendererFrameAfter:i+1,threw:false,objects:[{submitted:{...counts}}],
   observedTotals:{...counts},observedColorTotals:{...counts},observedShadowTotals:{...zero},nativeEndTotals:{...counts}}))};
}
const dom={width:1280,height:800,dpr:1,quality:'smooth',fps:'30',reducedMotion:true,settingsVisible:false,atStart:false,ride:'CADILLAC'};
const input=[{type:'click',target:'start-label',control:'start',trusted:true},{type:'keydown',target:'quality',trusted:true},{type:'keydown',target:'fps',trusted:true}];

test('Three completed frames with unavailable optional GPU timings remain an honest diagnostic',()=>{
 const result=validateObservation(sample(),dom,input);assert.equal(result.completedFrames,3);assert.equal(result.timerStatus,'unavailable');
});
test('Missing native completion cannot be counted as a completed frame',()=>{
 const a=sample();a.frames[2].completion.status='pending';assert.throws(()=>validateObservation(a,dom,input));
 const b=sample();b.completedFrames=2;assert.throws(()=>validateObservation(b,dom,input));
});
test('Per-object and original native renderer counters must conserve every draw',()=>{
 const a=sample();a.frames[0].objects[0].submitted.triangles=9;assert.throws(()=>validateObservation(a,dom,input));
 const b=sample();b.frames[0].nativeEndTotals.calls=2;assert.throws(()=>validateObservation(b,dom,input));
 const c=sample();c.frames[0].observedShadowTotals.calls=1;assert.throws(()=>validateObservation(c,dom,input));
});
test('Synthetic events and missing original selector controls cannot be accepted',()=>{
 assert.throws(()=>validateObservation(sample(),dom,input.map((e,i)=>({...e,trusted:i!==1}))));
 assert.throws(()=>validateObservation(sample(),dom,input.filter(e=>e.target!=='fps')));
});
test('Viewport, backend and original settings substitutions fail',()=>{
 for(const change of [{width:640},{height:400},{dpr:.5},{quality:'automatic'},{fps:'60'},{reducedMotion:false},{settingsVisible:true},{atStart:true}])assert.throws(()=>validateObservation(sample(),{...dom,...change},input));
 const a=sample();a.nativeRenderer='Apple Metal';assert.throws(()=>validateObservation(a,dom,input));
 assert.equal(validateDom(dom),true);assert.throws(()=>validateDom({...dom,quality:'automatic'}),'The same settings validation must work before the observer is armed');
});
test('Overflow, observer errors and unadvanced frames fail',()=>{
 const a=sample();a.overflow=true;assert.throws(()=>validateObservation(a,dom,input));
 const b=sample();b.errors=['missed draw'];assert.throws(()=>validateObservation(b,dom,input));
 const c=sample();c.frames[1].rendererFrameAfter=c.frames[1].rendererFrameBefore;assert.throws(()=>validateObservation(c,dom,input));
 const d=sample();d.coverage.fenceSync=false;assert.throws(()=>validateObservation(d,dom,input));
 const e=sample();e.nestedRenders=1;assert.throws(()=>validateObservation(e,dom,input));
 const f=sample();f.nestedDirectCalls=1;assert.throws(()=>validateObservation(f,dom,input));
});
test('Artifact pins reject another build or reused artifact name',()=>{
 const value={id:pins.artifact.id,name:pins.artifact.name,size_in_bytes:pins.artifact.bytes,digest:'sha256:'+pins.artifact.sha256,expired:false,
  workflow_run:{id:pins.originalRun,head_sha:pins.applicationSource}};
 verifyArtifactMetadata(value);
 for(const replacement of [{id:1},{digest:'sha256:'+ '0'.repeat(64)},{expired:true},{size_in_bytes:10},{workflow_run:{id:pins.originalRun,head_sha:'0'.repeat(40)}}])assert.throws(()=>verifyArtifactMetadata({...value,...replacement}));
});
test('Build manifest detects both changed bytes and extra files',async()=>{
 const dir=await mkdtemp(resolve(tmpdir(),'software-gpu-manifest-'));
 try{
  await writeFile(resolve(dir,'index.html'),'original');const before=await manifest(dir);await verifyManifest(dir,before);
  await writeFile(resolve(dir,'index.html'),'modified');await assert.rejects(verifyManifest(dir,before));
  await writeFile(resolve(dir,'index.html'),'original');await writeFile(resolve(dir,'extra.txt'),'extra');await assert.rejects(verifyManifest(dir,before));
 }finally{await rm(dir,{recursive:true,force:true});}
});
test('Initialization and capture functions come verbatim from the exact original driver',async()=>{
 assert(process.env.APP_GAME,'APP_GAME must identify the immutable source checkout for this source-equivalence test');
 const source=await readFile(resolve(process.env.APP_GAME,'scripts/cadillac-mods-browser-smoke.mjs'),'utf8');
 const derived=deriveNativeSetup(source);assert.equal(derived.receipts.length,7);
 for(const receipt of derived.receipts)assert(derived.module.includes(source.slice(receipt.startByte,receipt.endByte)));
 assert.match(derived.module,/await press\(control,'Home'\)/);
 assert.match(derived.module,/paintOpportunities:2/);
 assert.match(derived.module,/nativeInput\.tapStart\(locator,mobile\)/);
 assert.throws(()=>deriveNativeSetup(source+'\n'),'One-byte source drift must fail before derivation');
});
