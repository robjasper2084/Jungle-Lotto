import assert from 'node:assert/strict';
import {test} from 'node:test';
import {readFile} from 'node:fs/promises';
import {ORIGINAL_HARNESS_BLOB,PROTOTYPES,gitBlob,sourceArtifactContract,generatedTimingContract,chooseRockTarget,
 nativeLookPlan,targetFraming,cpuCoverage,diagnosticVerdict} from './polyhaven-native-diagnostic-contract.mjs';
import {nativeTypeaheadPlan} from './native-select-typeahead.mjs';

const identity=()=>[1,0,0,0,0,1,0,0,0,0,1,0,0,0,0,1];
const clone=value=>structuredClone(value);
function reportFixture(){
 const capture={framing:{projectedInside:true},fence:{gpuFence:true},observer:{ready:true,captureInvalidPasses:0},png:{bytes:22000,sha256:'a'.repeat(64),width:1440,height:900}};
 const settings={quality:'high',effectiveQuality:'high',cap:60,pixelRatio:1,adaptiveScale:1,world:{performanceDiagnostic:false}};
 const actual={quality:'high',cap:60,hour:12,clouds:'clear',cycle:false,lookSensitivity:1,focused:true,visibility:'visible',reducedMotion:true,viewport:[1440,900,1],url:'http://127.0.0.1:777/?profile=manual'};
 const buildMarker={commit:'1'.repeat(40),indexSha256:'a'.repeat(64),buildId:'run77',profileQuery:'manual'},build={status:'available',source:'same-origin build marker',marker:buildMarker};
 return {diagnosticOnly:true,releaseAcceptance:false,hostPlatform:'darwin',renderer:'ANGLE Apple Metal',errors:[],failedRequests:[],
  url:actual.url,settingsAtStart:clone(actual),settingsAtEnd:clone(actual),window:{startMs:1000,endMs:21000},buildMarker,
  source:{head:'1'.repeat(40),tree:'2'.repeat(40),harness:{gitBlob:ORIGINAL_HARNESS_BLOB}},guide:{destination:'Nashua Canal',trusted:true},
  looks:[0,1,2].map(shape=>({shape,trusted:true,capture:clone(capture)})),afterCapture:clone(capture),
  manualProfile:{stopReason:'manual',frames:600,activeSeconds:20,hiddenSeconds:0,droppedFrameSamples:0,viewport:[1440,900,1],settingsAtStart:clone(settings),settings:clone(settings),build:clone(build),buildAtStart:clone(build),
   submissionInstrumentation:{atStart:{status:'complete'},atFinish:{status:'complete'}},submissionDiagnostics:{profiledCallbacks:600,invalidDiagnosticSamples:0},metrics:{frameMs:{p95:83}},over250ms:2},
  receiptWindow:{active:false,startedAtMs:500,finishedAtMs:21500,renderInvocations:600,directInvocations:300000,wrongReceivers:0,renderThrows:0,directThrows:0},
  cpu:{coverage:{errors:[],samplesDuringWindow:15000}},consumedScripts:[{verified:true}],consumedAssets:PROTOTYPES.map(([,file])=>({file,verified:true})),
  inputs:{untrusted:0,dropped:0,errors:[],rows:['Start 10-minute capture','Stop and show report'].map(text=>({text,type:'click',trusted:true}))}};
}
test('a complete diagnostic retains bad frame metrics and can never certify performance or appearance',()=>{
 const report=reportFixture(),result=diagnosticVerdict(report);assert.equal(result.collectionComplete,true);
 assert.equal(result.releaseAcceptance,false);assert.equal(result.performanceAccepted,null);assert.equal(result.appearanceAccepted,null);assert.equal(result.collisionAccepted,null);
 assert.equal(result.observedManualP95Ms,83);assert.equal(result.observedManualIntervalsOver250ms,2);
});
test('diagnostic source, native input, image, renderer, quality and coverage failures fail closed',()=>{
 const corruptions=[
  r=>r.releaseAcceptance=true,r=>r.source.harness.gitBlob='0'.repeat(40),r=>r.source.head=null,
  r=>r.renderer='SwiftShader',r=>r.hostPlatform='linux',r=>r.guide.trusted=false,r=>r.guide.destination='Somewhere else',
  r=>r.looks.pop(),r=>r.looks[0].trusted=false,r=>r.looks[1].capture.framing.projectedInside=false,
  r=>r.looks[0].capture.observer.captureInvalidPasses=1,r=>r.afterCapture.fence.gpuFence=false,r=>r.afterCapture.png.width=1280,
  r=>r.manualProfile.stopReason='trusted-W-keyup',r=>r.manualProfile.activeSeconds=4,r=>r.manualProfile.hiddenSeconds=.1,
  r=>r.manualProfile.viewport[2]=2,r=>r.manualProfile.settings.quality='smooth',r=>r.manualProfile.settingsAtStart.cap=30,
  r=>r.manualProfile.settings.world.performanceDiagnostic=true,r=>r.manualProfile.submissionInstrumentation.atStart.status='partial',
  r=>r.manualProfile.submissionDiagnostics.invalidDiagnosticSamples=1,r=>r.receiptWindow.active=true,r=>r.receiptWindow.renderThrows=1,
  r=>r.receiptWindow.wrongReceivers=1,r=>r.cpu.coverage.errors.push('missing actual sample'),r=>r.consumedScripts=[],
  r=>r.consumedAssets[1].file='substitute.glb',r=>r.consumedAssets[0].verified=false,r=>r.inputs.untrusted=1,
  r=>r.inputs.dropped=1,r=>r.inputs.rows=[],r=>r.window.endMs=18000,r=>r.receiptWindow.startedAtMs=1100,r=>r.receiptWindow.finishedAtMs=20900,
  r=>r.settingsAtStart.clouds='overcast',r=>r.settingsAtEnd.focused=false,r=>r.settingsAtEnd.lookSensitivity=2,r=>r.manualProfile.build.marker.commit='4'.repeat(40),r=>r.manualProfile.buildAtStart.status='unavailable',
  r=>r.errors.push('page error'),r=>r.failedRequests.push('404'),
 ];
 for(const mutate of corruptions){const report=reportFixture();mutate(report);assert.equal(diagnosticVerdict(report).collectionComplete,false,String(mutate));}
});
test('source artifact binding requires the original driver and exact same-run source/staged/built bytes',async()=>{
 const harness=await readFile(new URL('./sustained-ride-profile.mjs',import.meta.url));assert.equal(gitBlob(harness),ORIGINAL_HARNESS_BLOB);
 const value={head:'1'.repeat(40),tree:'2'.repeat(40),expectedHead:'1'.repeat(40),artifact:{head:'1'.repeat(40),tree:'2'.repeat(40),runId:'77'},runId:'77',harness,
  assets:PROTOTYPES.map(([folder,file],i)=>({folder,file,source:Buffer.from('original '+i),staged:Buffer.from('original '+i),built:Buffer.from('original '+i)})),
  manifest:PROTOTYPES.map(([,file])=>'belle/polyhaven-review/'+file)};
 assert.equal(sourceArtifactContract(value).assets.length,3);
 for(const patch of [{expectedHead:'3'.repeat(40)},{artifact:{...value.artifact,tree:'4'.repeat(40)}},{runId:'78'},{harness:Buffer.from('edited driver')},{manifest:[]}])assert.throws(()=>sourceArtifactContract({...value,...patch}));
 for(const kind of ['staged','built']){const assets=value.assets.map(row=>({...row}));assets[1][kind]=Buffer.from('altered');assert.throws(()=>sourceArtifactContract({...value,assets}));}
});
test('only known generated build timing is allowed to change',()=>{
 const before=Buffer.from('{"buildMs":1,"triangles":42}'),after=Buffer.from('{"triangles":42,"buildMs":2}');
 assert.equal(generatedTimingContract(before,after).onlyBuildMsChanged,true);
 assert.throws(()=>generatedTimingContract(before,Buffer.from('{"buildMs":2,"triangles":41}')));
 assert.throws(()=>generatedTimingContract(before,Buffer.from('{"triangles":42}')));
});
test('native targets use actual position layout and owner transforms; clipped bases fail framing',()=>{
 const world=identity(),instance=identity();instance[14]=-20;
 const camera={position:[0,0,0],matrixWorld:identity(),matrixWorldInverse:identity(),projectionMatrix:[1,0,0,0,0,1,0,0,0,0,-1,-1,0,0,-.2,0]};
 const values=new Float32Array([99,-1,-1,-1,88,99,1,1,1,88]);
 const resources=[{key:'g',attributes:[{name:'position',arrayType:'Float32Array',itemSize:3,count:2,interleaved:true,stride:5,offset:1,bytes:Array.from(new Uint8Array(values.buffer))}]}];
 const snapshot={latest:{camera,rockDraws:[{object:{id:7,name:'Clustered mapped mineral boulders 0 near'},submitted:{calls:1},count:1,geometryResource:'g',instanceMatrix:instance,matrixWorld:world}]}};
 const target=chooseRockTarget(snapshot,resources,0);assert.deepEqual(target.position,[0,0,-20]);assert.deepEqual(target.basePosition,[0,-1,-20]);
 assert.equal(targetFraming(camera,target).projectedInside,true);assert.equal(targetFraming(camera,{...target,basePosition:[0,-21,-20]}).projectedInside,false);
 const plan=nativeLookPlan(camera,{...target,position:[-20,0,0]});assert(plan.from.x>=100&&plan.to.x<=1340);assert.equal(plan.steps,16);
 assert.throws(()=>chooseRockTarget(snapshot,resources,1),/No actual/);const short=clone(resources);short[0].attributes[0].bytes.pop();assert.throws(()=>chooseRockTarget(snapshot,short,0),/Incomplete/);
});
test('CPU clock coverage uses actual samples, preserves signed gaps and rejects bounds-only evidence',()=>{
 const window={startMs:1000,endMs:21000},a={beforeMs:900,afterMs:1100,timestampSeconds:1},b={beforeMs:20900,afterMs:21100,timestampSeconds:21};
 const deltas=[500000,...Array(21).fill(1000000),500000],cpu={startTime:0,endTime:22000000,nodes:[{id:1}],samples:deltas.map(()=>1),timeDeltas:deltas};
 let result=cpuCoverage(cpu,window,a,b);assert.deepEqual(result.errors,[]);assert(result.samplesDuringWindow>0);
 const signed=clone(cpu);signed.timeDeltas.splice(3,1,-1000,1001000);signed.samples.push(1);result=cpuCoverage(signed,window,a,b);
 assert.deepEqual(result.errors,[]);assert.equal(result.negativeDeltas,1);assert.equal(result.minimumRawDeltaUs,-1000);assert.equal(result.maximumRawDeltaUs,1001000);
 const onlyBounds={...cpu,samples:[1,1],timeDeltas:[500000,21500000]};assert(cpuCoverage(onlyBounds,window,a,b).errors.some(s=>s.includes('Actual CPU')));
 assert(cpuCoverage({...cpu,samples:cpu.samples.map(()=>2)},window,a,b).errors.length>0);
 assert(cpuCoverage(cpu,{...window,endMs:20000},a,b).errors.length>0);
 assert(cpuCoverage(cpu,window,a,{...b,timestampSeconds:23}).errors.length>0);
});
test('settings are chosen through closed native typeahead without scripting a selected value',()=>{
 const options=[{value:'smooth',label:'Smooth'},{value:'automatic',label:'Automatic'},{value:'high',label:'High'}];
 assert.deepEqual(nativeTypeaheadPlan(options,'automatic','high'),[{value:'high',prefix:'h'}]);
 assert.equal(nativeTypeaheadPlan(options,'high','high').length,2);
 assert.throws(()=>nativeTypeaheadPlan([...options,{value:'high',label:'Duplicate'}],'automatic','high'),/Ambiguous/);
});
test('a CPU sample only in clock uncertainty cannot prove activity inside the real window',()=>{
 const window={startMs:1000,endMs:21000},a={beforeMs:900,afterMs:1100,timestampSeconds:1},b={beforeMs:20900,afterMs:21100,timestampSeconds:21};
 const cpu={startTime:0,endTime:22000000,nodes:[{id:1}],samples:[1,1,1],timeDeltas:[500000,450000,20550000]};
 const result=cpuCoverage(cpu,window,a,b);
 assert.deepEqual(result.windowBoundsUs,[900000,21100000]);assert.deepEqual(result.guaranteedWindowBoundsUs,[1100000,20900000]);
 assert.equal(result.samplesWithinOuterBounds,1);assert.equal(result.samplesDuringWindow,0);
 assert(result.errors.some(error=>error.includes('Actual CPU samples')));
});
