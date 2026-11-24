import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {readFileSync} from 'node:fs';
import {createRequire} from 'node:module';
import {dirname,resolve} from 'node:path';
import * as T from 'three';
import {installBatchedIndirectUpdates,batchedIndirectUpdateDiagnostics} from './batchedIndirectUpdates.ts';

type Internals=T.BatchedMesh&{_indirectTexture:T.DataTexture;_multiDrawCount:number;_multiDrawStarts:Int32Array;_multiDrawCounts:Int32Array;_visibilityChanged:boolean};
class Canvas extends EventTarget {
 listeners=new Set<string>();
 override addEventListener(type:string,callback:EventListenerOrEventListenerObject|null,options?:AddEventListenerOptions|boolean){
  this.listeners.add(type);super.addEventListener(type,callback,options);
 }
 override removeEventListener(type:string,callback:EventListenerOrEventListenerObject|null,options?:EventListenerOptions|boolean){
  this.listeners.delete(type);super.removeEventListener(type,callback,options);
 }
}
function renderer(){
 const canvas=new Canvas();
 const value=Object.assign(Object.create(T.WebGLRenderer.prototype),{isWebGLRenderer:true,domElement:canvas}) as T.WebGLRenderer;
 return {value,canvas};
}
function camera(x=0,z=20){
 const value=new T.PerspectiveCamera(55,1,.1,200);value.position.set(x,0,z);value.lookAt(0,0,0);value.updateMatrixWorld(true);return value;
}
function fixture(adapt=true){
 const scene=new T.Scene(),material=new T.MeshStandardMaterial(),batch=new T.BatchedMesh(9,24,36,material) as Internals;
 const handle=adapt?installBatchedIndirectUpdates(batch):null;
 const geometry=new T.BoxGeometry(),id=batch.addGeometry(geometry);geometry.dispose();
 for(const x of [-3,0,3]){const instance=batch.addInstance(id);batch.setMatrixAt(instance,new T.Matrix4().makeTranslation(x,0,0));}
 batch.sortObjects=false;scene.add(batch);scene.updateMatrixWorld(true);
 return {scene,material,batch,handle,render:renderer(),camera:camera()};
}
type Fixture=ReturnType<typeof fixture>;
function draw(f:Fixture,camera=f.camera,shadow=false,renderer=f.render.value){
 return shadow?Reflect.apply(f.batch.onBeforeShadow,f.batch,[renderer,f.batch,f.camera,camera,f.batch.geometry,new T.MeshDepthMaterial(),null]):
  Reflect.apply(f.batch.onBeforeRender,f.batch,[renderer,f.scene,camera,f.batch.geometry,f.material,null]);
}
function commands(f:Fixture){return {
 ids:Array.from(f.batch._indirectTexture.image.data as Uint32Array),
 starts:Array.from(f.batch._multiDrawStarts),counts:Array.from(f.batch._multiDrawCounts),
 count:f.batch._multiDrawCount,visibilityChanged:f.batch._visibilityChanged,
};}
function equalDraw(a:Fixture,b:Fixture,ca=a.camera,cb=b.camera,shadow=false){
 assert.equal(draw(a,ca,shadow),draw(b,cb,shadow));assert.deepEqual(commands(a),commands(b));
}

test('private assumptions are pinned to three 0.185.1 and the reviewed native implementations',()=>{
 const root=resolve(dirname(createRequire(import.meta.url).resolve('three')),'..');
 assert.equal(JSON.parse(readFileSync(resolve(root,'package.json'),'utf8')).version,'0.185.1');
 const files={
  'src/objects/BatchedMesh.js':'a7b4154d996fe13b73bfd986e09903779c902ad4dd86d8e667a83abd77aab329',
  'src/textures/Texture.js':'ab2b297f91c58c69a95849ef8d1d3a9b7c0e7d2c3a574964b0ffd90b107452c6',
  'src/textures/Source.js':'5378078428637f94f8d7d447f984515cd35fb1ad9113ced086aad16a2f743f5e',
  'src/renderers/webgl/WebGLTextures.js':'241557c9b4a4cbbc76f4328329f6a26db2f27162e327ac2bb9eb4f851744184a',
 };
 for(const [file,expected] of Object.entries(files))assert.equal(createHash('sha256').update(readFileSync(resolve(root,file))).digest('hex'),expected,file);
});

test('unchanged native callbacks keep every draw command and coalesce only duplicate dirty requests',()=>{
 const baseline=fixture(false),candidate=fixture();
 for(let i=0;i<4;i++)equalDraw(baseline,candidate);
 assert.equal(baseline.batch._indirectTexture.version,4);
 assert.equal(candidate.batch._indirectTexture.version,1);
 assert.equal(candidate.batch._indirectTexture.source.version,1);
 assert.deepEqual(candidate.handle!.read(),{supported:true,active:true,disabledReason:null,attempted:4,delegated:1,suppressed:3,fallback:0,externalMarks:0,invalidations:0});
 assert.equal(installBatchedIndirectUpdates(candidate.batch),candidate.handle);
});

test('visibility, camera culling, native sorting and shadow/color transitions preserve exact IDs and commands',()=>{
 const a=fixture(false),b=fixture();
 equalDraw(a,b);
 for(const f of [a,b])f.batch.setVisibleAt(1,false);
 equalDraw(a,b);equalDraw(a,b);
 for(const f of [a,b]){f.batch.setVisibleAt(1,true);f.batch.sortObjects=true;}
 const left=camera(-15,1),right=camera(15,1),close=camera(0,2);
 for(const [ca,shadow] of [[left,false],[right,true],[left,false],[close,true],[b.camera,false]] as const){
  equalDraw(a,b,ca,ca,shadow);
 }
 assert.ok(b.handle!.read().delegated>=5);
 assert.ok(b.handle!.read().suppressed>=1);
});

test('ArrayCamera culling retains native multi-view commands',()=>{
 const a=fixture(false),b=fixture(),array=new T.ArrayCamera([camera(-15,1),camera(15,1)]);
 array.updateMatrixWorld(true);
 equalDraw(a,b,array,array);equalDraw(a,b,array,array);
 assert.equal(b.handle!.read().suppressed,1);
});

test('full allocation tail changes delegate even when active IDs are unchanged',()=>{
 const f=fixture();draw(f);const t=f.batch._indirectTexture;
 (t.image.data as Uint32Array)[8]=77;
 draw(f);assert.equal(t.version,2);draw(f);assert.equal(t.version,2);
 assert.equal(f.handle!.read().suppressed,1);
});

test('native count and wireframe range changes still happen when ID bytes match',()=>{
 const a=fixture(false),b=fixture();equalDraw(a,b);
 for(const f of [a,b])f.material.wireframe=true;
 equalDraw(a,b);assert.equal(b.handle!.read().suppressed,1);
 for(const f of [a,b])f.batch.setVisibleAt(2,false);
 equalDraw(a,b);assert.equal(b.batch._multiDrawCount,2);
 assert.equal(b.handle!.read().suppressed,2,'unchanged unused tail is harmless; native count changed');
});

test('A to B to A before any upload delegates all distinct requests and retains a pending native version',()=>{
 const f=fixture();draw(f);
 f.batch.setVisibleAt(0,false);draw(f);
 f.batch.setVisibleAt(0,true);draw(f);
 assert.equal(f.batch._indirectTexture.version,3);
 draw(f);assert.equal(f.batch._indirectTexture.version,3);
 assert.deepEqual([f.handle!.read().delegated,f.handle!.read().suppressed],[3,1]);
});

test('external true/false dirty marks and independent Source changes force the next native request',()=>{
 const f=fixture();draw(f);const t=f.batch._indirectTexture;
 t.needsUpdate=true;assert.equal(t.version,2);draw(f);assert.equal(t.version,3);
 t.needsUpdate=false;draw(f);assert.equal(t.version,4);
 t.source.needsUpdate=true;draw(f);assert.equal(t.version,5);
 draw(f);assert.equal(t.version,5);
 assert.equal(f.handle!.read().externalMarks,2);
 assert.equal(f.handle!.read().suppressed,1);
});

test('native early return creates no fabricated update, and foreign receiver calls remain native',()=>{
 const f=fixture();draw(f);f.batch.perObjectFrustumCulled=false;
 const before=f.handle!.read();draw(f);assert.deepEqual(f.handle!.read(),before);
 const other=fixture(false),wrapped=f.batch.onBeforeRender;
 Reflect.apply(wrapped,other.batch,[other.render.value,other.scene,other.camera,other.batch.geometry,other.material,null]);
 assert.equal(other.batch._indirectTexture.version,1);assert.deepEqual(f.handle!.read(),before);
});

test('context loss and restore invalidate without GL calls and preserve the first restored dirty mark',()=>{
 const f=fixture();draw(f);draw(f);
 f.render.canvas.dispatchEvent(new Event('webglcontextlost'));
 draw(f);assert.equal(f.batch._indirectTexture.version,2);assert.equal(f.handle!.read().fallback,1);
 f.render.canvas.dispatchEvent(new Event('webglcontextrestored'));
 draw(f);assert.equal(f.batch._indirectTexture.version,3);draw(f);assert.equal(f.batch._indirectTexture.version,3);
 assert.equal(f.handle!.read().invalidations,2);
 assert.equal(f.render.canvas.listeners.size,2);
});

test('a second renderer conservatively restores native marking and removes lifecycle listeners',()=>{
 const f=fixture();draw(f);draw(f);const second=renderer();draw(f,f.camera,false,second.value);
 assert.equal(f.handle!.read().active,false);assert.equal(f.handle!.read().disabledReason,'multiple-renderers');
 assert.equal(f.batch.onBeforeRender,T.BatchedMesh.prototype.onBeforeRender);
 assert.equal(Object.hasOwn(f.batch._indirectTexture,'needsUpdate'),false);
 assert.equal(f.render.canvas.listeners.size,0);assert.equal(second.canvas.listeners.size,0);
 const before=f.batch._indirectTexture.version;draw(f);assert.equal(f.batch._indirectTexture.version,before+1);
});

test('resize and texture replacement retain native disposal and first-upload behavior',()=>{
 const resized=fixture();draw(resized);resized.batch.setInstanceCount(16);
 assert.equal(resized.handle!.read().active,false);assert.equal(resized.handle!.read().disabledReason,'texture-disposed');
 assert.equal(resized.batch._indirectTexture.version,0);draw(resized);assert.equal(resized.batch._indirectTexture.version,1);
 const f=fixture();draw(f);const old=f.batch._indirectTexture;
 f.batch._indirectTexture=new T.DataTexture(new Uint32Array(9),3,3,T.RedIntegerFormat,T.UnsignedIntType);
 draw(f);assert.equal(f.batch._indirectTexture.version,1);assert.equal(f.handle!.read().disabledReason,'texture-replaced');
 assert.equal(Object.hasOwn(old,'needsUpdate'),false);
});

test('dispose/reuse and explicit handle disposal remove only owned wrappers',()=>{
 const f=fixture();draw(f);const t=f.batch._indirectTexture;
 t.dispose();assert.equal(f.handle!.read().active,false);assert.equal(f.render.canvas.listeners.size,0);
 const version=t.version;draw(f);assert.equal(t.version,version+1);
 const g=fixture();draw(g);g.handle!.dispose();g.handle!.dispose();
 assert.equal(g.batch.onBeforeRender,T.BatchedMesh.prototype.onBeforeRender);assert.equal(Object.hasOwn(g.batch._indirectTexture,'needsUpdate'),false);
 const h=fixture();draw(h);const custom=()=>{};
 h.batch.onBeforeRender=custom;
 Object.defineProperty(h.batch._indirectTexture,'needsUpdate',{configurable:true,set:custom});
 h.handle!.dispose();assert.equal(h.batch.onBeforeRender,custom);
 assert.equal(Object.getOwnPropertyDescriptor(h.batch._indirectTexture,'needsUpdate')!.set,custom);
});

test('native setter and original callback exceptions retain their exact identity and call count',()=>{
 const f=fixture();draw(f);const marker={reason:'native source setter'},source=f.batch._indirectTexture.source;
 let calls=0;Object.defineProperty(source,'needsUpdate',{configurable:true,set(){calls++;throw marker;}});
 assert.throws(()=>draw(f),error=>error===marker);assert.equal(calls,1);
 assert.equal(f.handle!.read().fallback,1);delete (source as unknown as Record<string,unknown>).needsUpdate;
 draw(f);assert.equal(f.handle!.read().delegated,3);
 const g=fixture(),failure={reason:'geometry'};let geometryCalls=0;
 g.batch.geometry.getIndex=()=>{geometryCalls++;throw failure;};
 assert.throws(()=>draw(g),error=>error===failure);assert.equal(geometryCalls,1);assert.equal(g.handle!.read().attempted,0);
});

test('readonly native version fields keep the native setter failure instead of suppressing it',()=>{
 const f=fixture();draw(f);Object.defineProperty(f.batch._indirectTexture,'version',{writable:false});
 assert.throws(()=>draw(f),TypeError);assert.equal(f.handle!.read().suppressed,0);assert.equal(f.handle!.read().fallback,1);
 f.handle!.dispose();
});

test('later inherited setter changes disable the adapter and retain ordinary native dispatch',()=>{
 const descriptor=Object.getOwnPropertyDescriptor(T.Texture.prototype,'needsUpdate')!;
 const f=fixture();draw(f);let calls=0;
 try{
  Object.defineProperty(T.Texture.prototype,'needsUpdate',{...descriptor,set(value){calls++;descriptor.set!.call(this,value);}});
  f.batch._indirectTexture.needsUpdate=true;
  assert.equal(calls,1);assert.equal(f.batch._indirectTexture.version,2);
  assert.equal(f.handle!.read().externalMarks,1);
  assert.equal(f.handle!.read().disabledReason,'native-implementation-changed');
  draw(f);assert.equal(calls,2);assert.equal(f.batch._indirectTexture.version,3);
 }finally{Object.defineProperty(T.Texture.prototype,'needsUpdate',descriptor);f.handle!.dispose();}
});

test('observation does not invoke application image/version getters in addition to native code',()=>{
 const f=fixture(),t=f.batch._indirectTexture,image=t.image;let reads=0;
 Object.defineProperty(t,'image',{configurable:true,get(){reads++;return image;}});
 draw(f);assert.equal(reads,1);assert.equal(f.handle!.read().fallback,1);
 let version=1,versionReads=0;
 Object.defineProperty(t,'version',{configurable:true,get(){versionReads++;return version;},set(v){version=v;}});
 draw(f);assert.equal(versionReads,1);assert.equal(version,2);assert.equal(f.handle!.read().fallback,2);
});

test('custom sort and material callbacks retain all native marks and are never invoked by observation',()=>{
 const f=fixture();draw(f);f.batch.sortObjects=true;let sorts=0;
 f.batch.setCustomSort(list=>{sorts++;list.reverse();});draw(f);draw(f);
 assert.equal(sorts,2);assert.equal(f.handle!.read().fallback,2);assert.equal(f.handle!.read().suppressed,0);
 f.batch.setCustomSort(null);let calls=0;f.material.onBeforeRender=()=>{calls++;};
 draw(f);assert.equal(calls,0,'renderer, not this adapter, owns material callback execution');
 assert.equal(f.handle!.read().fallback,3);
});

test('nested custom native-callback invocations stay pass-through and do not authorize outer suppression',()=>{
 const a=fixture(false),b=fixture();
 for(const f of [a,b]){
  let inside=false,once=false;const original=T.BatchedMesh.prototype.getMatrixAt;
  f.batch.getMatrixAt=function(index,matrix){
   if(!inside&&!once){once=true;inside=true;draw(f);inside=false;}
   return original.call(this,index,matrix);
  };
 }
 equalDraw(a,b);assert.equal(b.handle!.read().attempted,2);assert.equal(b.handle!.read().fallback,2);assert.equal(b.handle!.read().suppressed,0);
});

test('custom onUpdate, changed native layouts and uncertain source/data identities always delegate',()=>{
 const mutations:((f:Fixture)=>void)[]=[
  f=>{f.batch._indirectTexture.onUpdate=()=>{};},
  f=>{f.batch._indirectTexture.updateRanges.push({start:0,count:1});},
  f=>{f.batch._indirectTexture.generateMipmaps=true;},
  f=>{f.batch._indirectTexture.source.dataReady=false;},
  f=>{f.batch._indirectTexture.image={...f.batch._indirectTexture.image};},
  f=>{f.batch._indirectTexture.image.data=(f.batch._indirectTexture.image.data as Uint32Array).slice();},
  f=>{f.batch._indirectTexture.source=new T.Source(f.batch._indirectTexture.image);},
 ];
 for(const mutate of mutations){
  const f=fixture();draw(f);mutate(f);draw(f);draw(f);
  assert.equal(f.handle!.read().suppressed,0);assert.equal(f.handle!.read().fallback,2);assert.equal(f.batch._indirectTexture.version,3);
 }
});

test('unknown renderers and failed lifecycle observation cannot enable suppression or change native calls',()=>{
 const f=fixture();draw(f,f.camera,false,{} as T.WebGLRenderer);draw(f,f.camera,false,{} as T.WebGLRenderer);
 assert.equal(f.handle!.read().fallback,2);assert.equal(f.batch._indirectTexture.version,2);
 const g=fixture();g.render.canvas.addEventListener=()=>{throw new Error('listener unavailable');};
 draw(g);assert.equal(g.batch._indirectTexture.version,1);assert.equal(g.handle!.read().active,false);
});

test('used/cloned/custom textures and non-native batches are rejected without mutation',()=>{
 const batch=()=>new T.BatchedMesh(4,24,36,new T.MeshStandardMaterial()) as Internals;
 const variants:((b:Internals)=>void)[]=[
  b=>{b._indirectTexture.needsUpdate=true;},
  b=>{b._indirectTexture=b._indirectTexture.clone();},
  b=>{b.onBeforeRender=()=>{};},
  b=>{b._indirectTexture.onUpdate=()=>{};},
  b=>{Object.defineProperty(b._indirectTexture,'needsUpdate',{configurable:true,set(){}});},
  b=>{Object.defineProperty(b._indirectTexture.source,'needsUpdate',{configurable:true,set(){}});},
 ];
 for(const mutate of variants){const b=batch();mutate(b);const callback=b.onBeforeRender,descriptor=Object.getOwnPropertyDescriptor(b._indirectTexture,'needsUpdate');
  const h=installBatchedIndirectUpdates(b);assert.equal(h.read().supported,false);assert.equal(h.read().active,false);
  assert.equal(b.onBeforeRender,callback);assert.deepEqual(Object.getOwnPropertyDescriptor(b._indirectTexture,'needsUpdate'),descriptor);
 }
 class Derived extends T.BatchedMesh {}
 assert.equal(installBatchedIndirectUpdates(new Derived(4,24,36)).read().supported,false);
});

test('diagnostics traverse only on request and expose copies with setter-decision meanings',()=>{
 const scene=new T.Scene(),a=fixture(),b=fixture();scene.add(a.batch,b.batch);draw(a);draw(a);draw(b);
 const report=batchedIndirectUpdateDiagnostics(scene);
 assert.equal(report.version,1);assert.equal(report.installedBatches,2);assert.equal(report.activeBatches,2);
 assert.deepEqual(report.totals,{attempted:3,delegated:2,suppressed:1,fallback:0,externalMarks:0,invalidations:0});
 assert.ok(Object.isFrozen(a.handle!.read()));report.totals.suppressed=999;report.batches.length=0;
 assert.equal(batchedIndirectUpdateDiagnostics(scene).totals.suppressed,1);
 a.handle!.dispose();assert.equal(batchedIndirectUpdateDiagnostics(scene).activeBatches,1);
});
