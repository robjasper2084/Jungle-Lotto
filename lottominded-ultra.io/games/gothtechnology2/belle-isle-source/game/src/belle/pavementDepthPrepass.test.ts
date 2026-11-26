import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import * as T from 'three';
import {WebGLGeometries} from 'three/src/renderers/webgl/WebGLGeometries.js';
import {createPavementMesh,pavementFactoryOwner,type PavementPart} from './pavement.ts';
import {preparePavementDepthPrepass,type PavementDepthReceipt} from './pavementDepthPrepass.ts';
import {finishAsphalt} from './surfaceFinish.ts';
import {WorldAtmosphere} from './worldAtmosphere.ts';
import {applyRealisticMaterials,loadRealisticMaterials} from './realisticMaterials.ts';
import {applyPhotoReferenceSurfaces} from './photoReferenceSurfaces.ts';
import {dressSunsetGround} from './sunsetGround.ts';

const options={rendererOutput:{type:T.UnsignedByteType,nodes:false}};
function adapter(){
 const canvas=new EventTarget();let contextCalls=0;
 const renderer={getContextAttributes:()=>{contextCalls++;return{depth:true,stencil:false};},getRenderTarget:()=>null,domElement:canvas,
  capabilities:{logarithmicDepthBuffer:false,reversedDepthBuffer:false},xr:{isPresenting:false},localClippingEnabled:false,clippingPlanes:[],
  info:{render:{frame:0}}} as unknown as T.WebGLRenderer;
 return{renderer,canvas,contextCalls:()=>contextCalls};
}
function part(kind='asphalt'){
 const values=[[-6,0,-15],[0,0,-1],[6,0,-15],[100,0,-15],[106,0,-1],[112,0,-15]];
 const data=new Float32Array(values.flatMap(([x,y,z])=>[x,y,z,0,1,0,x/8,z/8]));
 return{buffer:data.buffer,part:{kind,offset:0,vertices:6,indices:[0,1,2,3,4,5],ranges:[
  [3,-6,0,-15,6,0,-1],[6,100,0,-15,112,0,-1]
 ]} as PavementPart};
}
function receipt(source:T.Mesh):PavementDepthReceipt{
 const material=source.material as T.MeshStandardMaterial;
 return{source,geometry:source.geometry,material,compile:material.onBeforeCompile,key:material.customProgramCacheKey};
}
function fixture(kind='asphalt'){
 const a=adapter(),scene=new T.Scene(),material=new T.MeshStandardMaterial({color:0x979b99});
 finishAsphalt(material);material.name='Island asphalt';material.userData.realisticSurface='asphalt';material.userData.realisticProfile='asphalt|planar';
 const data=part(kind),source=createPavementMesh(data.buffer,data.part,8,material);scene.add(source);scene.updateMatrixWorld(true);
 const camera=new T.PerspectiveCamera(60,1,.08,1000);camera.position.set(0,4,8);camera.lookAt(0,0,-6);camera.updateMatrixWorld(true);
 const handle=preparePavementDepthPrepass(scene,a.renderer,[receipt(source)],options);
 const depth=source.children[0] as T.Mesh|undefined;
 function begin(input:T.Camera=camera){Reflect.apply(scene.onBeforeRender,scene,[a.renderer,scene,input,null]);a.renderer.info.render.frame++;}
 function draw(input:T.Camera=camera){assert(depth);Reflect.apply(depth.onBeforeRender,depth,[a.renderer,scene,input,depth.geometry,depth.material,null]);}
 function after(){assert(depth);Reflect.apply(depth.onAfterRender,depth,[a.renderer,scene,camera,depth.geometry,depth.material,null]);}
 function dispose(){handle.dispose();source.geometry.dispose();material.dispose();}
 return{...a,scene,source,material,camera,handle,depth,begin,draw,after,dispose};
}

test('factory asphalt alone qualifies; a copied label and a different factory kind do not',()=>{
 const f=fixture();assert.equal(f.handle.read().prepared,1);assert(pavementFactoryOwner(f.source));
 f.handle.dispose();const forged=new T.Mesh(f.source.geometry,f.material);forged.name=f.source.name;f.scene.add(forged);
 assert.equal(pavementFactoryOwner(forged),undefined);
 const rejected=preparePavementDepthPrepass(f.scene,f.renderer,[receipt(forged)],options);assert.equal(rejected.read().prepared,0);rejected.dispose();f.dispose();
 const concrete=fixture('concrete');assert.equal(concrete.handle.read().prepared,0);concrete.dispose();
});

test('the depth view retains exact native attribute/index objects and matrix bits, independent range and original color hooks',()=>{
 const f=fixture(),depth=f.depth!,g=f.source.geometry,before=f.source.onBeforeRender,after=f.source.onAfterRender,key=f.material.customProgramCacheKey;
 assert.notEqual(depth.geometry,g);for(const name of Object.keys(g.attributes))assert.equal(depth.geometry.getAttribute(name),g.getAttribute(name));
 assert.equal(depth.geometry.index,g.index);assert.equal(depth.geometry.boundingSphere,g.boundingSphere);
 assert.notEqual(depth.matrixWorld,f.source.matrixWorld);assert.deepEqual(depth.matrixWorld.elements,f.source.matrixWorld.elements);assert.notEqual(depth.layers,f.source.layers);assert.equal(depth.layers.mask,f.source.layers.mask);
 assert.equal(depth.matrixAutoUpdate,false);assert.equal(depth.matrixWorldAutoUpdate,false);assert.equal(depth.renderOrder,-103);assert.equal(f.source.renderOrder,0);
 assert.equal(depth.castShadow,false);assert.equal(depth.receiveShadow,false);assert.equal((depth.material as T.Material).colorWrite,false);
 assert.equal((depth.material as T.Material).depthFunc,T.LessEqualDepth);assert.equal((depth.material as T.Material).allowOverride,false);
 f.begin();f.draw();const selected={...depth.geometry.drawRange};assert(selected.count>0&&selected.count<g.index!.count);
 assert.deepEqual(g.drawRange,{start:0,count:Infinity});
 const args=[f.renderer,f.scene,f.camera,g,f.material,null];Reflect.apply(before,f.source,args);assert.deepEqual(g.drawRange,selected);
 Reflect.apply(after,f.source,args);assert.deepEqual(g.drawRange,{start:0,count:Infinity});f.after();
 assert.deepEqual(depth.geometry.drawRange,{start:0,count:0});assert.equal(f.source.onBeforeRender,before);assert.equal(f.source.onAfterRender,after);
 assert.equal(f.material.customProgramCacheKey,key);assert.equal(f.material.onBeforeRender,T.Material.prototype.onBeforeRender);
 f.scene.updateMatrixWorld(true);assert.deepEqual(depth.matrixWorld.elements,f.source.matrixWorld.elements);assert(depth.matrixWorld.equals(new T.Matrix4()));
 const intersections:T.Intersection[]=[];depth.raycast(new T.Raycaster(),intersections);assert.deepEqual(intersections,[]);
 assert.equal(f.contextCalls(),1,'no synchronous parameter/context queries per draw');f.dispose();
});

test('owned depth transforms cannot write into the source and altered depth state stops depth work',()=>{
 const changes:((f:ReturnType<typeof fixture>)=>void)[]=[
  f=>{f.depth!.matrixWorld.elements[12]=2;},f=>{f.depth!.matrixAutoUpdate=true;f.depth!.position.x=9;f.scene.updateMatrixWorld(true);},
  f=>{f.depth!.layers.set(2);},f=>{f.depth!.layers=new T.Layers();},f=>{f.depth!.matrix.elements[0]=2;},
  f=>{(f.depth!.material as T.Material).polygonOffset=true;},f=>{(f.depth!.material as T.Material).depthFunc=T.LessDepth;},
  f=>{(f.depth!.material as T.Material).onBeforeCompile=()=>{};},f=>{f.depth!.castShadow=true;},
  f=>{f.depth!.geometry=new T.BoxGeometry();},f=>{f.depth!.material=new T.MeshBasicMaterial();},
  f=>{f.depth!.onBeforeRender=()=>{};},f=>{f.depth!.onAfterRender=()=>{};},f=>{f.depth!.raycast=T.Mesh.prototype.raycast;},
  f=>{f.depth!.geometry.setIndex([0,1,2]);},f=>{f.depth!.geometry.setAttribute('position',new T.Float32BufferAttribute([0,0,0],3));},
 ];
 for(const change of changes){const f=fixture();f.begin();change(f);f.draw();assert.equal(f.depth!.geometry.drawRange.count,0);
  assert(f.source.matrixWorld.equals(new T.Matrix4()));assert.equal(f.source.layers.mask,1);assert.deepEqual(f.source.geometry.drawRange,{start:0,count:Infinity});f.dispose();}
});

test('an interrupted depth render cannot leave shared source range or material modified',()=>{
 const f=fixture(),g=f.source.geometry,originalRange=g.drawRange,material=f.material,version=material.version;
 f.begin();f.draw();assert.throws(()=>{throw new Error('native draw failed');},/native draw failed/);
 assert.equal(g.drawRange,originalRange);assert.deepEqual(g.drawRange,{start:0,count:Infinity});
 assert.equal(f.source.material,material);assert.equal(material.version,version);assert.equal(material.colorWrite,true);
 f.handle.dispose();assert.deepEqual(g.drawRange,{start:0,count:Infinity});assert.equal(material.version,version);f.dispose();
});

test('source material, callback, visibility, parent, transform and uploaded-attribute changes fail closed',()=>{
 const changes:((f:ReturnType<typeof fixture>)=>void)[]=[
  f=>{f.material.transparent=true;},f=>{f.material.opacity=.9;},f=>{f.material.alphaTest=.01;},f=>{f.material.alphaHash=true;},
  f=>{f.material.alphaToCoverage=true;},f=>{f.material.alphaMap=new T.Texture();},f=>{f.material.displacementMap=new T.Texture();},
  f=>{f.material.depthWrite=false;},f=>{f.material.depthTest=false;},f=>{f.material.depthFunc=T.LessDepth;},f=>{f.material.side=T.BackSide;},
  f=>{f.material.polygonOffset=true;},f=>{f.material.stencilWrite=true;},f=>{f.material.clippingPlanes=[new T.Plane()];},
  f=>{f.material.onBeforeCompile=()=>{};},f=>{f.material.customProgramCacheKey=()=> 'new';},f=>{f.material.onBeforeRender=()=>{};},
  f=>{f.material.defines!.CUSTOM=1;},f=>{f.material.needsUpdate=true;},f=>{f.material.visible=false;},
  f=>{f.source.visible=false;},f=>{f.scene.visible=false;},f=>{f.source.position.x=1;},f=>{f.source.matrixWorld.elements[12]=1;},
  f=>{f.source.matrixWorld=f.source.matrixWorld.clone();},f=>{f.source.layers=new T.Layers();},f=>{f.source.layers.set(2);},
  f=>{f.source.frustumCulled=false;},f=>{f.source.castShadow=true;},f=>{f.source.customDepthMaterial=new T.MeshDepthMaterial();},
  f=>{f.source.onBeforeRender=()=>{};},f=>{f.source.onAfterRender=()=>{};},f=>{f.source.onBeforeShadow=()=>{};},
  f=>{f.source.raycast=()=>{};},f=>{f.source.removeFromParent();},f=>{const group=new T.Group();f.scene.add(group);group.add(f.source);},
  f=>{f.source.material=f.material.clone();},f=>{f.source.geometry=f.source.geometry.clone();},
  f=>{f.source.geometry.getAttribute('position').needsUpdate=true;},f=>{f.source.geometry.index!.needsUpdate=true;},
  f=>{f.source.geometry.boundingSphere!.radius+=1;},f=>{f.source.geometry.setDrawRange(3,3);},f=>{f.source.geometry.addGroup(0,3,0);},
 ];
 for(const change of changes){const f=fixture();f.begin();change(f);f.draw();assert.equal(f.depth!.geometry.drawRange.count,0,change.toString());
  assert.notEqual(f.handle.read().entries[0].status,'active',change.toString());f.dispose();}
});

test('unsupported material is excluded before native collection rather than issuing a zero-count depth draw',()=>{
 const f=fixture(),sourceBefore=f.source.onBeforeRender,sourceAfter=f.source.onAfterRender;
 f.material.transparent=true;f.material.opacity=.65;f.material.needsUpdate=true;
 f.begin();
 assert.equal(f.depth!.visible,false);assert.equal(f.source.visible,true);
 assert.equal(f.handle.read().entries[0].status,'material-changed');assert.equal(f.handle.read().entries[0].selectedIndices,0);
 const collected:T.Object3D[]=[];f.scene.traverseVisible(object=>collected.push(object));
 assert(collected.includes(f.source));assert(!collected.includes(f.depth!),'unsupported depth view never reaches render-list collection');
 f.depth!.visible=true;assert.equal(f.depth!.visible,false,'a requested enable cannot bypass failed preflight');
 assert.equal(f.source.onBeforeRender,sourceBefore);assert.equal(f.source.onAfterRender,sourceAfter);
 assert.deepEqual(f.source.geometry.drawRange,{start:0,count:Infinity});assert.equal(f.contextCalls(),1);f.dispose();
});

test('requested baseline visibility and transient unsupported views recover only through a new valid preflight',()=>{
 const f=fixture();assert.equal(f.depth!.visible,false,'no previous frame permission before first preflight');
 f.depth!.visible=false;f.begin();assert.equal(f.depth!.visible,false);f.draw();assert.equal(f.depth!.geometry.drawRange.count,0);
 f.depth!.visible=true;assert.equal(f.depth!.visible,false);f.begin();assert.equal(f.depth!.visible,true);f.draw();assert(f.depth!.geometry.drawRange.count>0);f.after();
 const target=new T.WebGLRenderTarget(4,4);f.renderer.getRenderTarget=()=>target;f.begin();assert.equal(f.depth!.visible,false);
 f.renderer.getRenderTarget=()=>null;f.depth!.visible=true;assert.equal(f.depth!.visible,false);f.begin();assert.equal(f.depth!.visible,true);f.draw();f.after();
 f.material.transparent=true;f.begin();assert.equal(f.depth!.visible,false);
 f.material.transparent=false;f.begin();assert.equal(f.depth!.visible,true);f.draw();assert(f.depth!.geometry.drawRange.count>0);f.after();
 f.begin(new T.ArrayCamera([f.camera]));assert.equal(f.depth!.visible,false);f.begin();assert.equal(f.depth!.visible,true);
 f.canvas.dispatchEvent(new Event('webglcontextlost'));f.begin();assert.equal(f.depth!.visible,false);
 f.canvas.dispatchEvent(new Event('webglcontextrestored'));f.begin();assert.equal(f.depth!.visible,true);assert.equal(f.contextCalls(),2);
 target.dispose();f.dispose();
});

test('preflight follows original scene-hook mutations and preserves its exact return and throw',()=>{
 const f=fixture();f.handle.dispose();const answer={token:true},failure={token:'failure'};let mode='unsupported',calls=0;
 f.scene.onBeforeRender=function(){assert.equal(this,f.scene);calls++;if(mode==='throw')throw failure;f.material.transparent=mode==='unsupported';return answer;};
 const handle=preparePavementDepthPrepass(f.scene,f.renderer,[receipt(f.source)],options),depth=f.source.children[0] as T.Mesh;
 assert.equal(Reflect.apply(f.scene.onBeforeRender,f.scene,[f.renderer,f.scene,f.camera,null]),answer);
 assert.equal(depth.visible,false);assert.equal(handle.read().entries[0].status,'material-changed');f.renderer.info.render.frame++;
 mode='valid';assert.equal(Reflect.apply(f.scene.onBeforeRender,f.scene,[f.renderer,f.scene,f.camera,null]),answer);assert.equal(depth.visible,true);f.renderer.info.render.frame++;
 mode='throw';assert.throws(()=>Reflect.apply(f.scene.onBeforeRender,f.scene,[f.renderer,f.scene,f.camera,null]),error=>error===failure);
 assert.equal(depth.visible,false);assert.equal(handle.read().entries[0].status,'scene-before-threw');assert.equal(calls,3);
 handle.dispose();f.dispose();
});

test('nested scene-hook render gets its own upcoming stamp and outer view is approved after it returns',()=>{
 const f=fixture();f.handle.dispose();const inner=f.camera.clone();inner.updateMatrixWorld(true);let wrapper:T.Scene['onBeforeRender'],depth:T.Mesh,calls=0;
 f.scene.onBeforeRender=function(renderer,scene,camera){
  calls++;
  if(camera===f.camera){
   Reflect.apply(wrapper,this,[renderer,scene,inner,null]);f.renderer.info.render.frame++;
   assert.equal(depth.visible,true);Reflect.apply(depth.onBeforeRender,depth,[renderer,scene,inner,depth.geometry,depth.material,null]);assert(depth.geometry.drawRange.count>0);
   Reflect.apply(depth.onAfterRender,depth,[renderer,scene,inner,depth.geometry,depth.material,null]);
  }
 };
 const handle=preparePavementDepthPrepass(f.scene,f.renderer,[receipt(f.source)],options);wrapper=f.scene.onBeforeRender;depth=f.source.children[0] as T.Mesh;
 Reflect.apply(wrapper,f.scene,[f.renderer,f.scene,f.camera,null]);f.renderer.info.render.frame++;
 assert.equal(calls,2);assert.equal(f.renderer.info.render.frame,2);assert.equal(depth.visible,true);
 Reflect.apply(depth.onBeforeRender,depth,[f.renderer,f.scene,f.camera,depth.geometry,depth.material,null]);assert(depth.geometry.drawRange.count>0);
 // A nested render after outer collection invalidates that outer list's approval.
 Reflect.apply(wrapper,f.scene,[f.renderer,f.scene,inner,null]);f.renderer.info.render.frame++;
 Reflect.apply(depth.onBeforeRender,depth,[f.renderer,f.scene,f.camera,depth.geometry,depth.material,null]);assert.equal(depth.geometry.drawRange.count,0);assert.equal(depth.visible,false);
 handle.dispose();f.dispose();
});

test('a later shadow-phase mutation still reaches the full per-draw guard after successful preflight',()=>{
 const f=fixture();f.begin();assert.equal(f.depth!.visible,true);
 // Native shadow callbacks run after render-list collection. No prior approval
 // may substitute for re-reading the current source at its actual color draw.
 f.material.depthWrite=false;f.draw();assert.equal(f.depth!.geometry.drawRange.count,0);assert.equal(f.depth!.visible,false);
 assert.equal(f.handle.read().depthDrawAttempts,0);assert.equal(f.handle.read().entries[0].status,'material-changed');
 assert.equal(f.material.depthWrite,false,'the caller-owned source remains untouched');assert.deepEqual(f.source.geometry.drawRange,{start:0,count:Infinity});f.dispose();
});

test('preflight keeps independent eligible owners and cannot rearm a disposed private view',()=>{
 const f=fixture();f.handle.dispose();const data=part(),otherMaterial=new T.MeshStandardMaterial();finishAsphalt(otherMaterial);
 otherMaterial.name='Island asphalt';otherMaterial.userData.realisticSurface='asphalt';otherMaterial.userData.realisticProfile='asphalt|planar';
 const other=createPavementMesh(data.buffer,data.part,8,otherMaterial);f.scene.add(other);f.scene.updateMatrixWorld(true);
 const handle=preparePavementDepthPrepass(f.scene,f.renderer,[receipt(f.source),receipt(other)],options),one=f.source.children[0] as T.Mesh,two=other.children[0] as T.Mesh;
 f.material.transparent=true;Reflect.apply(f.scene.onBeforeRender,f.scene,[f.renderer,f.scene,f.camera,null]);f.renderer.info.render.frame++;
 assert.equal(one.visible,false);assert.equal(two.visible,true);assert.equal(handle.read().entries[0].status,'material-changed');assert.equal(handle.read().entries[1].status,'ready');
 Reflect.apply(two.onBeforeRender,two,[f.renderer,f.scene,f.camera,two.geometry,two.material,null]);assert(two.geometry.drawRange.count>0);
 Reflect.apply(two.onAfterRender,two,[f.renderer,f.scene,f.camera,two.geometry,two.material,null]);other.geometry.dispose();assert.equal(two.visible,false);
 Reflect.apply(f.scene.onBeforeRender,f.scene,[f.renderer,f.scene,f.camera,null]);f.renderer.info.render.frame++;
 assert.equal(two.visible,false);assert.equal(handle.read().entries[1].status,'disposed');assert.equal(other.children.length,0);
 handle.dispose();otherMaterial.dispose();f.dispose();
});

test('unsupported context, output, global clipping, target, override, log/reversed depth and ArrayCamera inputs fall back',()=>{
 const changes:((f:ReturnType<typeof fixture>)=>void)[]=[
  f=>{f.renderer.getRenderTarget=()=>new T.WebGLRenderTarget(4,4);},f=>{f.scene.overrideMaterial=new T.MeshBasicMaterial();},
  f=>{f.renderer.localClippingEnabled=true;},f=>{f.renderer.clippingPlanes.push(new T.Plane());},
  f=>{f.renderer.capabilities.logarithmicDepthBuffer=true;},f=>{f.renderer.capabilities.reversedDepthBuffer=true;},
  f=>{f.renderer.xr.isPresenting=true;},f=>{Object.defineProperty(f.camera,'reversedDepth',{value:true});},f=>{f.camera.coordinateSystem=T.WebGPUCoordinateSystem;},
 ];
 for(const change of changes){const f=fixture();f.begin();change(f);f.draw();assert.equal(f.depth!.geometry.drawRange.count,0);f.dispose();}
 const array=fixture();array.begin(new T.ArrayCamera([array.camera]));array.draw(array.camera);assert.equal(array.depth!.geometry.drawRange.count,0,'native passes child camera to mesh; top-level guard still rejects');array.dispose();
 for(const bad of ['stencil','depth','output'] as const){const f=fixture();f.handle.dispose();
  f.renderer.getContextAttributes=()=>({depth:bad!=='depth',stencil:bad==='stencil'} as WebGLContextAttributes);
  const handle=preparePavementDepthPrepass(f.scene,f.renderer,[receipt(f.source)],bad==='output'?{rendererOutput:{type:T.HalfFloatType,nodes:false}}:options);
  assert.equal(handle.read().prepared,0);handle.dispose();f.dispose();}
});

test('scene observation forwards once with exact this/args/result/throw and restores only its own descriptor',()=>{
 const f=fixture();f.handle.dispose();const returned={token:true},args:unknown[]=[],receiver:unknown[]=[];
 f.scene.onBeforeRender=function(...a){args.push(a);receiver.push(this);return returned;};
 const descriptor=Object.getOwnPropertyDescriptor(f.scene,'onBeforeRender');
 const handle=preparePavementDepthPrepass(f.scene,f.renderer,[receipt(f.source)],options),input=[f.renderer,f.scene,f.camera,null];
 assert.equal(Reflect.apply(f.scene.onBeforeRender,f.scene,input),returned);assert.deepEqual(args,[input]);assert.deepEqual(receiver,[f.scene]);
 handle.dispose();assert.deepEqual(Object.getOwnPropertyDescriptor(f.scene,'onBeforeRender'),descriptor);
 const thrown={token:'thrown'};let calls=0;f.scene.onBeforeRender=()=>{calls++;throw thrown;};
 const again=preparePavementDepthPrepass(f.scene,f.renderer,[receipt(f.source)],options);
 assert.throws(()=>Reflect.apply(f.scene.onBeforeRender,f.scene,input),error=>error===thrown);assert.equal(calls,1);
 const replacement=()=>{};f.scene.onBeforeRender=replacement;again.dispose();assert.equal(f.scene.onBeforeRender,replacement);f.dispose();
});

test('removed scene observation, nested frame and lost/restored context do not reuse stale permission',()=>{
 const f=fixture();f.begin();f.draw();assert.equal(f.handle.read().entries[0].status,'active');f.after();
 const hook=f.scene.onBeforeRender;f.scene.onBeforeRender=()=>{};f.begin();f.draw();assert.equal(f.depth!.geometry.drawRange.count,0);
 f.scene.onBeforeRender=hook;f.begin();f.renderer.info.render.frame++;f.draw();assert.equal(f.depth!.geometry.drawRange.count,0);
 f.begin();f.canvas.dispatchEvent(new Event('webglcontextlost'));f.draw();assert.equal(f.depth!.geometry.drawRange.count,0);
 f.canvas.dispatchEvent(new Event('webglcontextrestored'));f.begin();f.draw();assert(f.depth!.geometry.drawRange.count>0);assert.equal(f.contextCalls(),2);f.dispose();
});

test('native r185 disposal releases the view VAOs while retaining every source GPU attribute',()=>{
 const f=fixture(),removed:T.BufferAttribute[]=[],released:T.BufferGeometry[]=[],info={memory:{geometries:0}};
 const factory=WebGLGeometries as unknown as (...args:unknown[])=>{get:(object:T.Object3D,geometry:T.BufferGeometry)=>T.BufferGeometry};
 const native=factory({}, {remove:(attribute:T.BufferAttribute)=>removed.push(attribute)},info,{releaseStatesOfGeometry:(geometry:T.BufferGeometry)=>released.push(geometry)});
 const originalAttributes={...f.source.geometry.attributes},originalIndex=f.source.geometry.index,depthGeometry=f.depth!.geometry;
 native.get(f.source,f.source.geometry);native.get(f.depth!,depthGeometry);assert.equal(info.memory.geometries,2);
 f.handle.dispose();assert.equal(info.memory.geometries,1);assert.deepEqual(removed,[]);assert.deepEqual(released,[depthGeometry]);
 assert.deepEqual(f.source.geometry.attributes,originalAttributes);assert.equal(f.source.geometry.index,originalIndex);assert.equal(f.source.children.length,0);
 f.dispose();assert.equal(info.memory.geometries,0);assert.equal(removed.length,4);
});

test('disposing either source owner releases only the owned depth view, and disposal is idempotent',()=>{
 for(const which of ['geometry','material'] as const){const f=fixture();
  if(which==='geometry')f.source.geometry.dispose();else f.material.dispose();
  assert.equal(f.source.children.length,0);assert.equal(f.handle.read().entries[0].status,'disposed');f.handle.dispose();f.handle.dispose();f.dispose();}
});

test('the actual 759 asphalt factory, decorators and camera ranges activate without changing a color shader or callback',async t=>{
 const textures:T.Texture[]=[];const mocked=t.mock.method(T.TextureLoader.prototype,'loadAsync',async(url:string)=>{const texture=new T.Texture({width:1,height:1});texture.name=url;textures.push(texture);return texture;});
 await loadRealisticMaterials({capabilities:{getMaxAnisotropy:()=>8},initTexture:()=>{}} as unknown as T.WebGLRenderer);mocked.mock.restore();
 const meta=JSON.parse(readFileSync(new URL('../../public/belle/pavement.json',import.meta.url),'utf8')) as {stride:number;groups:PavementPart[]};
 const bytes=Uint8Array.from(readFileSync(new URL('../../public/belle/pavement.bin',import.meta.url))).buffer,asphalt=meta.groups.find(p=>p.kind==='asphalt')!;
 const scene=new T.Scene(),atmosphere=new WorldAtmosphere(scene,new T.Texture()),material=new T.MeshStandardMaterial({color:0x979b99});
 material.name='Island asphalt';finishAsphalt(material);const source=createPavementMesh(bytes,asphalt,meta.stride,material);scene.add(source);atmosphere.flush();
 applyRealisticMaterials(scene);applyPhotoReferenceSurfaces(scene);dressSunsetGround(scene);scene.updateMatrixWorld(true);
 const a=adapter(),final=source.material as T.MeshStandardMaterial,record=receipt(source),before=source.onBeforeRender,after=source.onAfterRender;
 const shader=()=>{const value={vertexShader:T.ShaderLib.standard.vertexShader,fragmentShader:T.ShaderLib.standard.fragmentShader,uniforms:{}} as Parameters<T.Material['onBeforeCompile']>[0];final.onBeforeCompile(value,a.renderer);return value;};
 const baseline=shader();assert(baseline.vertexShader.includes('asphaltXZ'));assert(baseline.fragmentShader.includes('skinGradient'));assert(baseline.fragmentShader.includes('repairAmount'));
 assert.equal(baseline.vertexShader.split('#include <project_vertex>').length,2);assert.equal(baseline.vertexShader.split('#include <begin_vertex>').length,2);
 assert(!/\bgl_Position\b|\btransformed\s*[+*/-]?=/.test(baseline.vertexShader),'audited wrappers only add varyings');
 assert(!/\bdiscard\b|\bgl_FragDepth\b/.test(baseline.fragmentShader),'authored fragment additions do not change coverage or depth');
 const handle=preparePavementDepthPrepass(scene,a.renderer,[record],options),depth=source.children[0] as T.Mesh;assert.equal(handle.read().prepared,1);
 let submitted=0,empty=0;
 for(const pose of [[60,8,1488,400,2,1300],[1300,9,1200,1800,2,250],[3200,12,0,1000,2,1000],[50000,10,50000,51000,10,50000]]){
  const camera=new T.PerspectiveCamera(60,1440/900,.08,22000);camera.position.set(pose[0],pose[1],pose[2]);camera.lookAt(pose[3],pose[4],pose[5]);camera.updateMatrixWorld(true);
  Reflect.apply(scene.onBeforeRender,scene,[a.renderer,scene,camera,null]);a.renderer.info.render.frame++;
  Reflect.apply(depth.onBeforeRender,depth,[a.renderer,scene,camera,depth.geometry,depth.material,null]);const expected={...depth.geometry.drawRange};
  assert.equal(handle.read().entries[0].status,'active');if(expected.count)submitted++;else empty++;
  assert.deepEqual(source.geometry.drawRange,{start:0,count:Infinity});
  Reflect.apply(before,source,[a.renderer,scene,camera,source.geometry,final,null]);assert.deepEqual(source.geometry.drawRange,expected);
  Reflect.apply(after,source,[a.renderer,scene,camera,source.geometry,final,null]);
 }
 assert(submitted>=3&&empty===1);assert.equal(source.onBeforeRender,before);assert.equal(source.onAfterRender,after);assert.equal(final.onBeforeCompile,record.compile);assert.equal(final.customProgramCacheKey,record.key);
 const candidate=shader();assert.equal(candidate.vertexShader,baseline.vertexShader);assert.equal(candidate.fragmentShader,baseline.fragmentShader);
 assert.equal(candidate.uniforms.belleCloudTime,baseline.uniforms.belleCloudTime);assert.equal(a.contextCalls(),1);
 handle.dispose();atmosphere.dispose();source.geometry.dispose();final.dispose();material.dispose();textures.forEach(texture=>texture.dispose());
});

test('the pinned native frame stamp is observed before increment and original mesh callbacks still bracket the native draw',()=>{
 const source=readFileSync(new URL('../../node_modules/three/src/renderers/WebGLRenderer.js',import.meta.url),'utf8');
 const observe=source.indexOf('scene.onBeforeRender( _this, scene, camera, _currentRenderTarget )'),advance=source.indexOf('this.info.render.frame ++;');
 const collect=source.indexOf('projectObject( scene, camera, 0, _this.sortObjects )',observe);
 assert(observe>=0&&collect>observe&&advance>collect);assert(source.indexOf('shadowMap.render( shadowsArray, scene, camera )')>advance);
 const project=source.slice(source.indexOf('function projectObject('),source.indexOf('function renderScene('));
 assert(project.indexOf('if ( object.visible === false ) return;')>=0);
 assert(project.indexOf('if ( object.visible === false ) return;')<project.indexOf('currentRenderList.push('),'native visibility rejection precedes list insertion');
 const start=source.indexOf('function renderObject( object, scene, camera, geometry, material, group )'),render=source.slice(start,source.indexOf('function getProgram',start));
 assert(render.indexOf('object.onBeforeRender')<render.indexOf('object.modelViewMatrix.multiplyMatrices'));
 assert(render.indexOf('object.onAfterRender')>render.lastIndexOf('_this.renderBufferDirect'));
});
