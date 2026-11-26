import test from 'node:test';
import assert from 'node:assert/strict';
import pins from './pins.json' with {type:'json'};
import {analyzeBenefit,warmup,measured} from './contract.mjs';
const clone=value=>structuredClone(value);
function fixture(factor=.8){
 const settings={width:1280,height:800,pixelRatio:1,shadowMapSize:2048,shadowEnabled:true,shadowType:1,outputType:1009,antialias:true,stencil:false,
  alpha:true,depth:true,preserveDrawingBuffer:true,outputColorSpace:'srgb',toneMapping:4,exposure:1.02};
 let queryId=0,frame=0;const rows=[],cases=[];
 for(const pinned of pins.cases){
  const camera=clone(pinned.cameraInput),owners=[{sourceId:10,geometryId:20}],samples=[];
  const base=[];
  for(let index=0;index<pinned.baselineCalls;index++)base.push({id:10+index,pass:index===pinned.baselineCalls-1?'shadow':'color',calls:1,
   triangles:index===0?pinned.extraDepthTriangles:index===1?pinned.baselineTriangles-pinned.extraDepthTriangles-(pinned.baselineCalls-2):1,
   world:camera.world,view:camera.view,projection:camera.projection,positionId:30+index,indexId:40+index,start:0,count:index===0?pinned.extraDepthTriangles*3:3});
  for(const phase of ['warmup','measured'])for(const [order,mode]of (phase==='warmup'?warmup:measured).entries()){
   const ns=Math.round((10+order*.03)*(mode==='candidate'?factor:1)*1e6);
   rows.push({id:queryId,allocated:true,begun:true,ended:true,completed:true,resolved:true,deleted:true,status:'valid',nanoseconds:ns,observedNanoseconds:ns,disjointChecks:[false,false,false],error:null});
   const draws=clone(base);if(mode==='candidate')draws.unshift({...clone(base[0]),id:99,triangles:pinned.extraDepthTriangles});
   samples.push({phase,order,mode,queryId:queryId++,cpuMs:1,error:null,beforeCamera:clone(camera),afterCamera:clone(camera),
    beforeOwners:clone(owners),afterOwners:clone(owners),frame:++frame,ownersIntact:true,lines:0,points:0,
    calls:pinned.baselineCalls+(mode==='candidate'?pinned.extraDepthCalls:0),triangles:pinned.baselineTriangles+(mode==='candidate'?pinned.extraDepthTriangles:0),
    draws,depthStats:{supported:true,disposed:false,entries:[{sourceId:10,depthId:99}]}});
  }
  const night=pinned.name.endsWith('-night');
  cases.push({name:pinned.name,cameraInput:camera,owners,samples,settings,gpu:'test GPU',night,shadowAnchor:{point:[10,2,20]},
   lighting:{atmosphereTime:12,sunIntensity:night?.16:3,hemisphereIntensity:night?.24:2.1,lampIntensity:night?600:0,
    sunPosition:[-25,72,55],target:[10,2,20],lampPosition:[14,9,23]},
   assetSha256:pins.files['public/belle/pavement.bin']??'14d16dd1c3148c8ee6132c765e59934b9e86ea79f4607dfd48dd08455feac21b'});
 }
 return{schema:'pavement-depth-benefit/v1',performanceConclusion:null,gpu:'test GPU',settings,cases,
  assetSha256:'14d16dd1c3148c8ee6132c765e59934b9e86ea79f4607dfd48dd08455feac21b',warmupOrder:clone(warmup),measuredOrder:clone(measured),
  expectedCases:6,expectedWarmupSamples:24,expectedMeasuredSamples:96,errors:[],
  queries:{available:true,reason:null,disjoint:false,attempted:120,allocated:120,begun:120,ended:120,completed:120,resolved:120,deleted:120,liveQueries:0,rows}};
}
test('valid improvements, neutral outcomes and regressions all complete without changing eligibility',()=>{
 for(const factor of [.8,1,1.2]){
  const report=fixture(factor),analysis=analyzeBenefit(report);assert.equal(analysis.eligible,true,JSON.stringify(analysis));
  assert.equal(analysis.fullGameAcceptance,false);assert.equal(analysis.cases.length,6);
  for(const row of analysis.cases){assert.equal(row.pairs.length,8);assert.equal(row.baselineGpuMs.n,8);assert.equal(row.candidateGpuMs.n,8);assert(row.drift.baseline);assert(row.drift.candidate);}
  if(factor===1.2)assert(analysis.cases[0].pairedDeltaPercent.mean>0,'a slower result remains valid diagnostic completion');
 }
});
test('requires observed native context alpha rather than the renderer clear-alpha option',()=>{
 const report=fixture();assert.equal(analyzeBenefit(report).eligible,true);
 report.settings.alpha=false;
 const result=analyzeBenefit(report);assert.equal(result.eligible,false);
 assert.match(result.reason,/native r185 context alpha/);assert.equal(result.performanceConclusion,null);
});
test('unavailable, disjoint, failed, unresolved or leaked queries produce no performance conclusion',()=>{
 const edits=[r=>{r.queries.available=false;},r=>{r.queries.disjoint=true;},r=>{r.errors.push('timed out');},
  r=>{r.queries.resolved--;},r=>{r.queries.deleted--;r.queries.liveQueries=1;},r=>{r.queries.rows[5].status='failed';},
  r=>{r.queries.rows[5].nanoseconds=null;},r=>{r.queries.rows[5].nanoseconds=0;},r=>{r.queries.rows[5].disjointChecks[0]=true;}];
 for(const edit of edits){const r=fixture();edit(r);const a=analyzeBenefit(r);assert.equal(a.eligible,false);assert.equal(a.performanceConclusion,null);}
});
test('omitted warmups, selected samples, duplicate query IDs and unbalanced order are rejected',()=>{
 const edits=[r=>r.cases[0].samples.shift(),r=>r.cases[0].samples.pop(),r=>{r.cases[0].samples[5].queryId=0;},
  r=>{r.cases[0].samples[4].mode='candidate';},r=>{r.measuredOrder.reverse();},r=>{r.cases.pop();},r=>{r.queries.rows.pop();}];
 for(const edit of edits){const r=fixture();edit(r);assert.equal(analyzeBenefit(r).eligible,false);}
});
test('swapped query rows or swapped elapsed attribution fail even when every query ID is unique',()=>{
 for(const mode of ['rows','samples']){
  const r=fixture();
  if(mode==='rows')[r.queries.rows[4],r.queries.rows[5]]=[r.queries.rows[5],r.queries.rows[4]];
  else [r.cases[0].samples[4].queryId,r.cases[0].samples[5].queryId]=[r.cases[0].samples[5].queryId,r.cases[0].samples[4].queryId];
  const result=analyzeBenefit(r);assert.equal(result.eligible,false);assert.equal(result.performanceConclusion,null);
 }
});
test('wrong pose, hidden source changes, altered shadows, concealed work and unsupported depth draws are rejected',()=>{
 const edits=[r=>{r.cases[0].cameraInput.world[0]++;},r=>{r.cases[0].samples[3].afterCamera.view[0]++;},
  r=>{r.cases[0].samples[3].afterOwners[0].geometryId++;},r=>{r.cases[0].samples[3].frame++;},
  r=>{r.cases[0].samples[3].draws[0].triangles--;},r=>{r.cases[0].samples[1].calls--;},
  r=>{r.cases[0].samples[1].draws[0].world[0]++;},r=>{r.cases[0].samples[1].draws[0].triangles=0;},
  r=>{r.cases[0].samples[0].draws.at(-1).pass='color';},r=>{r.settings.shadowEnabled=false;},
  r=>{r.settings.toneMapping=0;},r=>{r.cases[0].lighting.sunIntensity=0;},r=>{r.cases[0].lighting.sunPosition[0]++;},
  r=>{r.cases[0].night=true;},r=>{r.cases[0].samples[0].error='GPU fence timed out';}];
 for(const edit of edits){const r=fixture();edit(r);assert.equal(analyzeBenefit(r).eligible,false);}
});
