import assert from 'node:assert/strict';
import test from 'node:test';
import {createHash} from 'node:crypto';
import {mkdtemp,rm,writeFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {resolve} from 'node:path';
import {compareGalleries,expectedVisits,verifyImages} from './polyhaven-gallery-comparison.mjs';

const head='1'.repeat(40),tree='2'.repeat(40);
function fixture(device='desktop'){
 const viewport=device==='phone'?{width:390,height:844}:{width:1440,height:900};
 return Object.fromEntries(['baseline','candidate'].map(mode=>[mode,{mode,sourceHead:head,sourceTree:tree,
  previewFlag:mode==='candidate'?'1':'0',buildStatus:0,captureStatus:0,errors:[],gallery:{head,sourceTree:tree,mode,hostPlatform:'darwin',renderer:'ANGLE (Apple, ANGLE Metal Renderer: Apple M1, Unspecified Version)',
   device,viewport,browserViewport:{...viewport,devicePixelRatio:1},route:'belle-four-zone-visual-audit',quick:true,qualities:[device==='phone'?'smooth':'high'],
   passed:true,errors:[],failedRequests:[],coverageGaps:[],visits:expectedVisits(device).map(stop=>({...stop,passed:true,frame:{gpuFence:true},screenshot:stop.id+'.png',screenshotBytes:20000,sha256:'3'.repeat(64),
    settings:{quality:stop.quality,time:String(stop.time),clouds:stop.clouds,cycle:false,cap:device==='phone'?'30':'60',focused:true,visibility:'visible'},profileData:{quality:stop.quality},
    rockReview:mode==='candidate'?{state:'loaded',loaded:true,visible:device==='phone'?0:1}:{state:null,loaded:false,visible:0}}))
  }}]));
}
const compare=(captures,device='desktop')=>compareGalleries(captures,{head,tree,device});

test('complete native evidence stays explicitly pending manual visual and pose review',()=>{
 for(const device of ['desktop','phone']){
  const result=compare(fixture(device),device);
  assert.deepEqual(result.errors,[]);
  assert.equal(result.automatedEvidencePassed,true);
  assert.equal(result.pairs.length,8);
  assert.ok(result.pairs.every(pair=>pair.guideSettingsMatch&&pair.cameraEquivalence==='unverified'));
  assert.equal(result.manualReviewRequired,true);
  assert.equal(result.visualOverlapAccepted,null);
  assert.equal(result.collisionBehaviorAccepted,null);
 }
});

test('comparator rejects provenance, mode, renderer, dimensions, capture and route failures',()=>{
 const cases=[
  ['source mismatch',x=>{x.candidate.sourceTree='4'.repeat(40);}],
  ['build mode mismatch',x=>{x.baseline.previewFlag='1';}],
  ['gallery source/mode mismatch',x=>{x.candidate.gallery.head='4'.repeat(40);}],
  ['native Mac Metal required',x=>{x.candidate.gallery.renderer='SwiftShader';}],
  ['native Mac Metal required',x=>{x.candidate.gallery.hostPlatform='linux';}],
  ['viewport or DPR mismatch',x=>{x.candidate.gallery.browserViewport.devicePixelRatio=2;}],
  ['viewport or DPR mismatch',x=>{x.candidate.gallery.browserViewport.width=390;}],
  ['build or capture failed',x=>{x.baseline.captureStatus=1;}],
  ['image file missing',x=>{x.candidate.errors.push('image file missing');}],
  ['gallery not passed',x=>{x.baseline.gallery.passed=false;}],
  ['errors not empty',x=>{x.candidate.gallery.errors.push('WebGL error');}],
  ['failedRequests not empty',x=>{x.candidate.gallery.failedRequests.push('HTTP failure');}],
  ['missing or duplicate visits',x=>{x.candidate.gallery.visits.pop();}],
  ['missing or duplicate visits',x=>{x.candidate.gallery.visits[1]=x.candidate.gallery.visits[0];}],
  ['Guide route or lighting mismatch',x=>{x.candidate.gallery.visits[0].destination='Wrong Guide destination';}],
  ['actual settings mismatch',x=>{x.candidate.gallery.visits[0].settings.time='17.8';}],
  ['capture not foreground',x=>{x.candidate.gallery.visits[0].settings.focused=false;}],
  ['missing genuine painted capture',x=>{x.candidate.gallery.visits[0].frame.gpuFence=false;}],
  ['image receipt missing',x=>{x.candidate.gallery.visits[0].screenshot='../wrong.png';}],
  ['preview active in baseline',x=>{x.baseline.gallery.visits[0].rockReview={state:'loaded',loaded:true,visible:1};}],
  ['source prototypes not loaded',x=>{x.candidate.gallery.visits[0].rockReview.loaded=false;}],
  ['no desktop visit displays',x=>{for(const v of x.candidate.gallery.visits)v.rockReview.visible=0;}]
 ];
 for(const [expected,mutate] of cases){
  const captures=fixture();mutate(captures);const result=compare(captures);
  assert.equal(result.automatedEvidencePassed,false,expected);
  assert.ok(result.errors.some(error=>error.includes(expected)),expected+': '+result.errors.join('; '));
 }
 const missing=compare({});assert.equal(missing.automatedEvidencePassed,false);
});

test('phone Smooth requires loaded prototypes with zero visible preview instances',()=>{
 const captures=fixture('phone');
 captures.candidate.gallery.visits[0].rockReview.visible=1;
 assert.ok(compare(captures,'phone').errors.some(x=>x.includes('Smooth unexpectedly displays')));
 captures.candidate.gallery.visits[0].rockReview.visible=0;
 captures.candidate.gallery.visits[0].rockReview.state=null;
 assert.ok(compare(captures,'phone').errors.some(x=>x.includes('source prototypes not loaded')));
});

test('image receipts reject missing files, altered bytes and wrong PNG dimensions',async()=>{
 const directory=await mkdtemp(resolve(tmpdir(),'polyhaven-evidence-'));
 try{
  // Structural fixture only: real screenshots are produced by the GPU-fenced gallery.
  const bytes=Buffer.alloc(20000);Buffer.from([137,80,78,71,13,10,26,10]).copy(bytes);
  bytes.write('IHDR',12);bytes.writeUInt32BE(1440,16);bytes.writeUInt32BE(900,20);
  const visit={screenshot:'capture.png',screenshotBytes:bytes.length,sha256:createHash('sha256').update(bytes).digest('hex')};
  const report={visits:[visit]};
  await assert.rejects(verifyImages(report,directory,'desktop'),{code:'ENOENT'});
  await writeFile(resolve(directory,visit.screenshot),bytes);
  await verifyImages(report,directory,'desktop');
  await assert.rejects(verifyImages(report,directory,'phone'),/viewport width mismatch/);
  bytes[100]=1;await writeFile(resolve(directory,visit.screenshot),bytes);
  await assert.rejects(verifyImages(report,directory,'desktop'),/hash receipt mismatch/);
 }finally{await rm(directory,{recursive:true,force:true});}
});
