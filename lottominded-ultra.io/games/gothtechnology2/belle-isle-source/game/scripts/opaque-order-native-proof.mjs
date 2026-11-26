#!/usr/bin/env node
/** Additional diagnostic only. Existing opaque draws are reordered; all original release gates remain unchanged. */
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {createRequire} from 'node:module';
import {execFileSync} from 'node:child_process';
import {createServer} from 'node:http';
import {readFile,readdir,mkdir,writeFile} from 'node:fs/promises';
import {resolve,dirname,extname,sep,posix} from 'node:path';
import {inflateSync,deflateSync} from 'node:zlib';

const WIDTH=960,HEIGHT=600,BASELINE='d4f4baa8e2016f4c9107b40176388bf2d3f6fe8c';
const CASES=['jefferson-day','jefferson-night','island-day','island-night','conservatory-day','conservatory-night','ramp-grazing-day','under-ramp-day'];
const PARTITIONS={all:CASES,'linux-a':CASES.slice(0,4),'linux-b':CASES.slice(4)};
const ARMS=['original','early-terrain','late-sky'],CANDIDATES=ARMS.slice(1),ABBA_GROUPS=8;
const TIMING_CASES=CASES.slice(0,6).flatMap(name=>CANDIDATES.map(candidate=>name+'|forced-refresh|'+candidate));
const IMAGE_SUFFIXES=[...ARMS,'repeat','terrain-hidden-control','sky-hidden-control','shadow-off-control','restored-control'];
const GAME_PATH='lottominded-ultra.io/games/gothtechnology2/belle-isle-source/game';
const SOURCE_ROOT='lottominded-ultra.io/games/gothtechnology2/';
const HELPER_HASHES={
 'src/belle/opaqueSurfaceOrder.ts':'5fa1e235302cc0db448e873c368ce0ebe1e9cefdacf577d3a85c7d71513b7a15',
 'src/belle/opaqueSurfaceOrder.test.ts':'c35ed09d1450616bab048e21ef8194291c342e67cfbb088cc3e2a4df8efcca90',
};
const FACTORY_HOOKS={
 'src/belle/pavement.ts':{sha256:'b655c47430e8830b000154d594e7f6a5840e8b516eec17f946dcb4025b1a32db',
  needle:'mesh.receiveShadow=true;limitGroundDrawRange(mesh,part.ranges);scene.add(mesh);',
  replacement:"mesh.receiveShadow=true;limitGroundDrawRange(mesh,part.ranges);scene.add(mesh);if(part.kind==='asphalt')registerOpaqueSurfaceOwner('asphalt',mesh);"},
 'src/belle/shore.ts':{sha256:'ef2d18e69c9c944258a266a80a2b5bd08e263e908a7e1e2c73e70a41e86e7c64',
  needle:"const mesh=new T.Mesh(g,grass);mesh.name='Graded bridge approach';mesh.receiveShadow=true;scene.add(mesh);",
  replacement:"const mesh=new T.Mesh(g,grass);mesh.name='Graded bridge approach';mesh.receiveShadow=true;scene.add(mesh);registerOpaqueSurfaceOwner('approach',mesh);"},
 'src/belle/islandSky.ts':{sha256:'40d4db69cea275afb9d7473f355cdc98b3618bc2f20be32bc2a202f5855029e0',
  needle:'scene.add(sky);scene.background=null;',replacement:"scene.add(sky);scene.background=null;registerOpaqueSurfaceOwner('sky',sky);"},
};
const FACTORY_IMPORT="import {registerOpaqueSurfaceOwner} from 'fixture:opaque-order-owners';\n";
const REGISTRY_SOURCE='export const opaqueSurfaceOwners=[];export function registerOpaqueSurfaceOwner(kind,mesh){opaqueSurfaceOwners.push({kind,mesh});}';
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

const POOL_COUNTERS=['renderCalls','pooledCalls','colorCalls','shadowCalls'];
function poolIdentity(stats){return Object.fromEntries(['supported','preparedEntries','activeEntries','pageCount','poolBytes','pages','preparationAttempts','preparationRenders','preparationFrames','preparationReady','fallbacks','observerErrors','contextLosses'].map(key=>[key,stats[key]]));}
function validatePool(delta,label){for(const key of POOL_COUNTERS)integer(delta?.[key],label+': '+key);assert(delta.renderCalls>0&&delta.colorCalls>0,label+': original pooling is not active');assert.equal(delta.pooledCalls,delta.colorCalls+delta.shadowCalls,label+': original pooled calls');}
function applyFactoryHook(content,path){
 const key=path.startsWith(GAME_PATH+'/')?path.slice(GAME_PATH.length+1):path,hook=FACTORY_HOOKS[key];
 if(!hook)return null;
 assert.equal(sha256(content),hook.sha256,'Unreviewed original factory source '+key);
 assert.equal(content.split(hook.needle).length-1,1,'Factory owner site must occur exactly once: '+key);
 return {code:FACTORY_IMPORT+content.replace(hook.needle,hook.replacement),receipt:{kind:'factory-owner-registration',source:key,original:hook.needle,replacement:hook.replacement,import:FACTORY_IMPORT,replacements:1}};
}
const same=(a,b)=>JSON.stringify(a)===JSON.stringify(b);
function orderFor(kind,arm){return arm==='early-terrain'&&kind!=='sky'?(kind==='asphalt'?-104:-103):arm==='late-sky'&&kind==='sky'?1000000:kind==='sky'?-100:0;}
function validateOwners(receipt,baseline,arm,label){
 assert.equal(receipt?.mode,arm,label+': actual controller mode');assert(Array.isArray(receipt.owners)&&receipt.owners.length===4,label+': factory owner count');
 assert.deepEqual(receipt.owners.map(owner=>owner.kind).sort(),['approach','approach','asphalt','sky'],label+': exact factory owner kinds');
 assert.equal(new Set(receipt.owners.map(owner=>owner.id)).size,4,label+': unique original mesh identities');
 const originals=new Map((baseline?.owners??receipt.owners).map(owner=>[owner.id,owner]));
 for(const owner of receipt.owners){
  integer(owner.id,label+': source mesh id');integer(owner.geometryId,label+': source geometry');assert.equal(typeof owner.name,'string');
  assert(Array.isArray(owner.materialIds)&&owner.materialIds.length===1,label+': one final material');integer(owner.materialIds[0],label+': material id');
  assert.equal(owner.originalOrder,orderFor(owner.kind,'original'),label+': original factory order');assert.equal(owner.order,orderFor(owner.kind,arm),label+': assigned order');
  const original=originals.get(owner.id);assert(original,label+': foreign mesh owner');assert.deepEqual({...owner,order:original.order},{...original},label+': factory identity changed');
 }
}
function withoutOrder(draw){const {renderOrder,...identity}=draw;return identity;}
function drawMultiset(draws){return draws.map(draw=>JSON.stringify(withoutOrder(draw))).sort();}
function allowedDraws(original,owners,arm){
 const byId=new Map(owners.map(owner=>[owner.id,owner]));
 const opaque=original.filter(draw=>draw.phase==='color'&&!draw.transparent&&draw.transmission===0);
 const slots=[];original.forEach((draw,index)=>{if(draw.phase==='color'&&!draw.transparent&&draw.transmission===0)slots.push(index);});
 let previous=null;for(const draw of opaque){if(previous)assert(previous.groupOrder<draw.groupOrder||previous.groupOrder===draw.groupOrder&&previous.renderOrder<=draw.renderOrder,'Original opaque sequence violates native group/render ordering');previous=draw;}
 for(const draw of original){
  const owner=byId.get(draw.object);if(owner){assert.equal(draw.phase,'color','Factory owner unexpectedly casts a shadow');assert.equal(draw.groupOrder,0,'Factory owner is no longer in the direct scene group');assert.equal(draw.transparent,false);assert.equal(draw.transmission,0);assert.equal(draw.depthTest,true);assert.equal(draw.depthWrite,owner.kind!=='sky');assert.equal(draw.depthFunc,3);assert.equal(draw.sourceGeometry,owner.geometryId);assert.equal(draw.material,owner.materialIds[0]);}
  else if(draw.phase==='color'&&!draw.transparent&&draw.transmission===0&&draw.groupOrder===0)assert(![-104,-103,1000000].includes(draw.renderOrder),'Candidate order collides with another original opaque draw');
 }
 const sorted=opaque.map((draw,index)=>({...draw,renderOrder:byId.has(draw.object)?orderFor(byId.get(draw.object).kind,arm):draw.renderOrder,__originalIndex:index}));
 sorted.sort((a,b)=>a.groupOrder-b.groupOrder||a.renderOrder-b.renderOrder||a.__originalIndex-b.__originalIndex);
 const expected=original.map(draw=>({...draw}));for(let i=0;i<slots.length;i++){const {__originalIndex,...draw}=sorted[i];expected[slots[i]]=draw;}return expected;
}
function inspectDrawPermutation(original,compared,owners,arm){
 const expected=allowedDraws(original,owners,arm);
 return {colorOrderAllowed:same(compared.filter(d=>d.phase==='color'),expected.filter(d=>d.phase==='color')),
  shadowOrderEqual:same(compared.filter(d=>d.phase==='shadow'),original.filter(d=>d.phase==='shadow')),
  drawMultisetEqual:same(drawMultiset(compared),drawMultiset(original))};
}
function validateDraws(draws,programs,label){
 assert(Array.isArray(draws)&&draws.length>0,label+': no actual direct submissions');
 for(const draw of draws){
  for(const key of ['object','sourceGeometry','material','program','start','count'])integer(draw[key],label+': draw '+key);
  assert(programs.has(draw.program),label+': missing actual linked native program');assert(['color','shadow'].includes(draw.phase),label+': unknown draw phase');
  for(const key of ['substituted','transparent','depthTest','depthWrite'])assert.equal(typeof draw[key],'boolean',label+': draw '+key);
  for(const key of ['renderOrder','groupOrder'])assert(typeof draw[key]==='number'&&Number.isFinite(draw[key]),label+': invalid '+key);
  finite(draw.transmission,label+': transmission');integer(draw.depthFunc,label+': depth function');
 }
}
function validateCasePlan(result,bridge){
 const {a,b,length,width}=bridge,ux=(b[0]-a[0])/length,uz=(b[1]-a[1])/length;
 assert.deepEqual(result.bridgeBasis,{a,b,length,width,ux,uz},'Camera recipes must use the immutable original bridge');
 const positions=[[0,6,0],[480,8,830],[1290,7,1115]],targets=[[160,4,290],[630,3,1050],[1330.8,9,1174.7]];
 for(let index=0;index<6;index++){assert.deepEqual(result.casePlan[index].position,positions[Math.floor(index/2)]);assert.deepEqual(result.casePlan[index].target,targets[Math.floor(index/2)]);}
 const recipes=[{position:[-130,width/2+.35,.18],target:[-6,width/2-.35,.04]},{position:[-60,0,-.65],target:[8,width/2+4,.1]}];
 for(let index=0;index<2;index++)for(const key of ['position','target']){const pose=result.casePlan[6+index],value=pose.recipe?.[key],[distance,side,heightOffset]=recipes[index][key];assert(value,'Missing fixed ramp recipe');assert.equal(value.s,distance);assert.equal(value.w,side);assert.equal(value.heightOffset,heightOffset);assert(Number.isFinite(value.terrainHeight),'Original sampled terrain height must be finite');const position=[a[0]+ux*distance+uz*side,value.terrainHeight+heightOffset,a[1]+uz*distance-ux*side];assert.deepEqual(value.position,position);assert.deepEqual(pose[key],position);}
 const partitions={all:CASES,'linux-a':CASES.slice(0,4),'linux-b':CASES.slice(4)};assert.equal(result.partitionPlanSha256,sha256(JSON.stringify({version:1,cases:CASES,partitions})),'Fixed plan receipt');
}
function validateResult(result,decoded,native,partition,bridge){
 assert.equal(result.schema,'belle-opaque-order-experiment-v1');assert.equal(result.width,WIDTH);assert.equal(result.height,HEIGHT);assert.equal(result.dpr,1);assert.equal(result.threeRevision,'185');
 validateCasePlan(result,bridge);assert.equal(result.partition,partition,'Actual fixed partition');assert.deepEqual(result.casePlan.map(item=>item.name),CASES,'Complete immutable case plan');assert.deepEqual(result.selectedCases,PARTITIONS[partition],'Actual planned partition');
 for(const [index,item]of result.casePlan.entries()){assert.equal(item.index,index);assert.equal(item.frozenTime,120+index);assert.equal(item.hour,item.name.endsWith('-night')?21:14);for(const key of ['position','target'])assert(Array.isArray(item[key])&&item[key].length===3&&item[key].every(Number.isFinite),'Fixed camera '+key);}
 assert.deepEqual(result.prelude,partition==='linux-b'?CASES.slice(0,4).map((name,index)=>({name,frozenTime:120+index,warmupRenders:3})):[],'Fixed world-state replay before a partition');
 assert.equal(result.software,!native,'Declared renderer backend');assert(native?/Metal/i.test(result.gpu)&&!/SwiftShader|llvmpipe/i.test(result.gpu):/SwiftShader/i.test(result.gpu),'Unexpected actual GPU '+result.gpu);
 assert(Array.isArray(result.errors),'Browser errors must be retained');exactNames(result.rows,PARTITIONS[partition],'name','Views');exactNames(result.controls,PARTITIONS[partition],'name','Controls');
 assert.deepEqual(result.rows.map(row=>row.name),PARTITIONS[partition],'Fixed view execution order');
 assert(result.poolBefore?.supported===true&&result.poolBefore.preparationReady===true,'Original shared buffers unsupported/unprepared');integer(result.poolBefore.activeEntries,'Prepared entries',200);integer(result.poolBefore.pageCount,'Prepared pages',1);integer(result.poolBefore.poolBytes,'Pool bytes',1);
 assert.deepEqual(poolIdentity(result.poolAfter),poolIdentity(result.poolBefore),'Pool pages, preparation or eligibility changed');assert.equal(result.poolHooksPreserved,true,'Original renderer/pool hooks changed');
 for(const key of ['fallbacks','observerErrors','contextLosses'])zero(result.poolAfter[key],'Pool '+key);
 assert(Array.isArray(result.poolBefore.entries)&&result.poolBefore.entries.length>=200,'Missing actual eligible source entries');assert(result.geometry?.meshes?.length>=200&&result.geometry?.geometries?.length>0,'Missing full-world geometry receipts');
 assert(Array.isArray(result.materials)&&result.materials.length>100,'Missing original full-world material receipts');validateOwners(result.ownerBaseline,null,'original','Factory baseline');
 const owners=result.ownerBaseline.owners,skyOwner=owners.find(owner=>owner.kind==='sky'),skyId=skyOwner.id;
 validateOwners(result.ownerFinal,result.ownerBaseline,'original','Final restored factory ownership');
 function depthWriters(records,label){
  assert(Array.isArray(records)&&records.length>100,label+': complete renderable material depth-state census');const ids=new Set();
  for(const material of records){integer(material.id,label+': material id');assert(!ids.has(material.id),label+': duplicate material record');ids.add(material.id);for(const key of ['transparent','depthTest','depthWrite','colorWrite','alphaHash'])assert.equal(typeof material[key],'boolean',label+': '+key);for(const key of ['transmission','opacity','alphaTest'])finite(material[key],label+': '+key);integer(material.depthFunc,label+': depth function');integer(material.blending,label+': blending');}
  const nonwriters=records.filter(material=>!material.transparent&&material.transmission===0&&!material.depthWrite);return same(nonwriters.map(material=>material.id),[skyOwner.materialIds[0]])&&records.every(material=>material.depthTest);
 }
 depthWriters(result.opaqueDepthWriters,'Whole scene');
 assert(Array.isArray(result.programs)&&result.programs.length>0,'No actual linked programs');const programs=new Map();
 for(const program of result.programs){integer(program.id,'Program id');assert(!programs.has(program.id),'Duplicate program id');programs.set(program.id,program);assert.equal(program.linked,true,'Program did not link');for(const type of ['vertex','fragment']){assert(typeof program[type]==='string'&&program[type].length>100,'Missing native '+type+' source');assert.match(program[type+'Sha256'],hashPattern);assert.equal(sha256(program[type]),program[type+'Sha256'],'Actual linked '+type+' hash');}}
 const independent=[],coverage={rows:0,substitutedColorDraws:0,substitutedShadowDraws:0,terrainChangedPixels:0,skyChangedPixels:0,shadowChangedPixels:0,earlyTerrainReorderedRows:0,lateSkyReorderedRows:0};
 const candidateResults=CANDIDATES.map(arm=>({arm,passed:true,rows:[],errors:[]})),byArm=new Map(candidateResults.map(result=>[result.arm,result]));let baselinePassed=true;
 function fail(arm,label,condition,message){if(condition)return;const entry=byArm.get(arm);if(entry){entry.passed=false;entry.errors.push(label+': '+message);}else baselinePassed=false;}
 function compareImages(original,candidate,label){const a=decoded.get(original),b=decoded.get(candidate);assert(a&&b,label+': saved images missing');const diff=pixelDiff(a.rgba,b.rgba);independent.push({name:label,...diff});return diff;}
 for(const row of result.rows){
  const label=row.name,planned=result.casePlan.find(item=>item.name===label),lateSkyAssumption=depthWriters(row.opaqueDepthWriters,label);assert.equal(row.width,WIDTH);assert.equal(row.height,HEIGHT);assert.equal(row.style,'authentic');assert.equal(row.bridgePreview,false,'Optional bridge must remain off in this diagnostic');assert.equal(row.hour,label.endsWith('-night')?21:14);assert.equal(row.frozenTime,120+CASES.indexOf(label),'Fixed world clock');assert.deepEqual(row.camera.position,planned.position,label+': actual camera position');assert.deepEqual(row.camera.target,planned.target,label+': actual camera target');const delta=planned.target.map((value,index)=>value-planned.position[index]),length=Math.hypot(...delta);assert(Array.isArray(row.camera.direction)&&row.camera.direction.length===3&&row.camera.direction.every((value,index)=>Number.isFinite(value)&&Math.abs(value-delta[index]/length)<=1e-12),label+': actual camera direction');assert(Array.isArray(row.camera.matrix)&&row.camera.matrix.length===16&&row.camera.matrix.every(Number.isFinite));assert.deepEqual(row.camera.matrix.slice(12,15),planned.position,label+': actual camera matrix position');assert(Array.isArray(row.camera.projection)&&row.camera.projection.length===16&&row.camera.projection.every(Number.isFinite));assert.equal(row.near,.08,label+': near clip');assert.equal(row.far,22000,label+': far clip');
  for(const type of ['geometry','material']){assert.match(row[type+'Sha256'],hashPattern);assert.equal(row['after'+type[0].toUpperCase()+type.slice(1)+'Sha256'],row[type+'Sha256'],label+': original '+type+' changed');assert.equal(row[type+'Equal'],true,label+': '+type+' equality');}
  for(const key of ['repeatChangedPixels','repeatMaxChannelDelta','repeatShadowChangedPixels','repeatShadowMaxChannelDelta'])zero(row[key],label+': '+key);assert.equal(row.repeatOrderEqual,true);assert.equal(row.repeatCountsEqual,true);
  exactNames(row.comparisons,ARMS,'arm',label+' arms');const original=row.comparisons.find(c=>c.arm==='original');integer(original.calls,label+': native calls',1);finite(original.triangles,label+': triangles',1);validateDraws(original.draws,programs,label+' original');
  // A late sky may pass at the same depth as other surfaces. Retain it as an
  // experiment, but verify this view has no OTHER opaque non-writer hidden by
  // the reordering. Its pixel result, including ties, is still tested exactly.
  let rowPassed=true;
  for(const compared of row.comparisons){
   const arm=compared.arm,id=label+'-'+arm,geometryEqual=compared.geometrySha256===row.geometrySha256,materialEqual=compared.materialSha256===row.materialSha256,depthScope=arm!=='late-sky'||lateSkyAssumption;for(const type of ['geometry','material'])assert.match(compared[type+'Sha256'],hashPattern);fail(arm,id,geometryEqual,'Source geometry changed');fail(arm,id,materialEqual,'Source material changed');fail(arm,id,depthScope,'Another opaque material violates the late-sky depth-writer scope');validateOwners(compared.orderReceipt,result.ownerBaseline,arm,id);validateDraws(compared.draws,programs,id);
   const {colorOrderAllowed,shadowOrderEqual,drawMultisetEqual}=inspectDrawPermutation(original.draws,compared.draws,owners,arm),countsEqual=compared.calls===original.calls&&compared.triangles===original.triangles;
   for(const [key,value]of Object.entries({colorOrderAllowed,shadowOrderEqual,drawMultisetEqual,countsEqual})){assert.equal(compared[key],value,id+': independent '+key);fail(arm,id,value,key);}
   const diff=compareImages(label+'-original',id,id);assert.equal(compared.changedPixels,diff.changedPixels,id+': independent changed pixels');assert.equal(compared.maxChannelDelta,diff.maxChannelDelta,id+': independent channel delta');fail(arm,id,diff.changedPixels===0&&diff.maxChannelDelta===0,'RGBA pixels differ');
   integer(compared.shadowChangedPixels,id+': shadow difference');integer(compared.shadowMaxChannelDelta,id+': shadow channel delta');assert.match(compared.shadowSha256,hashPattern);assert.equal(compared.shadowSha256===original.shadowSha256,compared.shadowChangedPixels===0,id+': shadow hash/difference agreement');fail(arm,id,compared.shadowChangedPixels===0&&compared.shadowMaxChannelDelta===0,'Shadow pixels differ');
   assert.match(compared.rgbaSha256,hashPattern);assert.equal(decoded.get(id)?.readPixelsSha256,compared.rgbaSha256,id+': PNG must match actual framebuffer');
   const color=compared.draws.filter(d=>d.substituted&&d.phase==='color').length,shadow=compared.draws.filter(d=>d.substituted&&d.phase==='shadow').length;assert.equal(compared.substitutedColorDraws,color);assert.equal(compared.substitutedShadowDraws,shadow);validatePool(compared.poolDelta,id);assert.equal(compared.poolDelta.pooledCalls,color+shadow);assert.equal(compared.poolDelta.colorCalls,color);assert.equal(compared.poolDelta.shadowCalls,shadow);assert.deepEqual(compared.poolDelta,original.poolDelta,id+': original pooled work changed');
   const passed=diff.changedPixels===0&&diff.maxChannelDelta===0&&compared.shadowChangedPixels===0&&compared.shadowMaxChannelDelta===0&&colorOrderAllowed&&shadowOrderEqual&&drawMultisetEqual&&countsEqual&&geometryEqual&&materialEqual&&depthScope;
   assert.equal(compared.passed,passed,id+': comparison verdict');assert(Array.isArray(compared.errors),id+': comparison errors');if(passed)assert.deepEqual(compared.errors,[]);rowPassed&&=passed;
   if(arm==='original'){assert(passed,id+': immutable original failed');coverage.substitutedColorDraws+=color;coverage.substitutedShadowDraws+=shadow;}
   else{const moved=!same(compared.draws.filter(d=>d.phase==='color').map(d=>d.object),original.draws.filter(d=>d.phase==='color').map(d=>d.object));if(moved)coverage[arm==='early-terrain'?'earlyTerrainReorderedRows':'lateSkyReorderedRows']++;byArm.get(arm).rows.push({name:label,passed,changedPixels:diff.changedPixels,maxChannelDelta:diff.maxChannelDelta,shadowChangedPixels:compared.shadowChangedPixels,colorOrderAllowed,shadowOrderEqual,drawMultisetEqual,countsEqual,geometryEqual,materialEqual,depthScope,reordered:moved});}
  }
  for(const suffix of ['repeat','restored-control']){const diff=compareImages(label+'-original',label+'-'+suffix,label+'-'+suffix);zero(diff.changedPixels,label+': '+suffix);zero(diff.maxChannelDelta,label+': '+suffix);}
  assert.equal(row.passed,rowPassed,label+': row verdict');coverage.rows++;
 }
 for(const control of result.controls){
  const label=control.name,original=decoded.get(label+'-original');const hidden=pixelDiff(original.rgba,decoded.get(label+'-terrain-hidden-control').rgba),sky=pixelDiff(original.rgba,decoded.get(label+'-sky-hidden-control').rgba),shadow=pixelDiff(original.rgba,decoded.get(label+'-shadow-off-control').rgba);
  assert.equal(hidden.changedPixels,control.terrainHiddenChangedPixels,label+': visibility positive control');assert.equal(sky.changedPixels,control.skyHiddenChangedPixels,label+': sky positive control');assert.equal(shadow.changedPixels,control.shadowOffChangedPixels,label+': shadow positive control');
  assert.deepEqual([...control.terrainHiddenIds].sort((a,b)=>a-b),owners.filter(owner=>owner.kind!=='sky').map(owner=>owner.id).sort((a,b)=>a-b),label+': actual terrain-control owners');assert.deepEqual(control.skyHiddenIds,[skyId],label+': actual sky-control owner');
  coverage.terrainChangedPixels=Math.max(coverage.terrainChangedPixels,hidden.changedPixels);coverage.skyChangedPixels=Math.max(coverage.skyChangedPixels,sky.changedPixels);coverage.shadowChangedPixels=Math.max(coverage.shadowChangedPixels,shadow.changedPixels);
  for(const key of ['restoredChangedPixels','restoredMaxChannelDelta','restoredShadowChangedPixels','restoredShadowMaxChannelDelta'])zero(control[key],label+': '+key);assert.equal(control.restoredOrderEqual,true);assert.equal(control.restoredCountsEqual,true);assert.equal(control.passed,true,label+': controls');
 }
 assert.equal(coverage.rows,PARTITIONS[partition].length);assert(coverage.substitutedColorDraws>0&&coverage.substitutedShadowDraws>0,'Original pooled color and shadow work must be exercised');assert(coverage.terrainChangedPixels>=16&&coverage.skyChangedPixels>=16&&coverage.shadowChangedPixels>=16,'Terrain, sky and mapped-shadow positive controls must each affect at least16 pixels in this fixed partition');assert(coverage.earlyTerrainReorderedRows>0&&coverage.lateSkyReorderedRows>0,'Both candidate changes must affect actual draw ordering');
 assert.deepEqual(result.coverage,{terrainChangedPixels:coverage.terrainChangedPixels,skyChangedPixels:coverage.skyChangedPixels,shadowChangedPixels:coverage.shadowChangedPixels},'Independently decoded positive-control coverage');
 exactNames(result.candidateResults,CANDIDATES,'arm','Browser candidate verdicts');for(const candidate of candidateResults)assert.equal(result.candidateResults.find(entry=>entry.arm===candidate.arm).passed,candidate.passed,'Independent candidate verdict '+candidate.arm);
 if(!native)assert.deepEqual(result.timings,[],'Software timings cannot be native evidence');
 return {independent,coverage,candidateResults,passed:baselinePassed&&candidateResults.every(candidate=>candidate.passed)&&result.errors.length===0};
}
function median(values){const sorted=[...values].sort((a,b)=>a-b),middle=Math.floor(sorted.length/2);return sorted.length%2?sorted[middle]:(sorted[middle-1]+sorted[middle])/2;}
function validateTimings(result,native){
 if(!native){assert.deepEqual(result.timings,[],'SwiftShader must not produce native timings');return [];}
 exactNames(result.timings.map(row=>({name:row.name+'|'+row.shadowMode+'|'+row.candidate})),TIMING_CASES,'name','Native timing cases');assert.deepEqual(result.timings.map(row=>row.name+'|'+row.shadowMode+'|'+row.candidate),TIMING_CASES,'Fixed native timing execution order');let nextQueryId=1;const mean=values=>values.reduce((sum,value)=>sum+value,0)/values.length;
 const summary=result.timings.map(timing=>{
  const id=timing.name+'|'+timing.shadowMode+'|'+timing.candidate,view=result.rows.find(row=>row.name===timing.name),baseline=view.comparisons.find(row=>row.arm==='original');
  assert.equal(timing.passed,true,id+': completed timing');assert.deepEqual(timing.errors,[],id+': timing failures');validateOwners(timing.orderReceipt,result.ownerBaseline,'original',id+': completed ABBA mode');assert.equal(timing.baseline,'original');assert(CANDIDATES.includes(timing.candidate));assert.equal(timing.shadowMode,'forced-refresh');assert.equal(timing.order,'ABBA');assert.equal(timing.repetitions,ABBA_GROUPS);assert.equal(timing.framesPerLane,16);assert.equal(timing.warmupRenders,3);assert.equal(timing.lanes.length,ABBA_GROUPS*4,id+': lane count');
  const first=timing.lanes[0].samples?.[0];integer(first?.calls,id+': measured calls',1);finite(first?.triangles,id+': measured triangles',1);assert.equal(first.calls,baseline.calls);assert.equal(first.triangles,baseline.triangles);
  const groups=[];for(let group=0;group<ABBA_GROUPS;group++){
   const lanes=timing.lanes.slice(group*4,group*4+4);assert.deepEqual(lanes.map(lane=>lane.arm),['original',timing.candidate,timing.candidate,'original'],id+': fixed ABBA order');
   for(const [laneIndex,lane]of lanes.entries()){
    const label=id+' group'+group+' lane'+laneIndex;assert.equal(lane.repetition,group+1);assert.equal(lane.framesPerLane,16);assert.equal(lane.warmupRenders,3);assert.equal(lane.samples?.length,16,label+': missing raw frames');validateOwners(lane.orderBefore,result.ownerBaseline,lane.arm,label+': starting measured owner orders');validateOwners(lane.orderReceipt,result.ownerBaseline,lane.arm,label+': ending measured owner orders');assert.deepEqual(lane.orderBefore,lane.orderReceipt,label+': orders changed inside timed lane');
    validatePool(lane.poolDelta,label);const delta={};for(const key of POOL_COUNTERS){integer(lane.poolBefore[key],label+': before '+key);integer(lane.poolAfter[key],label+': after '+key);delta[key]=lane.poolAfter[key]-lane.poolBefore[key];}assert.deepEqual(lane.poolDelta,delta,label+': independently recomputed pool delta');assert.deepEqual(lane.poolDelta,timing.lanes[0].poolDelta,label+': original pooled work changed');assert.equal(lane.poolDelta.renderCalls,16,label+': exactly16 measured renders');assert.equal(lane.poolDelta.colorCalls,baseline.poolDelta.colorCalls*16,label+': original color substitutions');assert.equal(lane.poolDelta.shadowCalls,baseline.poolDelta.shadowCalls*16,label+': original shadow substitutions');
    for(const [index,sample]of lane.samples.entries()){
     assert.equal(sample.index,index,label+': raw frame order');finite(sample.cpuMs,label+': CPU ms',Number.MIN_VALUE);finite(sample.fenceMs,label+': completion wait');assert.equal(sample.calls,first.calls);assert.equal(sample.triangles,first.triangles);assert.equal(sample.gpu?.status,'complete');finite(sample.gpu.nanoseconds,label+': actual GPU ns',Number.MIN_VALUE);assert.equal(sample.gpu.queryId,nextQueryId++,label+': unique contiguous real elapsed query');assert.equal(sample.gpu.resultAvailable,true);assert.equal(sample.gpu.disjoint,false);
    }
    assert.equal(lane.cpuMs,mean(lane.samples.map(sample=>sample.cpuMs)),label+': CPU mean');assert.equal(lane.fenceMs,mean(lane.samples.map(sample=>sample.fenceMs)),label+': completion wait mean');assert.equal(lane.gpu.status,'complete');assert.equal(lane.gpu.nanoseconds,mean(lane.samples.map(sample=>sample.gpu.nanoseconds)),label+': elapsed GPU mean');
   }
   const pair={repetition:group+1};for(const [metric,read]of [['cpuMs',lane=>lane.cpuMs],['gpuMs',lane=>lane.gpu.nanoseconds/1e6],['fenceMs',lane=>lane.fenceMs]]){const original=(read(lanes[0])+read(lanes[3]))/2,candidate=(read(lanes[1])+read(lanes[2]))/2;pair[metric]={baseline:original,candidate,delta:candidate-original,percent:original?100*(candidate-original)/original:null};}groups.push(pair);
  }
  const metrics={};for(const metric of ['cpuMs','gpuMs','fenceMs'])metrics[metric]={baselineMean:mean(groups.map(group=>group[metric].baseline)),candidateMean:mean(groups.map(group=>group[metric].candidate)),pairedMeanDelta:mean(groups.map(group=>group[metric].delta)),baselineMedian:median(groups.map(group=>group[metric].baseline)),candidateMedian:median(groups.map(group=>group[metric].candidate)),pairedMedianDelta:median(groups.map(group=>group[metric].delta)),pairedMedianPercent:median(groups.map(group=>group[metric].percent??0)),improvedGroups:groups.filter(group=>group[metric].delta<0).length,totalGroups:groups.length};
  return {name:timing.name,shadowMode:timing.shadowMode,candidate:timing.candidate,framesPerLane:16,rawSamples:512,groups,metrics,scope:'Eight complete paired ABBA groups, all raw samples retained. Diagnostic GPU execution and CPU submission only; completion waits are not FPS. No full-game release acceptance.'};
 });assert.equal(nextQueryId-1,TIMING_CASES.length*ABBA_GROUPS*4*16,'All6144 planned real GPU queries retained');return summary;
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
 const owners=['asphalt','approach','approach','sky'].map((kind,index)=>({id:index+1,kind,name:kind,geometryId:101+index,materialIds:[201+index],originalOrder:orderFor(kind,'original'),order:orderFor(kind,'original')}));
 const ownerBaseline={mode:'original',owners};const receipt=arm=>({mode:arm,owners:owners.map(owner=>({...owner,order:orderFor(owner.kind,arm)}))});
 const draw=(object,renderOrder,extra={})=>({object,name:'source'+object,sourceGeometry:100+object,material:200+object,phase:'color',start:0,count:3,program:1,substituted:false,renderOrder,groupOrder:0,transparent:false,transmission:0,depthTest:true,depthWrite:object!==4,depthFunc:3,...extra});
 const original=[draw(90,0,{phase:'shadow'}),draw(10,-102),draw(11,-101),draw(4,-100),draw(12,0),draw(3,0),draw(1,0),draw(2,0),draw(13,0,{transparent:true,depthWrite:false})];
 const early=allowedDraws(original,owners,'early-terrain'),late=allowedDraws(original,owners,'late-sky');assert.deepEqual(early.map(d=>d.object),[90,1,3,2,10,11,4,12,13]);assert.deepEqual(late.map(d=>d.object),[90,10,11,12,3,1,2,4,13]);
 assert.deepEqual(inspectDrawPermutation(original,early,owners,'early-terrain'),{colorOrderAllowed:true,shadowOrderEqual:true,drawMultisetEqual:true});
 const wrong=structuredClone(early);[wrong[4],wrong[5]]=[wrong[5],wrong[4]];assert.equal(inspectDrawPermutation(original,wrong,owners,'early-terrain').colorOrderAllowed,false,'Unauthorized nonowner reorder must fail');
 const material=structuredClone(early);material[1].material++;assert.equal(inspectDrawPermutation(original,material,owners,'early-terrain').drawMultisetEqual,false,'Material change cannot hide in permutation');
 const shadow=structuredClone(early);shadow[0].count+=3;assert.equal(inspectDrawPermutation(original,shadow,owners,'early-terrain').shadowOrderEqual,false,'Shadow draw change must fail');
 const collision=structuredClone(original);collision[1].renderOrder=-104;assert.throws(()=>allowedDraws(collision,owners,'early-terrain'),/collides/);
 const foreign=receipt('early-terrain');foreign.owners[0].id=99;assert.throws(()=>validateOwners(foreign,ownerBaseline,'early-terrain','fixture'),/foreign/);
 assert.throws(()=>applyFactoryHook('changed source',GAME_PATH+'/src/belle/pavement.ts'),/Unreviewed/);
 let queryId=1;const pooled={renderCalls:1,pooledCalls:3,colorCalls:2,shadowCalls:1};
 const result={ownerBaseline,rows:CASES.slice(0,6).map(name=>({name,comparisons:[{arm:'original',calls:5,triangles:10,poolDelta:pooled}]})),timings:[]};
 for(const key of TIMING_CASES){const [name,shadowMode,candidate]=key.split('|'),lanes=[];for(let group=0;group<8;group++)for(const arm of ['original',candidate,candidate,'original']){const samples=Array.from({length:16},(_,index)=>({index,cpuMs:1,fenceMs:0,gpu:{status:'complete',nanoseconds:1000,queryId:queryId++,resultAvailable:true,disjoint:false},calls:5,triangles:10}));lanes.push({arm,repetition:group+1,framesPerLane:16,warmupRenders:3,cpuMs:1,fenceMs:0,gpu:{status:'complete',nanoseconds:1000},poolBefore:{renderCalls:0,pooledCalls:0,colorCalls:0,shadowCalls:0},poolAfter:{renderCalls:16,pooledCalls:48,colorCalls:32,shadowCalls:16},poolDelta:{renderCalls:16,pooledCalls:48,colorCalls:32,shadowCalls:16},orderBefore:receipt(arm),orderReceipt:receipt(arm),samples});}result.timings.push({name,shadowMode,candidate,baseline:'original',order:'ABBA',repetitions:8,framesPerLane:16,warmupRenders:3,orderReceipt:receipt('original'),errors:[],passed:true,lanes});}
 assert.equal(validateTimings(result,true).length,12);const corruptQuery=structuredClone(result);corruptQuery.timings[0].lanes[0].samples[1].gpu.queryId=1;assert.throws(()=>validateTimings(corruptQuery,true),/unique contiguous/);
 const corruptMean=structuredClone(result);corruptMean.timings[0].lanes[0].cpuMs=2;assert.throws(()=>validateTimings(corruptMean,true),/CPU mean/);
 const corruptMode=structuredClone(result);corruptMode.timings[0].lanes[1].orderReceipt=receipt('original');assert.throws(()=>validateTimings(corruptMode,true),/actual controller mode/);
 console.log('Opaque order proof self-test passed: independent PNG decode, alpha/CRC, strict draw permutation, material/shadow identity, factory ownership, immutable hook hashes and all6144 raw GPU query/accounting checks.');
}


async function verifyPartitions(directory){
 assert.equal(typeof directory,'string','Partition artifact directory is required');const root=resolve(directory),files=[];
 async function walk(path){for(const entry of await readdir(path,{withFileTypes:true})){const next=resolve(path,entry.name);if(entry.isDirectory())await walk(next);else if(entry.name==='report.json')files.push(next);}}
 await walk(root);assert.equal(files.length,3,'Exactly two software partitions and one complete native artifact are required');
 const game=resolve(import.meta.dirname,'..'),repo=execFileSync('git',['rev-parse','--show-toplevel'],{cwd:game,encoding:'utf8'}).trim(),sourceHead=execFileSync('git',['rev-parse','HEAD'],{cwd:repo,encoding:'utf8'}).trim();if(process.env.OPAQUE_ORDER_PROOF_SOURCE_SHA)assert.equal(sourceHead,process.env.OPAQUE_ORDER_PROOF_SOURCE_SHA,'Aggregate checkout must be exact source');
 const reports=[];for(const file of files){const report=JSON.parse(await readFile(file,'utf8'));assert.equal(report.schema,'belle-opaque-order-native-proof-v1');assert.equal(report.sourceHead,sourceHead);assert.equal(report.baseline,BASELINE);assert.equal(report.baselineTree,'8754910f55ac44dd430cd5601d789c0d84d40e35');assert.equal(report.compileOnly,false);assert.equal(report.compiled,true);assert.equal(report.passed,true,file+': strict proof failed');assert.deepEqual(report.errors,[]);assert.deepEqual(report.failedRequests,[]);assert.equal(report.fixtureSha256,sha256(await readFile(resolve(dirname(file),'fixture.js'))),'Saved actual fixture hash');
  for(const receipt of report.sourceReceipts){assert.equal(receipt.sha256,sha256(await readFile(resolve(repo,receipt.path))),'Artifact/current proof source differs: '+receipt.path);assert.equal(receipt.matchesHead,true);assert.equal(receipt.headSha256,receipt.sha256);}
  assert.deepEqual(report.casePlan,PARTITIONS[report.partition]);assert.deepEqual(report.result.selectedCases,PARTITIONS[report.partition]);assert.deepEqual(report.result.rows.map(row=>row.name),PARTITIONS[report.partition]);assert.equal(report.result.partition,report.partition);assert.equal(report.result.passed,true);
  exactNames(report.factoryHooks,Object.keys(FACTORY_HOOKS),'source','Aggregate factory owner sites');for(const hook of report.factoryHooks){assert.equal(hook.sha256,FACTORY_HOOKS[hook.source].sha256);assert.equal(hook.replacements,1);}
  const native=report.partition==='all';assert.equal(report.platform,native?'darwin':'linux');assert(native?/Metal/.test(report.result.gpu):/SwiftShader/.test(report.result.gpu));assert.equal(report.result.software,!native);assert.equal(report.result.timings.length,native?12:0);assert.equal(report.timingSummary.length,native?12:0);
  exactNames(report.candidateResults,CANDIDATES,'arm','Aggregate candidate verdicts');for(const candidate of report.candidateResults){assert.equal(candidate.passed,true,candidate.arm+': failed candidate');assert.deepEqual(candidate.errors,[]);assert.deepEqual(candidate.rows.map(row=>row.name),PARTITIONS[report.partition]);}
  const expectedImages=PARTITIONS[report.partition].flatMap(name=>IMAGE_SUFFIXES.map(suffix=>name+'-'+suffix));exactNames(report.captures,expectedImages,'name','Aggregate saved captures');for(const capture of report.captures){assert.equal(capture.width,WIDTH);assert.equal(capture.height,HEIGHT);assert.match(capture.sha256,hashPattern);assert.match(capture.rgbaSha256,hashPattern);assert.match(capture.readPixelsSha256,hashPattern);}
  reports.push(report);
 }
 exactNames(reports,['all','linux-a','linux-b'],'partition','Complete fixed execution partitions');const software=reports.filter(report=>report.platform==='linux');assert.deepEqual(software.flatMap(report=>report.result.rows.map(row=>row.name)).sort(),[...CASES].sort(),'Software partition union must contain every fixed case exactly once');
 const canonical=reports[0];for(const report of reports.slice(1)){assert.equal(report.fixtureSha256,canonical.fixtureSha256,'All backends must execute the same bundled source');assert.deepEqual([...report.sourceReceipts].sort((a,b)=>a.path.localeCompare(b.path)),[...canonical.sourceReceipts].sort((a,b)=>a.path.localeCompare(b.path)),'All backends must use identical source receipts');assert.deepEqual([...report.pinnedSources].sort((a,b)=>a.path.localeCompare(b.path)),[...canonical.pinnedSources].sort((a,b)=>a.path.localeCompare(b.path)),'All backends must use identical immutable graph');}
 console.log(JSON.stringify({passed:true,sourceHead,baseline:BASELINE,nativeCases:8,softwareCases:8,partitions:['all','linux-a','linux-b'],nativeComparisons:12,nativeGpuQueries:6144,scope:'Complete diagnostic partition union only. Original full-game release gates remain separately required.'}));
}

async function main(){
 const compileOnly=process.argv.includes('--compile-only');assert(process.argv.slice(2).every(arg=>arg==='--compile-only'),'Unknown driver argument');
 const game=resolve(import.meta.dirname,'..'),gitArgs={cwd:game,maxBuffer:256*1024*1024},git=(...args)=>execFileSync('git',args,gitArgs);
 const repo=git('rev-parse','--show-toplevel').toString().trim(),sourceHead=git('rev-parse','HEAD').toString().trim(),sourceTree=git('rev-parse','HEAD^{tree}').toString().trim();
 gitArgs.cwd=repo;
 if(process.env.OPAQUE_ORDER_PROOF_SOURCE_SHA)assert.equal(sourceHead,process.env.OPAQUE_ORDER_PROOF_SOURCE_SHA,'Source HEAD is not the requested exact commit');
 if(process.env.OPAQUE_ORDER_PROOF_BASELINE_SHA)assert.equal(process.env.OPAQUE_ORDER_PROOF_BASELINE_SHA,BASELINE,'The original baseline cannot be changed by environment');
 const native=process.platform==='darwin',partition=process.env.OPAQUE_ORDER_PROOF_PARTITION??(native?'all':'linux-a');
 assert(Object.hasOwn(PARTITIONS,partition),'Unknown fixed case partition');if(!compileOnly)assert(native?partition==='all':partition!=='all','Native must run all cases; Linux must use its fixed partition');
 const expectedImages=PARTITIONS[partition].flatMap(name=>IMAGE_SUFFIXES.map(suffix=>name+'-'+suffix));
 const output=resolve(game,'output/opaque-order-proof');await mkdir(output,{recursive:true});
 const errors=[],failedRequests=[],pinnedSources=new Map(),assetEntries=new Map(),assetBytes=new Map(),literalAssets=new Map(),sourceFiles=new Map();
 const environmentDefines={'import.meta.env.PROD':'false','import.meta.env.BASE_URL':'"/"','import.meta.env':'{}'};
 const report={schema:'belle-opaque-order-native-proof-v1',partition,casePlan:PARTITIONS[partition],baseline:BASELINE,sourceHead,sourceTree,platform:process.platform,width:WIDTH,height:HEIGHT,dpr:1,compileOnly,compiled:false,passed:false,errors,failedRequests,fixtureSha256:null,sourceReceipts:[],pinnedSources:[],factoryHooks:[],assetTransformations:[],assets:[],captures:[],independent:[],timingSummary:[],result:null,environmentDefines,scope:'Additional diagnostic: immutable original full world, original/early-terrain/late-sky existing opaque draw orders with original shared buffers. Fixed Authentic day/night, grazing and under-ramp poses. No shader, geometry, shadow, full-game riding, optional bridge, input, collision, physical iPad or release acceptance is implied.'};
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
   const registered=applyFactoryHook(content,path);if(registered){transformations.push(registered.receipt);report.factoryHooks.push({path,sha256:sha256(content),...registered.receipt});}
   const transformed=(registered?.code??content).replace(/new\s+URL\(\s*(['"])([^'"\r\n]+)\1\s*,\s*import\.meta\.url\s*\)(\.href)?/g,(match,_quote,relative,href)=>{
    assert(relative.startsWith('.'),'Only relative static baseline URL assets are supported: '+path);const referenced=posix.normalize(posix.join(posix.dirname(path),relative)),url=assetUrl(referenced),replacement=href?JSON.stringify(url):'new URL('+JSON.stringify(url)+', location.origin)';transformations.push({original:match,replacement,asset:referenced,url});return replacement;
   });
   pinnedSources.set(path,{path,gitBlob:entry.blob,sha256:sha256(bytes),transformedSha256:sha256(transformed),transformations,content:transformed});
  }
  return pinnedSources.get(path).content;
 }
 const registryPlugin={name:'original-factory-owner-receipts',setup(builder){
  builder.onResolve({filter:/^fixture:opaque-order-owners$/},()=>({path:'opaque-order-owners',namespace:'factory-registry'}));
  builder.onLoad({filter:/.*/,namespace:'factory-registry'},()=>({contents:REGISTRY_SOURCE,loader:'js',resolveDir:game}));
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
  const receiptPaths=[GAME_PATH+'/scripts/opaque-order-native-proof.mjs',GAME_PATH+'/scripts/opaque-order-proof-browser.ts',...Object.keys(HELPER_HASHES).map(path=>GAME_PATH+'/'+path),GAME_PATH+'/package.json',GAME_PATH+'/package-lock.json',SOURCE_ROOT+'package.json',SOURCE_ROOT+'package-lock.json','.github/workflows/belle-opaque-order-proof.yml'];
  for(const path of receiptPaths){
   const bytes=await readFile(resolve(repo,path)),actual=sha256(bytes);let headHash=null;try{headHash=sha256(execFileSync('git',['show',sourceHead+':'+path],{...gitArgs,stdio:['ignore','pipe','ignore']}));}catch(error){if(!compileOnly)throw error;}
   const receipt={path,sha256:actual,headSha256:headHash,matchesHead:actual===headHash};report.sourceReceipts.push(receipt);if(!compileOnly)assert.equal(receipt.matchesHead,true,'Proof source differs from exact HEAD: '+path);
   const relative=path.startsWith(GAME_PATH+'/')?path.slice(GAME_PATH.length+1):null;if(HELPER_HASHES[relative])assert.equal(actual,HELPER_HASHES[relative],'Reviewed opaque-order module/test changed: '+path);
   if(path.endsWith('/package.json')||path.endsWith('/package-lock.json'))assert.equal(actual,sha256(original(path).bytes),'Dependencies differ from original world: '+path);
  }
  const {build}=await import('esbuild');
  const compiled=await build({absWorkingDir:game,entryPoints:[resolve(game,'scripts/opaque-order-proof-browser.ts')],bundle:true,format:'esm',target:'es2022',write:false,logLevel:'error',metafile:true,plugins:[registryPlugin,plugin],define:environmentDefines});
  exactNames(report.factoryHooks,Object.keys(FACTORY_HOOKS),'source','Pinned factory receipt injections');
  const javascript=compiled.outputFiles[0].contents;report.fixtureSha256=sha256(javascript);report.bundleInputs=[];
  const allowedCurrent=new Set([GAME_PATH+'/scripts/opaque-order-proof-browser.ts',GAME_PATH+'/src/belle/opaqueSurfaceOrder.ts']);
  for(const input of Object.keys(compiled.metafile.inputs).sort()){
   if(input.startsWith('pinned-source:')){report.bundleInputs.push({path:input,pinned:true});continue;}
   if(input==='factory-registry:opaque-order-owners'){report.bundleInputs.push({path:input,generated:true,sha256:sha256(REGISTRY_SOURCE),scope:'Receipt-only factory references shared by all arms'});continue;}
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
  const executablePath=process.env.OPAQUE_ORDER_PROOF_BROWSER_PATH;browser=await chromium.launch({headless:!native,args:native?['--enable-gpu','--use-gl=angle','--use-angle=metal']:['--use-angle=swiftshader','--enable-unsafe-swiftshader'],...(executablePath?{executablePath}:{channel:'chrome'})});report.browserVersion=browser.version();
  const context=await browser.newContext({viewport:{width:WIDTH,height:HEIGHT},deviceScaleFactor:1,reducedMotion:'reduce',serviceWorkers:'block'});
  await context.route('**/*',route=>{const url=route.request().url();if(url.startsWith(origin+'/')||url.startsWith('data:')||url.startsWith('blob:'))return route.continue();errors.push('Unexpected external asset request: '+url);return route.abort();});
  const page=await context.newPage();page.on('pageerror',error=>errors.push(String(error.stack||error)));page.on('requestfailed',request=>failedRequests.push({url:request.url(),failure:request.failure()}));
  page.on('console',message=>{if(message.type()==='error')errors.push(message.text());else if(message.text().startsWith('opaque order proof '))console.log(message.text());});
  await page.goto(origin+'/',{waitUntil:'load',timeout:120000});await page.waitForFunction(()=>typeof window.__opaqueOrderProof==='function',{},{timeout:120000});
  const result=await Promise.race([page.evaluate(partition=>window.__opaqueOrderProof(partition),partition),new Promise((_,reject)=>{deadline=setTimeout(()=>reject(Error('Full-world proof exceeded35minutes')),35*60*1000);})]);clearTimeout(deadline);
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
  exactNames(pending,expectedImages,'name','Saved image names');const decoded=new Map();
  for(const capture of pending){
   assert(capture.valid&&!capture.duplicate&&capture.dataUrl,'Invalid/duplicate PNG capture '+capture.name);const value=decodePng(capture.bytes,WIDTH,HEIGHT);
   let opaque=true;for(let i=3;i<value.rgba.length;i+=4)if(value.rgba[i]!==255){opaque=false;break;}assert(opaque,capture.name+': framebuffer alpha must survive PNG roundtrip');decoded.set(capture.name,value);Object.assign(report.captures.find(item=>item.file===capture.file),{width:value.width,height:value.height,rgbaSha256:value.rgbaSha256,readPixelsSha256:value.readPixelsSha256});
  }
  const validated=validateResult(result,decoded,native,partition,JSON.parse(asset(GAME_PATH+'/public/belle/map.json').toString('utf8')).bridge);report.independent=validated.independent;report.independentCoverage=validated.coverage;report.candidateResults=validated.candidateResults;report.timingSummary=validateTimings(result,native);
  assert.equal(errors.length,0,'Page, shader or immutable asset errors');assert.equal(failedRequests.length,0,'Failed asset requests');
  report.passed=validated.passed&&result.passed===true;if(!report.passed){errors.push('One or more opaque draw-order candidates failed strict equivalence; see per-candidate results.');process.exitCode=1;}
 }catch(error){errors.push(String(error.stack||error));process.exitCode=1;}
 finally{
  clearTimeout(deadline);await browser?.close();if(server)await new Promise(ok=>server.close(ok));
  report.pinnedSources=[...pinnedSources.values()].map(({content,...receipt})=>receipt);report.assetTransformations=report.pinnedSources.flatMap(source=>source.transformations.map(transform=>({source:source.path,...transform})));report.assets=[...assetEntries.values()];
  await writeFile(resolve(output,'report.json'),JSON.stringify(report,null,2)+'\n');await writeFile(resolve(output,'summary.json'),JSON.stringify({passed:report.passed,compiled:report.compiled,compileOnly,sourceHead,baseline:BASELINE,gpu:report.result?.gpu,rows:report.result?.rows?.length,coverage:report.independentCoverage,candidateResults:report.candidateResults,partition,timingSummary:report.timingSummary,errors,scope:report.scope},null,2)+'\n');
  console.log(JSON.stringify({passed:report.passed,compiled:report.compiled,compileOnly,sourceHead,baseline:BASELINE,partition,gpu:report.result?.gpu,rows:report.result?.rows?.length,errors,report:resolve(output,'report.json')}));
 }
}

if(process.argv.includes('--self-test')){assert.deepEqual(process.argv.slice(2),['--self-test']);selfTest();}else if(process.argv[2]==='--verify-partitions'){assert.equal(process.argv.length,4);await verifyPartitions(process.argv[3]);}else await main();
