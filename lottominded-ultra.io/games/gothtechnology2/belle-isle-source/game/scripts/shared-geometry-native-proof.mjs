#!/usr/bin/env node
/** Additional diagnostic only. This does not replace any full-game release gate.
 * The complete world graph and every requested asset come from immutable Git
 * blobs. The sole current application module is the opt-in uniform cache. */
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {createRequire} from 'node:module';
import {execFileSync} from 'node:child_process';
import {createServer} from 'node:http';
import {readFile,mkdir,writeFile} from 'node:fs/promises';
import {resolve,dirname,extname,sep,posix} from 'node:path';
import {inflateSync,deflateSync} from 'node:zlib';
import {build} from 'esbuild';

const WIDTH=960,HEIGHT=600,BASELINE='d4f4baa8e2016f4c9107b40176388bf2d3f6fe8c';
const CASES=['jefferson-day','jefferson-night','island-day','island-night','conservatory-day','conservatory-night'];
const PARTITIONS={all:CASES,'linux-a':['jefferson-day','jefferson-night','island-day'],'linux-b':['island-night','conservatory-day','conservatory-night']};
const PARTITION_PLAN={version:1,cases:CASES,partitions:PARTITIONS};
const WORKFLOW_PATH='.github/workflows/belle-shared-geometry-proof.yml';
const WORKFLOW_PARTITIONS=[{os:'ubuntu-latest',partition:'linux-a',cases:PARTITIONS['linux-a']},{os:'ubuntu-latest',partition:'linux-b',cases:PARTITIONS['linux-b']},{os:'macos-15',partition:'all',cases:PARTITIONS.all}];
const ARMS=['pooled','native','pooled-cache','native-cache'];
const CANDIDATES=ARMS.slice(1),CACHE_ARMS=ARMS.slice(2),ABBA_GROUPS=8;
const TIMING_CASES=CASES.flatMap(name=>(name.endsWith('-day')?['forced-refresh','steady-color']:['forced-refresh']).flatMap(shadowMode=>CANDIDATES.map(candidate=>name+'|'+shadowMode+'|'+candidate)));
const IMAGE_SUFFIXES=[...ARMS,'repeat','eligible-hidden-control','shadow-off-control','light-update-original-control','light-update-pooled-cache-control','light-update-native-cache-control','restored-control'];
const expectedImages=cases=>cases.flatMap(name=>IMAGE_SUFFIXES.map(suffix=>name+'-'+suffix));
const GAME_PATH='lottominded-ultra.io/games/gothtechnology2/belle-isle-source/game';
const SOURCE_ROOT='lottominded-ultra.io/games/gothtechnology2/';
const CACHE_HASHES={
 'src/belle/shadowMatrixCache.ts':'7e43f3e1abc8c9f6c79eef45b12d90b57e83ae5536714df8493ab3a8fda8347a',
 'src/belle/shadowMatrixCache.test.mjs':'e38bd99680ae85c7c6af2665489a1d8f3de5b430c47e72dca19adf955f2dc36f',
};
const sha256=value=>createHash('sha256').update(value).digest('hex');
const PARTITION_PLAN_SHA256=sha256(JSON.stringify(PARTITION_PLAN));
const hashPattern=/^[a-f0-9]{64}$/;
function partitionCases(partition,native,compileOnly=false){
 assert(Object.hasOwn(PARTITIONS,partition),'Unknown fixed proof partition '+partition);
 if(!compileOnly)assert(native?partition==='all':partition!=='all','Native proof requires all original cases; Linux requires a fixed partition');
 return PARTITIONS[partition];
}
function expectedPrelude(cases){return CASES.slice(0,CASES.indexOf(cases[0])).map((name,index)=>({name,frozenTime:120+index,warmupRenders:6}));}
function validateWorkflowPartitions(source){
 // The workflow matrix is intentionally literal JSON accepted by YAML. Read
 // the actual source rather than trusting environment-provided case names.
 const matches=[...source.matchAll(/^      matrix:\n        include: (\[[\s\S]*?\n        \])\n    env:\n/gm)];
 assert.equal(matches.length,1,'Exactly one literal fixed workflow partition matrix is required');
 const jobs=JSON.parse(matches[0][1]);assert.deepEqual(jobs,WORKFLOW_PARTITIONS,'Workflow partitions or exact case coverage changed');
 assert.deepEqual(jobs.filter(job=>job.os==='ubuntu-latest').flatMap(job=>job.cases),CASES,'Linux partitions must cover every original case exactly once');
 return jobs;
}
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

function validateCache(cache,label,active=true){
 assert(cache&&cache.version===1,label+': diagnostics version');assert.equal(cache.active,active,label+': active');
 for(const key of ['observedPrograms','observedUniforms','contextResets'])integer(cache[key],label+': '+key);
 zero(cache.contextResets,label+': context resets');assert(cache.observedPrograms>0&&cache.observedUniforms>0,label+': no observed native program');
 for(const name of ['directionalShadowMatrix','riverRipples','shipWake','shipShape']){
  const uniform=cache.uniforms[name];assert(uniform,label+': missing named uniform '+name);
  for(const key of ['observedUniforms','setterCalls','delegatedSetterCalls','nativeCalls','nativeSuccesses','nativeErrors','skippedCalls'])integer(uniform[key],label+': '+name+'.'+key);
  assert.equal(uniform.nativeCalls,uniform.nativeSuccesses+uniform.nativeErrors,label+': native accounting '+name);zero(uniform.nativeErrors,label+': native errors '+name);
  assert(uniform.skippedCalls+uniform.nativeCalls<=uniform.setterCalls,label+': impossible setter accounting '+name);
 }
 const shadow=cache.uniforms.directionalShadowMatrix;assert(shadow.observedUniforms>0&&shadow.nativeSuccesses>0&&shadow.skippedCalls>0,label+': no real shadow upload and subsequent skip');
 return shadow;
}
function poolIdentity(stats){return Object.fromEntries(['supported','preparedEntries','activeEntries','pageCount','poolBytes','pages','preparationAttempts','preparationRenders','preparationFrames','preparationReady','fallbacks','observerErrors','contextLosses'].map(key=>[key,stats[key]]));}
function validateArmActivity(record,arm,label){
 const delta=record.poolDelta;assert(delta,label+': missing pool deltas');for(const key of ['renderCalls','pooledCalls','colorCalls','shadowCalls'])integer(delta[key],label+': '+key);
 if(arm.startsWith('pooled'))assert(delta.renderCalls>0&&delta.pooledCalls>0&&delta.colorCalls>0,label+': pooled path was not exercised');
 else for(const key of ['renderCalls','pooledCalls','colorCalls','shadowCalls'])zero(delta[key],label+': native path ran pool hooks '+key);
 if(arm.endsWith('-cache'))validateCache(record.cache,label);
 else if(record.cache)assert.equal(record.cache.active,false,label+': cache leaked into baseline/native arm');
}
function validateResult(result,decoded,native,partition){
 const expectedCases=partitionCases(partition,native);assert.equal(result.partition,partition,'Browser partition');assert.deepEqual(result.expectedCases,expectedCases,'Browser expected cases');assert.equal(result.partitionPlanSha256,PARTITION_PLAN_SHA256,'Browser fixed partition plan');assert.deepEqual(result.prelude,expectedPrelude(expectedCases),'Original preceding view progression');
 assert.equal(result.schema,'belle-shared-geometry-experiment-v1');assert.equal(result.width,WIDTH);assert.equal(result.height,HEIGHT);assert.equal(result.dpr,1);assert.equal(result.threeRevision,'185');
 assert.equal(result.software,!native,'Declared renderer backend');assert(native?/Metal/i.test(result.gpu)&&!/SwiftShader|llvmpipe/i.test(result.gpu):/SwiftShader/i.test(result.gpu),'Unexpected actual GPU '+result.gpu);
 assert.deepEqual(result.errors,[],'Browser diagnostic errors');exactNames(result.rows,expectedCases,'name','Views');exactNames(result.controls,expectedCases,'name','Controls');
 assert(result.poolBefore?.supported===true&&result.poolBefore.preparationReady===true,'Original shared buffers unsupported/unprepared');
 integer(result.poolBefore.activeEntries,'Prepared entries',200);integer(result.poolBefore.pageCount,'Prepared pages',1);integer(result.poolBefore.poolBytes,'Pool bytes',1);
 assert.deepEqual(poolIdentity(result.poolAfter),poolIdentity(result.poolBefore),'Pool pages, preparation or eligibility changed');
 for(const key of ['fallbacks','observerErrors','contextLosses'])zero(result.poolAfter[key],'Pool '+key);
 assert(Array.isArray(result.poolBefore.entries)&&result.poolBefore.entries.length>=200,'Missing actual eligible source entries');
 assert(result.geometry?.meshes?.length>=200&&result.geometry?.geometries?.length>0,'Missing full-world geometry receipts');
 assert(Array.isArray(result.programs)&&result.programs.length>0,'No actual linked programs');const programs=new Map();
 for(const program of result.programs){
  integer(program.id,'Program id');assert(!programs.has(program.id),'Duplicate program id');programs.set(program.id,program);assert.equal(program.linked,true,'Program did not link');
  for(const type of ['vertex','fragment']){assert(typeof program[type]==='string'&&program[type].length>100,'Missing native '+type+' source');assert.match(program[type+'Sha256'],hashPattern);assert.equal(sha256(program[type]),program[type+'Sha256'],'Actual linked '+type+' hash');}
 }
 const independent=[],cacheRows=[];
 for(const row of result.rows){
  const label=row.name;assert.equal(row.width,WIDTH);assert.equal(row.height,HEIGHT);assert.equal(row.style,'authentic');assert.equal(row.bridgePreview,false,'Optional bridge must remain off');
  assert.equal(row.hour,label.endsWith('-night')?21:14);assert.equal(row.frozenTime,120+CASES.indexOf(label),label+': original frozen time');assert.equal(row.geometryEqual,true,label+': geometry');assert.match(row.geometrySha256,hashPattern);assert.equal(row.afterGeometrySha256,row.geometrySha256,label+': source geometry changed');
  for(const key of ['repeatChangedPixels','repeatMaxChannelDelta','repeatShadowChangedPixels'])zero(row[key],label+': '+key);
  exactNames(row.comparisons,ARMS,'arm',label+' arms');const original=row.comparisons.find(c=>c.arm==='pooled'),image=decoded.get(label+'-pooled');
  integer(original.calls,label+': native calls',1);finite(original.triangles,label+': triangles',1);assert(original.draws?.length>0,label+': no observed actual submissions');
  for(const compared of row.comparisons){
   const id=label+'-'+compared.arm;
   for(const key of ['changedPixels','maxChannelDelta','shadowChangedPixels','shadowMaxChannelDelta'])zero(compared[key],id+': '+key);
   assert.equal(compared.orderEqual,true,id+': draw order');assert.equal(compared.countsEqual,true,id+': draw counts');assert.equal(compared.calls,original.calls);assert.equal(compared.triangles,original.triangles);
   const normalized=compared.draws.map(({substituted,...draw})=>draw),expected=original.draws.map(({substituted,...draw})=>draw);assert.deepEqual(normalized,expected,id+': independently compared actual draw identity/order');
   for(const draw of compared.draws){assert(programs.has(draw.program),id+': draw references missing linked native program');integer(draw.start,id+': draw start');integer(draw.count,id+': draw count');assert(['color','shadow'].includes(draw.phase));assert.equal(typeof draw.substituted,'boolean');}
   const color=compared.draws.filter(d=>d.substituted&&d.phase==='color').length,shadow=compared.draws.filter(d=>d.substituted&&d.phase==='shadow').length;
   assert.equal(compared.substitutedColorDraws,color);assert.equal(compared.substitutedShadowDraws,shadow);
   assert.equal(compared.poolDelta.pooledCalls,color+shadow,id+': actual substitutions vs pooled calls');assert.equal(compared.poolDelta.colorCalls,color,id+': actual color substitutions');assert.equal(compared.poolDelta.shadowCalls,shadow,id+': actual shadow substitutions');
   if(compared.arm.startsWith('pooled'))assert(color+shadow>0,id+': no pool substitution');else zero(color+shadow,id+': unexpected substitution');
   validateArmActivity(compared,compared.arm,id);if(compared.arm.endsWith('-cache'))cacheRows.push(compared);
   assert.match(compared.rgbaSha256,hashPattern);assert.match(compared.shadowSha256,hashPattern);assert.equal(compared.rgbaSha256,original.rgbaSha256);assert.equal(compared.shadowSha256,original.shadowSha256);
   const capture=decoded.get(id);assert(capture,id+': saved PNG missing');assert.equal(capture.readPixelsSha256,compared.rgbaSha256,id+': saved PNG is not the reported framebuffer');
   const diff=pixelDiff(image.rgba,capture.rgba);zero(diff.changedPixels,id+': independent RGBA');zero(diff.maxChannelDelta,id+': independent channel delta');independent.push({name:id,...diff});
  }
  for(const suffix of ['repeat','restored-control']){const diff=pixelDiff(image.rgba,decoded.get(label+'-'+suffix).rgba);zero(diff.changedPixels,label+': independent '+suffix);independent.push({name:label+'-'+suffix,...diff});}
  assert.equal(row.passed,true,label+': browser result');
 }
 let namedShadowSkips=0,nativeShadowUpdates=0,maxEligible=0,maxShadow=0,maxUpdate=0;
 for(const row of cacheRows)namedShadowSkips+=row.cache.uniforms.directionalShadowMatrix.skippedCalls;
 for(const control of result.controls){
  const label=control.name,original=decoded.get(label+'-pooled'),updated=decoded.get(label+'-light-update-original-control');
  const hidden=pixelDiff(original.rgba,decoded.get(label+'-eligible-hidden-control').rgba),shadow=pixelDiff(original.rgba,decoded.get(label+'-shadow-off-control').rgba),update=pixelDiff(original.rgba,updated.rgba);
  assert.equal(hidden.changedPixels,control.eligibleHiddenChangedPixels,label+': independent visibility control');assert.equal(shadow.changedPixels,control.shadowOffChangedPixels,label+': independent shadow control');assert.equal(update.changedPixels,control.uniformUpdateChangedPixels,label+': independent live uniform control');
  maxEligible=Math.max(maxEligible,hidden.changedPixels);maxShadow=Math.max(maxShadow,shadow.changedPixels);maxUpdate=Math.max(maxUpdate,update.changedPixels);
  exactNames(control.uniformUpdates,CACHE_ARMS,'arm',label+' live uniform controls');
  for(const compared of control.uniformUpdates){
   const id=label+'-light-update-'+compared.arm+'-control';for(const key of ['changedPixels','maxChannelDelta','shadowChangedPixels','shadowMaxChannelDelta'])zero(compared[key],id+': '+key);
   assert.equal(compared.orderEqual,true,id+': order');assert.equal(compared.countsEqual,true,id+': counts');integer(compared.nativeShadowUploads,id+': changed shadow uploads',1);nativeShadowUpdates+=compared.nativeShadowUploads;
   const diff=pixelDiff(updated.rgba,decoded.get(id).rgba);zero(diff.changedPixels,id+': independent changed uniform pixels');independent.push({name:id,...diff});
  }
  zero(control.restoredChangedPixels,label+': restored pixels');zero(control.restoredMaxChannelDelta,label+': restored delta');assert.equal(control.passed,true,label+': controls');
 }
 const pooledDraws=result.rows.flatMap(row=>row.comparisons.find(compared=>compared.arm==='pooled').draws);
 const substitutedColorDraws=pooledDraws.filter(draw=>draw.substituted&&draw.phase==='color').length,substitutedShadowDraws=pooledDraws.filter(draw=>draw.substituted&&draw.phase==='shadow').length;
 assert(substitutedColorDraws>0&&substitutedShadowDraws>0,'Original eligible geometry must exercise actual color and shadow substitutions');
 const expectedCoverage={rows:expectedCases.length*CACHE_ARMS.length,substitutedColorDraws,substitutedShadowDraws,namedShadowSkips,nativeShadowUpdates,shadowChangedPixels:maxShadow,eligibleChangedPixels:maxEligible,uniformUpdateChangedPixels:maxUpdate};assert.deepEqual(result.cacheCoverage,expectedCoverage,'Independent control/cache coverage');
 assert(maxEligible>=16&&maxShadow>=16&&maxUpdate>=16,'Actual eligible geometry, receivers and live shadow update must each affect >=16 pixels in at least one view');
 if(!native)assert.deepEqual(result.timings,[],'Software timing must not be reported as native evidence');
 assert.equal(result.passed,true,'Browser proof failed');return {independent,coverage:expectedCoverage};
}
function median(values){const sorted=[...values].sort((a,b)=>a-b),middle=Math.floor(sorted.length/2);return sorted.length%2?sorted[middle]:(sorted[middle-1]+sorted[middle])/2;}
function validateTimings(result,native){
 if(!native){assert.deepEqual(result.timings,[],'SwiftShader must not produce acceptance timings');return [];}
 exactNames(result.timings.map(row=>({name:row.name+'|'+row.shadowMode+'|'+row.candidate})),TIMING_CASES,'name','Native timing cases');
 return result.timings.map(timing=>{
  const id=timing.name+'|'+timing.shadowMode+'|'+timing.candidate,view=result.rows.find(row=>row.name===timing.name),baseline=view.comparisons.find(row=>row.arm==='pooled');
  assert.equal(timing.baseline,'pooled');assert.equal(timing.order,'ABBA');assert.equal(timing.repetitions,ABBA_GROUPS);assert.equal(timing.lanes.length,ABBA_GROUPS*4,id+': lane count');
  const timedBaseline=timing.lanes[0];integer(timedBaseline.calls,id+': measured native calls',1);finite(timedBaseline.triangles,id+': measured triangles',1);
  if(timing.shadowMode==='forced-refresh'){assert.equal(timedBaseline.calls,baseline.calls,id+': forced-refresh calls');assert.equal(timedBaseline.triangles,baseline.triangles,id+': forced-refresh triangles');}
  const groups=[];for(let group=0;group<ABBA_GROUPS;group++){
   const lanes=timing.lanes.slice(group*4,group*4+4);assert.deepEqual(lanes.map(lane=>lane.arm),['pooled',timing.candidate,timing.candidate,'pooled'],id+': ABBA order');
   for(const lane of lanes){assert.equal(lane.repetition,group+1);finite(lane.cpuMs,id+': CPU ms',Number.MIN_VALUE);finite(lane.fenceMs,id+': fence ms');assert.equal(lane.gpu.status,'complete',id+': elapsed query');finite(lane.gpu.nanoseconds,id+': GPU ns',Number.MIN_VALUE);assert.equal(lane.calls,timedBaseline.calls,id+': timed calls');assert.equal(lane.triangles,timedBaseline.triangles,id+': timed triangles');validateArmActivity(lane,lane.arm,id+' timing '+lane.arm);if(timing.shadowMode==='steady-color')zero(lane.poolDelta.shadowCalls,id+': steady-color shadow submissions');}
   const pair={repetition:group+1};for(const [metric,read]of [['cpuMs',lane=>lane.cpuMs],['gpuMs',lane=>lane.gpu.nanoseconds/1e6],['fenceMs',lane=>lane.fenceMs]]){const original=(read(lanes[0])+read(lanes[3]))/2,candidate=(read(lanes[1])+read(lanes[2]))/2;pair[metric]={baseline:original,candidate,delta:candidate-original,percent:original?100*(candidate-original)/original:null};}groups.push(pair);
  }
  const metrics={};for(const metric of ['cpuMs','gpuMs','fenceMs'])metrics[metric]={baselineMedian:median(groups.map(group=>group[metric].baseline)),candidateMedian:median(groups.map(group=>group[metric].candidate)),pairedMedianDelta:median(groups.map(group=>group[metric].delta)),pairedMedianPercent:median(groups.map(group=>group[metric].percent??0)),improvedGroups:groups.filter(group=>group[metric].delta<0).length,totalGroups:groups.length};
  return {name:timing.name,shadowMode:timing.shadowMode,candidate:timing.candidate,groups,metrics,scope:'Balanced frozen full-world ABBA diagnostic only; no full-game frame-pacing or release acceptance claim.'};
 });
}

function pngForTest(pixels,width,height,filter=0){
 const chunk=(type,data)=>{const name=Buffer.from(type),out=Buffer.alloc(data.length+12);out.writeUInt32BE(data.length);name.copy(out,4);data.copy(out,8);out.writeUInt32BE(crc32(Buffer.concat([name,data])),8+data.length);return out;};
 const head=Buffer.alloc(13);head.writeUInt32BE(width);head.writeUInt32BE(height,4);head[8]=8;head[9]=6;const stride=width*4,raw=Buffer.alloc((stride+1)*height);
 for(let y=0;y<height;y++){raw[y*(stride+1)]=filter;for(let x=0;x<stride;x++){const left=x>=4?pixels[y*stride+x-4]:0,up=y?pixels[(y-1)*stride+x]:0,c=y&&x>=4?pixels[(y-1)*stride+x-4]:0,predictor=filter===0?0:filter===1?left:filter===2?up:filter===3?Math.floor((left+up)/2):paeth(left,up,c);raw[y*(stride+1)+1+x]=(pixels[y*stride+x]-predictor)&255;}}
 return Buffer.concat([Buffer.from('89504e470d0a1a0a','hex'),chunk('IHDR',head),chunk('IDAT',deflateSync(raw)),chunk('IEND',Buffer.alloc(0))]);
}
async function selfTest(){
 const pixels=Buffer.from([1,2,3,255,250,4,5,255,17,31,63,255,99,100,101,255]);
 for(let filter=0;filter<=4;filter++)assert.deepEqual(decodePng(pngForTest(pixels,2,2,filter),2,2).rgba,pixels,'Filter '+filter);
 const corrupt=pngForTest(pixels,2,2);corrupt[45]^=1;assert.throws(()=>decodePng(corrupt,2,2),/CRC/);assert.throws(()=>decodePng(pngForTest(pixels,2,2),3,2),/width/);
 const alpha=Buffer.from(pixels);alpha[3]--;assert.deepEqual(pixelDiff(pixels,alpha),{changedPixels:1,maxChannelDelta:1});
 assert.throws(()=>exactNames([{name:'a'},{name:'a'}],['a','b'],'name','fixture'),/identifiers/);assert.throws(()=>validateArmActivity({poolDelta:{renderCalls:1,pooledCalls:1,colorCalls:1,shadowCalls:0}},'native','fixture'),/native path/);
 assert.equal(decodePng(pngForTest(pixels,2,2),2,2).readPixelsSha256,sha256(bottomUp(pixels,2,2)));
 assert.throws(()=>partitionCases('chosen-case',false),/Unknown/);assert.throws(()=>partitionCases('all',false),/Linux/);assert.throws(()=>partitionCases('linux-a',true),/Native/);
 assert.deepEqual(expectedPrelude(PARTITIONS.all),[]);assert.deepEqual(expectedPrelude(PARTITIONS['linux-a']),[]);assert.deepEqual(expectedPrelude(PARTITIONS['linux-b']),[{name:'jefferson-day',frozenTime:120,warmupRenders:6},{name:'jefferson-night',frozenTime:121,warmupRenders:6},{name:'island-day',frozenTime:122,warmupRenders:6}]);
 assert.deepEqual([...expectedImages(PARTITIONS['linux-a']),...expectedImages(PARTITIONS['linux-b'])],expectedImages(CASES));assert.equal(expectedImages(CASES).length,66);assert.equal(TIMING_CASES.length,27);
 const repo=execFileSync('git',['rev-parse','--show-toplevel'],{cwd:import.meta.dirname,encoding:'utf8'}).trim(),workflow=await readFile(resolve(repo,WORKFLOW_PATH),'utf8');validateWorkflowPartitions(workflow);
 assert.throws(()=>validateWorkflowPartitions(workflow.replace('"partition":"linux-b"','"partition":"linux-a"')),/partitions/);assert.throws(()=>validateWorkflowPartitions(workflow.replace('"island-night","conservatory-day","conservatory-night"','"island-day","conservatory-day","conservatory-night"')),/coverage/);
 console.log('Shared geometry proof self-test passed: PNG decoding and equality, exact fixed workflow partitions, six-case/66-image union, 27 native timings, prior-view times, and invalid partition/backend rejection.');
}

async function main(){
 const compileOnly=process.argv.includes('--compile-only');assert(process.argv.slice(2).every(arg=>arg==='--compile-only'),'Unknown driver argument');
 const game=resolve(import.meta.dirname,'..'),gitArgs={cwd:game,maxBuffer:256*1024*1024},git=(...args)=>execFileSync('git',args,gitArgs);
 const repo=git('rev-parse','--show-toplevel').toString().trim(),sourceHead=git('rev-parse','HEAD').toString().trim(),sourceTree=git('rev-parse','HEAD^{tree}').toString().trim();
 gitArgs.cwd=repo;
 if(process.env.SHARED_GEOMETRY_PROOF_SOURCE_SHA)assert.equal(sourceHead,process.env.SHARED_GEOMETRY_PROOF_SOURCE_SHA,'Source HEAD is not the requested exact commit');
 if(process.env.SHARED_GEOMETRY_PROOF_BASELINE_SHA)assert.equal(process.env.SHARED_GEOMETRY_PROOF_BASELINE_SHA,BASELINE,'The original baseline cannot be changed by environment');
 const output=resolve(game,'output/shared-geometry-proof');await mkdir(output,{recursive:true});
 const errors=[],failedRequests=[],pinnedSources=new Map(),assetEntries=new Map(),assetBytes=new Map(),literalAssets=new Map(),sourceFiles=new Map();
 const environmentDefines={'import.meta.env.PROD':'false','import.meta.env.BASE_URL':'"/"','import.meta.env':'{}'};
 const partition=process.env.SHARED_GEOMETRY_PROOF_PARTITION??'all',native=process.platform==='darwin';let expectedCases=[];
 const report={schema:'belle-shared-geometry-native-proof-v1',baseline:BASELINE,sourceHead,sourceTree,platform:process.platform,partition,expectedCases,partitionPlan:PARTITION_PLAN,partitionPlanSha256:PARTITION_PLAN_SHA256,width:WIDTH,height:HEIGHT,dpr:1,compileOnly,compiled:false,passed:false,errors,failedRequests,fixtureSha256:null,sourceReceipts:[],pinnedSources:[],assetTransformations:[],assets:[],captures:[],independent:[],timingSummary:[],result:null,environmentDefines,scope:'Additional diagnostic: the declared fixed partition of one immutable original full-world snapshot, four exact native/pool/cache arms, fixed Authentic day/night poses. Both Linux partitions are required for all six-case software coverage; native always runs all six cases and all 27 timing comparisons. No full-game riding, optional bridge, controls, input, collision, physical iPad, or release acceptance is implied.'};
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
  expectedCases=partitionCases(partition,native,compileOnly);report.expectedCases=expectedCases;report.expectedImages=expectedImages(expectedCases);
  const matrixCases=process.env.SHARED_GEOMETRY_PROOF_MATRIX_CASES;
  if(process.env.CI&&!compileOnly)assert(matrixCases,'CI requires the workflow matrix case receipt');
  report.matrixCasesReceipt=matrixCases===undefined?null:JSON.parse(matrixCases);if(matrixCases!==undefined)assert.deepEqual(report.matrixCasesReceipt,expectedCases,'Workflow case receipt differs from the fixed partition');
  report.workflowPartitions=validateWorkflowPartitions(await readFile(resolve(repo,WORKFLOW_PATH),'utf8'));
  const tree=git('ls-tree','-rz',BASELINE,'--',SOURCE_ROOT).toString();for(const line of tree.split('\0').filter(Boolean)){const match=line.match(/^(\d+) (\w+) ([a-f0-9]{40})\t([\s\S]+)$/);assert(match,'Unexpected immutable tree record');sourceFiles.set(match[4],{mode:match[1],type:match[2],blob:match[3]});}assert(sourceFiles.size>0,'Immutable baseline tree is empty');
  report.baselineTree=git('rev-parse',BASELINE+'^{tree}').toString().trim();
  const receiptPaths=[GAME_PATH+'/scripts/shared-geometry-native-proof.mjs',GAME_PATH+'/scripts/shared-geometry-proof-browser.ts',...Object.keys(CACHE_HASHES).map(path=>GAME_PATH+'/'+path),GAME_PATH+'/package.json',GAME_PATH+'/package-lock.json',SOURCE_ROOT+'package.json',SOURCE_ROOT+'package-lock.json',WORKFLOW_PATH];
  for(const path of receiptPaths){
   const bytes=await readFile(resolve(repo,path)),actual=sha256(bytes);let headHash=null;try{headHash=sha256(execFileSync('git',['show',sourceHead+':'+path],{...gitArgs,stdio:['ignore','pipe','ignore']}));}catch(error){if(!compileOnly)throw error;}
   const receipt={path,sha256:actual,headSha256:headHash,matchesHead:actual===headHash};report.sourceReceipts.push(receipt);if(!compileOnly)assert.equal(receipt.matchesHead,true,'Proof source differs from exact HEAD: '+path);
   const relative=path.startsWith(GAME_PATH+'/')?path.slice(GAME_PATH.length+1):null;if(CACHE_HASHES[relative])assert.equal(actual,CACHE_HASHES[relative],'Reviewed cache module/test changed: '+path);
   if(path.endsWith('/package.json')||path.endsWith('/package-lock.json'))assert.equal(actual,sha256(original(path).bytes),'Dependencies differ from original world: '+path);
  }
  const compiled=await build({absWorkingDir:game,entryPoints:[resolve(game,'scripts/shared-geometry-proof-browser.ts')],bundle:true,format:'esm',target:'es2022',write:false,logLevel:'error',metafile:true,plugins:[plugin],define:environmentDefines});
  const javascript=compiled.outputFiles[0].contents;report.fixtureSha256=sha256(javascript);report.bundleInputs=[];
  const allowedCurrent=new Set([GAME_PATH+'/scripts/shared-geometry-proof-browser.ts',GAME_PATH+'/src/belle/shadowMatrixCache.ts']);
  for(const input of Object.keys(compiled.metafile.inputs).sort()){
   if(input.startsWith('pinned-source:')){report.bundleInputs.push({path:input,pinned:true});continue;}
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
  assert(native||process.platform==='linux','Only actual Metal/macOS and SwiftShader/Linux backends are supported');
  const executablePath=process.env.SHARED_GEOMETRY_PROOF_BROWSER_PATH;browser=await chromium.launch({headless:!native,args:native?['--enable-gpu','--use-gl=angle','--use-angle=metal']:['--use-angle=swiftshader','--enable-unsafe-swiftshader'],...(executablePath?{executablePath}:{channel:'chrome'})});report.browserVersion=browser.version();
  const context=await browser.newContext({viewport:{width:WIDTH,height:HEIGHT},deviceScaleFactor:1,reducedMotion:'reduce',serviceWorkers:'block'});
  await context.route('**/*',route=>{const url=route.request().url();if(url.startsWith(origin+'/')||url.startsWith('data:')||url.startsWith('blob:'))return route.continue();errors.push('Unexpected external asset request: '+url);return route.abort();});
  const page=await context.newPage();page.on('pageerror',error=>errors.push(String(error.stack||error)));page.on('requestfailed',request=>failedRequests.push({url:request.url(),failure:request.failure()}));
  page.on('console',message=>{if(message.type()==='error')errors.push(message.text());else if(message.text().startsWith('shared geometry proof '))console.log(message.text());});
  await page.goto(origin+'/?partition='+encodeURIComponent(partition),{waitUntil:'load',timeout:120000});await page.waitForFunction(()=>typeof window.__sharedGeometryProof==='function',{},{timeout:120000});
  const result=await Promise.race([page.evaluate(()=>window.__sharedGeometryProof()),new Promise((_,reject)=>{deadline=setTimeout(()=>reject(Error('Full-world proof exceeded35minutes')),35*60*1000);})]);clearTimeout(deadline);
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
  exactNames(pending,expectedImages(expectedCases),'name','Saved image names');const decoded=new Map();
  for(const capture of pending){
   assert(capture.valid&&!capture.duplicate&&capture.dataUrl,'Invalid/duplicate PNG capture '+capture.name);const value=decodePng(capture.bytes,WIDTH,HEIGHT);
   let opaque=true;for(let i=3;i<value.rgba.length;i+=4)if(value.rgba[i]!==255){opaque=false;break;}assert(opaque,capture.name+': framebuffer alpha must survive PNG roundtrip');decoded.set(capture.name,value);Object.assign(report.captures.find(item=>item.file===capture.file),{width:value.width,height:value.height,rgbaSha256:value.rgbaSha256,readPixelsSha256:value.readPixelsSha256});
  }
  const validated=validateResult(result,decoded,native,partition);report.independent=validated.independent;report.independentCoverage=validated.coverage;report.timingSummary=validateTimings(result,native);
  assert.equal(errors.length,0,'Page, shader or immutable asset errors');assert.equal(failedRequests.length,0,'Failed asset requests');report.passed=true;
 }catch(error){errors.push(String(error.stack||error));process.exitCode=1;}
 finally{
  clearTimeout(deadline);await browser?.close();if(server)await new Promise(ok=>server.close(ok));
  report.pinnedSources=[...pinnedSources.values()].map(({content,...receipt})=>receipt);report.assetTransformations=report.pinnedSources.flatMap(source=>source.transformations.map(transform=>({source:source.path,...transform})));report.assets=[...assetEntries.values()];
  await writeFile(resolve(output,'report.json'),JSON.stringify(report,null,2)+'\n');await writeFile(resolve(output,'summary.json'),JSON.stringify({passed:report.passed,compiled:report.compiled,compileOnly,sourceHead,baseline:BASELINE,partition,expectedCases,partitionPlanSha256:PARTITION_PLAN_SHA256,gpu:report.result?.gpu,rows:report.result?.rows?.length,cacheCoverage:report.independentCoverage,timingSummary:report.timingSummary,errors,scope:report.scope},null,2)+'\n');
  console.log(JSON.stringify({passed:report.passed,compiled:report.compiled,compileOnly,sourceHead,baseline:BASELINE,partition,expectedCases,gpu:report.result?.gpu,rows:report.result?.rows?.length,errors,report:resolve(output,'report.json')}));
 }
}

if(process.argv.includes('--self-test')){assert.deepEqual(process.argv.slice(2),['--self-test']);await selfTest();}else await main();
