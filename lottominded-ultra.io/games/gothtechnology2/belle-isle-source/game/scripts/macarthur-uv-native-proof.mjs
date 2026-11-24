import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';

// These are evidence validators, not a renderer or a source canonicalizer.
// The caller retains raw bytes first. Malformed evidence becomes a failed
// receipt instead of throwing out of the collection/cleanup path.
export const eligibleNames=[
 'MacArthur_MacArthur_galvanized_crash_barrier',
 'MacArthur_MacArthur_sidewalk_expansion_joints',
 'MacArthur_Painted_steel_glazing_bars',
 'MacArthur_Patinated_bronze',
];
export const warmName='MacArthur_Higgsfield_•_warm_limestone';
const allNames=[...eligibleNames,warmName],zero=[0,0,0,1],poison=[.375,.625,1,1];
const authoredCounts=new Map(eligibleNames.map((name,i)=>[name,{vertices:[33696,15840,46080,112980][i],indices:[50544,23760,69120,175848][i]}]));
const sha=value=>createHash('sha256').update(value).digest('hex');
const equal=(a,b,message)=>assert.deepEqual(a,b,message);
const positive=value=>Number.isSafeInteger(value)&&value>0;
const finiteVector=(value,size)=>Array.isArray(value)&&value.length===size&&value.every(Number.isFinite);
const ids=rows=>rows.map(row=>row.name).sort();
const result=action=>{try{return {passed:true,failures:[],...action()};}catch(error){return {passed:false,failures:[error instanceof Error?error.message:String(error)]};}};
const rowKey=row=>row.kind+' / '+row.name;
const uniformValue=value=>typeof value==='boolean'||Number.isFinite(value)||Array.isArray(value)&&value.length>0&&value.every(Number.isFinite);
const own=(object,key)=>Object.prototype.hasOwnProperty.call(object,key);

function keyed(rows,key,label){
 assert(Array.isArray(rows),label+' is not an array');const map=new Map();
 for(const row of rows){assert(row&&typeof row==='object',label+' has an invalid row');const name=key(row);assert(!map.has(name),label+' has a duplicate '+name);map.set(name,row);}
 return map;
}
function checkNative(native,label){
 assert(native&&positive(native.programId)&&native.linked===true,label+' has no linked actual program');
 assert(Number.isSafeInteger(native.samples)&&native.samples>=0,label+' sample count is invalid');
 assert(native.framebufferId===null||positive(native.framebufferId),label+' framebuffer identity is invalid');
 const attrs=keyed(native.attributes,row=>row.name,label+' active inputs'),locations=new Set();
 assert(attrs.size>0,label+' has no active inputs');
 for(const attribute of attrs.values()){
  assert(typeof attribute.name==='string'&&attribute.name.length>0,label+' input name is invalid');
  assert(Number.isSafeInteger(attribute.location)&&attribute.location>=0&&!locations.has(attribute.location),label+' input location is missing/aliased');locations.add(attribute.location);
  assert(positive(attribute.inputType)&&attribute.inputSize===1,label+' input type/array size changed');
  assert(typeof attribute.enabled==='boolean'&&typeof attribute.normalized==='boolean'&&typeof attribute.integer==='boolean',label+' input flags are incomplete');
  assert(Number.isSafeInteger(attribute.size)&&attribute.size>=1&&attribute.size<=4&&positive(attribute.type),label+' pointer type/size is invalid');
  for(const field of ['stride','offset','divisor'])assert(Number.isSafeInteger(attribute[field])&&attribute[field]>=0,label+' pointer '+field+' is invalid');
  assert(finiteVector(attribute.generic,4),label+' generic input is unavailable');
  assert(attribute.bufferId===null||positive(attribute.bufferId),label+' buffer identity is invalid');
  if(attribute.enabled)assert(positive(attribute.bufferId),label+' enabled input has no buffer');
 }
 return attrs;
}
function checkPosition(attribute,label){
 assert(attribute,label+' has no position');
 equal([attribute.inputType,attribute.inputSize,attribute.enabled,attribute.size,attribute.type,attribute.normalized,attribute.integer,attribute.divisor],[35665,1,true,3,5126,false,false,0],label+' authored position layout changed');
 assert(attribute.stride>=12&&attribute.stride%4===0&&attribute.offset%4===0,label+' authored position alignment changed');
}
function checkUv(attribute,{enabled,generic,location},label){
 assert(attribute,label+' has no active UV input');
 equal([attribute.inputType,attribute.inputSize,attribute.location],[35664,1,location],label+' linked UV input changed');
 assert.equal(attribute.enabled,enabled,label+' UV enable state is wrong');
 if(enabled)equal([attribute.size,attribute.type,attribute.normalized,attribute.integer,attribute.stride,attribute.offset,attribute.divisor],[2,5126,false,false,8,0,0],label+' UV pointer is not the original Float32 vec2 layout');
 // A disabled pointer may retain arbitrary old buffer/pointer fields. Only
 // its generic value supplies the input; do not count those raw aliases.
 if(generic!==null)equal(attribute.generic,generic,label+' actual generic UV value differs');
}
function checkSeed(seed,expected,purpose,location,label){
 assert(seed&&seed.purpose===purpose,label+' seed purpose is missing/wrong');
 assert.equal(seed.path,'Three ShaderMaterial.defaultAttributeValues.color through a real returned drawArrays',label+' did not use the actual Three default-color path');
 equal(seed.location,location,label+' seeded the wrong linked location');equal(seed.expected,expected,label+' expected seed changed');equal(seed.observed,expected,label+' native seed value differs');equal(seed.defaultColor,expected.slice(0,3),label+' material defaultColor differs');
 assert(finiteVector(seed.genericBefore,4),label+' has no pre-seed state');
 assert(seed.geometryHasColor===false&&positive(seed.geometryId),label+' must use a real geometry missing color');
 assert(seed.hooksRestored===true&&seed.targetViewportScissorRestored===true&&seed.glError===0,label+' seed state or GL status was not restored');
 assert(finiteVector(seed.viewportBefore,4)&&finiteVector(seed.scissorBefore,4)&&typeof seed.scissorTestBefore==='boolean',label+' viewport/scissor receipts are missing');
 equal(seed.draws,[{mode:4,first:0,count:3,returned:true}],label+' actual drawArrays receipt is missing');
 const attrs=checkNative(seed.proof,label+' seed');checkPosition(attrs.get('position'),label+' seed');
 equal([...attrs.keys()].sort(),['color','position'],label+' default-color seed active inputs changed');
 const color=attrs.get('color');equal(color,seed.color,label+' seed color receipt is stale');
 equal([color.location,color.inputType,color.inputSize,color.enabled],[location,35665,1,false],label+' actual default-color location/input changed');equal(color.generic,expected,label+' actual default-color value differs');
 assert(positive(seed.proof.framebufferId)&&seed.proof.samples===0,label+' seed did not draw into the separate samples0 target');
}
function checkShadow(shadow,view){
 assert(shadow&&shadow.width===256&&shadow.height===256&&shadow.samples===0,'Actual shadow target dimensions/sample count changed');
 equal([shadow.type,shadow.format],[1009,1023],'Shadow color attachment must be RGBA UnsignedByte');
 equal(shadow.depthTexture,{type:1014,format:1026},'Pinned PCF depthTexture storage changed');
 assert.equal(shadow.readback,'RGBA8 BasicDepthPacking color attachment; not native depthTexture bytes','Shadow readback kind is not explicit');assert.equal(shadow.readbackRestored,true,'Shadow readback changed renderer/framebuffer binding');
 equal(shadow.lightTarget,[264,8,467],'Shadow target changed');equal(shadow.lightPosition,view===0?[324,118,512]:[204,118,422],'Actual light direction changed');
 const camera=shadow.camera;equal([camera.left,camera.right,camera.top,camera.bottom,camera.near,camera.far],[-35,35,35,-35,1,400],'Actual light frustum changed');
 for(const value of [shadow.lightMatrixWorld,camera.matrixWorld,camera.projection])assert(finiteVector(value,16),'Actual shadow matrices are missing');
}
function expectedInventory(metadata,names,witness){
 const presentation=metadata.presentation,visible=presentation==='hidden'?[]:presentation.startsWith('omit:')?names.filter(name=>name!==presentation.slice(5)):names;
 const casters=witness||['no-casters','receiver-no-casters'].includes(presentation)?[]:presentation.startsWith('receiver-omit:')?visible.filter(name=>name!==presentation.slice(14)):visible;
 return [...visible.map(name=>({name,kind:witness?'witness':'color'})),...casters.map(name=>({name,kind:'shadow'}))].map(rowKey).sort();
}
function checkCapture(metadata,{mapped=true,witness=false,expectedNames=eligibleNames,generic=null}={}){
 assert(metadata&&typeof metadata==='object','Missing capture metadata');
 assert(['baseline','candidate'].includes(metadata.side),'Unknown capture side');assert(metadata.view===0||metadata.view===1,'Unknown capture view');
 assert(['screen-msaa4','target-samples0'].includes(metadata.output),'Unknown output');equal([metadata.width,metadata.height],[320,240],'Actual capture dimensions changed');
 assert(metadata.passed===true&&Array.isArray(metadata.failures)&&metadata.failures.length===0,'Page capture reported a failure');assert.equal(metadata.glError,0,'Capture reported a GL error');
 equal(metadata.diagnosticWitness,witness,'Product and diagnostic witness scopes were mixed');assert(typeof metadata.attributeControl==='boolean'&&(!metadata.attributeControl||witness&&metadata.side==='candidate'),'Attribute control escaped the candidate witness');
 assert(Array.isArray(expectedNames)&&expectedNames.length>0&&new Set(expectedNames).size===expectedNames.length&&expectedNames.every(name=>allNames.includes(name)),'Unexpected/duplicate actual caster inventory');
 const allowed=['all','hidden','no-casters','receiver','receiver-no-casters','primer','reverse',...allNames.flatMap(name=>['omit:'+name,'receiver-omit:'+name])];assert(allowed.includes(metadata.presentation),'Unknown presentation');
 if(metadata.presentation==='primer')equal(expectedNames,[warmName],'Primer must contain only actual mapped limestone');
 if(metadata.presentation==='reverse')equal([...expectedNames].sort(),[...allNames].sort(),'Reverse contract must include all five authored finishes');
 const lifecycle=metadata.lifecycle;assert(lifecycle?.restored===true&&lifecycle.visibilityRestored===true&&lifecycle.casterRestored===true&&lifecycle.genericRestored===true,'Capture lifecycle restoration is incomplete');
 const samples=metadata.output==='screen-msaa4'?4:0;equal(metadata.samples,samples,'Actual color sample count differs');checkShadow(metadata.shadow,metadata.view);
 equal(metadata.focus,[264,8,467],'Fixture focus changed');assert(finiteVector(metadata.camera?.matrixWorld,16)&&finiteVector(metadata.camera?.projection,16),'Actual view matrices are missing');
 equal(metadata.camera.position,metadata.view===0?[318,80,509]:[210,80,425],'Actual camera direction changed');
 const rows=keyed(metadata.receipts,rowKey,'Actual draw receipts'),selections=keyed(metadata.selections,rowKey,'Selected ranges'),resets=keyed(metadata.resets,rowKey,'Restored ranges');
 equal([...rows.keys()].sort(),expectedInventory(metadata,expectedNames,witness),'Actual draw inventory is missing or unexpected');equal([...selections.keys()].sort(),[...rows.keys()].sort(),'Selected ranges do not match actual draws');equal([...resets.keys()].sort(),[...rows.keys()].sort(),'Restored ranges do not match actual draws');
 assert(['fresh','poisoned','reset'].includes(metadata.generic),'Unknown generic state label');
 const requested=metadata.generic==='poisoned'?poison:zero;if(generic!==null)equal(generic,requested,'Validator generic input contradicts capture label');
 let location=metadata.uvLocation;
 if(metadata.presentation==='primer')location=[...rows.values()].find(row=>row.kind==='shadow')?.native?.attributes?.find(a=>a.name==='uv')?.location;
 if(mapped||witness)assert(Number.isSafeInteger(location)&&location>=0,'Actual mapped/witness UV location is unavailable');
 else assert(location===undefined||location===null,'Fresh reversed path must not inherit a mapped UV location');
 if(metadata.generic==='fresh'){
  assert(metadata.seed===null&&metadata.resetSeed===null&&metadata.everSeeded===false,'Reset or seeded context was labeled fresh');
 }else{
  assert(metadata.everSeeded===true,'Explicit generic seed was not recorded');checkSeed(metadata.seed,requested,metadata.generic==='poisoned'?'poison':'reset',location,'Capture');
  equal(metadata.seed.genericBefore,metadata.genericBefore,'Pre-seed state does not match capture');
  if(metadata.generic==='poisoned'){
   checkSeed(metadata.resetSeed,zero,'reset',location,'Restoration');equal(metadata.resetSeed.genericBefore,poison,'Generic poison was lost before restoration');assert.notEqual(metadata.seed.geometryId,metadata.resetSeed.geometryId,'Reset reused seed geometry and may skip Three default binding');
  }else assert.equal(metadata.resetSeed,null,'Zero reset capture has an unexpected second seed');
 }
 if(metadata.presentation!=='primer'&&(mapped||witness)){
  equal(metadata.genericBefore,zero,'Capture did not enter from its proven zero generic state');equal(metadata.genericAfter,zero,'Capture did not restore the original zero generic state');
 }else if(!mapped&&!witness)equal([metadata.genericBefore,metadata.genericAfter],[null,null],'Reverse contract inherited generic-state instrumentation');
 const programIds=new Set(),shadowPrograms=new Set(),uvBuffers=new Set();let partialShadowDraws=0;
 for(const [key,row]of rows){
  assert(positive(row.geometryId),key+' has no actual display identity');assert(positive(row.fullIndexCount)&&row.fullIndexCount%3===0,key+' full index count is invalid');
  const counts=authoredCounts.get(row.name);if(counts)equal(row.fullIndexCount,counts.indices,key+' no longer draws the actual shipped index count');
  assert([2,4].includes(row.indexBytes),key+' index storage changed');const selection=selections.get(key).range,reset=resets.get(key).range;
  equal(row.selected,selection,key+' receipt differs from the actual selected range');equal(reset,{start:0,count:'Infinity'},key+' culling hook did not restore its range');
  assert(Number.isSafeInteger(selection.start)&&selection.start>=0&&selection.start<row.fullIndexCount&&selection.start%3===0,key+' selected start is invalid');
  assert(selection.count==='Infinity'||positive(selection.count)&&selection.count%3===0,key+' selected count is invalid/empty');
  const count=selection.count==='Infinity'?row.fullIndexCount-selection.start:Math.min(selection.count,row.fullIndexCount-selection.start);
  equal(row.draw,{mode:4,count,type:row.indexBytes===2?5123:5125,offset:selection.start*row.indexBytes,returned:true},key+' returned indexed draw does not match actual range/index type');
  assert(count>0,key+' draw is empty');if(selection.count!=='Infinity')assert(selection.start+selection.count<=row.fullIndexCount,key+' selected range exceeds authored indices');
  assert(row.materialOpacity===1&&row.materialAlphaTest===0&&row.materialAlphaHash===false&&row.materialAlphaToCoverage===false&&!row.customDepth&&!row.customDistance,key+' eligible opaque/alpha-free material contract changed');
  equal(row.materialType,row.kind==='shadow'?'MeshDepthMaterial':witness?'RawShaderMaterial':'MeshStandardMaterial',key+' actual material type changed');
  equal(row.materialMap,!witness&&row.name===warmName,key+' actual source map presence changed');
  assert(finiteVector(row.cameraMatrixWorld,16)&&finiteVector(row.cameraProjection,16),key+' actual draw camera is missing');
  const attrs=checkNative(row.native,key);checkPosition(attrs.get('position'),key);programIds.add(row.native.programId);
  if(row.kind==='shadow'){
   assert(positive(row.native.framebufferId)&&row.native.samples===0,key+' shadow draw did not target the actual samples0 FBO');
   equal(row.cameraMatrixWorld,metadata.shadow.camera.matrixWorld,key+' culling used the wrong camera');equal(row.cameraProjection,metadata.shadow.camera.projection,key+' culling projection differs');
   assert(selection.count!=='Infinity'&&count<row.fullIndexCount,key+' shadow culling is not a nonempty partial span');partialShadowDraws++;shadowPrograms.add(row.native.programId);
   equal([...attrs.keys()].sort(),mapped?['position','uv']:['position'],key+' actual mapped/reversed shadow input inventory differs');
  }else{
   equal(row.native.samples,samples,key+' actual color draw sample count differs');assert(samples===4?row.native.framebufferId===null:positive(row.native.framebufferId),key+' color framebuffer kind differs');
   equal(row.cameraMatrixWorld,metadata.camera.matrixWorld,key+' color camera differs');equal(row.cameraProjection,metadata.camera.projection,key+' color projection differs');
   if(samples===0)equal(selection,{start:0,count:'Infinity'},key+' offscreen color bypass no longer keeps full geometry');else assert(selection.count!=='Infinity'&&count<row.fullIndexCount,key+' ordinary color culling is not partial');
   if(witness){equal([...attrs.keys()].sort(),['position','uv'],key+' witness input inventory differs');equal(attrs.get('position').location,location===0?1:0,key+' diagnostic position location conflicts with actual UV');}
  }
  if(row.kind==='shadow'&&mapped||row.kind==='witness'){
   const uv=attrs.get('uv');checkUv(uv,{enabled:metadata.side==='candidate'||row.name===warmName,generic:requested,location},key);if(uv.enabled)uvBuffers.add(uv.bufferId);
  }
  assert(row.uniforms&&typeof row.uniforms==='object'&&!Array.isArray(row.uniforms),key+' actual uniform receipts missing');
  for(const [name,value]of Object.entries(row.uniforms)){assert(value?.matches===true&&uniformValue(value.expected)&&uniformValue(value.observed),key+' invalid actual uniform '+name);equal(value.observed,value.expected,key+' stale actual uniform '+name);}
  if(row.kind==='shadow')equal(row.uniforms.opacity,{expected:1,observed:1,matches:true},key+' depth opacity was not verified natively');
 }
 if(shadowPrograms.size)assert.equal(shadowPrograms.size,1,'Actual shadow family did not use one linked program');
 if(witness)assert.equal(programIds.size,1,'Diagnostic witness did not use one linked program');
 return {draws:rows.size,partialShadowDraws,programIds:[...programIds],shadowProgramIds:[...shadowPrograms],uvLocation:location??null,uvBufferIds:[...uvBuffers],scope:witness?'diagnostic UV-consuming witness':'actual authored color and default depth materials'};
}

export function validateCapture(metadata,options){return result(()=>checkCapture(metadata,options));}

function pointerValue(attribute){
 const {bufferId,...value}=attribute;
 // Disabled pointer storage is inert. Keep location, type, generic value and
 // enable state while removing the raw VAO fields that cannot affect input.
 return attribute.enabled?value:{name:value.name,location:value.location,inputType:value.inputType,inputSize:value.inputSize,enabled:false,generic:value.generic};
}
function compareReceipts(a,b,{mapped=true,witness=false}={}){
 assert(a?.side==='baseline'&&b?.side==='candidate','Receipt comparison requires independent baseline/candidate sides');
 for(const field of ['view','output','generic','presentation','diagnosticWitness','attributeControl','width','height','samples','focus','camera','shadow'])equal(a[field],b[field],'Baseline/candidate '+field+' differs');
 assert(!a.attributeControl&&!b.attributeControl,'Product/pair comparison cannot include an active attribute control');
 const names=a.presentation==='primer'?[warmName]:a.presentation==='reverse'?allNames:eligibleNames;
 checkCapture(a,{mapped,witness,expectedNames:names});checkCapture(b,{mapped,witness,expectedNames:names});
 const rowsA=keyed(a.receipts,rowKey,'Baseline draws'),rowsB=keyed(b.receipts,rowKey,'Candidate draws');equal([...rowsA.keys()].sort(),[...rowsB.keys()].sort(),'Actual corresponding draw inventory differs');
 for(const [key,x]of rowsA){const y=rowsB.get(key);
  for(const field of ['name','kind','materialType','materialMap','materialOpacity','materialAlphaTest','materialAlphaHash','materialAlphaToCoverage','customDepth','customDistance','selected','fullIndexCount','indexBytes','cameraMatrixWorld','cameraProjection','draw','uniforms'])equal(x[field],y[field],key+' baseline/candidate '+field+' differs');
  equal(x.native.programId,y.native.programId,key+' actual native program identity differs');equal(x.native.samples,y.native.samples,key+' actual output sample state differs');equal(x.native.framebufferId===null,y.native.framebufferId===null,key+' framebuffer kind differs');
  const attrsA=keyed(x.native.attributes,row=>row.name,key+' baseline inputs'),attrsB=keyed(y.native.attributes,row=>row.name,key+' candidate inputs');equal([...attrsA.keys()].sort(),[...attrsB.keys()].sort(),key+' linked inputs differ');
  for(const [name,attribute]of attrsA){const other=attrsB.get(name);
   if(name==='uv'&&eligibleNames.includes(x.name)&&(mapped&&x.kind==='shadow'||witness))equal([attribute.location,attribute.inputType,attribute.inputSize,attribute.generic],[other.location,other.inputType,other.inputSize,other.generic],key+' UV program/location/generic contract differs');
   else equal(pointerValue(attribute),pointerValue(other),key+' original input layout changed: '+name);
  }
 }
 return {draws:rowsA.size,exactProgramIdentity:true,rangeAndOutputAxesEqual:true,allowedDifference:'Only four display UV inputs change from disabled generic state to enabled Float32 vec2 arrays; distinct storage identities are retained.'};
}
export function compareCaptureReceipts(a,b,options){return result(()=>compareReceipts(a,b,options));}

function sourceHasDefine(source,name){return new RegExp('^\\s*#define\\s+'+name+'(?:\\s|$)','m').test(source);}
function checkDepthSource(program,mapped){
 for(const stage of ['vertexSource','fragmentSource']){
  const source=program[stage];assert(/^#version 300 es\b/m.test(source),'Depth source is not the actual WebGL2 stage');
  assert(/^#define SHADER_TYPE MeshDepthMaterial\s*$/m.test(source),'Actual submitted depth material type changed');
  assert(sourceHasDefine(source,'DOUBLE_SIDED')&&sourceHasDefine(source,'SHADOWMAP_TYPE_PCF'),'Actual depth side/shadow type changed');
  equal(sourceHasDefine(source,'USE_MAP'),mapped,'Actual submitted mapped/reversed depth source differs');
  for(const macro of ['USE_ALPHAMAP','USE_ALPHATEST','USE_ALPHAHASH','ALPHA_TO_COVERAGE','USE_DISPLACEMENTMAP','USE_SKINNING','USE_INSTANCING','USE_BATCHING'])assert(!sourceHasDefine(source,macro),'Unexpected depth-affecting branch: '+macro);
  if(mapped&&stage==='vertexSource')assert(/^#define MAP_UV uv\s*$/m.test(source),'Mapped depth uses a different UV channel');
 }
 assert(/^#define DEPTH_PACKING 3200\s*$/m.test(program.fragmentSource),'Actual submitted depth is not BasicDepthPacking');
}
function checkWitnessSource(program,location){
 const vertex='precision highp float;\nlayout(location='+(location===0?1:0)+') in vec3 position;\nlayout(location='+location+') in vec2 uv;\nuniform mat4 projectionMatrix;uniform mat4 modelViewMatrix;out vec2 witnessUv;\nvoid main(){witnessUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',fragment='precision highp float;in vec2 witnessUv;out vec4 witnessOutput;void main(){witnessOutput=vec4(.15+.7*witnessUv.x,.20+.7*witnessUv.y,.35,1.);}';
 assert(/^#define SHADER_TYPE RawShaderMaterial\s*$/m.test(program.vertexSource),'Diagnostic witness is not the actual RawShaderMaterial');
 assert(program.vertexSource.endsWith(vertex)&&program.fragmentSource.endsWith(fragment),'Actual diagnostic witness UV location/arithmetic changed');
}
function checkSeedSource(program,location){
 assert(program,'Actual default-color seed program was not retained');
 const vertex='layout(location='+location+') in vec3 color;\nout vec3 seedColor;\nvoid main(){seedColor=color;gl_Position=vec4(position,1.);}',fragment='in vec3 seedColor;out vec4 seedOutput;void main(){seedOutput=vec4(seedColor,1.);}';
 assert(/^#define SHADER_TYPE ShaderMaterial\s*$/m.test(program.vertexSource),'Generic seed is not the actual Three ShaderMaterial');
 assert(program.vertexSource.endsWith(vertex)&&program.fragmentSource.endsWith(fragment),'Actual default-color seed source/location changed');
}
export function validatePrograms(programs,capturePairs,options={}){return result(()=>{
 const {mapped=true,witness=false,primer=null}=options;
 const table=keyed(programs,row=>row.id,'Retained programs');assert(table.size>0,'No retained full native shader stages');
 for(const row of table.values()){assert(positive(row.id)&&row.linked===true,'Retained native program is not linked');for(const name of ['vertexSource','fragmentSource'])assert(typeof row[name]==='string'&&row[name].includes('void main('),'Retained complete native '+name+' missing');}
 assert(Array.isArray(capturePairs)&&capturePairs.length>0,'No native capture pairs');const used=new Set(),depthIds=new Set();
 for(const pair of capturePairs){compareReceipts(pair.baseline,pair.candidate,{mapped,witness});
  for(const metadata of [pair.baseline,pair.candidate])for(const seed of [metadata.seed,metadata.resetSeed])if(seed){checkSeedSource(table.get(seed.proof.programId),seed.location);used.add(seed.proof.programId);}
  const other=keyed(pair.candidate.receipts,rowKey,'Candidate source receipts');
  for(const row of pair.baseline.receipts){const b=other.get(rowKey(row)),aProgram=table.get(row.native.programId),bProgram=table.get(b.native.programId);assert(aProgram&&bProgram,'Actual draw references an unretained native program');
   equal(aProgram.vertexSource,bProgram.vertexSource,'Full submitted vertex bytes differ');equal(aProgram.fragmentSource,bProgram.fragmentSource,'Full submitted fragment bytes differ');used.add(aProgram.id);used.add(bProgram.id);
   if(row.kind==='shadow'){checkDepthSource(aProgram,mapped);depthIds.add(aProgram.id);}
   if(row.kind==='witness')checkWitnessSource(aProgram,pair.baseline.uvLocation);
  }
 }
 if(!witness){assert.equal(depthIds.size,1,'Shadow captures did not retain one actual linked depth program');}
 if(primer!==null){
  assert(mapped&&!witness,'Only the mapped product program may take a warm primer');checkCapture(primer,{mapped:true,witness:false,expectedNames:[warmName]});
  const shadow=primer.receipts.filter(row=>row.kind==='shadow');assert.equal(shadow.length,1,'Warm primer depth receipt missing');assert(depthIds.has(shadow[0].native.programId),'Four later shadow draws did not reuse the actual warm primer program');
  assert.equal(shadow[0].materialMap,true,'Primer did not use the authored mapped limestone');checkDepthSource(table.get(shadow[0].native.programId),true);
 }
 return {usedPrograms:[...used],depthProgramIds:[...depthIds],primerProgramVerified:primer!==null,stages:[...used].map(id=>({id,vertexSha256:sha(table.get(id).vertexSource),fragmentSha256:sha(table.get(id).fragmentSource)})),normalization:'none; full submitted stage bytes compared exactly'};
});}

function attrValue(attribute){const {objectId,...value}=attribute;return value;}
function geometryValue(geometry){return {...geometry,objectId:undefined,attributes:Object.fromEntries(Object.entries(geometry.attributes).map(([name,value])=>[name,attrValue(value)])),index:attrValue(geometry.index),boundingBox:geometry.boundingBox?{...geometry.boundingBox,objectId:undefined}:null,boundingSphere:geometry.boundingSphere?{...geometry.boundingSphere,objectId:undefined}:null};}
function checkAttribute(attribute,label,inventory){
 assert(attribute&&positive(attribute.objectId),label+' original attribute identity is missing');assert(positive(attribute.itemSize)&&positive(attribute.count),label+' attribute shape is invalid');
 assert(['Float32Array','Uint16Array','Uint32Array','Int8Array','Uint8Array','Int16Array','Int32Array'].includes(attribute.arrayType),label+' typed storage is unsupported');
 assert(typeof attribute.normalized==='boolean'&&typeof attribute.interleaved==='boolean',label+' layout flags missing');
 assert(positive(attribute.stride)&&Number.isSafeInteger(attribute.offset)&&attribute.offset>=0&&Number.isSafeInteger(attribute.version)&&attribute.version>=0&&positive(attribute.usage),label+' layout metadata missing');
 const buffer=attribute.buffer;assert(buffer&&/^[0-9a-f]{64}$/.test(buffer.sha256)&&positive(buffer.bytes),label+' original byte hash/length missing');equal(inventory.get(buffer.sha256)?.bytes,buffer.bytes,label+' byte payload is not retained');
}
function checkGeometrySide(side,name,inventory){
 assert(side&&Array.isArray(side.rows),'Missing '+name+' geometry rows');const rows=keyed(side.rows,row=>row.name,name+' geometry');equal([...rows.keys()].sort(),[...allNames].sort(),'Actual five-mesh geometry inventory changed');
 equal([...side.receiptNames].sort(),name==='candidate'?[...eligibleNames].sort():[],name+' actual caller receipt cohort changed');assert(side.detail?.simplified>0,name+' actual asynchronous detail preparation did not run');
 let addedBytes=0;const addedIds=new Set();
 for(const [mesh,row]of rows){
  for(const field of ['sourceGeometryObjectUnchanged','originalAttributeObjectsRetained','materialObjectUnchanged','compileUnchanged','keyUnchanged','raycastWrapperPresent'])assert(row[field]===true,mesh+' failed original '+field);
  assert(finiteVector(row.matrixWorld,16),mesh+' transform missing');equal(row.matrixWorld,row.sourceMatrixWorld,mesh+' original transform changed');
  const {source,display}=row;assert(positive(source.objectId)&&positive(display.objectId)&&source.objectId!==display.objectId,mesh+' did not retain separate source and display geometries');
  for(const [label,geometry]of [['source',source],['display',display]]){
   assert(geometry.attributes&&Object.keys(geometry.attributes).length>=2,mesh+' '+label+' original attributes missing');
   for(const [attribute,value]of Object.entries(geometry.attributes))checkAttribute(value,mesh+' '+label+' '+attribute,inventory);checkAttribute(geometry.index,mesh+' '+label+' index',inventory);
   equal(geometry.drawRange,{start:0,count:'Infinity'},mesh+' '+label+' range not restored');equal(geometry.groups,[],mesh+' '+label+' groups changed');equal(geometry.morphAttributes,[],mesh+' '+label+' morph attributes changed');assert.equal(geometry.morphTargetsRelative,false,mesh+' '+label+' morph mode changed');
   assert(positive(geometry.boundingBox?.objectId)&&finiteVector(geometry.boundingBox.min,3)&&finiteVector(geometry.boundingBox.max,3),mesh+' '+label+' bounds missing');
   assert(positive(geometry.boundingSphere?.objectId)&&finiteVector(geometry.boundingSphere.center,3)&&Number.isFinite(geometry.boundingSphere.radius)&&geometry.boundingSphere.radius>0,mesh+' '+label+' sphere missing');
  }
  equal(display.boundingBox,source.boundingBox,mesh+' original bound object changed');equal(display.boundingSphere,source.boundingSphere,mesh+' original sphere object changed');assert.notEqual(display.index.objectId,source.index.objectId,mesh+' ordered display index must retain its separate identity');
  for(const [attribute,value]of Object.entries(source.attributes))equal(display.attributes[attribute],value,mesh+' original shared '+attribute+' object/bytes changed');
  const expected=authoredCounts.get(mesh);if(expected){equal(source.attributes.position.count,expected.vertices,mesh+' shipped vertex count changed');equal(source.index.count,expected.indices,mesh+' shipped index count changed');}
  equal(display.index.count,source.index.count,mesh+' ordered index count differs');equal(display.index.arrayType,source.index.arrayType,mesh+' ordered index type differs');
  const extra=Object.keys(display.attributes).filter(attribute=>!own(source.attributes,attribute));
  if(mesh===warmName){assert(source.attributes.uv,mesh+' lost its authored UV');equal(extra,[],mesh+' acquired a new authored attribute');}
  else{
   assert(!['uv','uv1','uv2','uv3'].some(attribute=>own(source.attributes,attribute)),mesh+' source/raycast geometry acquired UV storage');
   equal(extra,name==='candidate'?['uv']:[],mesh+' unexpected display-only attributes');
   if(name==='candidate'){
    const uv=display.attributes.uv;equal([uv.arrayType,uv.itemSize,uv.count,uv.normalized,uv.interleaved,uv.stride,uv.offset,uv.usage,uv.version],['Float32Array',2,source.attributes.position.count,false,false,2,0,35044,0],mesh+' added UV metadata differs');
    equal(uv.buffer.bytes,uv.count*8,mesh+' added UV byte length differs');equal(uv.buffer.sha256,sha(Buffer.alloc(uv.buffer.bytes)),mesh+' new UV bytes are not all positive zero');
    assert(!addedIds.has(uv.objectId)&&!Object.values(source.attributes).some(value=>value.objectId===uv.objectId),mesh+' added UV object aliases authored/other geometry');addedIds.add(uv.objectId);addedBytes+=uv.buffer.bytes;
   }
  }
  const material=row.material;assert(material?.type==='MeshStandardMaterial'&&material.side===2&&material.shadowSide===null&&!material.transparent&&material.opacity===1&&material.alphaTest===0&&!material.alphaHash&&!material.alphaToCoverage&&material.depthWrite===true&&material.colorWrite===true&&!material.customDepth&&!material.customDistance,mesh+' original opaque material eligibility changed');
  equal(material.map,mesh===warmName,mesh+' authored map presence changed');assert(typeof material.customKey==='string'&&material.customKey.length>0,mesh+' original key missing');
  if(mesh!==warmName)equal(material.defines,{STANDARD:''},mesh+' authored defines changed');
  assert(Array.isArray(row.rays)&&row.rays.length===4,mesh+' original ray probes missing');equal(row.rays,row.originalRays,mesh+' authored ray/face hits changed');
  for(const ray of row.rays){assert(finiteVector(ray.origin,3)&&finiteVector(ray.direction,3)&&Array.isArray(ray.hits)&&ray.hits.length>0,mesh+' original ray witness is empty');for(const hit of ray.hits)assert(Number.isFinite(hit.distance)&&finiteVector(hit.point,3)&&Number.isSafeInteger(hit.faceIndex)&&hit.faceIndex>=0&&hit.face&&['a','b','c','materialIndex'].every(key=>Number.isSafeInteger(hit.face[key])&&hit.face[key]>=0),mesh+' original face/ray result is incomplete');}
 }
 equal(addedBytes,name==='candidate'?1668768:0,name+' display-only allocation changed');return rows;
}
function checkGeometry(evidence){
 assert(evidence&&evidence.sides,'Missing original/display geometry evidence');const inventory=keyed(evidence.buffers,row=>row.sha256,'Retained geometry buffers');
 for(const row of inventory.values())assert(/^[0-9a-f]{64}$/.test(row.sha256)&&positive(row.bytes),'Invalid retained geometry content reference');
 const baseline=checkGeometrySide(evidence.sides.baseline,'baseline',inventory),candidate=checkGeometrySide(evidence.sides.candidate,'candidate',inventory);
 for(const [name,a]of baseline){const b=candidate.get(name);equal(geometryValue(a.source),geometryValue(b.source),name+' actual baseline/candidate source bytes/layout differ');
  const displayB=geometryValue(b.display);if(eligibleNames.includes(name))delete displayB.attributes.uv;equal(geometryValue(a.display),displayB,name+' original ordered display bytes/layout differ');
  for(const field of ['matrixWorld','sourceMatrixWorld','material','rays','originalRays'])equal(a[field],b[field],name+' baseline/candidate '+field+' differs');
 }
 return {baseline,candidate,inventory};
}
export function validateGeometry(before,after){return result(()=>{
 const a=checkGeometry(before),b=checkGeometry(after);
 for(const side of ['baseline','candidate'])equal(before.sides[side],after.sides[side],side+' original geometry/material/attribute objects or bytes changed after controls');
 for(const [hash,buffer]of a.inventory)equal(b.inventory.get(hash),buffer,'An original retained geometry payload disappeared');
 // Later controls legitimately add their own content-addressed poison arrays
 // to the inventory. They must not replace any restored geometry reference.
 return {meshes:allNames.length,eligible:eligibleNames.length,addedBytes:1668768,originalObjectsAndBytesRestored:true,buffersBefore:a.inventory.size,buffersAfter:b.inventory.size};
});}

export function validateAttributeControl(enabled,disabled,geometry,captures={}){return result(()=>{
 const {before,changed,restored}=captures;
 assert(enabled?.enabled===true&&disabled?.enabled===false,'Attribute control transitions missing');const state=checkGeometry(geometry);
 const on=keyed(enabled.attributes,row=>row.name,'Enabled control attributes'),off=keyed(disabled.attributes,row=>row.name,'Restored control attributes');equal([...on.keys()].sort(),[...eligibleNames].sort(),'Incomplete enabled attribute control');equal([...off.keys()].sort(),[...eligibleNames].sort(),'Incomplete restored attribute control');
 for(const metadata of [before,changed,restored]){assert.equal(metadata.side,'candidate','Array control escaped the candidate');checkCapture(metadata,{mapped:false,witness:true,expectedNames:eligibleNames,generic:zero});}
 equal([before.attributeControl,changed.attributeControl,restored.attributeControl],[false,true,false],'Wrong array-control capture lifecycle');
 for(const field of ['view','output','presentation','generic','width','height','samples','focus','camera','shadow']){equal(before[field],changed[field],'Array-control '+field+' changed');equal(before[field],restored[field],'Array restoration '+field+' changed');}
 const originalRows=keyed(before.receipts,row=>row.name,'Original witness draws'),changedRows=keyed(changed.receipts,row=>row.name,'Changed witness draws'),restoredRows=keyed(restored.receipts,row=>row.name,'Restored witness draws');
 for(const name of eligibleNames){const original=state.candidate.get(name).display.attributes.uv,a=on.get(name),b=off.get(name);assert(a.sourceHasUv===false&&b.sourceHasUv===false,name+' control touched original source UV');equal(b.attribute,original,name+' control did not restore the original UV object and bytes');assert.notEqual(a.attribute.objectId,original.objectId,name+' control reused the original UV object');
  const bytes=Buffer.alloc(original.buffer.bytes);for(let offset=0;offset<bytes.length;offset+=8){bytes.writeFloatLE(poison[0],offset);bytes.writeFloatLE(poison[1],offset+4);}
  equal(attrValue(a.attribute),{...attrValue(original),buffer:{sha256:sha(bytes),bytes:bytes.length}},name+' control did not bind the exact independent poison array');
  const x=originalRows.get(name),y=changedRows.get(name),z=restoredRows.get(name);assert(x&&y&&z,name+' witness draw missing during control');
  for(const field of ['geometryId','selected','fullIndexCount','indexBytes','cameraMatrixWorld','cameraProjection','draw','uniforms']){equal(x[field],y[field],name+' control changed '+field);equal(x[field],z[field],name+' restoration changed '+field);}
  equal([x.native.programId,x.native.programId],[y.native.programId,z.native.programId],name+' control changed the actual witness program');
  equal([x.native.framebufferId,x.native.framebufferId],[y.native.framebufferId,z.native.framebufferId],name+' control changed the actual output framebuffer');
  for(const attribute of x.native.attributes)if(attribute.name!=='uv'){
   equal(y.native.attributes.find(value=>value.name===attribute.name),attribute,name+' control changed an original native input/buffer');
   equal(z.native.attributes.find(value=>value.name===attribute.name),attribute,name+' restoration changed an original native input/buffer');
  }
  const uv=row=>row.native.attributes.find(attribute=>attribute.name==='uv');assert.notEqual(uv(x).bufferId,uv(y).bufferId,name+' poison attribute did not change the actual native buffer');equal(uv(z).bufferId,uv(x).bufferId,name+' original native UV buffer was not restored');
  equal(pointerValue(uv(x)),pointerValue(uv(y)),name+' control changed pointer format/generic value');equal(pointerValue(uv(x)),pointerValue(uv(z)),name+' restored UV pointer format differs');
 }
 return {attributes:eligibleNames.length,sourceGeometryUntouched:true,originalAttributeObjectsAndNativeBuffersRestored:true};
});}
