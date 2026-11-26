#!/usr/bin/env node
/** Additional diagnostic only. This does not replace any full-game release gate.
 * The complete world graph and every requested asset come from immutable Git
 * blobs. The only candidate is the separately pinned direct Three uniform setter transformation. */
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {createRequire} from 'node:module';
import {execFileSync} from 'node:child_process';
import {createServer} from 'node:http';
import {readFile,mkdir,writeFile} from 'node:fs/promises';
import {resolve,dirname,extname,sep,posix} from 'node:path';
import {inflateSync,deflateSync} from 'node:zlib';
import {build} from 'esbuild';
import {transformThreeShadowUniform} from './three-shadow-uniform-transform.mjs';

const WIDTH=960,HEIGHT=600,BASELINE='d4f4baa8e2016f4c9107b40176388bf2d3f6fe8c';
const CASES=['jefferson-day','jefferson-night','island-day','island-night','conservatory-day','conservatory-night'];
const ARMS=['original','inline'];
const CANDIDATES=ARMS.slice(1),CACHE_ARMS=ARMS.slice(1),ABBA_GROUPS=8;
const TIMING_CASES=CASES.flatMap(name=>(name.endsWith('-day')?['forced-refresh','steady-color']:['forced-refresh']).flatMap(shadowMode=>CANDIDATES.map(candidate=>name+'|'+shadowMode+'|'+candidate)));
const IMAGE_SUFFIXES=[...ARMS,'repeat','eligible-hidden-control','shadow-off-control','light-update-original-control','light-update-inline-control','light-restored-inline-control','toggle-original-control','toggle-inline-first-control','toggle-inline-repeat-control','restored-control'];
const EXPECTED_IMAGES=CASES.flatMap(name=>IMAGE_SUFFIXES.map(suffix=>name+'-'+suffix));
const GAME_PATH='lottominded-ultra.io/games/gothtechnology2/belle-isle-source/game';
const SOURCE_ROOT='lottominded-ultra.io/games/gothtechnology2/';
const TRANSFORM_HASHES={
 'scripts/three-shadow-uniform-transform.mjs':'9ce420aa994b2396f39fbd4b255b4cbf56fbcbfe2539d2dd6bd7cb354fc092fd',
 'scripts/three-shadow-uniform-transform.test.mjs':'063877625ec45b4540f258e3f3ed8d95cba3a28d4df0a4a109f7a0b24aa1b993',
};
const sha256=value=>createHash('sha256').update(value).digest('hex');
const hashPattern=/^[a-f0-9]{64}$/;
function finite(value,label,min=0){assert(typeof value==='number'&&Number.isFinite(value)&&value>=min,label+' must be finite and >= '+min);}
function integer(value,label,min=0){assert(Number.isSafeInteger(value)&&value>=min,label+' must be an integer >= '+min);}
function exactNames(items,expected,key,label){assert(Array.isArray(items),label+' must be an array');assert.deepEqual(items.map(item=>item[key]).sort(),[...expected].sort(),label+' has duplicate, missing or unexpected identifiers');}
function zero(value,label){assert.equal(value,0,label);}
function pixelDiff(a,b){assert.equal(a.length,b.length,'Decoded image length');let changedPixels=0,maxChannelDelta=0;for(let i=0;i<a.length;i+=4){let changed=false;for(let k=0;k<4;k++){const delta=Math.abs(a[i+k]-b[i+k]);changed ||= delta!==0;maxChannelDelta=Math.max(maxChannelDelta,delta);}if(changed)changedPixels++;}return {changedPixels,maxChannelDelta};}
function bottomUp(bytes,width,height){const result=Buffer.alloc(bytes.length),stride=width*4;for(let y=0;y<height;y++)bytes.copy(result,(height-1-y)*stride,y*stride,(y+1)*stride);return result;}

// Independent PNG decoding: no browser-computed equality or hash is accepted
// without reconstructing all RGBA bytes from the saved artifact in Node.
const crcTable=Uint32Array.from({length:256},(_,n)=>{for(let k=0;k<8;k++)n=n&1?0xedb88320^(n>>>1):n>>>1;return n>>>0;});
function crc32(bytes){let value=0xffffffff;for(const byte of bytes)value=crcTable[(value^byte)&255]^(value>>>8);return (value^0xffffffff)>>>0;}
function paeth(a,b,c){const p=a+b-c,pa=Math.abs(p-a),pb=Math.abs(p-b),pc=Math.abs(p-c);return pa<=pb&&pa<=pc?a:pb<=pc?b:c;}
function decodePng(bytes,expectedWidth,expectedHeight){
 assert(Buffer.isBuffer(bytes)&&bytes.subarray(0,8).equals(Buffer.from('89504e470d0a1a0a','hex')),'PNG signature');
 let offset=8,width,height,channels,seenHeader=false,seenData=false,endedData=false,seenEnd=false;const parts=[];
 while(offset<bytes.length){
  assert(offset+12<=bytes.length,'Truncated PNG chunk');const length=bytes.readUInt32BE(offset),end=offset+12+length;assert(end<=bytes.length,'Truncated PNG payload');
  const type=bytes.toString('ascii',offset+4,offset+8),data=bytes.subarray(offset+8,offset+8+length);assert.match(type,/^[A-Za-z]{4}$/,'PNG chunk type');
  assert.equal(crc32(bytes.subarray(offset+4,offset+8+length)),bytes.readUInt32BE(offset+8+length),'PNG CRC: '+type);
  assert(!seenEnd,'PNG data after IEND');
  if(type==='IHDR'){
   assert(!seenHeader&&offset===8&&length===13,'PNG requires exactly one leading IHDR');seenHeader=true;
   width=data.readUInt32BE(0);height=data.readUInt32BE(4);assert.equal(width,expectedWidth,'PNG width');assert.equal(height,expectedHeight,'PNG height');
   assert.equal(data[8],8,'PNG must use eight-bit channels');assert([2,6].includes(data[9]),'PNG must be RGB or RGBA');channels=data[9]===6?4:3;
   assert.equal(data[10],0,'PNG compression');assert.equal(data[11],0,'PNG filter method');assert.equal(data[12],0,'PNG interlace');
  }else{
   assert(seenHeader,'PNG header missing');
   if(type==='IDAT'){assert(!endedData,'Non-contiguous PNG IDAT');seenData=true;parts.push(data);}
   else{
    if(seenData)endedData=true;
    if(type==='IEND'){assert(length===0&&seenData,'PNG IEND without image data');seenEnd=true;}
    else{assert(!/^[A-Z]/.test(type)||type==='PLTE','Unsupported critical PNG chunk '+type);assert(type!=='tRNS','Unexpected separate PNG transparency');}
   }
  }
  offset=end;
 }
 assert(seenEnd&&offset===bytes.length,'Missing PNG end');const stride=width*channels,expected=(stride+1)*height;
 const raw=inflateSync(Buffer.concat(parts),{maxOutputLength:expected});assert.equal(raw.length,expected,'PNG decompressed size');const decoded=Buffer.alloc(stride*height);
 for(let y=0;y<height;y++){
  const filter=raw[y*(stride+1)];assert(filter<=4,'Unsupported PNG row filter');
  for(let x=0;x<stride;x++){
   const left=x>=channels?decoded[y*stride+x-channels]:0,up=y?decoded[(y-1)*stride+x]:0,upperLeft=y&&x>=channels?decoded[(y-1)*stride+x-channels]:0;
   const predictor=filter===0?0:filter===1?left:filter===2?up:filter===3?Math.floor((left+up)/2):paeth(left,up,upperLeft);
   decoded[y*stride+x]=(raw[y*(stride+1)+1+x]+predictor)&255;
  }
 }
 const rgba=channels===4?decoded:Buffer.alloc(width*height*4);
 if(channels===3)for(let pixel=0;pixel<width*height;pixel++){decoded.copy(rgba,pixel*4,pixel*3,pixel*3+3);rgba[pixel*4+3]=255;}
 return {width,height,rgba,rgbaSha256:sha256(rgba),readPixelsSha256:sha256(bottomUp(rgba,width,height))};
}

const CACHE_COUNTERS=['setterCalls','nativeCalls','nativeSuccesses','nativeErrors','skippedCalls'];
const POOL_COUNTERS=['renderCalls','pooledCalls','colorCalls','shadowCalls'];
function validateCache(cache,label,arm,{allowUnseen=false}={}){
 assert(cache&&cache.version===1,label+': controller version');assert.equal(cache.mode,arm,label+': actual setter mode');
 for(const key of ['generation','contexts','registeredUniforms','activeUniforms',...CACHE_COUNTERS,'fallbackCalls','contextResets','ownershipFailures'])integer(cache[key],label+': '+key);
 if(!allowUnseen){assert.equal(cache.contexts,1,label+': one renderer context');integer(cache.registeredUniforms,label+': actual named uniforms',1);}
 else assert(cache.contexts<=1,label+': unexpected renderer context');
 for(const key of ['nativeErrors','fallbackCalls','contextResets','ownershipFailures'])zero(cache[key],label+': '+key);
 assert.equal(cache.nativeCalls,cache.nativeSuccesses,label+': native upload accounting');
 assert.equal(cache.setterCalls,cache.nativeCalls+cache.skippedCalls,label+': original conversion must produce native upload or exact skip');
 assert.equal(cache.activeUniforms,arm==='inline'?cache.registeredUniforms:0,label+': actual eligible setter ownership');
 if(arm==='original')for(const key of CACHE_COUNTERS)zero(cache[key],label+': candidate activity in original mode '+key);
 return cache;
}
function validateCacheDelta(before,after,delta,arm,label){
 validateCache(before,label+' before',arm,{allowUnseen:true});validateCache(after,label+' after',arm);
 assert.equal(before.generation,after.generation,label+': mode invalidated during rendering');
 const expected={};for(const key of CACHE_COUNTERS){expected[key]=after[key]-before[key];integer(expected[key],label+': delta '+key);}
 assert.deepEqual(delta,expected,label+': independently recomputed cache delta');return expected;
}
function validateWarm(warm,arm,label){
 assert(warm,label+': missing warmup');const delta=validateCacheDelta(warm.before,warm.after,warm.delta,arm,label+' warmup');
 if(arm==='inline'){integer(delta.nativeSuccesses,label+': first warm upload',1);integer(delta.skippedCalls,label+': repeated warm skip',1);}
}
function poolIdentity(stats){return Object.fromEntries(['supported','preparedEntries','activeEntries','pageCount','poolBytes','pages','preparationAttempts','preparationRenders','preparationFrames','preparationReady','fallbacks','observerErrors','contextLosses'].map(key=>[key,stats[key]]));}
function validatePool(delta,label){for(const key of POOL_COUNTERS)integer(delta?.[key],label+': '+key);assert(delta.renderCalls>0&&delta.colorCalls>0,label+': original pooling is not active');assert.equal(delta.pooledCalls,delta.colorCalls+delta.shadowCalls,label+': original pooled calls');}
function validateExact(value,label){
 for(const key of ['changedPixels','maxChannelDelta','shadowChangedPixels','shadowMaxChannelDelta'])zero(value[key],label+': '+key);
 assert.equal(value.orderEqual,true,label+': native draw order');assert.equal(value.countsEqual,true,label+': native draw counts');
}
function validateResult(result,decoded,native){
 assert.equal(result.schema,'belle-uniform-array-experiment-v1');assert.equal(result.width,WIDTH);assert.equal(result.height,HEIGHT);assert.equal(result.dpr,1);assert.equal(result.threeRevision,'185');
 assert.equal(result.software,!native,'Declared renderer backend');assert(native?/Metal/i.test(result.gpu)&&!/SwiftShader|llvmpipe/i.test(result.gpu):/SwiftShader/i.test(result.gpu),'Unexpected actual GPU '+result.gpu);
 assert.deepEqual(result.errors,[],'Browser diagnostic errors');exactNames(result.rows,CASES,'name','Views');exactNames(result.controls,CASES,'name','Controls');
 assert(result.poolBefore?.supported===true&&result.poolBefore.preparationReady===true,'Original shared buffers unsupported/unprepared');
 integer(result.poolBefore.activeEntries,'Prepared entries',200);integer(result.poolBefore.pageCount,'Prepared pages',1);integer(result.poolBefore.poolBytes,'Pool bytes',1);
 assert.deepEqual(poolIdentity(result.poolAfter),poolIdentity(result.poolBefore),'Pool pages, preparation or eligibility changed');assert.equal(result.poolHooksPreserved,true,'Original renderer/pool hooks changed');
 for(const key of ['fallbacks','observerErrors','contextLosses'])zero(result.poolAfter[key],'Pool '+key);
 assert(Array.isArray(result.poolBefore.entries)&&result.poolBefore.entries.length>=200,'Missing actual eligible source entries');
 assert(result.geometry?.meshes?.length>=200&&result.geometry?.geometries?.length>0,'Missing full-world geometry receipts');
 assert(Array.isArray(result.programs)&&result.programs.length>0,'No actual linked programs');const programs=new Map();
 for(const program of result.programs){
  integer(program.id,'Program id');assert(!programs.has(program.id),'Duplicate program id');programs.set(program.id,program);assert.equal(program.linked,true,'Program did not link');
  for(const type of ['vertex','fragment']){assert(typeof program[type]==='string'&&program[type].length>100,'Missing native '+type+' source');assert.match(program[type+'Sha256'],hashPattern);assert.equal(sha256(program[type]),program[type+'Sha256'],'Actual linked '+type+' hash');}
 }
 const independent=[],coverage={rows:0,substitutedColorDraws:0,substitutedShadowDraws:0,namedShadowSkips:0,nativeShadowUpdates:0,nativeShadowRestores:0,toggleFirstNativeUploads:0,toggleRepeatSkips:0,shadowChangedPixels:0,eligibleChangedPixels:0,uniformUpdateChangedPixels:0};
 function compareImages(original,candidate,label){const a=decoded.get(original),b=decoded.get(candidate);assert(a&&b,label+': saved images missing');const diff=pixelDiff(a.rgba,b.rgba);zero(diff.changedPixels,label+': independent RGBA');zero(diff.maxChannelDelta,label+': independent channel delta');independent.push({name:label,...diff});}
 for(const row of result.rows){
  const label=row.name;assert.equal(row.width,WIDTH);assert.equal(row.height,HEIGHT);assert.equal(row.style,'authentic');assert.equal(row.bridgePreview,false,'Optional bridge must remain off in initial diagnostic');
  assert.equal(row.hour,label.endsWith('-night')?21:14);assert.equal(row.geometryEqual,true,label+': geometry');assert.match(row.geometrySha256,hashPattern);assert.equal(row.afterGeometrySha256,row.geometrySha256,label+': source geometry changed');
  for(const key of ['repeatChangedPixels','repeatMaxChannelDelta','repeatShadowChangedPixels','repeatShadowMaxChannelDelta'])zero(row[key],label+': '+key);assert.equal(row.repeatOrderEqual,true);assert.equal(row.repeatCountsEqual,true);
  exactNames(row.comparisons,ARMS,'arm',label+' arms');const original=row.comparisons.find(c=>c.arm==='original');
  integer(original.calls,label+': native calls',1);finite(original.triangles,label+': triangles',1);assert(original.draws?.length>0,label+': no observed actual submissions');
  for(const compared of row.comparisons){
   const id=label+'-'+compared.arm;validateExact(compared,id);assert.equal(compared.calls,original.calls);assert.equal(compared.triangles,original.triangles);
   assert.deepEqual(compared.draws,original.draws,id+': independently compared actual draw/geometry/material/program identity and order');
   for(const draw of compared.draws){assert(programs.has(draw.program),id+': missing linked native program');integer(draw.start,id+': draw start');integer(draw.count,id+': draw count');assert(['color','shadow'].includes(draw.phase));assert.equal(typeof draw.substituted,'boolean');}
   const color=compared.draws.filter(d=>d.substituted&&d.phase==='color').length,shadow=compared.draws.filter(d=>d.substituted&&d.phase==='shadow').length;
   assert.equal(compared.substitutedColorDraws,color);assert.equal(compared.substitutedShadowDraws,shadow);validatePool(compared.poolDelta,id);
   assert.equal(compared.poolDelta.pooledCalls,color+shadow,id+': observed substitutions');assert.equal(compared.poolDelta.colorCalls,color);assert.equal(compared.poolDelta.shadowCalls,shadow);
   validateWarm(compared.warmCache,compared.arm,id);const delta=validateCacheDelta(compared.cacheBefore,compared.cache,compared.cacheDelta,compared.arm,id);
   if(compared.arm==='inline'){integer(delta.skippedCalls,id+': warmed cache must skip a real upload',1);coverage.rows++;coverage.namedShadowSkips+=delta.skippedCalls;}
   else{coverage.substitutedColorDraws+=color;coverage.substitutedShadowDraws+=shadow;}
   assert.match(compared.rgbaSha256,hashPattern);assert.match(compared.shadowSha256,hashPattern);assert.equal(compared.rgbaSha256,original.rgbaSha256);assert.equal(compared.shadowSha256,original.shadowSha256);
   assert.equal(decoded.get(id)?.readPixelsSha256,compared.rgbaSha256,id+': saved PNG does not match real framebuffer');compareImages(label+'-original',id,id);
  }
  for(const suffix of ['repeat','restored-control','light-restored-inline-control','toggle-original-control','toggle-inline-first-control','toggle-inline-repeat-control'])compareImages(label+'-original',label+'-'+suffix,label+'-'+suffix);
  assert.equal(row.passed,true,label+': browser result');
 }
 for(const control of result.controls){
  const label=control.name,original=decoded.get(label+'-original'),updated=decoded.get(label+'-light-update-original-control');
  const hidden=pixelDiff(original.rgba,decoded.get(label+'-eligible-hidden-control').rgba),shadow=pixelDiff(original.rgba,decoded.get(label+'-shadow-off-control').rgba),update=pixelDiff(original.rgba,updated.rgba);
  assert.equal(hidden.changedPixels,control.eligibleHiddenChangedPixels,label+': independent visibility control');assert.equal(shadow.changedPixels,control.shadowOffChangedPixels,label+': independent shadow control');assert.equal(update.changedPixels,control.uniformUpdateChangedPixels,label+': independent live uniform control');
  assert(Array.isArray(control.eligibleHiddenIds)&&control.eligibleHiddenIds.length>0&&new Set(control.eligibleHiddenIds).size===control.eligibleHiddenIds.length,label+': actual visibility-control source IDs');
  coverage.eligibleChangedPixels=Math.max(coverage.eligibleChangedPixels,hidden.changedPixels);coverage.shadowChangedPixels=Math.max(coverage.shadowChangedPixels,shadow.changedPixels);coverage.uniformUpdateChangedPixels=Math.max(coverage.uniformUpdateChangedPixels,update.changedPixels);
  for(const [field,target]of [['uniformUpdate','nativeShadowUpdates'],['uniformRestore','nativeShadowRestores']]){
   const compared=control[field],id=label+' '+field;assert.equal(compared.arm,'inline');validateExact(compared,id);const delta=validateCacheDelta(compared.cacheBefore,compared.cache,compared.cacheDelta,'inline',id);
   integer(compared.nativeShadowUploads,id+': changed shadow payload upload',1);assert.equal(compared.nativeShadowUploads,delta.nativeSuccesses);coverage[target]+=delta.nativeSuccesses;
  }
  assert.equal(control.uniformUpdate.cache.generation,control.uniformRestore.cache.generation,label+': light was restored only after resetting cache');
  compareImages(label+'-light-update-original-control',label+'-light-update-inline-control',label+'-light-update-inline-control');
  const toggle=control.toggle;integer(toggle.generationBefore,label+': pre-toggle generation');assert(toggle.generationDisabled>toggle.generationBefore&&toggle.generationEnabled>toggle.generationDisabled,label+': toggles did not invalidate');
  validateCache(toggle.disabled,label+' disabled','original');validateCache(toggle.enabled,label+' enabled','inline');assert.equal(toggle.disabled.generation,toggle.generationDisabled);assert.equal(toggle.enabled.generation,toggle.generationEnabled);
  for(const key of CACHE_COUNTERS){zero(toggle.disabled[key],label+': disabled counters');zero(toggle.enabled[key],label+': fresh enabled counters');}
  for(const key of ['original','first','repeat'])validateExact(toggle[key],label+' toggle '+key);
  validateCache(toggle.original.cache,label+' toggle original','original');for(const key of CACHE_COUNTERS)zero(toggle.original.cacheDelta[key],label+': original toggle candidate delta');
  const first=validateCacheDelta(toggle.first.cacheBefore,toggle.first.cache,toggle.first.cacheDelta,'inline',label+' toggle first'),repeat=validateCacheDelta(toggle.repeat.cacheBefore,toggle.repeat.cache,toggle.repeat.cacheDelta,'inline',label+' toggle repeat');
  assert.equal(toggle.first.cache.generation,toggle.generationEnabled);assert.equal(toggle.repeat.cache.generation,toggle.generationEnabled);assert.equal(toggle.firstNativeShadowUploads,first.nativeSuccesses);assert.equal(toggle.repeatNativeShadowUploads,repeat.nativeSuccesses);assert.equal(toggle.repeatShadowSkips,repeat.skippedCalls);
  integer(first.nativeSuccesses,label+': first enabled upload',1);zero(repeat.nativeSuccesses,label+': unchanged repeat reuploaded');integer(repeat.skippedCalls,label+': enabled repeat skipped',1);assert.equal(toggle.passed,true);
  coverage.toggleFirstNativeUploads+=first.nativeSuccesses;coverage.toggleRepeatSkips+=repeat.skippedCalls;
  for(const key of ['restoredChangedPixels','restoredMaxChannelDelta','restoredShadowChangedPixels'])zero(control[key],label+': '+key);assert.equal(control.restoredOrderEqual,true);assert.equal(control.restoredCountsEqual,true);assert.equal(control.passed,true,label+': controls');
 }
 assert.equal(coverage.rows,CASES.length);assert(coverage.substitutedColorDraws>0&&coverage.substitutedShadowDraws>0,'Original pooled color and shadow work must be exercised');
 assert(coverage.eligibleChangedPixels>=16&&coverage.shadowChangedPixels>=16&&coverage.uniformUpdateChangedPixels>=16,'Actual source geometry, mapped shadows and live payload must each affect >=16 pixels in at least one view');
 assert.deepEqual(result.cacheCoverage,coverage,'Independent coverage');validateCache(result.controller,'Final restored original controller','original');
 if(!native)assert.deepEqual(result.timings,[],'Software timings cannot be native evidence');assert.equal(result.passed,true,'Browser proof failed');return {independent,coverage};
}
function median(values){const sorted=[...values].sort((a,b)=>a-b),middle=Math.floor(sorted.length/2);return sorted.length%2?sorted[middle]:(sorted[middle-1]+sorted[middle])/2;}
function validateTimings(result,native){
 if(!native){assert.deepEqual(result.timings,[],'SwiftShader must not produce native acceptance timings');return [];}
 exactNames(result.timings.map(row=>({name:row.name+'|'+row.shadowMode+'|'+row.candidate})),TIMING_CASES,'name','Native timing cases');
 let nextQueryId=1;const mean=values=>values.reduce((sum,value)=>sum+value,0)/values.length;
 const summary=result.timings.map(timing=>{
  const id=timing.name+'|'+timing.shadowMode+'|'+timing.candidate,view=result.rows.find(row=>row.name===timing.name),baseline=view.comparisons.find(row=>row.arm==='original');
  assert.equal(timing.baseline,'original');assert.equal(timing.candidate,'inline');assert.equal(timing.order,'ABBA');assert.equal(timing.repetitions,ABBA_GROUPS);assert.equal(timing.framesPerLane,16);assert.equal(timing.warmupRenders,3);assert.equal(timing.lanes.length,ABBA_GROUPS*4,id+': lane count');
  const first=timing.lanes[0].samples?.[0];integer(first?.calls,id+': measured native calls',1);finite(first?.triangles,id+': measured triangles',1);
  if(timing.shadowMode==='forced-refresh'){assert.equal(first.calls,baseline.calls,id+': forced shadow calls');assert.equal(first.triangles,baseline.triangles,id+': forced shadow triangles');}
  const groups=[];for(let group=0;group<ABBA_GROUPS;group++){
   const lanes=timing.lanes.slice(group*4,group*4+4);assert.deepEqual(lanes.map(lane=>lane.arm),['original','inline','inline','original'],id+': fixed ABBA order');
   for(const [laneIndex,lane]of lanes.entries()){
    const label=id+' group'+group+' lane'+laneIndex;assert.equal(lane.repetition,group+1);assert.equal(lane.framesPerLane,16);assert.equal(lane.warmupRenders,3);assert.equal(lane.samples?.length,16,label+': missing or dropped raw frames');
    validateWarm(lane.warmCache,lane.arm,label);const delta=validateCacheDelta(lane.cacheBefore,lane.cache,lane.cacheDelta,lane.arm,label);
    if(lane.arm==='inline')integer(delta.skippedCalls,label+': timed inline activity',1);
    validatePool(lane.poolDelta,label);const poolDelta={};for(const key of POOL_COUNTERS){integer(lane.poolBefore[key],label+': before '+key);integer(lane.poolAfter[key],label+': after '+key);poolDelta[key]=lane.poolAfter[key]-lane.poolBefore[key];}
    assert.deepEqual(lane.poolDelta,poolDelta,label+': independent pool counter deltas');assert.deepEqual(lane.poolDelta,timing.lanes[0].poolDelta,label+': original pooled work changed between arms');
    assert.equal(lane.poolDelta.colorCalls,baseline.poolDelta.colorCalls*16,label+': original color substitutions per raw frame');assert.equal(lane.poolDelta.shadowCalls,timing.shadowMode==='forced-refresh'?baseline.poolDelta.shadowCalls*16:0,label+': original shadow substitutions per raw frame');
    for(const [index,sample]of lane.samples.entries()){
     assert.equal(sample.index,index,label+': raw frame order');finite(sample.cpuMs,label+': CPU ms',Number.MIN_VALUE);finite(sample.fenceMs,label+': fence ms');assert.equal(sample.calls,first.calls,label+': native draw count');assert.equal(sample.triangles,first.triangles,label+': native triangle count');
     assert.equal(sample.gpu?.status,'complete',label+': real elapsed query');finite(sample.gpu.nanoseconds,label+': GPU ns',Number.MIN_VALUE);assert.equal(sample.gpu.queryId,nextQueryId++,label+': duplicate, missing or reordered GPU query');assert.equal(sample.gpu.resultAvailable,true,label+': GPU result unavailable');assert.equal(sample.gpu.disjoint,false,label+': disjoint GPU query');
    }
    assert.equal(lane.cpuMs,mean(lane.samples.map(sample=>sample.cpuMs)),label+': recomputed CPU mean');assert.equal(lane.fenceMs,mean(lane.samples.map(sample=>sample.fenceMs)),label+': recomputed fence mean');assert.equal(lane.gpu.status,'complete');assert.equal(lane.gpu.nanoseconds,mean(lane.samples.map(sample=>sample.gpu.nanoseconds)),label+': recomputed GPU mean');
   }
   const pair={repetition:group+1};for(const [metric,read]of [['cpuMs',lane=>lane.cpuMs],['gpuMs',lane=>lane.gpu.nanoseconds/1e6],['fenceMs',lane=>lane.fenceMs]]){const original=(read(lanes[0])+read(lanes[3]))/2,candidate=(read(lanes[1])+read(lanes[2]))/2;pair[metric]={baseline:original,candidate,delta:candidate-original,percent:original?100*(candidate-original)/original:null};}groups.push(pair);
  }
  const metrics={};for(const metric of ['cpuMs','gpuMs','fenceMs'])metrics[metric]={baselineMean:mean(groups.map(group=>group[metric].baseline)),candidateMean:mean(groups.map(group=>group[metric].candidate)),pairedMeanDelta:mean(groups.map(group=>group[metric].delta)),baselineMedian:median(groups.map(group=>group[metric].baseline)),candidateMedian:median(groups.map(group=>group[metric].candidate)),pairedMedianDelta:median(groups.map(group=>group[metric].delta)),pairedMedianPercent:median(groups.map(group=>group[metric].percent??0)),improvedGroups:groups.filter(group=>group[metric].delta<0).length,totalGroups:groups.length};
  return {name:timing.name,shadowMode:timing.shadowMode,candidate:timing.candidate,framesPerLane:16,rawSamples:512,groups,metrics,scope:'Balanced frozen full-world ABBA diagnostic only; every raw sample retained. No full-game frame-pacing or release acceptance claim.'};
 });
 assert.equal(nextQueryId-1,TIMING_CASES.length*ABBA_GROUPS*4*16,'Every planned native GPU query must have a retained completed raw sample');return summary;
}

function pngForTest(pixels,width,height,filter=0){
 const chunk=(type,data)=>{const name=Buffer.from(type),out=Buffer.alloc(data.length+12);out.writeUInt32BE(data.length);name.copy(out,4);data.copy(out,8);out.writeUInt32BE(crc32(Buffer.concat([name,data])),8+data.length);return out;};
 const head=Buffer.alloc(13);head.writeUInt32BE(width);head.writeUInt32BE(height,4);head[8]=8;head[9]=6;const stride=width*4,raw=Buffer.alloc((stride+1)*height);
 for(let y=0;y<height;y++){raw[y*(stride+1)]=filter;for(let x=0;x<stride;x++){const left=x>=4?pixels[y*stride+x-4]:0,up=y?pixels[(y-1)*stride+x]:0,c=y&&x>=4?pixels[(y-1)*stride+x-4]:0,predictor=filter===0?0:filter===1?left:filter===2?up:filter===3?Math.floor((left+up)/2):paeth(left,up,c);raw[y*(stride+1)+1+x]=(pixels[y*stride+x]-predictor)&255;}}
 return Buffer.concat([Buffer.from('89504e470d0a1a0a','hex'),chunk('IHDR',head),chunk('IDAT',deflateSync(raw)),chunk('IEND',Buffer.alloc(0))]);
}
function selfTest(){
 const pixels=Buffer.from([1,2,3,255,250,4,5,255,17,31,63,255,99,100,101,255]);
 for(let filter=0;filter<=4;filter++)assert.deepEqual(decodePng(pngForTest(pixels,2,2,filter),2,2).rgba,pixels,'Filter '+filter);
 const corrupt=pngForTest(pixels,2,2);corrupt[45]^=1;assert.throws(()=>decodePng(corrupt,2,2),/CRC/);assert.throws(()=>decodePng(pngForTest(pixels,2,2),3,2),/width/);
 const alpha=Buffer.from(pixels);alpha[3]--;assert.deepEqual(pixelDiff(pixels,alpha),{changedPixels:1,maxChannelDelta:1});
 assert.throws(()=>exactNames([{name:'a'},{name:'a'}],['a','b'],'name','fixture'),/identifiers/);assert.throws(()=>validatePool({renderCalls:1,pooledCalls:2,colorCalls:1,shadowCalls:0},'fixture'),/pooled calls/);
 assert.equal(decodePng(pngForTest(pixels,2,2),2,2).readPixelsSha256,sha256(bottomUp(pixels,2,2)));
 console.log('Uniform array proof self-test passed: PNG filters, CRC/dimensions, alpha differences, readPixels hash, duplicate cases and original-pool accounting.');
}

async function main(){
 const compileOnly=process.argv.includes('--compile-only');assert(process.argv.slice(2).every(arg=>arg==='--compile-only'),'Unknown driver argument');
 const game=resolve(import.meta.dirname,'..'),gitArgs={cwd:game,maxBuffer:256*1024*1024},git=(...args)=>execFileSync('git',args,gitArgs);
 const repo=git('rev-parse','--show-toplevel').toString().trim(),sourceHead=git('rev-parse','HEAD').toString().trim(),sourceTree=git('rev-parse','HEAD^{tree}').toString().trim();
 gitArgs.cwd=repo;
 if(process.env.UNIFORM_ARRAY_PROOF_SOURCE_SHA)assert.equal(sourceHead,process.env.UNIFORM_ARRAY_PROOF_SOURCE_SHA,'Source HEAD is not the requested exact commit');
 if(process.env.UNIFORM_ARRAY_PROOF_BASELINE_SHA)assert.equal(process.env.UNIFORM_ARRAY_PROOF_BASELINE_SHA,BASELINE,'The original baseline cannot be changed by environment');
 const output=resolve(game,'output/uniform-array-proof');await mkdir(output,{recursive:true});
 const errors=[],failedRequests=[],pinnedSources=new Map(),assetEntries=new Map(),assetBytes=new Map(),literalAssets=new Map(),sourceFiles=new Map();
 const environmentDefines={'import.meta.env.PROD':'false','import.meta.env.BASE_URL':'"/"','import.meta.env':'{}'};
 const report={schema:'belle-uniform-array-native-proof-v1',baseline:BASELINE,sourceHead,sourceTree,platform:process.platform,width:WIDTH,height:HEIGHT,dpr:1,compileOnly,compiled:false,passed:false,errors,failedRequests,fixtureSha256:null,sourceReceipts:[],pinnedSources:[],uniformTransforms:[],assetTransformations:[],assets:[],captures:[],independent:[],timingSummary:[],result:null,environmentDefines,scope:'Additional diagnostic: one immutable original full-world snapshot, original/inline uniform setters with original shared buffers, fixed Authentic day/night poses. No full-game riding, optional bridge, controls, input, collision, physical iPad, or release acceptance is implied.'};
 let browser,server,deadline;
 const safePath=path=>{assert(path.startsWith(SOURCE_ROOT)&&!path.includes('\\')&&!path.includes('\0')&&!path.split('/').includes('..')&&!posix.isAbsolute(path),'Unsafe immutable repository path '+path);return path;};
 function original(path){
  safePath(path);const entry=sourceFiles.get(path);assert(entry&&entry.type==='blob'&&['100644','100755'].includes(entry.mode),'Pinned regular Git blob unavailable: '+path);
  const bytes=git('cat-file','blob',entry.blob);assert.equal(createHash('sha1').update('blob '+bytes.length+'\0').update(bytes).digest('hex'),entry.blob,'Immutable Git object bytes '+path);return {bytes,entry};
 }
 function sourcePath(path){
  safePath(path);const choices=extname(path)?[path]:[path,path+'.ts',path+'.js',path+'.json',path+'/index.ts',path+'/index.js'];
  const found=choices.find(candidate=>sourceFiles.get(candidate)?.type==='blob');assert(found,'Missing pinned import '+path);return found;
 }
 function asset(path,url){
  safePath(path);let bytes=assetBytes.get(path);if(!bytes){const value=original(path);bytes=value.bytes;assetBytes.set(path,bytes);assetEntries.set(path,{path,gitBlob:value.entry.blob,bytes:bytes.length,sha256:sha256(bytes),urls:[],requests:0});}
  const receipt=assetEntries.get(path);if(url&&!receipt.urls.includes(url))receipt.urls.push(url);return bytes;
 }
 function assetUrl(path){safePath(path);assert(sourceFiles.has(path),'Pinned URL asset missing: '+path);const url='/__pinned_asset/'+path;literalAssets.set(url,path);asset(path,url);return url;}
 function pinned(path){
  if(!pinnedSources.has(path)){
   const {bytes,entry}=original(path),content=bytes.toString('utf8'),transformations=[];
   const transformed=content.replace(/new\s+URL\(\s*(['"])([^'"\r\n]+)\1\s*,\s*import\.meta\.url\s*\)(\.href)?/g,(match,_quote,relative,href)=>{
    assert(relative.startsWith('.'),'Only relative static baseline URL assets are supported: '+path);const referenced=posix.normalize(posix.join(posix.dirname(path),relative)),url=assetUrl(referenced),replacement=href?JSON.stringify(url):'new URL('+JSON.stringify(url)+', location.origin)';transformations.push({original:match,replacement,asset:referenced,url});return replacement;
   });
   pinnedSources.set(path,{path,gitBlob:entry.blob,sha256:sha256(bytes),transformedSha256:sha256(transformed),transformations,content:transformed});
  }
  return pinnedSources.get(path).content;
 }
 const uniformPlugin={name:'pinned-three-shadow-uniform-experiment',setup(builder){
  builder.onResolve({filter:/^fixture:uniform-array-control$/},()=>({path:'uniform-array-control',namespace:'uniform-control'}));
  builder.onLoad({filter:/.*/,namespace:'uniform-control'},()=>({contents:'export {__belleUniformArrayProofControl as uniformArrayProofControl} from "three";',loader:'js',resolveDir:game}));
  builder.onLoad({filter:/[/\\]three[/\\](?:build[/\\]three\.module\.js|src[/\\]renderers[/\\]webgl[/\\]WebGLUniforms\.js)$/},async args=>{
   const source=await readFile(args.path,'utf8'),transformed=transformThreeShadowUniform(source,args.path,{enabled:true,proof:true});
   assert(transformed,'Expected pinned Three module was not transformed');assert.equal(transformed.receipt.inputSha256,sha256(source));assert.equal(transformed.receipt.outputSha256,sha256(transformed.code));
   report.uniformTransforms.push({path:args.path,...transformed.receipt});return {contents:transformed.code,loader:'js',resolveDir:dirname(args.path)};
  });
 }};
 const plugin={name:'immutable-full-world-original',setup(builder){
  builder.onResolve({filter:/^baseline:/},args=>{const name=args.path.slice(9),path=sourcePath(GAME_PATH+'/'+(name.startsWith('src/')||name.startsWith('runtime/')?name:'src/belle/'+name));return {path,namespace:'pinned-source'};});
  builder.onResolve({filter:/.*/,namespace:'pinned-source'},async args=>{
   if(args.path.startsWith('.'))return {path:sourcePath(posix.normalize(posix.join(posix.dirname(args.importer),args.path.replace(/\?url$/,'')))),namespace:'pinned-source'};
   if(args.path==='@digital-static/ridecore')return {path:sourcePath(GAME_PATH+'/runtime/ride-core/src/index.ts'),namespace:'pinned-source'};
   // The same ESM resolver as the current helper preserves Three constructors.
   return builder.resolve(args.path,{resolveDir:game,kind:args.kind});
  });
  builder.onLoad({filter:/.*/,namespace:'pinned-source'},args=>{
   const extension=extname(args.path);if(!['.ts','.tsx','.js','.mjs','.json'].includes(extension))return {contents:'export default '+JSON.stringify(assetUrl(args.path))+';',loader:'js',resolveDir:game};
   return {contents:pinned(args.path),loader:extension==='.json'?'json':extension==='.tsx'?'tsx':extension==='.ts'?'ts':'js',resolveDir:dirname(resolve(repo,args.path))};
  });
 }};
 try{
  const tree=git('ls-tree','-rz',BASELINE,'--',SOURCE_ROOT).toString();for(const line of tree.split('\0').filter(Boolean)){const match=line.match(/^(\d+) (\w+) ([a-f0-9]{40})\t([\s\S]+)$/);assert(match,'Unexpected immutable tree record');sourceFiles.set(match[4],{mode:match[1],type:match[2],blob:match[3]});}assert(sourceFiles.size>0,'Immutable baseline tree is empty');
  report.baselineTree=git('rev-parse',BASELINE+'^{tree}').toString().trim();
  const receiptPaths=[GAME_PATH+'/scripts/uniform-array-native-proof.mjs',GAME_PATH+'/scripts/uniform-array-proof-browser.ts',...Object.keys(TRANSFORM_HASHES).map(path=>GAME_PATH+'/'+path),GAME_PATH+'/package.json',GAME_PATH+'/package-lock.json',SOURCE_ROOT+'package.json',SOURCE_ROOT+'package-lock.json','.github/workflows/belle-uniform-array-proof.yml'];
  for(const path of receiptPaths){
   const bytes=await readFile(resolve(repo,path)),actual=sha256(bytes);let headHash=null;try{headHash=sha256(execFileSync('git',['show',sourceHead+':'+path],{...gitArgs,stdio:['ignore','pipe','ignore']}));}catch(error){if(!compileOnly)throw error;}
   const receipt={path,sha256:actual,headSha256:headHash,matchesHead:actual===headHash};report.sourceReceipts.push(receipt);if(!compileOnly)assert.equal(receipt.matchesHead,true,'Proof source differs from exact HEAD: '+path);
   const relative=path.startsWith(GAME_PATH+'/')?path.slice(GAME_PATH.length+1):null;if(TRANSFORM_HASHES[relative])assert.equal(actual,TRANSFORM_HASHES[relative],'Reviewed cache module/test changed: '+path);
   if(path.endsWith('/package.json')||path.endsWith('/package-lock.json'))assert.equal(actual,sha256(original(path).bytes),'Dependencies differ from original world: '+path);
  }
  const compiled=await build({absWorkingDir:game,entryPoints:[resolve(game,'scripts/uniform-array-proof-browser.ts')],bundle:true,format:'esm',target:'es2022',write:false,logLevel:'error',metafile:true,plugins:[uniformPlugin,plugin],define:environmentDefines});
  assert.equal(report.uniformTransforms.length,1,'Exactly one shared Three graph must be transformed');assert.match(report.uniformTransforms[0].module,/build\/three\.module\.js$/);assert.equal(report.uniformTransforms[0].proof,true);
  const javascript=compiled.outputFiles[0].contents;report.fixtureSha256=sha256(javascript);report.bundleInputs=[];
  const allowedCurrent=new Set([GAME_PATH+'/scripts/uniform-array-proof-browser.ts']);
  for(const input of Object.keys(compiled.metafile.inputs).sort()){
   if(input.startsWith('pinned-source:')){report.bundleInputs.push({path:input,pinned:true});continue;}
   if(input==='uniform-control:uniform-array-control'){report.bundleInputs.push({path:input,generated:true,scope:'Proof-only controller re-export from the one transformed Three module'});continue;}
   if(input==='<define:import.meta.env>'){report.bundleInputs.push({path:input,generated:true,value:environmentDefines['import.meta.env']});continue;}
   const filename=resolve(game,input),isDependency=filename.includes(sep+'node_modules'+sep),path=filename.startsWith(repo+sep)?filename.slice(repo.length+1):filename;
   assert(isDependency||allowedCurrent.has(path),'Current source leaked into immutable original graph: '+path);report.bundleInputs.push({path,dependency:isDependency,sha256:sha256(await readFile(filename))});
  }
  for(const path of allowedCurrent)assert(report.bundleInputs.some(input=>input.path===path),'Missing expected current input '+path);
  for(const required of ['world.ts','sharedGeometryBuffers.ts','terrain.ts','fountainLayout.ts','coastGuard.ts','sunsetReferencePolicy.ts','activitiesPlan.ts','playgrounds.ts'])assert(pinnedSources.has(GAME_PATH+'/src/belle/'+required),'Original baseline module not compiled: '+required);
  await writeFile(resolve(output,'fixture.js'),javascript);await writeFile(resolve(output,'bundle-metafile.json'),JSON.stringify(compiled.metafile,null,2)+'\n');report.compiled=true;
  if(compileOnly){console.log('Compiled immutable full-world proof. Compile-only is not pixel or performance acceptance.');return;}
  const require=createRequire(resolve(game,'../../package.json')),{chromium}=require('@playwright/test');
  const types={'.json':'application/json','.bin':'application/octet-stream','.glb':'model/gltf-binary','.gltf':'model/gltf+json','.webp':'image/webp','.png':'image/png','.jpg':'image/jpeg','.jpeg':'image/jpeg','.hdr':'application/octet-stream','.wasm':'application/wasm','.js':'text/javascript','.mp3':'audio/mpeg','.ogg':'audio/ogg'};
  server=createServer((req,res)=>{
   try{
    const pathname=new URL(req.url,'http://127.0.0.1').pathname;assert(req.method==='GET'||req.method==='HEAD','Read-only fixture server');res.setHeader('Cache-Control','no-store');
    if(pathname==='/'){res.setHeader('Content-Type','text/html');res.end('<!doctype html><html><head><meta charset="utf-8"><link rel="icon" href="data:,"><style>html,body{margin:0;width:960px;height:600px;overflow:hidden}canvas{display:block}</style></head><body><canvas></canvas><script type="module" src="/proof.js"></script></body></html>');return;}
    if(pathname==='/proof.js'){res.setHeader('Content-Type','text/javascript');res.end(javascript);return;}
    const decoded=decodeURIComponent(pathname);assert(!decoded.includes('\\')&&!decoded.includes('\0')&&!decoded.split('/').includes('..'),'Unsafe asset request');
    const path=decoded.startsWith('/__pinned_asset/')?literalAssets.get(decoded):GAME_PATH+'/public'+decoded;assert(path,'Unregistered original asset URL '+decoded);const bytes=asset(path,decoded);assetEntries.get(path).requests++;
    res.setHeader('Content-Type',types[extname(path)]||'application/octet-stream');res.setHeader('Content-Length',bytes.length);res.end(req.method==='HEAD'?undefined:bytes);
   }catch(error){errors.push(String(error.stack||error));res.writeHead(500);res.end('Immutable fixture asset verification failed');}
  });
  await new Promise((ok,reject)=>{server.once('error',reject);server.listen(0,'127.0.0.1',ok);});const origin='http://127.0.0.1:'+server.address().port;
  const native=process.platform==='darwin';assert(native||process.platform==='linux','Only actual Metal/macOS and SwiftShader/Linux backends are supported');
  const executablePath=process.env.UNIFORM_ARRAY_PROOF_BROWSER_PATH;browser=await chromium.launch({headless:!native,args:native?['--enable-gpu','--use-gl=angle','--use-angle=metal']:['--use-angle=swiftshader','--enable-unsafe-swiftshader'],...(executablePath?{executablePath}:{channel:'chrome'})});report.browserVersion=browser.version();
  const context=await browser.newContext({viewport:{width:WIDTH,height:HEIGHT},deviceScaleFactor:1,reducedMotion:'reduce',serviceWorkers:'block'});
  await context.route('**/*',route=>{const url=route.request().url();if(url.startsWith(origin+'/')||url.startsWith('data:')||url.startsWith('blob:'))return route.continue();errors.push('Unexpected external asset request: '+url);return route.abort();});
  const page=await context.newPage();page.on('pageerror',error=>errors.push(String(error.stack||error)));page.on('requestfailed',request=>failedRequests.push({url:request.url(),failure:request.failure()}));
  page.on('console',message=>{if(message.type()==='error')errors.push(message.text());else if(message.text().startsWith('uniform array proof '))console.log(message.text());});
  await page.goto(origin+'/',{waitUntil:'load',timeout:120000});await page.waitForFunction(()=>typeof window.__uniformArrayProof==='function',{},{timeout:120000});
  const result=await Promise.race([page.evaluate(()=>window.__uniformArrayProof()),new Promise((_,reject)=>{deadline=setTimeout(()=>reject(Error('Full-world proof exceeded35minutes')),35*60*1000);})]);clearTimeout(deadline);
  const captures=result.images;delete result.images;report.result=result;
  // Persist every well-named capture before inspecting dimensions/equality, so
  // a failing row keeps the evidence needed to diagnose it.
  const pending=[];assert(Array.isArray(captures),'Browser did not return captures');
  for(const [index,capture]of captures.entries()){
   const valid=typeof capture.name==='string'&&/^[a-z0-9-]+$/.test(capture.name),name=valid?capture.name:'invalid-capture-'+index;
   const duplicate=pending.some(item=>item.name===name),file=(duplicate?name+'-duplicate-'+index:name)+'.png';
   const data=typeof capture.png==='string'?capture.png:'',bytes=Buffer.from(data.replace(/^data:image\/png;base64,/,''),'base64');await writeFile(resolve(output,file),bytes);
   pending.push({name,file,bytes,valid,duplicate,dataUrl:data.startsWith('data:image/png;base64,')});report.captures.push({name,file,sha256:sha256(bytes),bytes:bytes.length});
  }
  exactNames(pending,EXPECTED_IMAGES,'name','Saved image names');const decoded=new Map();
  for(const capture of pending){
   assert(capture.valid&&!capture.duplicate&&capture.dataUrl,'Invalid/duplicate PNG capture '+capture.name);const value=decodePng(capture.bytes,WIDTH,HEIGHT);
   let opaque=true;for(let i=3;i<value.rgba.length;i+=4)if(value.rgba[i]!==255){opaque=false;break;}assert(opaque,capture.name+': framebuffer alpha must survive PNG roundtrip');decoded.set(capture.name,value);Object.assign(report.captures.find(item=>item.file===capture.file),{width:value.width,height:value.height,rgbaSha256:value.rgbaSha256,readPixelsSha256:value.readPixelsSha256});
  }
  const validated=validateResult(result,decoded,native);report.independent=validated.independent;report.independentCoverage=validated.coverage;report.timingSummary=validateTimings(result,native);
  assert.equal(errors.length,0,'Page, shader or immutable asset errors');assert.equal(failedRequests.length,0,'Failed asset requests');report.passed=true;
 }catch(error){errors.push(String(error.stack||error));process.exitCode=1;}
 finally{
  clearTimeout(deadline);await browser?.close();if(server)await new Promise(ok=>server.close(ok));
  report.pinnedSources=[...pinnedSources.values()].map(({content,...receipt})=>receipt);report.assetTransformations=report.pinnedSources.flatMap(source=>source.transformations.map(transform=>({source:source.path,...transform})));report.assets=[...assetEntries.values()];
  await writeFile(resolve(output,'report.json'),JSON.stringify(report,null,2)+'\n');await writeFile(resolve(output,'summary.json'),JSON.stringify({passed:report.passed,compiled:report.compiled,compileOnly,sourceHead,baseline:BASELINE,gpu:report.result?.gpu,rows:report.result?.rows?.length,cacheCoverage:report.independentCoverage,timingSummary:report.timingSummary,errors,scope:report.scope},null,2)+'\n');
  console.log(JSON.stringify({passed:report.passed,compiled:report.compiled,compileOnly,sourceHead,baseline:BASELINE,gpu:report.result?.gpu,rows:report.result?.rows?.length,errors,report:resolve(output,'report.json')}));
 }
}

if(process.argv.includes('--self-test')){assert.deepEqual(process.argv.slice(2),['--self-test']);selfTest();}else await main();
