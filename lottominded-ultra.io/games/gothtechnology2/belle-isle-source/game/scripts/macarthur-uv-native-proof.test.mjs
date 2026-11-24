import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {eligibleNames,warmName,validateCapture,compareCaptureReceipts,validateGeometry,validatePrograms,validateAttributeControl} from './macarthur-uv-native-proof.mjs';

// Deliberately modeled receipts exercise the independent evidence oracle.
// They are not GPU measurements, native compilation or product pixel proof.
// Vertex/index counts are the five exact shipped GLB accessor counts; native
// execution supplies the real matrices, source stages, pointers and bytes.
const zero=[0,0,0,1],poison=[.375,.625,1,1],names=[...eligibleNames,warmName];
const counts=[[33696,50544,2],[15840,23760,2],[46080,69120,2],[112980,175848,4],[85024,142992,4]];
const identity=[1,0,0,0,0,1,0,0,0,0,1,0,0,0,0,1],shadowMatrix=[...identity.slice(0,12),324,118,512,1];
const clone=structuredClone,hash=value=>createHash('sha256').update(value).digest('hex');
const pass=result=>{assert.equal(result.passed,true,JSON.stringify(result));assert.deepEqual(result.failures,[]);};
const fail=result=>{assert.equal(result.passed,false,'Malformed evidence was accepted');assert(Array.isArray(result.failures)&&result.failures.length>0);};
function pointer(name,location,{enabled=true,generic=zero,bufferId=100}={}){return {name,location,inputType:name==='uv'?35664:35665,inputSize:1,enabled,size:name==='uv'?2:3,type:5126,normalized:false,integer:false,stride:name==='uv'?8:12,offset:0,divisor:0,bufferId:enabled?bufferId:null,generic:[...generic]};}
function native(programId,attributes,framebufferId=null,samples=4){return {programId,linked:true,attributes,framebufferId,samples};}
function seed(value,purpose,geometryId=1000){const color=pointer('color',2,{enabled:false,generic:value});return {purpose,path:'Three ShaderMaterial.defaultAttributeValues.color through a real returned drawArrays',location:2,genericBefore:purpose==='reset'&&geometryId===1001?poison:zero,expected:[...value],observed:[...value],color,draws:[{mode:4,first:0,count:3,returned:true}],proof:native(70,[pointer('position',0),color],900,0),defaultColor:value.slice(0,3),geometryHasColor:false,geometryId,hooksRestored:true,targetViewportScissorRestored:true,viewportBefore:[0,0,320,240],scissorBefore:[0,0,320,240],scissorTestBefore:false,glError:0};}
function capture(side,{mapped=true,witness=false,output='screen-msaa4',generic='fresh',presentation='all',control=false}={}){
 const members=presentation==='primer'?[warmName]:presentation==='reverse'?names:eligibleNames;
 const genericValue=generic==='poisoned'?poison:zero,uvLocation=mapped||witness?2:undefined;
 const metadata={side,view:0,output,generic,presentation,diagnosticWitness:witness,attributeControl:control,width:320,height:240,samples:output==='screen-msaa4'?4:0,glError:0,seed:generic==='fresh'?null:seed(genericValue,generic==='poisoned'?'poison':'reset'),resetSeed:generic==='poisoned'?seed(zero,'reset',1001):null,everSeeded:generic!=='fresh',uvLocation,genericBefore:uvLocation===undefined?null:[...zero],genericAfter:uvLocation===undefined?null:[...zero],focus:[264,8,467],camera:{position:[318,80,509],matrixWorld:[...identity],projection:[...identity]},receipts:[],selections:[],resets:[],lifecycle:{restored:true,visibilityRestored:true,casterRestored:true,genericRestored:true},shadow:{width:256,height:256,type:1009,format:1023,colorSpace:'',samples:0,depthTexture:{type:1014,format:1026},readback:'RGBA8 BasicDepthPacking color attachment; not native depthTexture bytes',readbackRestored:true,lightPosition:[324,118,512],lightTarget:[264,8,467],lightMatrixWorld:[...shadowMatrix],camera:{left:-35,right:35,top:35,bottom:-35,near:1,far:400,matrixWorld:[...shadowMatrix],projection:[...identity]}},passed:true,failures:[]};
 for(const kind of witness?['witness']:['shadow','color'])for(const name of members){const index=names.indexOf(name),[vertices,fullIndexCount,indexBytes]=counts[index],target=kind==='shadow'||output==='target-samples0';
  const selected=kind!=='shadow'&&target?{start:0,count:'Infinity'}:{start:300,count:600},count=selected.count==='Infinity'?fullIndexCount:600;
  const attributes=[pointer('position',0,{bufferId:(side==='candidate'?300:200)+index})];
  if(kind==='shadow'&&mapped||witness||kind==='color'&&name===warmName)attributes.push(pointer('uv',2,{enabled:side==='candidate'||name===warmName,generic:genericValue,bufferId:(control?600:side==='candidate'?500:400)+index}));
  if(kind==='color')attributes.push(pointer('normal',1,{bufferId:(side==='candidate'?800:700)+index}));
  const row={name,kind,geometryId:(side==='candidate'?100:200)+index,materialType:kind==='shadow'?'MeshDepthMaterial':witness?'RawShaderMaterial':'MeshStandardMaterial',materialMap:!witness&&name===warmName,materialOpacity:1,materialAlphaTest:0,materialAlphaHash:false,materialAlphaToCoverage:false,customDepth:false,customDistance:false,selected,fullIndexCount,indexBytes,cameraMatrixWorld:kind==='shadow'?[...shadowMatrix]:[...identity],cameraProjection:[...identity],draw:{mode:4,count,type:indexBytes===2?5123:5125,offset:selected.start*indexBytes,returned:true},native:native(kind==='shadow'?40:witness?60:50+index,attributes,kind==='shadow'?(side==='candidate'?902:901):target?903:null,target?0:4),uniforms:witness?{}:{opacity:{expected:1,observed:1,matches:true}}};
  metadata.receipts.push(row);metadata.selections.push({name,kind,range:{...selected}});metadata.resets.push({name,kind,range:{start:0,count:'Infinity'}});
 }
 if(presentation==='primer'){delete metadata.uvLocation;metadata.genericBefore=null;metadata.genericAfter=null;}
 return metadata;
}
function stages(mapped=true){const prefix='#version 300 es\n#define SHADER_TYPE MeshDepthMaterial\n#define DOUBLE_SIDED\n#define SHADOWMAP_TYPE_PCF\n'+(mapped?'#define USE_MAP\n':'');return {id:40,linked:true,vertexSource:prefix+(mapped?'#define MAP_UV uv\n':'')+'void main(){gl_Position=vec4(0.);}',fragmentSource:prefix+'#define DEPTH_PACKING 3200\nvoid main(){gl_FragColor=vec4(1.);}'};}
function programs(mapped=true){
 return [stages(mapped),...Array.from({length:5},(_,index)=>({id:50+index,linked:true,vertexSource:'#version 300 es\n#define SHADER_TYPE MeshStandardMaterial\nvoid main(){gl_Position=vec4(0.);}',fragmentSource:'#version 300 es\n#define SHADER_TYPE MeshStandardMaterial\nvoid main(){gl_FragColor=vec4(1.);}'})),
  {id:60,linked:true,vertexSource:'#version 300 es\n#define SHADER_TYPE RawShaderMaterial\nprecision highp float;\nlayout(location=0) in vec3 position;\nlayout(location=2) in vec2 uv;\nuniform mat4 projectionMatrix;uniform mat4 modelViewMatrix;out vec2 witnessUv;\nvoid main(){witnessUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',fragmentSource:'#version 300 es\n#define SHADER_TYPE RawShaderMaterial\nprecision highp float;in vec2 witnessUv;out vec4 witnessOutput;void main(){witnessOutput=vec4(.15+.7*witnessUv.x,.20+.7*witnessUv.y,.35,1.);}'},
  {id:70,linked:true,vertexSource:'#version 300 es\n#define SHADER_TYPE ShaderMaterial\nlayout(location=2) in vec3 color;\nout vec3 seedColor;\nvoid main(){seedColor=color;gl_Position=vec4(position,1.);}',fragmentSource:'#version 300 es\n#define SHADER_TYPE ShaderMaterial\nin vec3 seedColor;out vec4 seedOutput;void main(){seedOutput=vec4(seedColor,1.);}'}];
}
function geometry(){let next=1;const buffers=new Map(),sides={};
 function attribute(arrayType,itemSize,count,fill){const bytes=Buffer.alloc(itemSize*count*(arrayType==='Uint16Array'?2:4),fill),sha256=hash(bytes);buffers.set(sha256,{sha256,bytes:bytes.length});return {objectId:next++,arrayType,itemSize,count,normalized:false,interleaved:false,stride:itemSize,offset:0,usage:35044,version:0,buffer:{sha256,bytes:bytes.length}};}
 for(const side of ['baseline','candidate']){const rows=[];for(const [index,name]of names.entries()){
  const [vertices,indices,indexBytes]=counts[index],attributes={position:attribute('Float32Array',3,vertices,index+1),normal:attribute('Float32Array',3,vertices,index+5)};if(name===warmName)attributes.uv=attribute('Float32Array',2,vertices,7);
  const source={objectId:next++,attributes,index:attribute(indexBytes===2?'Uint16Array':'Uint32Array',1,indices,9),groups:[],drawRange:{start:0,count:'Infinity'},morphAttributes:[],morphTargetsRelative:false,boundingBox:{objectId:next++,min:[0,0,0],max:[1,1,1]},boundingSphere:{objectId:next++,center:[.5,.5,.5],radius:1}};
  const display={...clone(source),objectId:next++,index:attribute(indexBytes===2?'Uint16Array':'Uint32Array',1,indices,10)};
  if(side==='candidate'&&name!==warmName)display.attributes.uv=attribute('Float32Array',2,vertices,0);
  const rays=Array.from({length:4},(_,i)=>({origin:[i,1,0],direction:[0,-1,0],hits:[{distance:1,point:[i,0,0],faceIndex:i,face:{a:i*3,b:i*3+1,c:i*3+2,materialIndex:0}}]}));
  rows.push({name,source,display,matrixWorld:[...identity],sourceMatrixWorld:[...identity],sourceGeometryObjectUnchanged:true,originalAttributeObjectsRetained:true,materialObjectUnchanged:true,compileUnchanged:true,keyUnchanged:true,raycastWrapperPresent:true,rays,originalRays:clone(rays),material:{name,type:'MeshStandardMaterial',side:2,shadowSide:null,transparent:false,opacity:1,alphaTest:0,alphaHash:false,alphaToCoverage:false,depthWrite:true,colorWrite:true,defines:{STANDARD:''},customKey:'authored|surface|atmosphere',map:name===warmName,customDepth:false,customDistance:false}});
 }sides[side]={rows,receiptNames:side==='candidate'?[...eligibleNames]:[],detail:{simplified:5},constructionStats:{retained:true}};}
 return {sides,buffers:[...buffers.values()],note:'Modeled oracle inputs, not native evidence.'};
}
function attributeControl(){const originalGeometry=geometry(),before=capture('candidate',{mapped:false,witness:true,generic:'reset'}),changed=capture('candidate',{mapped:false,witness:true,generic:'reset',control:true}),restored=clone(before),enabled={enabled:true,attributes:[]},disabled={enabled:false,attributes:[]};
 for(const [index,name]of eligibleNames.entries()){
  const attribute=clone(originalGeometry.sides.candidate.rows.find(row=>row.name===name).display.attributes.uv),poisonAttribute=clone(attribute),bytes=Buffer.alloc(attribute.buffer.bytes);for(let offset=0;offset<bytes.length;offset+=8){bytes.writeFloatLE(poison[0],offset);bytes.writeFloatLE(poison[1],offset+4);}
  poisonAttribute.objectId=10000+index;poisonAttribute.buffer={sha256:hash(bytes),bytes:bytes.length};enabled.attributes.push({name,sourceHasUv:false,attribute:poisonAttribute});disabled.attributes.push({name,sourceHasUv:false,attribute});
 }
 return {enabled,disabled,originalGeometry,captures:{before,changed,restored}};
}

test('actual-capture oracle keeps mapped color/depth, reverse and diagnostic scopes distinct',()=>{
 for(const output of ['screen-msaa4','target-samples0'])for(const generic of ['fresh','poisoned']){
  const a=capture('baseline',{output,generic}),b=capture('candidate',{output,generic});pass(validateCapture(a));pass(validateCapture(b));pass(compareCaptureReceipts(a,b));
 }
 const a=capture('baseline',{mapped:false,presentation:'reverse'}),b=capture('candidate',{mapped:false,presentation:'reverse'});pass(validateCapture(a,{mapped:false,expectedNames:names}));pass(compareCaptureReceipts(a,b,{mapped:false}));
 for(const side of ['baseline','candidate'])pass(validateCapture(capture(side,{mapped:false,witness:true,generic:'reset'}),{mapped:false,witness:true}));
 pass(validateCapture(capture('baseline',{presentation:'primer'}),{expectedNames:[warmName]}));
});

test('legal UV location zero retains exact seed identity without colliding with diagnostic position',()=>{
 function atZero(metadata){metadata.uvLocation=0;
  for(const row of metadata.receipts){const uv=row.native.attributes.find(a=>a.name==='uv');if(uv){uv.location=0;row.native.attributes.find(a=>a.name==='position').location=1;}}
  for(const receipt of [metadata.seed,metadata.resetSeed])if(receipt){receipt.location=0;receipt.color.location=0;receipt.proof.attributes.find(a=>a.name==='position').location=1;}
  return metadata;
 }
 const pair={baseline:atZero(capture('baseline',{generic:'poisoned'})),candidate:atZero(capture('candidate',{generic:'poisoned'}))};pass(validateCapture(pair.baseline));pass(compareCaptureReceipts(pair.baseline,pair.candidate));
 const witnessPair={baseline:atZero(capture('baseline',{mapped:false,witness:true,generic:'reset'})),candidate:atZero(capture('candidate',{mapped:false,witness:true,generic:'reset'}))};pass(compareCaptureReceipts(witnessPair.baseline,witnessPair.candidate,{mapped:false,witness:true}));
 const p=programs();p.find(row=>row.id===60).vertexSource=p.find(row=>row.id===60).vertexSource.replace('location=0','location=1').replace('location=2','location=0');p.find(row=>row.id===70).vertexSource=p.find(row=>row.id===70).vertexSource.replace('location=2','location=0');pass(validatePrograms(p,[witnessPair],{mapped:false,witness:true}));
 witnessPair.candidate.receipts[0].native.attributes.find(a=>a.name==='position').location=0;fail(validateCapture(witnessPair.candidate,{mapped:false,witness:true}));
});

test('a subject-free, partial, empty or misranged draw report cannot pass as complete',()=>{
 const mutations=[m=>{m.receipts=[];m.selections=[];m.resets=[];},m=>m.receipts.pop(),m=>m.receipts.push(clone(m.receipts[0])),m=>m.receipts[0].draw.count=0,m=>m.receipts[0].draw.returned=false,m=>m.receipts[0].draw.offset+=2,m=>m.receipts[0].draw.type=5125,m=>m.receipts[0].fullIndexCount-=3,m=>m.selections[0].range.start+=3,m=>m.resets[0].range.count=600,m=>m.receipts[0].cameraMatrixWorld[12]+=1];
 for(const mutate of mutations){const value=capture('baseline');mutate(value);fail(validateCapture(value));}
});

test('native UV layout, generic, link, framebuffer, alpha and uniform defects are rejected',()=>{
 for(const mutate of [a=>a.enabled=false,a=>a.stride=0,a=>a.offset=8,a=>a.size=4,a=>a.type=5123,a=>a.integer=true,a=>a.normalized=true,a=>a.divisor=1,a=>a.location=3,a=>a.bufferId=null]){
  const m=capture('candidate');mutate(m.receipts[0].native.attributes.find(a=>a.name==='uv'));fail(validateCapture(m));
 }
 for(const mutate of [m=>m.receipts[0].native.attributes.find(a=>a.name==='uv').generic[0]=1,m=>m.receipts[0].native.linked=false,m=>m.receipts[0].native.samples=4,m=>m.receipts[0].native.framebufferId=null,m=>m.receipts[0].materialAlphaTest=.5,m=>m.receipts[0].materialAlphaHash=true,m=>m.receipts[0].materialAlphaToCoverage=true,m=>m.receipts[0].customDepth=true,m=>m.receipts[0].uniforms.opacity.observed=.5,m=>delete m.receipts[0].uniforms.opacity,m=>m.shadow.readbackRestored=false,m=>m.shadow.camera.right=100]){
  const m=capture('baseline');mutate(m);fail(validateCapture(m));
 }
 // Inert pointer data must not be mistaken for an enabled input or extra layout.
 const disabled=capture('baseline'),uv=disabled.receipts[0].native.attributes.find(a=>a.name==='uv');Object.assign(uv,{bufferId:998,size:4,stride:64,offset:16});pass(validateCapture(disabled));
});

test('the real preceding default-color draw and exact generic restoration are necessary',()=>{
 const mutations=[m=>m.seed.location=3,m=>m.seed.geometryHasColor=true,m=>m.seed.draws[0].returned=false,m=>m.seed.draws=[],m=>m.seed.color.enabled=true,m=>m.seed.proof.attributes.find(a=>a.name==='color').generic[0]=0,m=>m.seed.targetViewportScissorRestored=false,m=>m.seed.glError=1282,m=>m.resetSeed.geometryId=m.seed.geometryId,m=>m.resetSeed.observed=[1,1,1,1],m=>m.genericBefore=[1,0,0,1],m=>m.genericAfter=[1,0,0,1],m=>m.lifecycle.visibilityRestored=false,m=>m.lifecycle.casterRestored=false,m=>m.lifecycle.genericRestored=false,m=>m.lifecycle.restored=false,m=>m.generic='fresh'];
 for(const mutate of mutations){const m=capture('baseline',{generic:'poisoned'});mutate(m);fail(validateCapture(m));}
 const fresh=capture('baseline');fresh.everSeeded=true;fail(validateCapture(fresh));
});

test('pair oracle preserves native program, non-UV layouts, uniforms and selected spans',()=>{
 for(const mutate of [m=>m.receipts[0].native.programId++,m=>m.receipts[0].native.attributes.find(a=>a.name==='position').stride=16,m=>{m.receipts[0].uniforms.opacity={expected:.5,observed:.5,matches:true};},m=>{m.receipts[0].selected.start+=3;m.selections[0].range.start+=3;m.receipts[0].draw.offset+=6;},m=>m.camera.position[0]++,m=>m.shadow.lightPosition[0]++]){
  const a=capture('baseline'),b=capture('candidate');mutate(b);fail(compareCaptureReceipts(a,b));
 }
 const a=capture('baseline'),b=capture('candidate');for(const row of b.receipts)for(const attr of row.native.attributes)if(attr.bufferId)attr.bufferId+=10000;pass(compareCaptureReceipts(a,b));
});

test('full stage/source proof binds warm primer, reversed source and exact UV-consuming witness',()=>{
 const pair={baseline:capture('baseline'),candidate:capture('candidate')},primer=capture('baseline',{presentation:'primer'});pass(validatePrograms(programs(),[pair],{mapped:true,primer}));
 const reverse={baseline:capture('baseline',{mapped:false,presentation:'reverse'}),candidate:capture('candidate',{mapped:false,presentation:'reverse'})};pass(validatePrograms(programs(false),[reverse],{mapped:false}));
 const witnessPair={baseline:capture('baseline',{mapped:false,witness:true,generic:'reset'}),candidate:capture('candidate',{mapped:false,witness:true,generic:'reset'})};pass(validatePrograms(programs(),[witnessPair],{mapped:false,witness:true}));
 for(const mutate of [p=>p.splice(0,1),p=>p[0].linked=false,p=>p[0].vertexSource=p[0].vertexSource.replace('#define USE_MAP\n',''),p=>p[0].fragmentSource=p[0].fragmentSource.replace('3200','3201'),p=>p[0].fragmentSource+='\n#define USE_ALPHATEST\n',p=>p[0].vertexSource=p[0].vertexSource.replace('MAP_UV uv','MAP_UV uv1'),p=>p.push(clone(p[0]))]){const p=programs();mutate(p);fail(validatePrograms(p,[pair],{primer}));}
 const badPrimer=clone(primer);badPrimer.receipts.find(row=>row.kind==='shadow').native.programId=999;fail(validatePrograms(programs(),[pair],{primer:badPrimer}));
 const badReverse=programs();fail(validatePrograms(badReverse,[reverse],{mapped:false}));
 for(const id of [60,70]){const p=programs();p.find(row=>row.id===id).vertexSource=p.find(row=>row.id===id).vertexSource.replace('location=2','location=3');fail(validatePrograms(p,[witnessPair],{mapped:false,witness:true}));}
 const p=programs();p.find(row=>row.id===60).fragmentSource=p.find(row=>row.id===60).fragmentSource.replace('.15+.7','.15+.6');fail(validatePrograms(p,[witnessPair],{mapped:false,witness:true}));
});

test('geometry oracle preserves authored bytes, indices, bounds, callbacks and source raycasts',()=>{
 const before=geometry();pass(validateGeometry(before,clone(before)));
 for(const mutate of [
  e=>e.sides.candidate.rows[0].display.attributes.uv.buffer.sha256='1'.repeat(64),
  e=>e.sides.candidate.rows[0].display.attributes.uv.normalized=true,
  e=>e.sides.candidate.rows[0].display.attributes.uv.objectId++,
  e=>e.sides.candidate.rows[0].display.attributes.normal.objectId++,
  e=>e.sides.candidate.rows[0].source.attributes.uv=clone(e.sides.candidate.rows[0].display.attributes.uv),
  e=>e.sides.candidate.rows[0].display.index.objectId++,
  e=>e.sides.candidate.rows[0].display.boundingBox.objectId++,
  e=>e.sides.candidate.rows[0].materialObjectUnchanged=false,
  e=>e.sides.candidate.rows[0].compileUnchanged=false,
  e=>e.sides.candidate.rows[0].keyUnchanged=false,
  e=>e.sides.candidate.rows[0].matrixWorld[12]++,
  e=>e.sides.candidate.rows[0].rays[0].hits[0].faceIndex++,
  e=>e.sides.candidate.rows[4].display.attributes.uv.objectId++,
  e=>e.sides.candidate.receiptNames.pop(),
  e=>e.sides.candidate.detail.simplified=0,
  e=>e.buffers=[],
 ]){const after=clone(before);mutate(after);fail(validateGeometry(before,after));}
});

test('each attribute control must replace only display UV and restore its exact native buffer and object',()=>{
 const run=value=>validateAttributeControl(value.enabled,value.disabled,value.originalGeometry,value.captures);pass(run(attributeControl()));
 for(const mutate of [v=>v.enabled.attributes[0].sourceHasUv=true,v=>v.disabled.attributes[0].attribute.objectId++,v=>v.enabled.attributes[0].attribute.objectId=v.disabled.attributes[0].attribute.objectId,v=>v.enabled.attributes[0].attribute.buffer.sha256=v.disabled.attributes[0].attribute.buffer.sha256,v=>v.captures.changed.receipts[0].native.attributes.find(a=>a.name==='uv').bufferId=v.captures.before.receipts[0].native.attributes.find(a=>a.name==='uv').bufferId,v=>v.captures.restored.receipts[0].native.attributes.find(a=>a.name==='uv').bufferId++,v=>v.captures.changed.receipts[0].native.attributes.find(a=>a.name==='position').bufferId++,v=>v.captures.changed.receipts[0].geometryId++,v=>v.captures.changed.attributeControl=false,v=>v.enabled.attributes.pop()]){const value=attributeControl();mutate(value);fail(run(value));}
});

test('malformed evidence returns a retained structured failure instead of throwing',()=>{
 for(const action of [()=>validateCapture(null),()=>compareCaptureReceipts(null,null),()=>validateGeometry(null,null),()=>validatePrograms(null,null),()=>validatePrograms([],[],null),()=>validateAttributeControl(null,null,null),()=>validateAttributeControl(null,null,null,null)]){let value;assert.doesNotThrow(()=>{value=action();});fail(value);}
});
