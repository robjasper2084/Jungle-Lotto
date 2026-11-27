import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {createHash} from 'node:crypto';
import pins from './landmark-index-pins.json' with {type:'json'};
import {loadPinnedLandmarkDecoder,decodeLandmarkIndexEntries,verifyLandmarkIndexManifest} from './landmark-index-manifest.mjs';
import {installDisplayIndexObserver,displayIndexBounds,displayIndexSelection} from './display-index-receipt.ts';
import {assertDisplayIndexSubmittedOwner} from './display-index-contract.mjs';
import {assertSubmittedOwner,assertDrawPair} from './contract.mjs';

const assetRoot=process.env.ROOF_DISPLAY_ASSET_ROOT,gameRoot=process.env.ROOF_DISPLAY_GAME_ROOT;
assert(assetRoot&&gameRoot,'Set ROOF_DISPLAY_ASSET_ROOT and ROOF_DISPLAY_GAME_ROOT to the original immutable assets and pinned game checkout');
await verifyLandmarkIndexManifest(assetRoot,gameRoot);
const decoded=await decodeLandmarkIndexEntries({
 metadataBytes:await readFile(resolve(assetRoot,pins.assets.metadata.path)),
 encodedIndicesBytes:await readFile(resolve(assetRoot,pins.assets.encodedIndices.path)),
 modelBytes:await readFile(resolve(assetRoot,pins.assets.model.path)),
},await loadPinnedLandmarkDecoder(gameRoot));
const nativeIndices=decoded.entries.find(row=>row.key==='94:0');assert(nativeIndices,'Original marble monument indices are required');
const clone=value=>structuredClone(value),hash=value=>createHash('sha256').update(value).digest('hex');
const bytes=array=>new Uint8Array(array.buffer,array.byteOffset,array.byteLength);
const identity=()=>[1,0,0,0,0,1,0,0,0,0,1,0,0,0,0,1];
const callbackNames=['onBeforeRender','onAfterRender','onBeforeShadow','onAfterShadow'];
const vector=(x=0,y=0,z=0)=>({x,y,z,toArray(){return [this.x,this.y,this.z];}});
const callbacks=()=>({onBeforeRender:function beforeRender(){},onAfterRender:function afterRender(){},onBeforeShadow:function beforeShadow(){},onAfterShadow:function afterShadow(){}});
const callbackReceipt=object=>callbackNames.map(name=>({functionSha256:hash(new TextEncoder().encode(JSON.stringify(Function.prototype.toString.call(object[name]))))}));
const attribute=(array,itemSize)=>({array,itemSize,count:array.length/itemSize,normalized:false,gpuType:1015,usage:35044});
function attributeReceipt(a){
 const interleaved=!!a.isInterleavedBufferAttribute,data=interleaved?a.data:a,array=data.array;
 return {type:array.constructor.name,bytes:array.byteLength,count:a.count,itemSize:a.itemSize,normalized:a.normalized,interleaved,
  offset:interleaved?a.offset:0,stride:interleaved?data.stride:a.itemSize,gpuType:a.gpuType??null,usage:data.usage,meshPerAttribute:a.meshPerAttribute??null,sha256:hash(bytes(array))};
}
function geometryReceipt(g){
 return {type:g.type,attributes:Object.fromEntries(Object.keys(g.attributes).sort().map(name=>[name,attributeReceipt(g.attributes[name])])),index:attributeReceipt(g.index),groups:clone(g.groups),
  drawRange:{start:g.drawRange.start,count:g.drawRange.count===Infinity?'Infinity':g.drawRange.count},morphTargetsRelative:g.morphTargetsRelative,morphAttributes:{},
  boundingBox:g.boundingBox?{min:g.boundingBox.min.toArray(),max:g.boundingBox.max.toArray()}:null,
  boundingSphere:g.boundingSphere?{center:g.boundingSphere.center.toArray(),radius:g.boundingSphere.radius}:null};
}
function cameraReceipt(camera){return Object.fromEntries(['matrixWorld','matrixWorldInverse','projectionMatrix'].map(name=>[name,[...camera[name].elements]]));}
function path(object){
 const label=object.name||object.type,peers=object.parent?.children.filter(child=>(child.name||child.type)===label)??[object];
 return (object.parent?path(object.parent)+'/':'')+encodeURIComponent(label)+'#'+peers.indexOf(object);
}
function objectReceipt(f){return {path:path(f.mesh),name:f.mesh.name,type:'Mesh',count:1,isRoof:false,instanceMatrix:null,instanceColor:null,morphTargetInfluences:null,
 visible:f.mesh.visible,castShadow:f.mesh.castShadow,matrixWorld:[...f.mesh.matrixWorld.elements],callbacks:callbackReceipt(f.mesh),geometry:geometryReceipt(f.full)};}
function sceneReceipt(f){return {path:'Scene#0',type:'Scene',callbacks:callbackReceipt(f.scene)};}

/** The indices below are actual decoded immutable bytes. Owner attributes and
 * transforms are deliberately synthetic unit fixtures; no native proof is
 * reconstructed from the old artifact's missing callback/group observations. */
function fixture({interleaved=false,matrix=undefined,pinRows=pins,prepareError=null,throwPrepare=null,nested=false}={}){
 const entry=nativeIndices.entry,count=entry.vertices,position=Float32Array.from({length:count*3},(_,i)=>(i%19)/19);
 const attributes={position:attribute(position,3),normal:attribute(new Float32Array(count*3),3),uv:attribute(new Float32Array(count*2),2),sedimentCoord:attribute(new Float32Array(count*2),2)};
 if(interleaved){const array=new Float32Array(new ArrayBuffer((count*5+8)*4),16,count*5),data={array,stride:5,usage:35048};
  attributes.position={isInterleavedBufferAttribute:true,data,count,itemSize:3,offset:0,normalized:false};attributes.uv={isInterleavedBufferAttribute:true,data,count,itemSize:2,offset:3,normalized:false};}
 const full={type:'BufferGeometry',attributes,index:attribute(new nativeIndices.sourceIndex.constructor(nativeIndices.sourceIndex),1),groups:[],drawRange:{start:0,count:Infinity},
  morphTargetsRelative:false,morphAttributes:{},boundingBox:null,boundingSphere:{center:vector(),radius:2}};
 const reduced={...full,attributes:{...attributes},index:attribute(new Uint32Array(nativeIndices.decodedIndex),1),groups:[],drawRange:{start:0,count:Infinity},morphAttributes:{},boundingSphere:{center:vector(),radius:2}};
 const world=matrix?[...matrix]:identity();if(!matrix)world[14]=-1000;
 let geometry=full,geometryAssignments=0,callbackInvocations=0;
 const mesh={isMesh:true,type:'Mesh',name:'Original display fixture',count:1,visible:true,castShadow:false,matrixWorld:{elements:world},parent:null,...callbacks()};
 Object.defineProperty(mesh,'geometry',{get:()=>geometry,set:value=>{geometryAssignments++;geometry=value;},enumerable:true});
 const scene={type:'Scene',name:'',parent:null,children:[mesh],...callbacks()};mesh.parent=scene;
 if(nested){const group={type:'Group',name:'Original group / nested',parent:scene,children:[mesh],...callbacks()};scene.children=[group];mesh.parent=group;}
 const association={meshes:entry.mesh,primitives:entry.primitive};
 const asset={scene,parser:{associations:new Map([[mesh,association]])}};
 // Independent direct transcription of the pinned source's registration math.
 const columns=Math.max(...[0,4,8].map(i=>Math.abs(world[i])+Math.abs(world[i+1])+Math.abs(world[i+2]))),rows=Math.max(...[0,1,2].map(i=>Math.abs(world[i])+Math.abs(world[i+4])+Math.abs(world[i+8]))),scale=Math.sqrt(rows*columns);
 const item={mesh,full,reduced,bounds:{center:vector(world[12]/world[15],world[13]/world[15],world[14]/world[15]),radius:2*scale},error:entry.error*scale};
 class OriginalDetail {
  constructor(){this.asset=asset;this.items=[item];this.splitActive=false;this.prepareCalls=0;this.returned=null;}
  prepareDistant(targetScene){
   this.prepareCalls++;if(throwPrepare)throw throwPrepare;
   const original=this.returned=prepareError?Promise.reject(prepareError):Promise.resolve().then(()=>{
    const before=targetScene.onBeforeRender,after=targetScene.onAfterRender;
    targetScene.onBeforeRender=(renderer,renderScene,camera,target)=>{
     callbackInvocations++;before.call(targetScene,renderer,renderScene,camera,target);if(this.splitActive)return;
     const p=camera.projectionMatrix.elements,eye=camera.matrixWorldInverse.elements,c=item.bounds.center,near=-(eye[2]*c.x+eye[6]*c.y+eye[10]*c.z+eye[14])-item.bounds.radius;
     const size={x:0,y:0,set(x,y){this.x=x;this.y=y;return this;}};renderer.getDrawingBufferSize(size);
     const focal=.5*Math.hypot(size.x*(Math.abs(p[0])+1+Math.abs(p[8])),size.y*(Math.abs(p[5])+1+Math.abs(p[9]))),e=item.error;
     const permitted=camera.isPerspectiveCamera&&!camera.isArrayCamera&&!renderer.xr.isPresenting&&!target&&mesh.visible&&!mesh.castShadow&&Number.isFinite(e)&&e>=0&&Number.isFinite(near)&&near>64+e&&Number.isFinite(focal)&&focal>0&&e*focal<=(near-e)*.5;
     mesh.geometry=permitted?reduced:full;
    };
    targetScene.onAfterRender=(...args)=>{callbackInvocations++;if(!this.splitActive)mesh.geometry=full;after.apply(targetScene,args);};
   });return original;
  }
 }
 const observer=installDisplayIndexObserver(OriginalDetail,pinRows),detail=new OriginalDetail();
 const projection=identity();projection[0]=1.1;projection[5]=1.7;
 const camera={isPerspectiveCamera:true,isArrayCamera:false,matrixWorld:{elements:identity()},matrixWorldInverse:{elements:identity()},projectionMatrix:{elements:projection}};
 const renderer={xr:{isPresenting:false},target:null,width:1280,height:800,getRenderTarget(){return this.target;},getDrawingBufferSize(target){return target.set(this.width,this.height);}};
 return {entry,mesh,scene,full,reduced,item,asset,association,observer,detail,OriginalDetail,camera,renderer,
  get geometryAssignments(){return geometryAssignments;},get callbackInvocations(){return callbackInvocations;}};
}
async function prepared(options){const f=fixture(options),returned=f.detail.prepareDistant(f.scene);assert.strictEqual(returned,f.detail.returned,'Observer must return exact original Promise');await returned;await Promise.resolve();return f;}
function drawRow(f,snapshot){return {path:path(f.mesh),pass:'color',castShadow:false,calls:1,triangles:f.entry.count/3,lines:0,points:0,submittedGroup:null,
 submittedGeometry:{positionCount:f.entry.vertices,indexCount:f.entry.count,start:0,count:'Infinity'},camera:cameraReceipt(f.camera),displayIndexSubmission:snapshot.receipt};}
async function prove(f){
 const beforeAssignments=f.geometryAssignments,beforeCallbacks=f.callbackInvocations,context=f.observer.beforeRender(f.scene,f.camera,f.renderer);
 assert.equal(f.geometryAssignments,beforeAssignments);assert.equal(f.callbackInvocations,beforeCallbacks,'Observer must not invoke an original callback');
 f.scene.onBeforeRender(f.renderer,f.scene,f.camera,f.renderer.target);assert.strictEqual(f.mesh.geometry,f.reduced);
 const atDrawAssignments=f.geometryAssignments,atDrawCallbacks=f.callbackInvocations,snapshot=f.observer.snapshotSubmitted(context,f.mesh.geometry,f.mesh,null,'color');
 assert(snapshot);assert.equal(f.geometryAssignments,atDrawAssignments);assert.equal(f.callbackInvocations,atDrawCallbacks);
 const draw=drawRow(f,snapshot);f.scene.onAfterRender(f.renderer,f.scene,f.camera,f.renderer.target);
 const restoredAssignments=f.geometryAssignments,restoredCallbacks=f.callbackInvocations;f.observer.assertRestored(context);
 assert.equal(f.geometryAssignments,restoredAssignments);assert.equal(f.callbackInvocations,restoredCallbacks);
 await snapshot.settle(async value=>hash(value));assert.equal(f.geometryAssignments,restoredAssignments);assert.equal(f.callbackInvocations,restoredCallbacks);
 return {f,context,snapshot,draw,object:objectReceipt(f),scene:sceneReceipt(f)};
}

test('real immutable full/reduced index bytes bind every manifest entry and an exact original projected owner',async()=>{
 assert.equal(decoded.entries.length,pins.entries.length);
 for(const row of decoded.entries){const pin=pins.entries.find(p=>p.key===row.key);for(const [which,array] of [['sourceIndex',row.sourceIndex],['decodedIndex',row.decodedIndex]]){
  assert.equal(hash(bytes(array)),pin[which].sha256);assert.equal(array.length,pin[which].count);assert.equal(array.constructor.name,pin[which].type);
 }}
 const result=await prove(await prepared());assertDisplayIndexSubmittedOwner(result.draw,result.object,result.scene,pins);
 assert.equal(result.draw.displayIndexSubmission.sourceGeometry.index.sha256,pins.entries.find(p=>p.key===nativeIndices.key).sourceIndex.sha256);
});
test('preparation observer preserves exact Promise, receiver and rejection without invoking source callbacks',async()=>{
 const f=fixture(),result=f.detail.prepareDistant(f.scene);assert.strictEqual(result,f.detail.returned);await result;await Promise.resolve();
 assert.equal(f.detail.prepareCalls,1);assert.equal(f.callbackInvocations,0);assert.equal(f.geometryAssignments,0);
 const error=Error('original rejected preparation'),bad=fixture({prepareError:error}),promise=bad.detail.prepareDistant(bad.scene);
 assert.strictEqual(promise,bad.detail.returned);await assert.rejects(promise,value=>value===error);await Promise.resolve();
 assert.throws(()=>bad.observer.beforeRender(bad.scene,bad.camera,bad.renderer),value=>value===error);
 const thrown=Error('original synchronous preparation throw'),sync=fixture({throwPrepare:thrown});assert.throws(()=>sync.detail.prepareDistant(sync.scene),value=>value===thrown);
});
test('source row-column norm covers scaled/sheared sphere bounds and asymmetric projection',()=>{
 const matrix=[2,0,0,0,1,3,0,0,0,0,4,0,10,-20,-300,1],source={center:[1,2,3],radius:2};
 // Columns max4; rows max4; original conservative scale4, center[14,-14,-288].
 assert.deepStrictEqual(displayIndexBounds(matrix,source,.25),{scale:4,error:1,bounds:{center:[14,-14,-288],radius:8}});
 const sheared=[1,2,0,0,3,1,0,0,0,0,1,0,0,0,-500,1],b=displayIndexBounds(sheared,{center:[0,0,0],radius:1},.125);
 assert.equal(b.scale,4);assert.equal(b.bounds.radius,4);assert.equal(b.error,.5);
 const p=identity();p[0]=-2;p[5]=-3;p[8]=.4;p[9]=-.25;
 const value={camera:{projectionMatrix:p,matrixWorldInverse:identity()},bounds:{center:[0,0,-500],radius:2},error:.01,width:1280,height:800,splitActive:false,perspective:true,arrayCamera:false,xrPresenting:false,target:null,visible:true,castShadow:false};
 const decision=displayIndexSelection(value);assert.equal(decision.near,498);assert.equal(decision.pixelScale,.5*Math.hypot(1280*3.4,800*4.25));assert.equal(decision.selected,'reduced');
 const symmetric=clone(value);symmetric.camera.projectionMatrix[8]=0;symmetric.camera.projectionMatrix[9]=0;assert(displayIndexSelection(symmetric).pixelScale<decision.pixelScale);
});
test('original near64 threshold is strict and half-pixel error threshold is inclusive',()=>{
 const value={camera:{projectionMatrix:identity(),matrixWorldInverse:identity()},bounds:{center:[0,0,-64],radius:0},error:0,width:1280,height:800,splitActive:false,perspective:true,arrayCamera:false,xrPresenting:false,target:null,visible:true,castShadow:false};
 assert.equal(displayIndexSelection(value).selected,'full');value.bounds.center[2]=-64.0001;assert.equal(displayIndexSelection(value).selected,'reduced');
 value.error=1;const pixelScale=displayIndexSelection(value).pixelScale,threshold=1+2*pixelScale;value.bounds.center[2]=-threshold;
 assert.equal(displayIndexSelection(value).selected,'reduced');value.bounds.center[2]=-(threshold-1e-6);assert.equal(displayIndexSelection(value).selected,'full');
 for(const error of [-1,NaN,Infinity]){value.error=error;assert.equal(displayIndexSelection(value).selected,'full');}
});
test('visibility, shadow, orthographic, array-camera, XR and offscreen flags retain original full fallback',async()=>{
 const edits=[f=>f.mesh.visible=false,f=>f.mesh.castShadow=true,f=>delete f.camera.isPerspectiveCamera,f=>f.camera.isArrayCamera=true,f=>f.renderer.xr.isPresenting=true,f=>f.renderer.target={}];
 for(const edit of edits){const f=await prepared();edit(f);const c=f.observer.beforeRender(f.scene,f.camera,f.renderer);f.scene.onBeforeRender(f.renderer,f.scene,f.camera,f.renderer.target);
  assert.strictEqual(f.mesh.geometry,f.full);assert.equal(f.observer.snapshotSubmitted(c,f.full,f.mesh,null,'color'),null);
  f.scene.onAfterRender(f.renderer,f.scene,f.camera,f.renderer.target);f.observer.assertRestored(c);
 }
 const split=await prepared();split.detail.splitActive=true;assert.throws(()=>split.observer.beforeRender(split.scene,split.camera,split.renderer),/split/i);
});
test('full fallback still binds original camera flags and buffer size while allowing the native shadow target',async()=>{
 const edits=[f=>f.renderer.xr.isPresenting=true,f=>f.renderer.width=640,f=>f.renderer.height=400,
  f=>f.camera.isArrayCamera=true,f=>f.camera.isPerspectiveCamera=false,f=>f.camera.projectionMatrix.elements[8]=.5];
 for(const edit of edits){
  const f=await prepared();f.camera.matrixWorld.elements[14]=-950;f.camera.matrixWorldInverse.elements[14]=950;
  const c=f.observer.beforeRender(f.scene,f.camera,f.renderer);f.scene.onBeforeRender(f.renderer,f.scene,f.camera,null);assert.strictEqual(f.mesh.geometry,f.full);
  edit(f);assert.throws(()=>f.observer.snapshotSubmitted(c,f.full,f.mesh,null,'color'),/camera|drawing buffer/i);
 }
 const f=await prepared();f.mesh.castShadow=true;const c=f.observer.beforeRender(f.scene,f.camera,f.renderer);
 f.scene.onBeforeRender(f.renderer,f.scene,f.camera,null);assert.strictEqual(f.mesh.geometry,f.full);f.renderer.target={nativeShadowTarget:true};
 assert.equal(f.observer.snapshotSubmitted(c,f.full,f.mesh,null,'shadow'),null,'Full shadow submissions legitimately bind their own native target');
 f.renderer.target=null;f.scene.onAfterRender(f.renderer,f.scene,f.camera,null);f.observer.assertRestored(c);
});
test('nonuniform scale/shear and interleaved shared attributes survive original identity and full layout validation',async()=>{
 const matrix=[2,1,0,0,1,2,0,0,0,0,3,0,0,0,-1000,1],result=await prove(await prepared({matrix,interleaved:true}));
 assertDisplayIndexSubmittedOwner(result.draw,result.object,result.scene,pins);
 const a=result.draw.displayIndexSubmission.sourceGeometry.attributes;
 assert.equal(a.position.interleaved,true);assert.equal(a.position.stride,5);assert.equal(a.uv.offset,3);assert.equal(a.position.sha256,a.uv.sha256);
 assert.equal(a.position.usage,35048);assert.equal(a.position.gpuType,null);
});
test('composed scene and mesh callbacks remain untouched and same-text reference replacements fail',async()=>{
 const f=await prepared(),before=f.scene.onBeforeRender,after=f.scene.onAfterRender,meshBefore=f.mesh.onBeforeRender,meshAfter=f.mesh.onAfterRender;let meshInvocations=0;
 f.scene.onBeforeRender=function composedBefore(...args){return before.apply(this,args);};f.scene.onAfterRender=function composedAfter(...args){return after.apply(this,args);};
 f.mesh.onBeforeRender=function composedMeshBefore(...args){meshInvocations++;return meshBefore.apply(this,args);};f.mesh.onAfterRender=function composedMeshAfter(...args){meshInvocations++;return meshAfter.apply(this,args);};
 const r=await prove(f);assertDisplayIndexSubmittedOwner(r.draw,r.object,r.scene,pins);assert.equal(meshInvocations,0,'Observer must not call composed mesh callbacks');
 for(const owner of ['scene','mesh']){
  const c=f.observer.beforeRender(f.scene,f.camera,f.renderer),fn=f[owner].onBeforeShadow;
  const replacement=Function('return ('+Function.prototype.toString.call(fn)+')')();assert.equal(String(replacement),String(fn));assert.notStrictEqual(replacement,fn);f[owner].onBeforeShadow=replacement;
  assert.throws(()=>f.observer.assertRestored(c),/callback reference/i);f[owner].onBeforeShadow=fn;f.observer.assertRestored(c);
 }
});
test('deferred display hashes require the same restored geometry and scene/mesh callback references',async()=>{
 const edits=[{edit:f=>f.mesh.geometry={...f.full},error:/geometry.*restored/i},...['scene','mesh'].map(owner=>({edit:f=>{
  const fn=f[owner].onBeforeShadow,replacement=Function('return ('+Function.prototype.toString.call(fn)+')')();
  assert.equal(String(replacement),String(fn));assert.notStrictEqual(replacement,fn);f[owner].onBeforeShadow=replacement;
 },error:/callback reference/i}))];
 for(const {edit,error} of edits){
  const f=await prepared(),c=f.observer.beforeRender(f.scene,f.camera,f.renderer);f.scene.onBeforeRender(f.renderer,f.scene,f.camera,null);
  const s=f.observer.snapshotSubmitted(c,f.reduced,f.mesh,null,'color');f.scene.onAfterRender(f.renderer,f.scene,f.camera,null);f.observer.assertRestored(c);
  let release,entered,calls=0,finished=0;const gate=new Promise(resolve=>release=resolve),started=new Promise(resolve=>entered=resolve);
  const promise=s.settle(async value=>{calls++;entered();await gate;finished++;return hash(value);}),rejected=assert.rejects(promise,error);
  await started;edit(f);release();await rejected;assert.equal(finished,calls);assert.equal(s.receipt.settled,false);
  const terminalCalls=calls;await assert.rejects(s.settle(async value=>{calls++;return hash(value);}),error);assert.equal(calls,terminalCalls);
 }
});
test('full/source, quiet, reduced submission and restored geometry identities are mandatory',async()=>{
 for(const where of ['quiet','source','reduced','submitted','restored']){
  const f=await prepared();
  if(where==='quiet'){f.mesh.geometry=f.reduced;assert.throws(()=>f.observer.beforeRender(f.scene,f.camera,f.renderer),/quiet\/full/);continue;}
  if(where==='source'){f.item.full={...f.full};assert.throws(()=>f.observer.beforeRender(f.scene,f.camera,f.renderer),/identity/i);continue;}
  const c=f.observer.beforeRender(f.scene,f.camera,f.renderer);f.scene.onBeforeRender(f.renderer,f.scene,f.camera,null);
  if(where==='reduced'){f.mesh.geometry={...f.reduced};assert.throws(()=>f.observer.snapshotSubmitted(c,f.mesh.geometry,f.mesh,null,'color'),/geometry disagrees/);continue;}
  if(where==='submitted'){assert.throws(()=>f.observer.snapshotSubmitted(c,{...f.reduced},f.mesh,null,'color'),/identity/i);continue;}
  const s=f.observer.snapshotSubmitted(c,f.reduced,f.mesh,null,'color');assert.throws(()=>f.observer.assertRestored(c),/not restored/);
  await assert.rejects(s.settle(async v=>hash(v)),/restoration/i);
 }
});
test('registered source remains the actual live scene member through quiet, submission and restoration',async()=>{
 const mutations=[
  {name:'same-path live replacement',edit:f=>{
   const parent=f.mesh.parent,replacement={...f.mesh,geometry:f.full,parent};parent.children=parent.children.map(child=>child===f.mesh?replacement:child);f.mesh.parent=null;return replacement;
  }},
  {name:'child-list removal with stale parent',edit:f=>{
   const parent=f.mesh.parent,replacement={...f.mesh,geometry:f.full,parent};parent.children=parent.children.map(child=>child===f.mesh?replacement:child);return replacement;
  }},
  {name:'reparented original',edit:f=>{
   f.mesh.parent.children=f.mesh.parent.children.filter(child=>child!==f.mesh);const group={type:'Group',name:'Replacement group',parent:f.scene,children:[f.mesh],...callbacks()};f.scene.children.push(group);f.mesh.parent=group;return f.mesh;
  }},
  {name:'renamed original',edit:f=>{f.mesh.name='Changed original display name';return f.mesh;}},
  {name:'renamed original ancestor',edit:f=>{f.mesh.parent.name='Changed original group name';return f.mesh;}},
 ];
 for(const phase of ['quiet','submission','restoration'])for(const mutation of mutations){
  const f=await prepared({nested:true}),label=mutation.name+' at '+phase;
  if(phase==='quiet'){mutation.edit(f);assert.throws(()=>f.observer.beforeRender(f.scene,f.camera,f.renderer),undefined,label);continue;}
  const c=f.observer.beforeRender(f.scene,f.camera,f.renderer);
  if(phase==='submission'){
   const live=mutation.edit(f);f.scene.onBeforeRender(f.renderer,f.scene,f.camera,null);
   assert.strictEqual(f.mesh.geometry,f.reduced,'The original selector still updates its registered item, even if detached');
   assert.throws(()=>f.observer.snapshotSubmitted(c,live.geometry,live,null,'color'),undefined,label);continue;
  }
  f.scene.onBeforeRender(f.renderer,f.scene,f.camera,null);f.observer.snapshotSubmitted(c,f.reduced,f.mesh,null,'color');
  f.scene.onAfterRender(f.renderer,f.scene,f.camera,null);mutation.edit(f);assert.throws(()=>f.observer.assertRestored(c),undefined,label);
 }
});
test('an unchanged nested source hierarchy binds the actual complete scene path',async()=>{
 const r=await prove(await prepared({nested:true}));assertDisplayIndexSubmittedOwner(r.draw,r.object,r.scene,pins);
 assert.equal(r.draw.path,'Scene#0/Original%20group%20%2F%20nested#0/Original%20display%20fixture#0');
 assert.equal(r.draw.displayIndexSubmission.registration.path,r.draw.path);
 const changed=clone(r.draw);changed.displayIndexSubmission.registration.path='Scene#0/Original%20display%20fixture#0';
 assert.throws(()=>assertDisplayIndexSubmittedOwner(changed,r.object,r.scene,pins));
});
test('wrong pass, missing native group, source transform or attribute/storage identity cannot enter reduced proof',async()=>{
 for(const edit of [f=>f.full.attributes.position={...f.full.attributes.position},f=>f.full.attributes.position.array=new Float32Array(f.full.attributes.position.array),
  f=>f.reduced.attributes.position={...f.reduced.attributes.position},f=>f.full.index={...f.full.index},f=>f.mesh.matrixWorld.elements[12]++,
  f=>f.item.bounds.radius++,f=>f.association.meshes++,f=>f.full.attributes.position.normalized=true]){
  const f=await prepared();edit(f);assert.throws(()=>f.observer.beforeRender(f.scene,f.camera,f.renderer));
 }
 for(const [group,pass] of [[undefined,'color'],[{},'color'],[null,'shadow'],[null,'auxiliary']]){
  const f=await prepared(),c=f.observer.beforeRender(f.scene,f.camera,f.renderer);f.scene.onBeforeRender(f.renderer,f.scene,f.camera,null);
  assert.throws(()=>f.observer.snapshotSubmitted(c,f.reduced,f.mesh,group,pass));
 }
});
test('full and reduced immutable index byte changes fail their own manifest pins',async()=>{
 for(const kind of ['full','reduced']){
  const f=await prepared();f[kind].index.array[0]=(f[kind].index.array[0]+1)%f.entry.vertices;
  const c=f.observer.beforeRender(f.scene,f.camera,f.renderer);f.scene.onBeforeRender(f.renderer,f.scene,f.camera,null);
  const s=f.observer.snapshotSubmitted(c,f.reduced,f.mesh,null,'color');f.scene.onAfterRender(f.renderer,f.scene,f.camera,null);f.observer.assertRestored(c);
  await assert.rejects(s.settle(async v=>hash(v)),/Pinned display-index .* bytes differ/);
 }
});
test('actual synchronous byte copies precede later index/attribute mutation',async()=>{
 const f=await prepared(),object=objectReceipt(f),c=f.observer.beforeRender(f.scene,f.camera,f.renderer);f.scene.onBeforeRender(f.renderer,f.scene,f.camera,null);
 const s=f.observer.snapshotSubmitted(c,f.reduced,f.mesh,null,'color'),draw=drawRow(f,s);
 f.full.attributes.position.array[0]=123;f.full.index.array[0]=(f.full.index.array[0]+1)%f.entry.vertices;f.reduced.index.array[0]=(f.reduced.index.array[0]+1)%f.entry.vertices;
 f.scene.onAfterRender(f.renderer,f.scene,f.camera,null);f.observer.assertRestored(c);await s.settle(async v=>hash(v));
 assertDisplayIndexSubmittedOwner(draw,object,sceneReceipt(f),pins);assert.notEqual(draw.displayIndexSubmission.sourceGeometry.attributes.position.sha256,hash(bytes(f.full.attributes.position.array)));
});
test('host rejects changed source/index/attribute/policy/callback/identity/restoration evidence',async()=>{
 const r=await prove(await prepared()),proof=d=>d.displayIndexSubmission;
 const edits=[d=>proof(d).sourceGeometry.index.sha256='0'.repeat(64),d=>proof(d).submittedGeometry.index.sha256='1'.repeat(64),
  d=>proof(d).submittedGeometry.attributes.sedimentCoord.sha256='2'.repeat(64),d=>proof(d).submittedGeometry.attributes.position.normalized=true,
  d=>proof(d).submittedGeometry.attributes.position.usage++,d=>proof(d).submittedGeometry.attributes.position.gpuType++,
  d=>proof(d).sourceGeometry.boundingSphere.radius++,d=>proof(d).entry.error*=2,d=>proof(d).registration.scale++,
  d=>proof(d).selection.width=640,d=>proof(d).selection.near++,d=>proof(d).selection.pixelScale--,d=>proof(d).selection.camera.projectionMatrix[8]=.25,
  d=>proof(d).selection.visible=false,d=>proof(d).selection.castShadow=true,d=>proof(d).selection.arrayCamera=true,d=>proof(d).selection.xrPresenting=true,d=>proof(d).selection.target='non-default',d=>proof(d).selection.splitActive=true,
  d=>proof(d).actualGroupRecorded=false,d=>delete d.submittedGroup,d=>d.submittedGroup={undefined:true},d=>d.pass='shadow',d=>d.castShadow=true,
  d=>proof(d).identities.attributeObjectsShared=false,d=>proof(d).identities.restoredIsFull=false,d=>proof(d).restored=null,d=>proof(d).settled=false,
  d=>proof(d).callbacks.object[0].functionSha256='3'.repeat(64),d=>proof(d).callbacks.scene[0].functionSha256='4'.repeat(64),
  d=>d.submittedGeometry.indexCount++,d=>d.submittedGeometry.start=3,d=>d.calls=2,d=>d.lines=1,d=>d.points=1,d=>d.triangles--];
 for(const [i,edit] of edits.entries()){const d=clone(r.draw);edit(d);assert.throws(()=>assertDisplayIndexSubmittedOwner(d,r.object,r.scene,pins),undefined,'Evidence mutation '+i);}
});
test('old missing-proof display-index artifacts remain failed and paired original proof must match exactly',async()=>{
 const a=await prove(await prepared()),b=await prove(await prepared());
 const old={...a.draw};delete old.displayIndexSubmission;delete old.submittedGroup;assert.throws(()=>assertSubmittedOwner(old,a.object,a.scene),/no owner proof/);
 const roofPath='Scene#0/107227742_STAGED_LOD0#0/RoofPatinatedCopperPanels#0';
 const roof={path:roofPath,pass:'color',calls:1,triangles:48,submittedGeometry:{positionCount:96,indexCount:144,start:0,count:'Infinity'}},appended={...clone(roof),triangles:98,submittedGeometry:{positionCount:150,indexCount:294,start:0,count:'Infinity'}};
 assertDrawPair([a.draw,roof],[b.draw,appended]);const changed=clone(b.draw);changed.displayIndexSubmission.selection.near++;
 assert.throws(()=>assertDrawPair([a.draw,roof],[changed,appended]));
});
