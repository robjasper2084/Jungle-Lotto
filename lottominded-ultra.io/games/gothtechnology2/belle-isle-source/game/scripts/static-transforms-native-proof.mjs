#!/usr/bin/env node
/** Additional diagnostic only. Explicit static factory matrix work is disabled; all original release gates remain unchanged. */
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
const ARMS=['original','static'],ABBA_GROUPS=16,TIMING_CASES=CASES.slice(0,6);
const IMAGE_SUFFIXES=[...ARMS,'repeat','hidden-original-control','hidden-static-control','shadow-off-original-control','shadow-off-static-control','immediate-restored-control','restored-static-control','restored-original-control'];
const GAME_PATH='lottominded-ultra.io/games/gothtechnology2/belle-isle-source/game';
const SOURCE_ROOT='lottominded-ultra.io/games/gothtechnology2/';
const STATISTICAL_PLAN_SHA256='f8fc83ea0df0fdee38c64f755f3d775c8137341fd6d499fe8b997fc2126f3ec9';
const HELPER_HASHES={
 'src/belle/staticWorldTransforms.ts':'45ac45a866352a4e67d59278db2a54688ad1c63211fca406851c79bb6944e799',
 'src/belle/staticWorldTransforms.test.ts':'dba5345e15701b1009a860c7c94c0b96270ab9f21e4993201f8379222f976622',
};
const FACTORY_OVERRIDES={
 'src/belle/detroitScene.ts':{original:'b8259828a177be7f03f032b782a6a51ebd9fb161f688a0edba50dcef52e6cb9c',current:'ad0892bcea1f131f028e7b4aa07242630303bbf0c5b0851aab0dcaeda6d76a4e'},
 'src/belle/lakeHabitat.ts':{original:'62f34b32746ec78a3acc932de8dbf65e593b001189aea09b5947383b15eafe49',current:'9d5035eaae91a46b3258f16376b4b66e5b0c03f6b62acadc039dfdea33982f38'},
 'src/belle/detroitAssets.ts':{original:'dc4e9be74658fba8bb52f3ec2d9b01d016aad2818aa4627ca9603a8d779d8f9e',current:'f0f49113deb5a1d34564e97f6fa9fa8a1422ef4f65a7d8bea840ca96a7c02849'},
};
const EXPECTED_OWNERS=[{owner:'detroit-initial',roots:143,nodes:200},{owner:'lake-habitat',roots:42,nodes:147},{owner:'detroit-stream:/__pinned_asset/'+GAME_PATH+'/src/belle/districtModels/street-at-sunset.glb',roots:1,nodes:496},{owner:'detroit-stream:/__pinned_asset/'+GAME_PATH+'/src/belle/districtModels/detroit-scenery.glb',roots:1,nodes:64}];
const REQUIRED_PACKS=['street-at-sunset','detroit-scenery'].map(name=>GAME_PATH+'/src/belle/districtModels/'+name+'.glb');
const SOURCE_RECEIPT_PATHS=[GAME_PATH+'/scripts/static-transforms-native-proof.mjs',GAME_PATH+'/scripts/static-transforms-proof-browser.ts',...Object.keys(HELPER_HASHES).map(path=>GAME_PATH+'/'+path),...Object.keys(FACTORY_OVERRIDES).map(path=>GAME_PATH+'/'+path),GAME_PATH+'/package.json',GAME_PATH+'/package-lock.json',SOURCE_ROOT+'package.json',SOURCE_ROOT+'package-lock.json','.github/workflows/belle-static-transforms-proof.yml'];
const same=(a,b)=>JSON.stringify(a)===JSON.stringify(b);
const mean=values=>values.reduce((a,b)=>a+b,0)/values.length;
const median=values=>{const sorted=[...values].sort((a,b)=>a-b),middle=Math.floor(sorted.length/2);return sorted.length%2?sorted[middle]:(sorted[middle-1]+sorted[middle])/2;};
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

function normalizeFactory(source,key){
 const patches=[];let text=source;
 function replace(needle,replacement,count=1){const actual=text.split(needle).length-1;assert.equal(actual,count,'Exact registration bookkeeping count: '+key+' '+needle);text=text.split(needle).join(replacement);patches.push({original:needle,replacement,count});}
 replace("import {registerStaticWorldTransforms} from './staticWorldTransforms.ts';\n",'');
 if(key==='src/belle/detroitScene.ts'){
  replace('size=320,ownedRoots?:T.Object3D[]','size=320');replace(';ownedRoots?.push(m);',';');replace('  const ownedRoots:T.Object3D[]=[];\n','');
  for(const name of ['m','ground','banks','trail','slab','fallback','proxy','mesh','pond'])replace(';ownedRoots.push('+name+');',';');
  replace(',320,ownedRoots)',')',4);replace("  registerStaticWorldTransforms(scene,'detroit-initial',ownedRoots);\n",'');
 }else if(key==='src/belle/lakeHabitat.ts')replace(" registerStaticWorldTransforms(scene,'lake-habitat',tiles.map(tile=>tile.root));\n",'');
 else if(key==='src/belle/detroitAssets.ts'){
  replace('ready.set(stage,{publish,source:url});','ready.set(stage,publish);');replace('const ready=new Map<T.Group,{publish:()=>void;source:string}>();','const ready=new Map<T.Group,()=>void>();');
  replace("  for(const [stage,{publish,source}] of ready){\n   scene.add(stage);publish();\n   // Warmup temporarily reparents the stage. Register its fixed transforms\n   // only after final publication; subsequent updates change visibility.\n   registerStaticWorldTransforms(scene,'detroit-stream:'+source,[stage]);\n  }","  for(const [stage,publish] of ready){scene.add(stage);publish();}");
 }else assert.fail('Unreviewed factory override '+key);
 assert(!text.includes('registerStaticWorldTransforms')&&!text.includes('ownedRoots'),'Unstripped registration bookkeeping '+key);return {text,patches};
}
function ownerKey(value){assert.equal(typeof value,'string');return value.startsWith('detroit-stream:')?'detroit-stream:'+new URL(value.slice(15),'http://fixture.invalid').pathname:value;}
function flagBits(owner){return owner.nodes?owner.nodes.map(node=>(node.matrixAutoUpdate?1:0)|(node.matrixWorldAutoUpdate?2:0)|(node.matrixWorldNeedsUpdate?4:0)):owner.flagBits;}
function flagCounts(bits){return {matrixAutoUpdate:bits.filter(bits=>bits&1).length,matrixWorldAutoUpdate:bits.filter(bits=>bits&2).length,matrixWorldNeedsUpdate:bits.filter(bits=>bits&4).length};}
function ownerIdentity(owner){return {owner:ownerKey(owner.owner),rootIds:owner.rootIds,nodeIds:owner.nodeIds,rootCount:owner.rootCount,nodeCount:owner.nodeCount};}
function validateRegistry(receipt,baseline,arm,label,full=true){
 assert.equal(receipt?.version,1,label+': registry version');const enabled=arm==='static';assert.equal(receipt.enabled,enabled,label+': actual mode');
 for(const [key,value]of Object.entries({registeredOwners:4,registeredRoots:187,registeredNodes:907,activeOwners:enabled?4:0,activeRoots:enabled?187:0,activeNodes:enabled?907:0,invalidations:0,rejectedRegistrations:0}))assert.equal(receipt[key],value,label+': '+key);
 assert.deepEqual(receipt.rejections,[],label+': rejected factory registrations');exactNames(receipt.owners.map(owner=>({...owner,key:ownerKey(owner.owner)})),EXPECTED_OWNERS.map(owner=>owner.owner),'key',label+': exact published factory owners');
 const allNodes=new Set(),allRoots=new Set();for(const owner of receipt.owners){const expected=EXPECTED_OWNERS.find(item=>item.owner===ownerKey(owner.owner));assert.equal(owner.eligible,true);assert.equal(owner.active,enabled);assert.equal(owner.invalidated,false);assert.equal(owner.reason,null);assert.equal(owner.rootCount,expected.roots);assert.equal(owner.nodeCount,expected.nodes);assert.equal(owner.rootIds.length,expected.roots);assert.equal(owner.nodeIds.length,expected.nodes);
  for(const id of owner.rootIds){integer(id,label+': root id');assert(!allRoots.has(id),label+': duplicate factory root');allRoots.add(id);assert(owner.nodeIds.includes(id),label+': root missing from its node population');}for(const id of owner.nodeIds){integer(id,label+': node id');assert(!allNodes.has(id),label+': overlapping static factories');allNodes.add(id);}
  const actualBits=flagBits(owner);assert(Array.isArray(actualBits)&&actualBits.length===owner.nodeCount,label+': actual per-node flags absent');for(const bits of actualBits)assert(Number.isInteger(bits)&&bits>=0&&bits<=7,label+': invalid actual matrix flag bits');if(!full)assert.deepEqual(owner.flagCounts,flagCounts(actualBits),label+': actual flag counts');if(enabled)assert(actualBits.every(bits=>bits===0),label+': active static flags must all be false');
  if(baseline){const original=baseline.owners.find(item=>ownerKey(item.owner)===expected.owner);assert(original,label+': foreign owner');assert.deepEqual(ownerIdentity(owner),ownerIdentity(original),label+': actual factory identity changed');if(!enabled)assert.deepEqual(actualBits,flagBits(original),label+': original per-node matrix flags not restored');}
  if(full){assert.equal(owner.roots.length,expected.roots);assert.equal(owner.nodes.length,expected.nodes);assert.deepEqual(owner.roots.map(root=>root.id),owner.rootIds);assert.deepEqual(owner.nodes.map(node=>node.id),owner.nodeIds);for(const root of owner.roots){integer(root.parentId,label+': root parent');integer(root.nodeCount,label+': root subtree count',1);assert.equal(root.updateMatrixWorld,enabled?'barrier':'original',label+': root actual matrix method');}for(const node of owner.nodes){for(const key of ['matrixAutoUpdate','matrixWorldAutoUpdate','matrixWorldNeedsUpdate'])assert.equal(typeof node[key],'boolean',label+': node '+key);assert.equal(node.updateMatrixWorld,enabled&&owner.rootIds.includes(node.id)?'barrier':'original',label+': exact actual method');if(enabled){assert.equal(node.matrixAutoUpdate,false);assert.equal(node.matrixWorldAutoUpdate,false);assert.equal(node.matrixWorldNeedsUpdate,false);}}}
 }
 assert.equal(allRoots.size,187);assert.equal(allNodes.size,907);
}
function validateMatrix(frame,label){
 assert(Array.isArray(frame.matrixObjects)&&frame.matrixObjects.length>=907,label+': complete actual scene matrix objects');const ids=new Set();for(const object of frame.matrixObjects){integer(object.id,label+': matrix object');assert(!ids.has(object.id),label+': duplicate matrix object');ids.add(object.id);assert(object.parentId===null||Number.isSafeInteger(object.parentId),label+': parent id');assert.equal(typeof object.visible,'boolean');assert.equal(typeof object.name,'string');assert.equal(typeof object.type,'string');}
 assert.equal(typeof frame.matrixBytes,'string',label+': actual binary matrices');const bytes=Buffer.from(frame.matrixBytes,'base64');assert.equal(bytes.toString('base64'),frame.matrixBytes,label+': canonical matrix binary');assert.equal(bytes.length,frame.matrixObjects.length*32*8,label+': exact local and world Float64 matrix byte count');assert.equal(sha256(bytes),frame.matrixSha256,label+': independent actual matrix hash');for(let offset=0;offset<bytes.length;offset+=8)assert(Number.isFinite(bytes.readDoubleLE(offset)),label+': nonfinite actual matrix');return bytes;
}
function validateFrame(frame,pixels,programs,baseline,arm,label){
 validateRegistry(frame.registry,baseline,arm,label);integer(frame.calls,label+': native draw calls',1);finite(frame.triangles,label+': triangles',1);assert.equal(frame.rgbaSha256,pixels.readPixelsSha256,label+': saved RGBA hash');assert.match(frame.shadowSha256,hashPattern);validatePool(frame.poolDelta,label);assert.equal(frame.poolDelta.renderCalls,1,label+': one complete captured render');
 assert(Array.isArray(frame.draws)&&frame.draws.length>0,label+': actual ordered native direct calls');let nativeCalls=0,color=0,shadow=0;for(const draw of frame.draws){for(const key of ['object','sourceGeometry','material','start','count','program','nativeCalls'])integer(draw[key],label+': '+key);assert(programs.has(draw.program),label+': linked program receipt absent');assert(['color','shadow'].includes(draw.phase));assert.equal(typeof draw.substituted,'boolean');assert(Array.isArray(draw.transformWords)&&draw.transformWords.length===82,label+': exact world/model-view/normal matrix words');for(const word of draw.transformWords)assert(Number.isInteger(word)&&word>=0&&word<=0xffffffff,label+': submitted IEEE matrix word');nativeCalls+=draw.nativeCalls;if(draw.substituted){if(draw.phase==='color')color++;else shadow++;}}
 assert.equal(nativeCalls,frame.calls,label+': direct submissions explain actual native count');assert.equal(color,frame.poolDelta.colorCalls,label+': independently attributed buffer color substitutions');assert.equal(shadow,frame.poolDelta.shadowCalls,label+': independently attributed buffer shadow substitutions');return validateMatrix(frame,label);
}
function inspectPair(a,b,pixelsA,pixelsB,label){
 const diff=pixelDiff(pixelsA.rgba,pixelsB.rgba),bytesA=validateMatrix(a,label+' A'),bytesB=validateMatrix(b,label+' B');
 const result={...diff,shadowChangedPixels:a.shadowSha256===b.shadowSha256?0:null,shadowMaxChannelDelta:a.shadowSha256===b.shadowSha256?0:null,orderEqual:same(a.draws,b.draws),countsEqual:a.calls===b.calls&&a.triangles===b.triangles,matricesEqual:bytesA.equals(bytesB)&&same(a.matrixObjects,b.matrixObjects)};
 for(const key of ['changedPixels','maxChannelDelta','orderEqual','countsEqual','matricesEqual'])assert.equal(b[key],result[key],label+': reported '+key+' differs from independent reconstruction');
 if(result.shadowChangedPixels===0){zero(b.shadowChangedPixels,label+': exact shadow hash must report zero');zero(b.shadowMaxChannelDelta,label+': exact shadow hash delta');}else{integer(b.shadowChangedPixels,label+': changed shadow pixels',1);integer(b.shadowMaxChannelDelta,label+': changed shadow delta',1);}
 return result;
}
function immediateDrawIdentity(a,b,programs){return a.draws.length===b.draws.length&&a.draws.every((draw,index)=>{const {program,...identity}=draw,{program:otherProgram,...otherIdentity}=b.draws[index],first=programs.get(program),second=programs.get(otherProgram);return same(identity,otherIdentity)&&!!first&&!!second&&first.vertexSha256===second.vertexSha256&&first.fragmentSha256===second.fragmentSha256;});}
function strictPair(result,label,requireOrder=true){zero(result.changedPixels,label+': changed RGBA pixels');zero(result.maxChannelDelta,label+': RGBA delta');zero(result.shadowChangedPixels,label+': shadow equality');zero(result.shadowMaxChannelDelta,label+': shadow delta');assert.equal(result.countsEqual,true,label+': native counts');assert.equal(result.matricesEqual,true,label+': actual local/world matrices');if(requireOrder)assert.equal(result.orderEqual,true,label+': exact native draw/program order');}
function validateCasePlan(result,bridge){
 const {a,b,length,width}=bridge,ux=(b[0]-a[0])/length,uz=(b[1]-a[1])/length;
 assert.deepEqual(result.bridgeBasis,{a,b,length,width,ux,uz},'Camera recipes must use the immutable original bridge');
 const positions=[[0,6,0],[480,8,830],[1290,7,1115]],targets=[[160,4,290],[630,3,1050],[1330.8,9,1174.7]];
 for(let index=0;index<6;index++){assert.deepEqual(result.casePlan[index].position,positions[Math.floor(index/2)]);assert.deepEqual(result.casePlan[index].target,targets[Math.floor(index/2)]);}
 const recipes=[{position:[-130,width/2+.35,.18],target:[-6,width/2-.35,.04]},{position:[-60,0,-.65],target:[8,width/2+4,.1]}];
 for(let index=0;index<2;index++)for(const key of ['position','target']){const pose=result.casePlan[6+index],value=pose.recipe?.[key],[distance,side,heightOffset]=recipes[index][key];assert(value,'Missing fixed ramp recipe');assert.equal(value.s,distance);assert.equal(value.w,side);assert.equal(value.heightOffset,heightOffset);assert(Number.isFinite(value.terrainHeight),'Original sampled terrain height must be finite');const position=[a[0]+ux*distance+uz*side,value.terrainHeight+heightOffset,a[1]+uz*distance-ux*side];assert.deepEqual(value.position,position);assert.deepEqual(pose[key],position);}
 const partitions={all:CASES,'linux-a':CASES.slice(0,4),'linux-b':CASES.slice(4)};assert.equal(result.partitionPlanSha256,sha256(JSON.stringify({version:1,cases:CASES,partitions})),'Fixed plan receipt');
}

function independentPixelAudit(decoded,partition){const pairs=[['original','original'],['original','static'],['original','repeat'],['hidden-original-control','hidden-static-control'],['shadow-off-original-control','shadow-off-static-control'],['original','immediate-restored-control'],['original','restored-static-control'],['original','restored-original-control']];return PARTITIONS[partition].flatMap(name=>pairs.map(([a,b])=>{const first=decoded.get(name+'-'+a),second=decoded.get(name+'-'+b);assert(first&&second,'Complete decoded pair unavailable');return {name,original:a,candidate:b,...pixelDiff(first.rgba,second.rgba),originalRgbaSha256:first.rgbaSha256,candidateRgbaSha256:second.rgbaSha256};}));}
function validateResult(result,decoded,native,partition,bridge){
 assert.equal(result.schema,'belle-static-transforms-experiment-v1');assert.equal(result.width,WIDTH);assert.equal(result.height,HEIGHT);assert.equal(result.dpr,1);assert.equal(result.near,.08);assert.equal(result.far,22000);assert.equal(result.threeRevision,'185');
 validateCasePlan(result,bridge);assert.equal(result.partition,partition);assert.deepEqual(result.casePlan.map(item=>item.name),CASES);assert.deepEqual(result.selectedCases,PARTITIONS[partition]);assert.deepEqual(result.expectedCases,PARTITIONS[partition]);
 for(const [index,item]of result.casePlan.entries()){assert.equal(item.index,index);assert.equal(item.frozenTime,120+index);assert.equal(item.hour,item.name.endsWith('-night')?21:14);}
 assert.deepEqual(result.prelude,partition==='linux-b'?CASES.slice(0,4).map((name,index)=>({name,frozenTime:120+index,warmupRenders:3})):[],'Fixed world replay before partition');assert.equal(result.software,!native);assert(native?/Metal/i.test(result.gpu)&&!/SwiftShader|llvmpipe/i.test(result.gpu):/SwiftShader/i.test(result.gpu),'Actual backend');
 validateRegistry(result.ownerBaseline,null,'original','Final published baseline');validateRegistry(result.ownerFinal,result.ownerBaseline,'original','Restored final registry');
 assert.deepEqual(result.expectedOwners.map(owner=>({...owner,owner:ownerKey(owner.owner)})),EXPECTED_OWNERS);assert.deepEqual(result.publication.owners.map(owner=>({...owner,owner:ownerKey(owner.owner)})),EXPECTED_OWNERS);assert.equal(result.publication.frozenTime,119);assert.deepEqual(result.publication.position,[0,6,0]);integer(result.publication.updates,'Publication updates',1);finite(result.publication.elapsedMs,'Publication elapsed');assert(result.publication.elapsedMs<300000);validateRegistry(result.publication.registry,result.ownerBaseline,'original','Actual ready publications');assert.equal(result.publication.assetBarrier.frozen,true);
 assert.equal(result.poolHooksPreserved,true);assert(result.poolBefore?.supported&&result.poolBefore.preparationReady);integer(result.poolBefore.activeEntries,'Original buffer entries',200);assert.deepEqual(poolIdentity(result.poolBefore),poolIdentity(result.poolAfter));for(const key of ['fallbacks','observerErrors','contextLosses'])zero(result.poolAfter[key],key);
 assert(result.geometry?.meshes?.length>=907&&result.geometry?.instanceBuffers?.length>400,'Streamed full-world geometry/instance receipts absent');assert(Array.isArray(result.materials)&&result.materials.length>100);assert(Array.isArray(result.errors));
 const programs=new Map();for(const program of result.programs){integer(program.id,'Program id');assert(!programs.has(program.id),'Duplicate linked program');programs.set(program.id,program);assert.equal(program.linked,true);for(const type of ['vertex','fragment']){assert(typeof program[type]==='string'&&program[type].length>100);assert.equal(sha256(program[type]),program[type+'Sha256']);}}assert(programs.size>0);
 exactNames(result.rows,PARTITIONS[partition],'name','Rows');exactNames(result.controls,PARTITIONS[partition],'name','Controls');assert.deepEqual(result.rows.map(row=>row.name),PARTITIONS[partition]);
 const independent=[],coverage={rows:0,substitutedColorDraws:0,substitutedShadowDraws:0,hiddenChangedPixels:0,shadowChangedPixels:0};
 for(const row of result.rows){const name=row.name,planned=result.casePlan.find(item=>item.name===name),pixels=suffix=>{const found=decoded.get(name+'-'+suffix);assert(found,'Missing saved image '+name+'-'+suffix);return found;};assert.equal(row.width,WIDTH);assert.equal(row.height,HEIGHT);assert.equal(row.near,.08);assert.equal(row.far,22000);assert.equal(row.hour,planned.hour);assert.equal(row.frozenTime,planned.frozenTime);assert.equal(row.style,'authentic');assert.equal(row.bridgePreview,false);assert.deepEqual(row.camera.position,planned.position);assert.deepEqual(row.camera.target,planned.target);assert.equal(row.geometryEqual,true);assert.equal(row.materialEqual,true);assert.equal(row.afterGeometrySha256,row.geometrySha256);assert.equal(row.afterMaterialSha256,row.materialSha256);assert.match(row.geometrySha256,hashPattern);assert.match(row.materialSha256,hashPattern);
  exactNames(row.comparisons,ARMS,'arm',name+': exact arms');const original=row.comparisons.find(item=>item.arm==='original'),candidate=row.comparisons.find(item=>item.arm==='static');
  for(const frame of row.comparisons){validateFrame(frame,pixels(frame.arm),programs,result.ownerBaseline,frame.arm,name+' '+frame.arm);assert.equal(frame.geometrySha256,row.geometrySha256);assert.equal(frame.materialSha256,row.materialSha256);assert.deepEqual(frame.errors,[]);assert.equal(frame.passed,true);const pair=inspectPair(original,frame,pixels('original'),pixels(frame.arm),name+' '+frame.arm);strictPair(pair,name+' '+frame.arm);independent.push({name:name+'-'+frame.arm,...pair});}
  validateFrame(row.repeat,pixels('repeat'),programs,result.ownerBaseline,'original',name+' repeat');const repeat=inspectPair(original,row.repeat,pixels('original'),pixels('repeat'),name+' repeat');strictPair(repeat,name+' repeat');independent.push({name:name+'-repeat',...repeat});
  const control=result.controls.find(item=>item.name===name);assert.deepEqual(control.hiddenIds,result.ownerBaseline.owners.flatMap(owner=>owner.rootIds));assert.equal(control.warmupRenders,3);assert.equal(control.transformsPreserved,true);assert.equal(control.geometrySha256,row.geometrySha256);assert.equal(control.materialSha256,row.materialSha256);
  for(const [key,suffix]of [['hidden','hidden'],['shadowOff','shadow-off']]){const pair=control[key];for(const arm of ARMS)validateFrame(pair[arm],pixels(suffix+'-'+arm+'-control'),programs,result.ownerBaseline,arm,name+' '+suffix+' '+arm);const inspected=inspectPair(pair.original,{...pair.static,...Object.fromEntries(['changedPixels','maxChannelDelta','shadowChangedPixels','shadowMaxChannelDelta','orderEqual','countsEqual','matricesEqual'].map(key=>[key,pair[key]]))},pixels(suffix+'-original-control'),pixels(suffix+'-static-control'),name+' '+suffix);strictPair(inspected,name+' '+suffix);independent.push({name:name+'-'+suffix,...inspected});}
  for(const [key,suffix,arm,requireOrder]of [['immediate','immediate-restored-control','static',false],['restored','restored-static-control','static',true],['originalRestored','restored-original-control','original',true]]){const frame=control[key];validateFrame(frame,pixels(suffix),programs,result.ownerBaseline,arm,name+' '+suffix);const pair=inspectPair(original,frame,pixels('original'),pixels(suffix),name+' '+suffix);strictPair(pair,name+' '+suffix,requireOrder);independent.push({name:name+'-'+suffix,...pair});}
  const immediateIdentity=immediateDrawIdentity(original,control.immediate,programs);assert.equal(control.immediateDrawIdentityEqual,immediateIdentity);assert.equal(immediateIdentity,true,name+': immediate restoration may differ only in program IDs with identical actual linked shader hashes');
  const hidden=pixelDiff(pixels('original').rgba,pixels('hidden-original-control').rgba),shadow=pixelDiff(pixels('original').rgba,pixels('shadow-off-original-control').rgba);assert.equal(control.hiddenChangedPixels,hidden.changedPixels);assert.equal(control.shadowOffChangedPixels,shadow.changedPixels);coverage.hiddenChangedPixels=Math.max(coverage.hiddenChangedPixels,hidden.changedPixels);coverage.shadowChangedPixels=Math.max(coverage.shadowChangedPixels,shadow.changedPixels);coverage.rows++;coverage.substitutedColorDraws+=original.poolDelta.colorCalls;coverage.substitutedShadowDraws+=original.poolDelta.shadowCalls;
  const baselineMatrices=validateMatrix(original,name+' baseline');for(const arm of ARMS){assert(baselineMatrices.equals(validateMatrix(control.hidden[arm],name+' hidden '+arm)),'Visibility control changed actual transforms');const omitVisible=objects=>objects.map(({visible,...object})=>object);assert.deepEqual(omitVisible(control.hidden[arm].matrixObjects),omitVisible(original.matrixObjects));}
  assert.equal(control.passed,true);assert.equal(row.passed,true);
 }
 assert.equal(coverage.rows,PARTITIONS[partition].length);assert(coverage.substitutedColorDraws>0&&coverage.substitutedShadowDraws>0,'Original pooled color/shadow work absent');assert(coverage.hiddenChangedPixels>=16&&coverage.shadowChangedPixels>=16,'Predeclared positive controls inactive');assert.deepEqual(result.coverage,{hiddenChangedPixels:coverage.hiddenChangedPixels,shadowChangedPixels:coverage.shadowChangedPixels});assert.deepEqual(result.errors,[]);assert.equal(result.passed,true);return {independent,coverage};
}
function validateTimings(result,native){
 exactNames(result.timings,native?TIMING_CASES:[],'name','Exactly six complete native timing comparisons');if(!native)return[];let nextQueryId=1;
 const summary=result.timings.map(timing=>{const row=result.rows.find(row=>row.name===timing.name),baseline=row.comparisons.find(frame=>frame.arm==='original');assert.equal(timing.baseline,'original');assert.equal(timing.candidate,'static');assert.equal(timing.shadowMode,'forced-refresh');assert.equal(timing.order,'ABBA');assert.equal(timing.repetitions,16);assert.equal(timing.framesPerLane,16);assert.equal(timing.warmupRenders,3);assert.equal(timing.lanes.length,64);assert.deepEqual(timing.errors,[]);assert.equal(timing.passed,true);const groups=[];
  for(let group=0;group<16;group++){const lanes=timing.lanes.slice(group*4,group*4+4);assert.deepEqual(lanes.map(lane=>lane.arm),['original','static','static','original']);for(const lane of lanes){const label=timing.name+' group'+(group+1)+' '+lane.arm;assert.equal(lane.repetition,group+1);assert.equal(lane.framesPerLane,16);assert.equal(lane.warmupRenders,3);assert.equal(lane.samples.length,16);assert.equal(lane.observerAbsent,true);validateRegistry(lane.registryBefore,result.ownerBaseline,lane.arm,label+' before',false);validateRegistry(lane.registryAfter,result.ownerBaseline,lane.arm,label+' after',false);
    validatePool(lane.poolDelta,label);const delta={};for(const key of POOL_COUNTERS){integer(lane.poolBefore[key],label+': before '+key);integer(lane.poolAfter[key],label+': after '+key);delta[key]=lane.poolAfter[key]-lane.poolBefore[key];}assert.deepEqual(lane.poolDelta,delta);assert.equal(lane.poolDelta.renderCalls,16);assert.equal(lane.poolDelta.colorCalls,baseline.poolDelta.colorCalls*16);assert.equal(lane.poolDelta.shadowCalls,baseline.poolDelta.shadowCalls*16);
    for(const [index,sample]of lane.samples.entries()){assert.equal(sample.index,index);finite(sample.cpuMs,label+': render CPU ms',Number.MIN_VALUE);finite(sample.fenceMs,label+': completion wait');assert.equal(sample.calls,baseline.calls);assert.equal(sample.triangles,baseline.triangles);assert.equal(sample.gpu.status,'complete');finite(sample.gpu.nanoseconds,label+': actual GPU ns',Number.MIN_VALUE);assert.equal(sample.gpu.queryId,nextQueryId++,label+': unique contiguous actual elapsed query');assert.equal(sample.gpu.resultAvailable,true);assert.equal(sample.gpu.disjoint,false);}
    assert.equal(lane.cpuMs,mean(lane.samples.map(sample=>sample.cpuMs)),label+': raw render CPU mean');assert.equal(lane.fenceMs,mean(lane.samples.map(sample=>sample.fenceMs)));assert.equal(lane.gpu.status,'complete');assert.equal(lane.gpu.nanoseconds,mean(lane.samples.map(sample=>sample.gpu.nanoseconds)));
    const matrix=lane.matrixOnly;assert.equal(matrix.warmupCalls,3);assert.equal(matrix.calls,16);assert.equal(matrix.samples.length,16);assert.equal(matrix.beforeSha256,baseline.matrixSha256);assert.equal(matrix.afterSha256,matrix.beforeSha256);for(const [index,sample]of matrix.samples.entries()){assert.equal(sample.index,index);finite(sample.cpuMs,label+': separate matrix CPU ms');}assert.equal(matrix.cpuMs,mean(matrix.samples.map(sample=>sample.cpuMs)),label+': raw matrix-only mean');
   }
   const pair={repetition:group+1};for(const [metric,read]of [['cpuMs',lane=>lane.cpuMs],['gpuMs',lane=>lane.gpu.nanoseconds/1e6],['matrixOnlyMs',lane=>lane.matrixOnly.cpuMs],['fenceMs',lane=>lane.fenceMs]]){const original=(read(lanes[0])+read(lanes[3]))/2,candidate=(read(lanes[1])+read(lanes[2]))/2;pair[metric]={baseline:original,candidate,delta:candidate-original,percent:original?100*(candidate-original)/original:null};}groups.push(pair);
  }
  const metrics={};for(const metric of ['cpuMs','gpuMs','matrixOnlyMs','fenceMs'])metrics[metric]={baselineMean:mean(groups.map(group=>group[metric].baseline)),candidateMean:mean(groups.map(group=>group[metric].candidate)),pairedMeanDelta:mean(groups.map(group=>group[metric].delta)),baselineMedian:median(groups.map(group=>group[metric].baseline)),candidateMedian:median(groups.map(group=>group[metric].candidate)),pairedMedianDelta:median(groups.map(group=>group[metric].delta)),improvedGroups:groups.filter(group=>group[metric].delta<0).length,totalGroups:16};return {name:timing.name,shadowMode:'forced-refresh',candidate:'static',rawSamples:1024,matrixOnlySamples:1024,groups,metrics,scope:'Sixteen complete paired ABBA groups. CPU render submission primary; actual GPU and separate matrix-only CPU reported independently. Completion wait is not frame rate. No full-game release acceptance.'};
 });assert.equal(nextQueryId-1,6144,'All6144 actual GPU samples retained');return summary;
}
function pngForTest(pixels,width,height,filter=0){
 const chunk=(type,data)=>{const name=Buffer.from(type),out=Buffer.alloc(data.length+12);out.writeUInt32BE(data.length);name.copy(out,4);data.copy(out,8);out.writeUInt32BE(crc32(Buffer.concat([name,data])),8+data.length);return out;};
 const head=Buffer.alloc(13);head.writeUInt32BE(width);head.writeUInt32BE(height,4);head[8]=8;head[9]=6;const stride=width*4,raw=Buffer.alloc((stride+1)*height);
 for(let y=0;y<height;y++){raw[y*(stride+1)]=filter;for(let x=0;x<stride;x++){const left=x>=4?pixels[y*stride+x-4]:0,up=y?pixels[(y-1)*stride+x]:0,c=y&&x>=4?pixels[(y-1)*stride+x-4]:0,predictor=filter===0?0:filter===1?left:filter===2?up:filter===3?Math.floor((left+up)/2):paeth(left,up,c);raw[y*(stride+1)+1+x]=(pixels[y*stride+x]-predictor)&255;}}
 return Buffer.concat([Buffer.from('89504e470d0a1a0a','hex'),chunk('IHDR',head),chunk('IDAT',deflateSync(raw)),chunk('IEND',Buffer.alloc(0))]);
}
function selfTest(){
 const pixels=Buffer.from([1,2,3,255,250,4,5,255,17,31,63,255,99,100,101,255]);for(let filter=0;filter<=4;filter++)assert.deepEqual(decodePng(pngForTest(pixels,2,2,filter),2,2).rgba,pixels);const corrupt=pngForTest(pixels,2,2);corrupt[45]^=1;assert.throws(()=>decodePng(corrupt,2,2),/CRC/);assert.throws(()=>decodePng(pngForTest(pixels,2,2),3,2),/width/);const alpha=Buffer.from(pixels);alpha[3]--;assert.deepEqual(pixelDiff(pixels,alpha),{changedPixels:1,maxChannelDelta:1});
 assert.throws(()=>normalizeFactory('changed source','src/belle/detroitScene.ts'),/bookkeeping count/);assert.throws(()=>exactNames([{name:'a'},{name:'a'}],['a','b'],'name','fixture'),/identifiers/);
 const registry=enabled=>{let next=1;const owners=EXPECTED_OWNERS.map(expected=>{const nodeIds=Array.from({length:expected.nodes},()=>next++),rootIds=nodeIds.slice(0,expected.roots);return {owner:expected.owner,rootIds,nodeIds,rootCount:expected.roots,nodeCount:expected.nodes,eligible:true,active:enabled,invalidated:false,reason:null,flagBits:nodeIds.map(()=>enabled?0:3),flagCounts:flagCounts(nodeIds.map(()=>enabled?0:3))};});return {version:1,enabled,registeredOwners:4,registeredRoots:187,registeredNodes:907,activeOwners:enabled?4:0,activeRoots:enabled?187:0,activeNodes:enabled?907:0,invalidations:0,rejectedRegistrations:0,owners,rejections:[]};};
 const original=registry(false),candidate=registry(true);validateRegistry(candidate,original,'static','fixture',false);const wrong=structuredClone(candidate);wrong.owners[2].nodeIds.pop();assert.throws(()=>validateRegistry(wrong,original,'static','fixture',false));
 const objects=Array.from({length:907},(_,id)=>({id,parentId:null,type:'Object3D',name:'',visible:true})),values=new Float64Array(907*32),matrixBytes=Buffer.from(values.buffer),matrix={matrixObjects:objects,matrixBytes:matrixBytes.toString('base64'),matrixSha256:sha256(matrixBytes)};assert(validateMatrix(matrix,'fixture').equals(matrixBytes));const negativeZero=Buffer.from(matrixBytes);negativeZero.writeDoubleLE(-0,0);assert(!negativeZero.equals(matrixBytes),'Signed zero must remain distinct binary evidence');const badMatrix={...matrix,matrixBytes:negativeZero.toString('base64')};assert.throws(()=>validateMatrix(badMatrix,'fixture'),/matrix hash/);
 let queryId=1;const pooled={renderCalls:1,pooledCalls:3,colorCalls:2,shadowCalls:1},result={ownerBaseline:original,rows:TIMING_CASES.map(name=>({name,comparisons:[{arm:'original',calls:5,triangles:10,poolDelta:pooled,matrixSha256:matrix.matrixSha256}]})),timings:[]};
 for(const name of TIMING_CASES){const lanes=[];for(let group=0;group<16;group++)for(const arm of ['original','static','static','original']){const receipt=arm==='static'?candidate:original,samples=Array.from({length:16},(_,index)=>({index,cpuMs:1,fenceMs:0,gpu:{status:'complete',nanoseconds:1000,queryId:queryId++,resultAvailable:true,disjoint:false},calls:5,triangles:10}));lanes.push({arm,repetition:group+1,framesPerLane:16,warmupRenders:3,observerAbsent:true,registryBefore:receipt,registryAfter:receipt,cpuMs:1,fenceMs:0,gpu:{status:'complete',nanoseconds:1000},matrixOnly:{warmupCalls:3,calls:16,cpuMs:.1,samples:Array.from({length:16},(_,index)=>({index,cpuMs:.1})),beforeSha256:matrix.matrixSha256,afterSha256:matrix.matrixSha256},poolBefore:{renderCalls:0,pooledCalls:0,colorCalls:0,shadowCalls:0},poolAfter:{renderCalls:16,pooledCalls:48,colorCalls:32,shadowCalls:16},poolDelta:{renderCalls:16,pooledCalls:48,colorCalls:32,shadowCalls:16},samples});lanes.at(-1).matrixOnly.cpuMs=mean(lanes.at(-1).matrixOnly.samples.map(sample=>sample.cpuMs));}result.timings.push({name,shadowMode:'forced-refresh',candidate:'static',baseline:'original',order:'ABBA',repetitions:16,framesPerLane:16,warmupRenders:3,errors:[],passed:true,lanes});}
 assert.equal(validateTimings(result,true).length,6);const lane=result.timings[0].lanes[0];lane.samples[1].gpu.queryId=1;assert.throws(()=>validateTimings(result,true),/unique contiguous/);lane.samples[1].gpu.queryId=2;lane.cpuMs=2;assert.throws(()=>validateTimings(result,true),/raw render CPU mean/);lane.cpuMs=1;lane.observerAbsent=false;assert.throws(()=>validateTimings(result,true));lane.observerAbsent=true;lane.matrixOnly.afterSha256='0'.repeat(64);assert.throws(()=>validateTimings(result,true));lane.matrixOnly.afterSha256=lane.matrixOnly.beforeSha256;lane.registryAfter=candidate;assert.throws(()=>validateTimings(result,true),/actual mode/);lane.registryAfter=original;
 const wrongFlags=structuredClone(original);wrongFlags.owners[0].flagBits[0]=0;wrongFlags.owners[0].flagCounts=flagCounts(wrongFlags.owners[0].flagBits);lane.registryAfter=wrongFlags;assert.throws(()=>validateTimings(result,true),/original per-node matrix flags not restored/);lane.registryAfter=original;
 const programs=new Map([[1,{vertexSha256:'a',fragmentSha256:'b'}],[2,{vertexSha256:'a',fragmentSha256:'b'}],[3,{vertexSha256:'a',fragmentSha256:'changed'}]]),draw={object:1,geometry:2,program:1,transformWords:[0,1]},first={draws:[draw]},second={draws:[{...draw,program:2}]};assert.equal(immediateDrawIdentity(first,second,programs),true);second.draws[0].geometry=3;assert.equal(immediateDrawIdentity(first,second,programs),false);second.draws[0].geometry=2;second.draws[0].program=3;assert.equal(immediateDrawIdentity(first,second,programs),false);
 console.log('Static transform proof self-test passed: independent PNG/alpha/CRC decoding, binary signed-zero matrices, exact factory populations, absent measured observers, and all6144 raw GPU/render/matrix samples.');
}

async function verifyPartitions(directory){
 assert.equal(typeof directory,'string');const files=[];async function walk(path){for(const entry of await readdir(path,{withFileTypes:true})){const next=resolve(path,entry.name);if(entry.isDirectory())await walk(next);else if(entry.name==='report.json')files.push(next);}}await walk(resolve(directory));assert.equal(files.length,3,'Exactly two fixed software partitions and one full native artifact required');
 const game=resolve(import.meta.dirname,'..'),repo=execFileSync('git',['rev-parse','--show-toplevel'],{cwd:game,encoding:'utf8'}).trim(),sourceHead=execFileSync('git',['rev-parse','HEAD'],{cwd:repo,encoding:'utf8'}).trim();if(process.env.STATIC_TRANSFORMS_PROOF_SOURCE_SHA)assert.equal(sourceHead,process.env.STATIC_TRANSFORMS_PROOF_SOURCE_SHA);
 const reports=[];for(const file of files){const report=JSON.parse(await readFile(file,'utf8'));assert.equal(report.schema,'belle-static-transforms-native-proof-v1');assert.equal(report.sourceHead,sourceHead);assert.equal(report.baseline,BASELINE);assert.equal(report.baselineTree,'8754910f55ac44dd430cd5601d789c0d84d40e35');assert.equal(report.statisticalPlanSha256,STATISTICAL_PLAN_SHA256);assert.equal(report.compileOnly,false);assert.equal(report.compiled,true);assert.equal(report.passed,true,file+': strict proof failed');assert.deepEqual(report.errors,[]);assert.deepEqual(report.failedRequests,[]);assert.equal(report.fixtureSha256,sha256(await readFile(resolve(dirname(file),'fixture.js'))));
  exactNames(report.sourceReceipts,SOURCE_RECEIPT_PATHS,'path','Complete current proof source receipts');for(const receipt of report.sourceReceipts){assert.equal(receipt.sha256,sha256(await readFile(resolve(repo,receipt.path))));assert.equal(receipt.matchesHead,true);assert.equal(receipt.headSha256,receipt.sha256);}
  validateOverrides(report.factoryOverrides);for(const override of report.factoryOverrides)assert.deepEqual(override.patches,normalizeFactory(await readFile(resolve(repo,GAME_PATH,override.source),'utf8'),override.source).patches);validateAssets(report);const native=report.partition==='all';assert.equal(report.platform,native?'darwin':'linux');const decoded=new Map();exactNames(report.captures,PARTITIONS[report.partition].flatMap(name=>IMAGE_SUFFIXES.map(suffix=>name+'-'+suffix)),'name','Aggregate exact saved captures');for(const capture of report.captures){const bytes=await readFile(resolve(dirname(file),capture.file));assert.equal(sha256(bytes),capture.sha256);const value=decodePng(bytes,WIDTH,HEIGHT);assert.equal(value.rgbaSha256,capture.rgbaSha256);assert.equal(value.readPixelsSha256,capture.readPixelsSha256);decoded.set(capture.name,value);}
  assert.deepEqual(report.independentPixelAudit,independentPixelAudit(decoded,report.partition));const checked=validateResult(report.result,decoded,native,report.partition,report.result.bridgeBasis);assert.deepEqual(checked.independent,report.independent);assert.deepEqual(checked.coverage,report.independentCoverage);assert.deepEqual(validateTimings(report.result,native),report.timingSummary);reports.push(report);
 }
 exactNames(reports,['all','linux-a','linux-b'],'partition','Complete fixed partition union');assert.deepEqual(reports.filter(report=>report.platform==='linux').flatMap(report=>report.result.rows.map(row=>row.name)).sort(),[...CASES].sort());const canonical=reports[0];for(const report of reports.slice(1)){assert.equal(report.fixtureSha256,canonical.fixtureSha256);assert.deepEqual([...report.sourceReceipts].sort((a,b)=>a.path.localeCompare(b.path)),[...canonical.sourceReceipts].sort((a,b)=>a.path.localeCompare(b.path)));assert.deepEqual([...report.pinnedSources].sort((a,b)=>a.path.localeCompare(b.path)),[...canonical.pinnedSources].sort((a,b)=>a.path.localeCompare(b.path)));assert.deepEqual(report.factoryOverrides,canonical.factoryOverrides);}
 console.log(JSON.stringify({passed:true,sourceHead,baseline:BASELINE,nativeCases:8,softwareCases:8,nativeComparisons:6,nativeGpuSamples:6144,matrixOnlySamples:6144,scope:'Complete diagnostic union only; original full-game release gates remain required.'}));
}
function validateOverrides(overrides){exactNames(overrides,Object.keys(FACTORY_OVERRIDES),'source','Exact registration-only current factory override set');for(const record of overrides){const expected=FACTORY_OVERRIDES[record.source];assert.equal(record.currentSha256,expected.current);assert.equal(record.originalSha256,expected.original);assert.equal(record.normalizedSha256,expected.original);assert.equal(record.restoresOriginalBytes,true);assert(record.patches.length>0);}}
function validateAssets(report){assert.equal(report.assetBarrier?.count,1,'Exactly one completed publication barrier');assert.deepEqual(report.assetBarrier.lateRequests,[],'No streamed or lazy loading after scene freeze');assert.equal(report.assetBarrier.requests,report.assets.reduce((sum,asset)=>sum+asset.requests,0),'All scene asset requests completed before timing');for(const path of REQUIRED_PACKS){const asset=report.assets.find(asset=>asset.path===path);assert(asset&&asset.requests>0&&asset.bytes>0,'Actual required streamed pack was not served: '+path);assert.match(asset.sha256,hashPattern);assert.match(asset.gitBlob,/^[a-f0-9]{40}$/);}}
async function main(){
 const compileOnly=process.argv.includes('--compile-only');assert(process.argv.slice(2).every(arg=>arg==='--compile-only'),'Unknown driver argument');
 const game=resolve(import.meta.dirname,'..'),gitArgs={cwd:game,maxBuffer:256*1024*1024},git=(...args)=>execFileSync('git',args,gitArgs);
 const repo=git('rev-parse','--show-toplevel').toString().trim(),sourceHead=git('rev-parse','HEAD').toString().trim(),sourceTree=git('rev-parse','HEAD^{tree}').toString().trim();
 gitArgs.cwd=repo;
 if(process.env.STATIC_TRANSFORMS_PROOF_SOURCE_SHA)assert.equal(sourceHead,process.env.STATIC_TRANSFORMS_PROOF_SOURCE_SHA,'Source HEAD is not the requested exact commit');
 if(process.env.STATIC_TRANSFORMS_PROOF_BASELINE_SHA)assert.equal(process.env.STATIC_TRANSFORMS_PROOF_BASELINE_SHA,BASELINE,'The original baseline cannot be changed by environment');
 const native=process.platform==='darwin',partition=process.env.STATIC_TRANSFORMS_PROOF_PARTITION??(native?'all':'linux-a');
 assert(Object.hasOwn(PARTITIONS,partition),'Unknown fixed case partition');if(!compileOnly)assert(native?partition==='all':partition!=='all','Native must run all cases; Linux must use its fixed partition');
 const expectedImages=PARTITIONS[partition].flatMap(name=>IMAGE_SUFFIXES.map(suffix=>name+'-'+suffix));
 const output=resolve(game,'output/static-transforms-proof');await mkdir(output,{recursive:true});
 const errors=[],failedRequests=[],pinnedSources=new Map(),assetEntries=new Map(),assetBytes=new Map(),literalAssets=new Map(),sourceFiles=new Map(),overrideSources=new Map();
 const environmentDefines={'import.meta.env.PROD':'false','import.meta.env.BASE_URL':'"/"','import.meta.env':'{}'};
 const report={schema:'belle-static-transforms-native-proof-v1',statisticalPlanSha256:STATISTICAL_PLAN_SHA256,partition,casePlan:PARTITIONS[partition],baseline:BASELINE,sourceHead,sourceTree,platform:process.platform,width:WIDTH,height:HEIGHT,dpr:1,compileOnly,compiled:false,passed:false,errors,failedRequests,fixtureSha256:null,sourceReceipts:[],pinnedSources:[],factoryOverrides:[],assetBarrier:{count:0,requests:0,lateRequests:[]},assetTransformations:[],assets:[],captures:[],independent:[],independentPixelAudit:[],timingSummary:[],result:null,environmentDefines,scope:'Additional diagnostic: immutable d4 full world, three registration-only current factories, actual published street/scenery packs, and original/static matrix modes. CPU render submission primary; GPU/matrix-only timings separate. No full-game, four-style/stone, input, physics, mobile or release acceptance implied.'};
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
   const override=overrideSources.get(path);if(override)transformations.push({kind:'registration-only-current-factory',currentSha256:sha256(override),originalSha256:sha256(content),normalizedEqualsOriginal:true});
   const transformed=(override??content).replace(/new\s+URL\(\s*(['"])([^'"\r\n]+)\1\s*,\s*import\.meta\.url\s*\)(\.href)?/g,(match,_quote,relative,href)=>{
    assert(relative.startsWith('.'),'Only relative static baseline URL assets are supported: '+path);const referenced=posix.normalize(posix.join(posix.dirname(path),relative)),url=assetUrl(referenced),replacement=href?JSON.stringify(url):'new URL('+JSON.stringify(url)+', location.origin)';transformations.push({original:match,replacement,asset:referenced,url});return replacement;
   });
   pinnedSources.set(path,{path,gitBlob:entry.blob,sha256:sha256(bytes),transformedSha256:sha256(transformed),transformations,content:transformed});
  }
  return pinnedSources.get(path).content;
 }
 const plugin={name:'immutable-full-world-original',setup(builder){
  builder.onResolve({filter:/^\.\/worldPerformancePolicy\.ts$/},args=>args.importer===resolve(game,'src/belle/staticWorldTransforms.ts')?{path:sourcePath(GAME_PATH+'/src/belle/worldPerformancePolicy.ts'),namespace:'pinned-source'}:undefined);
  builder.onResolve({filter:/^baseline:/},args=>{const name=args.path.slice(9),path=sourcePath(GAME_PATH+'/'+(name.startsWith('src/')||name.startsWith('runtime/')?name:'src/belle/'+name));return {path,namespace:'pinned-source'};});
  builder.onResolve({filter:/.*/,namespace:'pinned-source'},async args=>{
   if(args.path.startsWith('.')){const path=posix.normalize(posix.join(posix.dirname(args.importer),args.path.replace(/\?url$/,'')));if(path===GAME_PATH+'/src/belle/staticWorldTransforms.ts')return {path:resolve(game,'src/belle/staticWorldTransforms.ts')};return {path:sourcePath(path),namespace:'pinned-source'};}
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
  const receiptPaths=SOURCE_RECEIPT_PATHS;
  for(const path of receiptPaths){
   const bytes=await readFile(resolve(repo,path)),actual=sha256(bytes);let headHash=null;try{headHash=sha256(execFileSync('git',['show',sourceHead+':'+path],{...gitArgs,stdio:['ignore','pipe','ignore']}));}catch(error){if(!compileOnly)throw error;}
   const receipt={path,sha256:actual,headSha256:headHash,matchesHead:actual===headHash};report.sourceReceipts.push(receipt);if(!compileOnly)assert.equal(receipt.matchesHead,true,'Proof source differs from exact HEAD: '+path);
   const relative=path.startsWith(GAME_PATH+'/')?path.slice(GAME_PATH.length+1):null;if(HELPER_HASHES[relative])assert.equal(actual,HELPER_HASHES[relative],'Reviewed static-transforms module/test changed: '+path);
   if(path.endsWith('/package.json')||path.endsWith('/package-lock.json'))assert.equal(actual,sha256(original(path).bytes),'Dependencies differ from original world: '+path);
  }
  for(const [key,expected]of Object.entries(FACTORY_OVERRIDES)){
   const path=GAME_PATH+'/'+key,current=await readFile(resolve(repo,path),'utf8'),baseline=original(path).bytes.toString('utf8');assert.equal(sha256(current),expected.current,'Unreviewed current factory '+key);assert.equal(sha256(baseline),expected.original,'Unreviewed original factory '+key);const normalized=normalizeFactory(current,key);assert.equal(normalized.text,baseline,'Removing only exact registration bookkeeping must restore immutable d4 byte-for-byte: '+key);overrideSources.set(path,current);report.factoryOverrides.push({source:key,currentSha256:sha256(current),originalSha256:sha256(baseline),normalizedSha256:sha256(normalized.text),restoresOriginalBytes:normalized.text===baseline,patches:normalized.patches});
  }
  validateOverrides(report.factoryOverrides);
  const {build}=await import('esbuild');
  const compiled=await build({absWorkingDir:game,entryPoints:[resolve(game,'scripts/static-transforms-proof-browser.ts')],bundle:true,format:'esm',target:'es2022',write:false,logLevel:'error',metafile:true,plugins:[plugin],define:environmentDefines});
  const javascript=compiled.outputFiles[0].contents;report.fixtureSha256=sha256(javascript);report.bundleInputs=[];
  const allowedCurrent=new Set([GAME_PATH+'/scripts/static-transforms-proof-browser.ts',GAME_PATH+'/src/belle/staticWorldTransforms.ts']);
  for(const input of Object.keys(compiled.metafile.inputs).sort()){
   if(input.startsWith('pinned-source:')){report.bundleInputs.push({path:input,pinned:true});continue;}
   if(input==='<define:import.meta.env>'){report.bundleInputs.push({path:input,generated:true,value:environmentDefines['import.meta.env']});continue;}
   const filename=resolve(game,input),isDependency=filename.includes(sep+'node_modules'+sep),path=filename.startsWith(repo+sep)?filename.slice(repo.length+1):filename;
   assert(isDependency||allowedCurrent.has(path),'Current source leaked into immutable original graph: '+path);report.bundleInputs.push({path,dependency:isDependency,sha256:sha256(await readFile(filename))});
  }
  for(const path of allowedCurrent)assert(report.bundleInputs.some(input=>input.path===path),'Missing expected current input '+path);
  for(const required of ['world.ts','sharedGeometryBuffers.ts','terrain.ts','fountainLayout.ts','coastGuard.ts','sunsetReferencePolicy.ts','activitiesPlan.ts','playgrounds.ts','worldPerformancePolicy.ts','districtModelUrls.ts','detroitAssets.ts','detroitScene.ts','lakeHabitat.ts'])assert(pinnedSources.has(GAME_PATH+'/src/belle/'+required),'Original baseline module not compiled: '+required);
  await writeFile(resolve(output,'fixture.js'),javascript);await writeFile(resolve(output,'bundle-metafile.json'),JSON.stringify(compiled.metafile,null,2)+'\n');report.compiled=true;
  if(compileOnly){console.log('Compiled immutable full-world proof. Compile-only is not pixel or performance acceptance.');return;}
  const require=createRequire(resolve(game,'../../package.json')),{chromium}=require('@playwright/test');
  const types={'.json':'application/json','.bin':'application/octet-stream','.glb':'model/gltf-binary','.gltf':'model/gltf+json','.webp':'image/webp','.png':'image/png','.jpg':'image/jpeg','.jpeg':'image/jpeg','.hdr':'application/octet-stream','.wasm':'application/wasm','.js':'text/javascript','.mp3':'audio/mpeg','.ogg':'audio/ogg'};
  server=createServer((req,res)=>{
   try{
    const pathname=new URL(req.url,'http://127.0.0.1').pathname;assert(req.method==='GET'||req.method==='HEAD','Read-only fixture server');res.setHeader('Cache-Control','no-store');
    if(pathname==='/'){res.setHeader('Content-Type','text/html');res.end('<!doctype html><html><head><meta charset="utf-8"><link rel="icon" href="data:,"><style>html,body{margin:0;width:960px;height:600px;overflow:hidden}canvas{display:block}</style></head><body><canvas></canvas><script type="module" src="/proof.js"></script></body></html>');return;}
    if(pathname==='/proof.js'){res.setHeader('Content-Type','text/javascript');res.end(javascript);return;}
    if(pathname==='/__asset_barrier'){assert.equal(report.assetBarrier.count,0,'Publication barrier repeated');report.assetBarrier.count++;report.assetBarrier.requests=[...assetEntries.values()].reduce((sum,asset)=>sum+asset.requests,0);res.setHeader('Content-Type','application/json');res.end(JSON.stringify({frozen:true,requests:report.assetBarrier.requests}));return;}
    const decoded=decodeURIComponent(pathname);assert(!decoded.includes('\\')&&!decoded.includes('\0')&&!decoded.split('/').includes('..'),'Unsafe asset request');
    const path=decoded.startsWith('/__pinned_asset/')?literalAssets.get(decoded):GAME_PATH+'/public'+decoded;assert(path,'Unregistered original asset URL '+decoded);if(report.assetBarrier.count){report.assetBarrier.lateRequests.push({path,url:decoded});throw Error('Scene asset requested after publication barrier: '+decoded);}const bytes=asset(path,decoded);assetEntries.get(path).requests++;
    res.setHeader('Content-Type',types[extname(path)]||'application/octet-stream');res.setHeader('Content-Length',bytes.length);res.end(req.method==='HEAD'?undefined:bytes);
   }catch(error){errors.push(String(error.stack||error));res.writeHead(500);res.end('Immutable fixture asset verification failed');}
  });
  await new Promise((ok,reject)=>{server.once('error',reject);server.listen(0,'127.0.0.1',ok);});const origin='http://127.0.0.1:'+server.address().port;
  assert(native||process.platform==='linux','Only actual Metal/macOS and SwiftShader/Linux backends are supported');
  const executablePath=process.env.STATIC_TRANSFORMS_PROOF_BROWSER_PATH;browser=await chromium.launch({headless:!native,args:native?['--enable-gpu','--use-gl=angle','--use-angle=metal']:['--use-angle=swiftshader','--enable-unsafe-swiftshader'],...(executablePath?{executablePath}:{channel:'chrome'})});report.browserVersion=browser.version();
  const context=await browser.newContext({viewport:{width:WIDTH,height:HEIGHT},deviceScaleFactor:1,reducedMotion:'reduce',serviceWorkers:'block'});
  await context.route('**/*',route=>{const url=route.request().url();if(url.startsWith(origin+'/')||url.startsWith('data:')||url.startsWith('blob:'))return route.continue();errors.push('Unexpected external asset request: '+url);return route.abort();});
  const page=await context.newPage();page.on('pageerror',error=>errors.push(String(error.stack||error)));page.on('requestfailed',request=>failedRequests.push({url:request.url(),failure:request.failure()}));
  page.on('console',message=>{if(message.type()==='error')errors.push(message.text());else if(message.text().startsWith('static transforms proof '))console.log(message.text());});
  await page.goto(origin+'/',{waitUntil:'load',timeout:120000});await page.waitForFunction(()=>typeof window.__staticTransformsProof==='function',{},{timeout:120000});
  const result=await Promise.race([page.evaluate(partition=>window.__staticTransformsProof(partition),partition),new Promise((_,reject)=>{deadline=setTimeout(()=>reject(Error('Full-world proof exceeded35minutes')),35*60*1000);})]);clearTimeout(deadline);
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
  // Derive complete observations before enforcing appearance. Failure remains
  // strict, but no complete raw timing/pixel evidence is discarded by a later gate.
  report.independentPixelAudit=independentPixelAudit(decoded,partition);report.timingSummary=validateTimings(result,native);
  const validated=validateResult(result,decoded,native,partition,JSON.parse(asset(GAME_PATH+'/public/belle/map.json').toString('utf8')).bridge);report.independent=validated.independent;report.independentCoverage=validated.coverage;
  report.assets=[...assetEntries.values()];validateAssets(report);
  assert.equal(errors.length,0,'Page, shader or immutable asset errors');assert.equal(failedRequests.length,0,'Failed asset requests');
  report.passed=result.passed===true;if(!report.passed){errors.push('Static transform candidate failed strict equivalence; see raw per-view results.');process.exitCode=1;}
 }catch(error){errors.push(String(error.stack||error));process.exitCode=1;}
 finally{
  clearTimeout(deadline);await browser?.close();if(server)await new Promise(ok=>server.close(ok));
  report.pinnedSources=[...pinnedSources.values()].map(({content,...receipt})=>receipt);report.assetTransformations=report.pinnedSources.flatMap(source=>source.transformations.map(transform=>({source:source.path,...transform})));report.assets=[...assetEntries.values()];
  await writeFile(resolve(output,'report.json'),JSON.stringify(report,null,2)+'\n');await writeFile(resolve(output,'summary.json'),JSON.stringify({passed:report.passed,compiled:report.compiled,compileOnly,sourceHead,baseline:BASELINE,gpu:report.result?.gpu,rows:report.result?.rows?.length,coverage:report.independentCoverage,partition,timingSummary:report.timingSummary,errors,scope:report.scope},null,2)+'\n');
  console.log(JSON.stringify({passed:report.passed,compiled:report.compiled,compileOnly,sourceHead,baseline:BASELINE,partition,gpu:report.result?.gpu,rows:report.result?.rows?.length,errors,report:resolve(output,'report.json')}));
 }
}

if(process.argv.includes('--self-test')){assert.deepEqual(process.argv.slice(2),['--self-test']);selfTest();}else if(process.argv[2]==='--verify-partitions'){assert.equal(process.argv.length,4);await verifyPartitions(process.argv[3]);}else await main();
