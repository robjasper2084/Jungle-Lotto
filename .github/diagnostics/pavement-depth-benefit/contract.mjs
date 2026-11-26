import assert from 'node:assert/strict';
import pins from './pins.json' with {type:'json'};
export const warmup=['baseline','candidate','candidate','baseline'];
const cycle=['baseline','candidate','candidate','baseline','candidate','baseline','baseline','candidate'];
export const measured=[...cycle,...cycle];
export const names=['original-software-start-day','original-software-start-night','island-landing-day','island-landing-night','island-far-road-day','island-far-road-night'];
const sum=(rows,key)=>rows.reduce((value,row)=>value+row[key],0);
function summary(values){
 const sorted=values.slice().sort((a,b)=>a-b),mean=values.reduce((a,b)=>a+b,0)/values.length;
 return{n:values.length,mean,median:(sorted[(sorted.length-1)>>1]+sorted[sorted.length>>1])/2,min:sorted[0],max:sorted.at(-1),
  standardDeviation:Math.sqrt(values.reduce((a,b)=>a+(b-mean)**2,0)/(values.length-1))};
}
/** Timing eligibility only. This never clears the independent pixel, controls or
 * sustained full-world gates, and never discards inconvenient measured samples. */
export function analyzeBenefit(result){
 const blocked=reason=>({eligible:false,reason,performanceConclusion:null,fullGameAcceptance:false});
 if(!result?.queries?.available)return blocked('Elapsed extension unavailable');
 if(result.queries.disjoint)return blocked('Disjoint timer context; no elapsed comparison');
 if(result.errors?.length)return blocked('Incomplete diagnostic: '+result.errors.join('; '));
 try{
  assert.equal(result.schema,'pavement-depth-benefit/v1');assert.equal(result.performanceConclusion,null);
  assert.deepEqual(result.warmupOrder,warmup);assert.deepEqual(result.measuredOrder,measured);
  assert.equal(result.expectedCases,6);assert.equal(result.expectedWarmupSamples,24);assert.equal(result.expectedMeasuredSamples,96);
  assert.deepEqual(result.cases.map(row=>row.name),names);
  const q=result.queries;assert.equal(q.reason,null);assert.equal(q.liveQueries,0);
  for(const key of ['attempted','allocated','begun','ended','completed','resolved','deleted'])assert.equal(q[key],120,'complete query conservation '+key);
  assert.equal(q.rows.length,120);
  const byQuery=new Map(q.rows.map(row=>[row.id,row]));assert.equal(byQuery.size,120);
  for(const [index,row]of q.rows.entries()){
   assert.equal(row.id,index,'raw query rows retain chronological IDs');
   assert.equal(row.status,'valid');assert.equal(row.error,null);
   for(const key of ['allocated','begun','ended','completed','resolved','deleted'])assert.equal(row[key],true);
   assert(row.disjointChecks.length>=3&&row.disjointChecks.every(value=>value===false));
   assert(Number.isSafeInteger(row.nanoseconds)&&row.nanoseconds>0,'resolved positive nanoseconds');
   assert.equal(row.observedNanoseconds,row.nanoseconds,'raw timer result retained');
  }
  assert.equal(result.settings.width,1280);assert.equal(result.settings.height,800);assert.equal(result.settings.pixelRatio,1);
  assert.equal(result.settings.shadowMapSize,2048);assert.equal(result.settings.shadowEnabled,true);assert.equal(result.settings.shadowType,1);
  assert.equal(result.settings.outputType,1009);assert.equal(result.settings.antialias,true);assert.equal(result.settings.stencil,false);
  // Pinned Three r185 allocates an alpha-enabled native context even when the
  // renderer constructor uses alpha:false for its opaque default clear value.
  // fixtureSettings records gl.getContextAttributes(), not that clear option.
  assert.equal(result.settings.alpha,true,'native r185 context alpha');assert.equal(result.settings.depth,true);assert.equal(result.settings.preserveDrawingBuffer,true);
  assert.equal(result.settings.outputColorSpace,'srgb');assert.equal(result.settings.toneMapping,4);assert.equal(result.settings.exposure,1.02);
  assert.equal(result.assetSha256,'14d16dd1c3148c8ee6132c765e59934b9e86ea79f4607dfd48dd08455feac21b');
  let previousFrame=null,nextQueryId=0;const used=new Set(),cases=[];
  for(const row of result.cases){
   const pinned=pins.cases.find(value=>value.name===row.name);assert(pinned);assert.deepEqual(row.cameraInput,pinned.cameraInput,'actual correctness-proven camera inputs');
   assert.deepEqual(row.settings,result.settings);assert.equal(row.gpu,result.gpu);assert.equal(row.assetSha256,result.assetSha256);
   assert.equal(row.night,row.name.endsWith('-night'));assert.equal(row.lighting.atmosphereTime,12);
   assert.equal(row.lighting.sunIntensity,row.night?.16:3);assert.equal(row.lighting.hemisphereIntensity,row.night?.24:2.1);
   assert.equal(row.lighting.lampIntensity,row.night?600:0);assert(row.shadowAnchor?.point?.length===3);
   const [x,y,z]=row.shadowAnchor.point;
   assert.deepEqual(row.lighting.sunPosition,[x-35,y+70,z+35]);assert.deepEqual(row.lighting.target,[x,y,z]);
   assert.deepEqual(row.lighting.lampPosition,[x+4,y+7,z+3]);
   assert.equal(row.samples.length,20);assert(row.owners.length>0);
   const order=[...warmup.map((mode,index)=>({mode,order:index,phase:'warmup'})),...measured.map((mode,index)=>({mode,order:index,phase:'measured'}))];
   let reference=null;
   const ns={baseline:[],candidate:[]},timed=[];
   for(let index=0;index<row.samples.length;index++){
    const sample=row.samples[index];for(const key of ['mode','order','phase'])assert.equal(sample[key],order[index][key]);
    assert.equal(sample.queryId,nextQueryId++,'chronological sample retains its original elapsed query');
    assert(byQuery.has(sample.queryId)&&!used.has(sample.queryId));used.add(sample.queryId);
    assert(Number.isFinite(sample.cpuMs)&&sample.cpuMs>=0);assert.equal(sample.error,null);assert.equal(sample.ownersIntact,true);
    assert.deepEqual(sample.beforeCamera,row.cameraInput);assert.deepEqual(sample.afterCamera,row.cameraInput);
    assert.deepEqual(sample.beforeOwners,row.owners);assert.deepEqual(sample.afterOwners,row.owners);
    for(const array of Object.values(row.cameraInput))assert(array.length===16&&array.every(value=>Number.isSafeInteger(value)&&value>=0&&value<=0xffffffff));
    assert(Number.isSafeInteger(sample.frame));if(previousFrame!==null)assert.equal(sample.frame,previousFrame+1,'no hidden fixture renders');previousFrame=sample.frame;
    assert.equal(sample.lines,0);assert.equal(sample.points,0);assert.equal(sample.depthStats.supported,true);assert.equal(sample.depthStats.disposed,false);
    const owners=new Map(sample.depthStats.entries.map(entry=>[entry.depthId,entry.sourceId]));
    const originals=sample.draws.filter(draw=>!owners.has(draw.id)),depth=sample.draws.filter(draw=>owners.has(draw.id));
    assert(originals.some(draw=>draw.pass==='shadow'&&draw.calls>0&&draw.triangles>0),'warmup and measured paths include original shadows');
    assert.equal(sample.calls,sum(sample.draws,'calls'));assert.equal(sample.triangles,sum(sample.draws,'triangles'));
    if(reference===null){assert.equal(sample.mode,'baseline');reference=originals;}
    assert.deepEqual(originals,reference,'all original color/shadow submissions stay identical in every warmup and timed frame');
    if(sample.mode==='baseline')assert.equal(depth.length,0);
    else{
     assert(depth.length>0);for(const draw of depth){
      assert.equal(draw.pass,'color');assert(draw.calls>0&&draw.triangles>0);
      const source=originals.find(original=>original.id===owners.get(draw.id)&&original.pass==='color');assert(source);
      for(const key of ['world','view','projection','positionId','indexId','start','count'])assert.deepEqual(draw[key],source[key]);
     }
    }
    assert.equal(sample.calls,sum(reference,'calls')+sum(depth,'calls'));assert.equal(sample.triangles,sum(reference,'triangles')+sum(depth,'triangles'));
    assert.equal(sample.calls,pinned.baselineCalls+(sample.mode==='candidate'?pinned.extraDepthCalls:0));
    assert.equal(sample.triangles,pinned.baselineTriangles+(sample.mode==='candidate'?pinned.extraDepthTriangles:0),'same native geometry workload as correctness fixture');
    if(sample.phase==='measured'){const elapsed=byQuery.get(sample.queryId).nanoseconds/1e6;ns[sample.mode].push(elapsed);timed.push({...sample,gpuMs:elapsed});}
   }
   const pairs=[];for(let index=0;index<timed.length;index+=2){
    const a=timed[index],b=timed[index+1];assert.notEqual(a.mode,b.mode);
    const baseline=a.mode==='baseline'?a:b,candidate=a.mode==='candidate'?a:b;
    pairs.push({order:[a.mode,b.mode],baselineQuery:baseline.queryId,candidateQuery:candidate.queryId,baselineMs:baseline.gpuMs,candidateMs:candidate.gpuMs,
     deltaMs:candidate.gpuMs-baseline.gpuMs,deltaPercent:100*(candidate.gpuMs-baseline.gpuMs)/baseline.gpuMs});
   }
   const baseline=row.samples.find(sample=>sample.mode==='baseline'),candidate=row.samples.find(sample=>sample.mode==='candidate');
   const drift=Object.fromEntries(['baseline','candidate'].map(mode=>{
    const first=summary(timed.slice(0,8).filter(sample=>sample.mode===mode).map(sample=>sample.gpuMs)).mean;
    const second=summary(timed.slice(8).filter(sample=>sample.mode===mode).map(sample=>sample.gpuMs)).mean;
    return[mode,{firstHalfMeanMs:first,secondHalfMeanMs:second,deltaPercent:100*(second-first)/first}];
   }));
   cases.push({name:row.name,baselineGpuMs:summary(ns.baseline),candidateGpuMs:summary(ns.candidate),pairedDeltaMs:summary(pairs.map(pair=>pair.deltaMs)),
    pairedDeltaPercent:summary(pairs.map(pair=>pair.deltaPercent)),pairs,drift,baselineCalls:baseline.calls,candidateCalls:candidate.calls,
    baselineTriangles:baseline.triangles,candidateTriangles:candidate.triangles,extraCalls:candidate.calls-baseline.calls,extraTriangles:candidate.triangles-baseline.triangles});
  }
  assert.equal(used.size,120);
  return{eligible:true,scope:'Only the fixed source-bound pavement/grass fixture on the recorded backend; negative deltas mean less GPU elapsed time.',
   renderer:result.gpu,allWarmupAndMeasuredQueriesAccounted:true,warmupQueries:24,measuredQueries:96,cases,
   performanceConclusion:'Reported per-case paired changes with full sample variability; no full-game inference or correctness acceptance.',
   fullGameAcceptance:false};
 }catch(error){return blocked(String(error));}
}
