import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {readFile,readdir} from 'node:fs/promises';
import {resolve} from 'node:path';
import {gunzipSync,inflateSync} from 'node:zlib';

export const sha256=bytes=>createHash('sha256').update(bytes).digest('hex');
export const blobHash=bytes=>createHash('sha1').update('blob '+bytes.length+'\0').update(bytes).digest('hex');
export const safeName=name=>assert(typeof name==='string'&&/^[a-z0-9][a-z0-9._-]{0,160}$/.test(name),'Unsafe evidence name');
export function pixelDiff(a,b){assert.equal(a.length,b.length);assert.equal(a.length%4,0);let changedPixels=0,maxChannelDelta=0;for(let i=0;i<a.length;i+=4){let changed=false;for(let c=0;c<4;c++){const d=Math.abs(a[i+c]-b[i+c]);changed ||= d!==0;maxChannelDelta=Math.max(maxChannelDelta,d);}changedPixels+=Number(changed);}return{changedPixels,maxChannelDelta};}
export function requireCandidate(plan){
 const c=plan.candidate;assert(c&&typeof c==='object','Candidate is UNBOUND; browser execution is prohibited');
 for(const k of ['commit','tree'])assert.match(c[k]??'',/^[a-f0-9]{40}$/,'Immutable candidate '+k);
 assert(Array.isArray(c.files)&&c.files.length===8,'Exactly eight declared candidate paths are required');
 assert.equal(new Set(c.files.map(f=>f.path)).size,8);
 for(const f of c.files){assert.match(f.blob??'',/^[a-f0-9]{40}$/);assert.match(f.sha256??'',/^[a-f0-9]{64}$/);assert(Number.isSafeInteger(f.bytes)&&f.bytes>0);}
 return c;
}
export function validateReflection(program){
 assert.equal(program.linked,true);assert(Array.isArray(program.attributes));
 const seen=new Set();
 for(const a of program.attributes){
  assert(!seen.has(a.name),'Duplicate reflected attribute');seen.add(a.name);
  assert(Number.isSafeInteger(a.index)&&a.index>=0&&Number.isSafeInteger(a.size)&&a.size>0);
  if(a.name==='gl_VertexID')assert(a.location===-1&&a.type===5124&&a.size===1,'Unexpected built-in gl_VertexID descriptor');
  else{assert(!a.name.startsWith('gl_'),'Unreviewed built-in attribute');assert(Number.isSafeInteger(a.location)&&a.location>=0,'User attribute lacks a native location');}
 }
 // gl_VertexID can occur inside Three's disabled morph-target source blocks.
 // The shipped street inputs have no morph attributes and no enabled define.
 if(program.street){assert(!/^\s*#\s*define\s+USE_MORPHTARGETS(?:\s|$)/m.test(program.vertex),'Vertex-ID-dependent morph path enabled');assert(program.vertex.includes('#undef USE_BATCHING'),'Original identity vertex path absent');}
 assert.match(program.vertexSha256,/^[a-f0-9]{64}$/);assert.match(program.fragmentSha256,/^[a-f0-9]{64}$/);
 assert.equal(sha256(program.vertex),program.vertexSha256);assert.equal(sha256(program.fragment),program.fragmentSha256);
}
const nativeScalarBytes={Float32:4,Uint16:2,Uint32:4,Float64:8};
export function expectedBinaryBytes(payload){
 if(payload.kind==='pixels'){assert.equal(payload.format,'RGBA8-bottom-up');assert(Number.isSafeInteger(payload.width)&&payload.width>0&&payload.width<=4096);assert(Number.isSafeInteger(payload.height)&&payload.height>0&&payload.height<=4096);return payload.width*payload.height*4;}
 assert.equal(payload.kind,'binary');assert(Object.hasOwn(nativeScalarBytes,payload.format),'Unknown binary format');assert.equal(payload.endianness,'little');assert(Number.isSafeInteger(payload.elements)&&payload.elements>=0);return nativeScalarBytes[payload.format]*payload.elements;
}
export function finalVerdict(report){return report.validated===true&&report.errors.length===0&&report.requests.length===0&&report.cleanup?.complete===true&&report.cleanup.errors.length===0;}
export function requireFullFrame(receipt,width,height){assert(receipt&&receipt.kind==='pixels');assert.equal(receipt.format,'RGBA8-bottom-up');assert.equal(receipt.width,width);assert.equal(receipt.height,height);assert.equal(receipt.bytes,width*height*4);assert.equal(receipt.png,true,'Full-frame PNG missing');}

export function normalizedDraw(draw,catalog,lane,programs){
 assert(programs.has(draw.program),'Draw references a missing native program');
 const program=programs.get(draw.program);assert.deepEqual(draw.reflectionAttributes,program.attributes,'Actual program reflection changed');
 const attributeSlots=program.attributes.filter(a=>a.location>=0).reduce((n,a)=>n+a.size*(a.type===35676?4:a.type===35675?3:a.type===35674?2:1),0);assert.equal(draw.attributes.length,attributeSlots,'Native attribute columns/array elements omitted');
 for(const a of draw.attributes){
  const declared=program.attributes.find(p=>p.name===a.name);assert(declared&&declared.location>=0);const columns=declared.type===35676?4:declared.type===35675?3:declared.type===35674?2:1;const element=a.arrayElement??0,column=a.column??0;assert(Number.isInteger(element)&&element>=0&&element<declared.size&&Number.isInteger(column)&&column>=0&&column<columns);assert.equal(a.location,declared.location+element*columns+column);assert.equal(a.enabled,true);assert(Number.isSafeInteger(a.buffer)&&a.buffer>0);
 }
 const common={object:draw.object,material:draw.material,program:draw.program,phase:draw.phase,target:draw.target,uniforms:draw.uniforms,state:draw.state,transformWords:draw.transformWords};
 if(draw.group===null)return{...common,geometry:draw.geometry,method:draw.method,arguments:draw.arguments,attributes:draw.attributes};
 assert(Number.isInteger(draw.group)&&draw.group>=0&&draw.group<7);const group=catalog.groups[draw.group];assert(group&&group.ordinal===draw.group);
 const selected=lane==='indexed'?group.indexed:group.original;
 assert.equal(draw.method,lane==='indexed'?'multiDrawElementsWEBGL':'multiDrawArraysWEBGL');
 assert.equal(draw.mode,4,'Street primitive type must remain TRIANGLES');assert.equal(draw.object,'street-group-'+draw.group);assert.equal(draw.material,group.material);
 const width=lane==='indexed'?(selected.indexType==='Uint32Array'?4:2):1;
 assert.equal(draw.indexType,lane==='indexed'?(width===4?5125:5123):null);
 assert.equal(draw.starts.length,draw.counts.length);assert.equal(draw.starts.length,draw.indirect.length);assert.equal(draw.starts.length,draw.sortRows.length);assert.equal(draw.drawCount,draw.starts.length);
 const seen=new Set(),order=[];
 for(let i=0;i<draw.drawCount;i++){
  const id=draw.indirect[i];assert(Number.isInteger(id)&&id>=0&&id<group.sources.length&&!seen.has(id),'Invalid or duplicate native instance');seen.add(id);
  const source=group.sources[id],range=selected.ranges[id],row=draw.sortRows[i];
  assert.equal(row.index,id);assert.equal(draw.starts[i],range.start*width,'Native byte offset does not resolve to the selected original source');assert.equal(row.start,range.start);assert.equal(draw.counts[i],source.corners);assert.equal(row.count,source.corners);assert.equal(range.count,source.corners);assert(Number.isFinite(row.z));
  if(i){const p=draw.sortRows[i-1],ps=group.sources[p.index];assert(p.z<row.z||(p.z===row.z&&ps.id<source.id),'Original depth/source-ID ordering changed');}
  order.push({sourceId:source.id,name:source.name,instanceId:id,geometryId:range.geometryId,corners:source.corners,zWords:row.zWords});
 }
 const attributes=draw.attributes.map(a=>{
  assert(['position','normal'].includes(a.name),'Unexpected street attribute');assert.equal(a.size,3);assert.equal(a.type,5126);assert.equal(a.normalized,false);assert.equal(a.stride,0);assert.equal(a.offset,0);assert.equal(a.divisor,0);
  assert.equal(a.buffer,selected.buffers[a.name].nativeBuffer,'Draw did not bind the audited native data');return{...a,buffer:'street-'+draw.group+'-'+a.name};
 });
 if(lane==='indexed')assert.equal(draw.elementBuffer,selected.buffers.index.nativeBuffer);
 else assert.equal(draw.elementBuffer,null);
 return{...common,geometry:'street-group-'+draw.group,mode:draw.mode,order,attributes};
}

export async function auditSavedEvidence(directory,plan,report){
 assert.equal(report.browser?.baseline,plan.baseline);assert.deepEqual(report.browser?.completed,plan.cases.map(c=>c.name));
 assert.equal(report.candidateBound,true);assert.equal(report.candidateCommitVerified,true,'Tree-only compilation cannot validate a browser artifact');
 const pins=JSON.parse(await readFile(new URL('./pins.json',import.meta.url),'utf8')),provenance=JSON.parse(await readFile(resolve(directory,'provenance.json'),'utf8'));
 assert.deepEqual(plan.candidate,pins.candidate);assert.deepEqual(provenance.candidate,pins.candidate);assert.equal(provenance.candidateCommitVerified,true);assert.equal(provenance.baseline,pins.baseline);assert.equal(provenance.baselineTree,pins.baselineTree);
 for(const [file,path,records]of [['staticPaletteBatch.original.ts','src/belle/staticPaletteBatch.ts',pins.sources],['staticPaletteBatch.ts','src/belle/staticPaletteBatch.ts',pins.candidate.files],['indexedStreetDisplayGeometry.ts','src/belle/indexedStreetDisplayGeometry.ts',pins.candidate.files]]){const expected=records.find(r=>r.path.endsWith('/game/'+path));assert(expected);const bytes=await readFile(resolve(directory,file));assert.equal(bytes.length,expected.bytes);assert.equal(blobHash(bytes),expected.blob,'Retained exact source blob changed');assert.equal(sha256(bytes),expected.sha256,'Retained exact source SHA changed');}
 assert.equal(sha256(await readFile(resolve(directory,'bundle.js'))),provenance.bundleSha256);assert.equal(report.bundleSha256,provenance.bundleSha256);assert.deepEqual(provenance.proofFiles,report.proofFiles);
 const ledgerText=await readFile(resolve(directory,'evidence.ndjson'),'utf8');assert(ledgerText.endsWith('\n'),'Incomplete evidence ledger');
 const ledger=ledgerText.trim().split('\n').map(s=>JSON.parse(s)),byName=new Map();
 const expectedFiles=new Set(['evidence.ndjson','report.json','provenance.json','bundle.js','bundle-meta.json','staticPaletteBatch.original.ts','staticPaletteBatch.ts','indexedStreetDisplayGeometry.ts']);
 for(const row of ledger){safeName(row.name);assert(!byName.has(row.name),'Duplicate receipt name');byName.set(row.name,row);for(const file of row.files){safeName(file.name);assert(!expectedFiles.has(file.name),'Duplicate retained file');expectedFiles.add(file.name);const bytes=await readFile(resolve(directory,file.name));assert.equal(bytes.length,file.bytes);assert.equal(sha256(bytes),file.sha256,'Retained file SHA mismatch');}}
 const getJson=async name=>{const r=byName.get(name);assert(r?.kind==='json','Missing JSON '+name);const v=JSON.parse(await readFile(resolve(directory,r.files[0].name),'utf8'));assert.deepEqual(v,r.value);return v;};
 const raw=async name=>{const r=byName.get(name);assert(r&&r.kind!=='json','Missing raw '+name);const bytes=gunzipSync(await readFile(resolve(directory,r.files[0].name)),{maxOutputLength:r.bytes});assert.equal(bytes.length,expectedBinaryBytes(r));assert.equal(bytes.length,r.bytes);assert.equal(sha256(bytes),r.sha256);if(r.png){const p=decodePng(await readFile(resolve(directory,r.files.find(f=>f.name.endsWith('.png')).name)),r.width,r.height);assert.equal(p.readPixelsSha256,r.sha256,'Saved PNG does not independently decode to raw pixels');}return bytes;};
 // Verify all retained raw records, including failed/control/timing receipts.
 for(const r of ledger)if(r.kind!=='json')await raw(r.name);
 const catalog=await getJson('geometry-catalog'),sourceBefore=await getJson('source-before'),sourceAfter=await getJson('source-after');
 assert.deepEqual(sourceAfter,sourceBefore,'Original street geometry/raycast metadata changed');assert.equal(sourceBefore.length,429);assert.equal(catalog.groups.length,7);
 const sourceByName=new Map(sourceBefore.map(s=>[s.name,s]));assert.equal(sourceByName.size,429);for(const s of sourceBefore){assert.equal(s.index,null);assert.equal(s.disposeEvents,0);assert.deepEqual(s.attributeNames,['normal','position']);}
 const construction=await getJson('construction'),selectedNames=new Set(plan.groups.flatMap(g=>g.sourceNames));assert.equal(selectedNames.size,355);assert.equal(construction.sharedMaterialHooksUnchangedByCandidate,true);assert.deepEqual(construction.orderedOriginalSourceIds,sourceBefore.filter(s=>selectedNames.has(s.name)).map(s=>s.id));
 const textures=await getJson('textures');assert.equal(textures.length,57);const expectedTextureUrls=pins.assets.filter(a=>a.path.endsWith('.webp')).map(a=>a.path.slice(a.path.indexOf('/public/')+7)).sort();assert.deepEqual(textures.map(t=>t.url).sort(),expectedTextureUrls);for(const key of ['uuid','sourceUuid','imageIdentity'])assert.equal(new Set(textures.map(t=>t[key])).size,57);for(const t of textures){assert.equal(t.format,1023);assert.equal(t.internalFormat,null);assert.equal(t.type,1009);assert.equal(t.colorSpace,t.url.endsWith('-color.webp')?'srgb':'');assert.equal(t.wrapS,1000);assert.equal(t.wrapT,1000);assert.equal(t.generateMipmaps,true);}
 assert.deepEqual(await getJson('raycast-after'),await getJson('raycast-before'),'Original face indices, vertex IDs or raycast result changed');
 const programs=new Map();for(const r of ledger)if(r.name.startsWith('program-')){const p=await getJson(r.name);validateReflection(p);assert(!programs.has(p.id));programs.set(p.id,p);}
 let expandedCorners=0;
 for(const g of catalog.groups){
  const expected=plan.groups[g.ordinal];assert.deepEqual(g.sources.map(s=>s.name),expected.sourceNames);assert.equal(sha256(JSON.stringify(g.sources.map(s=>s.name))),expected.sourceOrderSha256);
  assert.equal(g.key,expected.customProgramCacheKey);assert.deepEqual(g.indexed.policy,g.original.policy);assert.equal(g.original.policy.sortObjects,true);assert.equal(g.original.policy.perObjectFrustumCulled,true);assert.deepEqual(g.indexed.batchBounds,g.original.batchBounds);
  assert.equal(g.original.indexType,null);assert.equal(g.original.vertices,expected.originalVertices);assert.equal(g.indexed.indexType,expected.indexType);assert.equal(g.indexed.vertices,expected.uniqueVertices);assert.equal(g.indexed.indices,expected.indexCount);
  for(const lane of ['original','indexed'])for(const key of ['position','normal',...(lane==='indexed'?['index']:[])])assert.equal(byName.get(g[lane].buffers[key].receipt)?.format,key==='index'?(expected.indexType==='Uint32Array'?'Uint32':'Uint16'):'Float32');
  const ap=await raw(g.original.buffers.position.receipt),an=await raw(g.original.buffers.normal.receipt),bp=await raw(g.indexed.buffers.position.receipt),bn=await raw(g.indexed.buffers.normal.receipt),bi=await raw(g.indexed.buffers.index.receipt);
  assert.equal(ap.length+an.length,expected.originalVertices*24);assert.equal(bp.length+bn.length,expected.attributeBytes);assert.equal(bi.length,expected.indexBytes);
  const width=expected.indexType==='Uint32Array'?4:2;let seenCorners=0,seenUnique=0;
  for(let i=0;i<g.sources.length;i++){
   const source=g.sources[i],a=g.original.ranges[i],b=g.indexed.ranges[i];assert.equal(a.vertexCount,source.corners);assert.equal(b.indexCount,source.corners);assert.equal(a.vertexStart,seenCorners);assert.equal(b.vertexStart,seenUnique);assert.equal(b.indexStart,seenCorners);
   const original=sourceByName.get(source.name);assert(original);assert.equal(source.id,original.id);assert.equal(source.corners,original.positionCount);assert.equal(source.positionSha256,original.positionSha256);assert.equal(source.normalSha256,original.normalSha256);assert.deepEqual(b.bounds,a.bounds);assert.deepEqual(b.matrixWords,a.matrixWords);assert.equal(a.geometryId,b.geometryId);assert.equal(a.reservedVertexCount,a.vertexCount);assert.equal(b.reservedVertexCount,b.vertexCount);assert.equal(b.reservedIndexCount,b.indexCount);
   const sp=ap.subarray(a.vertexStart*12,(a.vertexStart+source.corners)*12),sn=an.subarray(a.vertexStart*12,(a.vertexStart+source.corners)*12);assert.equal(sha256(sp),source.positionSha256);assert.equal(sha256(sn),source.normalSha256);
   const first=new Map();
   for(let corner=0;corner<source.corners;corner++){
    const ix=width===4?bi.readUInt32LE((b.indexStart+corner)*4):bi.readUInt16LE((b.indexStart+corner)*2);
    assert(ix>=b.vertexStart&&ix<b.vertexStart+b.vertexCount,'Cross-tile or out-of-range index');
    const pos=sp.subarray(corner*12,(corner+1)*12),norm=sn.subarray(corner*12,(corner+1)*12);assert(bp.subarray(ix*12,ix*12+12).equals(pos),'Expanded Float32 position differs');assert(bn.subarray(ix*12,ix*12+12).equals(norm),'Expanded Float32 normal differs');
    const key=pos.toString('hex')+norm.toString('hex');if(!first.has(key))first.set(key,first.size);assert.equal(ix-b.vertexStart,first.get(key),'First-encounter tuple/index order changed');
   }
   assert.equal(first.size,b.vertexCount);seenCorners+=source.corners;seenUnique+=b.vertexCount;
  }
  assert.equal(seenCorners,expected.originalVertices);assert.equal(seenUnique,expected.uniqueVertices);expandedCorners+=seenCorners;
 }
 const mainFrames=new Map(),seenGroups=new Set(),caseResults=[],usedPrograms=new Set();
 const expectedNames=new Set(['start','source-before','source-after','raycast-before','raycast-after','construction','textures','geometry-catalog','browser-result']);
 const markFrame=(c,lane,label,shadows)=>{expectedNames.add(c.name+(label==='main'?'':'-'+label)+'-'+lane+'-frame');expectedNames.add(c.name+'-'+label+'-'+lane+'-rgba');expectedNames.add(c.name+'-'+label+'-'+lane+'-matrices');if(shadows)expectedNames.add(c.name+'-'+label+'-'+lane+'-shadow');};
 const frameData=async(c,lane,label)=>{const f=await getJson(c.name+(label==='main'?'':'-'+label)+'-'+lane+'-frame');assert.equal(f.case,c.name);assert.equal(f.lane,lane);assert.equal(f.label,label);requireFullFrame(byName.get(f.rgba),plan.viewport.width,plan.viewport.height);for(const shadow of f.shadows){assert.equal(shadow.width,2048);assert.equal(shadow.height,2048);const receipt=byName.get(shadow.receipt);assert.equal(receipt?.width,2048);assert.equal(receipt?.height,2048);}const matrix=byName.get(f.matrices);assert.equal(matrix?.format,'Float64');assert.equal(matrix.elements,f.matrixMetadata.length*32+16,'Incomplete original/object/camera matrix bytes');const rgba=await raw(f.rgba),normalized=f.draws.map(d=>{usedPrograms.add(d.program);return normalizedDraw(d,catalog,lane,programs);});return{f,rgba,normalized};};
 const exactPair=async(a,b)=>{assert.deepEqual(b.normalized,a.normalized,'Native culling/order/program/uniform/matrix changed');assert.deepEqual(pixelDiff(a.rgba,b.rgba),{changedPixels:0,maxChannelDelta:0});assert.equal(b.f.calls,a.f.calls);assert.equal(b.f.triangles,a.f.triangles);assert.deepEqual(b.f.originalVisibility,a.f.originalVisibility);assert.deepEqual(b.f.matrixMetadata,a.f.matrixMetadata);assert((await raw(b.f.matrices)).equals(await raw(a.f.matrices)));assert.equal(b.f.shadows.length,a.f.shadows.length);for(let i=0;i<a.f.shadows.length;i++){assert.deepEqual({...b.f.shadows[i],receipt:null},{...a.f.shadows[i],receipt:null});assert((await raw(b.f.shadows[i].receipt)).equals(await raw(a.f.shadows[i].receipt)));}};
 for(const c of plan.cases){
  const frames=[];for(const lane of plan.lanes){markFrame(c,lane,'main',c.shadows);const f=await frameData(c,lane,'main');assert.equal(f.f.shadows.length,c.shadows?1:0);for(const d of f.f.draws)if(d.group!==null)seenGroups.add(d.group);frames.push(f);}const[a,b,r]=frames;await exactPair(a,b);await exactPair(a,r);mainFrames.set(c.name,a);expectedNames.add(c.name+'-result');
  caseResults.push({case:c.name,changedPixels:0,nativeDraws:a.f.draws.length,calls:a.f.calls,triangles:a.f.triangles});
 }
 assert.deepEqual([...seenGroups].sort((a,b)=>a-b),[0,1,2,3,4,5,6],'Not all seven groups actually reached native draw calls');
 const controlResults=[];
 for(const control of [...plan.groupVisibilityControls.map(x=>({case:x.case,label:'group-'+x.group})),{case:plan.shadowControl.case,label:'shadow'}]){
  const c=plan.cases.find(c=>c.name===control.case),base=mainFrames.get(control.case);for(const lane of plan.lanes)markFrame(c,lane,control.label,c.shadows&&(control.label!=='shadow'||lane==='restored'));
  const a=await frameData(c,'original',control.label),b=await frameData(c,'indexed',control.label),r=await frameData(c,'restored',control.label);await exactPair(a,b);await exactPair(base,r);const difference=pixelDiff(base.rgba,a.rgba);assert(difference.changedPixels>0,'Vacuous visibility/shadow control');controlResults.push({...control,...difference});
 }
 const timing=[];for(const c of plan.cases){expectedNames.add(c.name+'-timings');const rows=await getJson(c.name+'-timings');assert.equal(rows.length,8);const expected=plan.timing.blocks.flat();for(let i=0;i<8;i++){expectedNames.add(c.name+'-timing-'+i);const r=rows[i];assert.deepEqual(r,await getJson(c.name+'-timing-'+i));assert.equal(r.lane,expected[i]);assert.equal(r.ordinal,i);assert.equal(r.case,c.name);assert.equal(r.block,Math.floor(i/4));assert.equal(r.position,i%4);assert(Number.isFinite(r.cpuSubmitMs)&&r.cpuSubmitMs>=0);assert(Number.isFinite(r.fenceWaitMs)&&r.fenceWaitMs>=0);assert.equal(r.status,'available');assert.equal(r.disjointBefore,false);assert.equal(r.disjointAfter,false);assert(Number.isFinite(r.gpuNanoseconds)&&r.gpuNanoseconds>0);timing.push(r);}}
 for(const g of catalog.groups)for(const lane of ['original','indexed'])for(const key of ['position','normal',...(lane==='indexed'?['index']:[])])expectedNames.add(g[lane].buffers[key].receipt);
 assert.deepEqual([...programs.keys()].sort((a,b)=>a-b),[...usedPrograms].sort((a,b)=>a-b),'Unreferenced or missing retained program');for(const p of programs.keys())expectedNames.add('program-'+p);
 assert.deepEqual([...byName.keys()].sort(),[...expectedNames].sort(),'Missing or extraneous evidence receipt');
 assert.deepEqual(await getJson('browser-result'),report.browser);assert.deepEqual((await getJson('start')).plan,plan);
 const disk=await readdir(directory);for(const f of disk)assert(expectedFiles.has(f),'Extraneous evidence file '+f);
 return{passed:true,zeroPixelCases:caseResults.length,allGroups:7,expandedCorners,programs:programs.size,controlResults,timingQueries:timing.length,timing,caseResults,allRawReceiptsVerified:ledger.filter(r=>r.kind!=='json').length};
}

const bottomUp=(bytes,width,height)=>{const out=Buffer.alloc(bytes.length),stride=width*4;for(let y=0;y<height;y++)bytes.copy(out,(height-1-y)*stride,y*stride,(y+1)*stride);return out;};
const crcTable=Uint32Array.from({length:256},(_,n)=>{for(let k=0;k<8;k++)n=n&1?0xedb88320^(n>>>1):n>>>1;return n>>>0;});
function crc32(bytes){let value=0xffffffff;for(const byte of bytes)value=crcTable[(value^byte)&255]^(value>>>8);return (value^0xffffffff)>>>0;}
function paeth(a,b,c){const p=a+b-c,pa=Math.abs(p-a),pb=Math.abs(p-b),pc=Math.abs(p-c);return pa<=pb&&pa<=pc?a:pb<=pc?b:c;}
export function decodePng(bytes,expectedWidth,expectedHeight){
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
