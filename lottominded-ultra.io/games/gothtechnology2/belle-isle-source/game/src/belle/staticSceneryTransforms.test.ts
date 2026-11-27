import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import * as T from 'three';
import {addStreetDetails} from './streetDetails.ts';
import {addGardens} from './gardens.ts';
import {addLakeHabitat} from './lakeHabitat.ts';
import type {StreetPlan} from './streetPlan.ts';

const publicRoot=new URL('../../public/',import.meta.url);
function fullStreetPlan():StreetPlan{
 const plan=JSON.parse(readFileSync(new URL('belle/street-details.json',publicRoot),'utf8'));
 const bytes=readFileSync(new URL('belle/street-details.bin',publicRoot));
 const data=new Float32Array(bytes.buffer,bytes.byteOffset,bytes.byteLength/4);
 plan.boxes=[];
 for(let i=0;i<data.length;i+=plan.stride)plan.boxes.push({x:data[i],y:data[i+1],z:data[i+2],w:data[i+3],h:data[i+4],l:data[i+5],yaw:data[i+6],material:plan.materials[data[i+7]],grade:data[i+8]});
 return plan;
}
async function fixtures(run:()=>void|Promise<void>){
 const oldDocument=Object.getOwnPropertyDescriptor(globalThis,'document'),oldFetch=globalThis.fetch;
 const context={fillRect(){},strokeRect(){},fillText(){},measureText(text:string){return{width:text.length*8};}};
 Object.defineProperty(globalThis,'document',{configurable:true,value:{createElement:(name:string)=>{assert.equal(name,'canvas');return{width:0,height:0,getContext:()=>context};}}});
 globalThis.fetch=async input=>{
  const path=typeof input==='string'?input:input instanceof URL?input.href:input.url;
  assert.match(path,/^\.\/belle\/nature\/(gardens|okonoka|heron)\.json(?:\?.*)?$/);
  return new Response(Uint8Array.from(readFileSync(new URL(path,publicRoot))).buffer);
 };
 try{await run();}finally{
  globalThis.fetch=oldFetch;
  if(oldDocument)Object.defineProperty(globalThis,'document',oldDocument);else Reflect.deleteProperty(globalThis,'document');
 }
}
function descendants(scene:T.Scene){const objects:T.Object3D[]=[];scene.traverse(object=>{if(object!==scene)objects.push(object);});return objects;}
function bytes(array:ArrayLike<number> & {buffer:ArrayBufferLike;byteOffset:number;byteLength:number}){
 return createHash('sha256').update(new Uint8Array(array.buffer,array.byteOffset,array.byteLength)).digest('hex');
}
function geometryState(geometry:T.BufferGeometry){
 return{index:geometry.index&&bytes(geometry.index.array),attributes:Object.entries(geometry.attributes).map(([name,attribute])=>{
  assert(attribute instanceof T.BufferAttribute,'These authored builders use native noninterleaved attributes');
  return[name,attribute.itemSize,attribute.normalized,attribute.count,bytes(attribute.array)];
 }),groups:geometry.groups,range:geometry.drawRange};
}
function materialState(material:T.Material){
 const m=material as T.MeshStandardMaterial,image=m.map?.image as {width:number;height:number}|undefined;
 return{name:m.name,color:m.color?.toArray(),roughness:m.roughness,metalness:m.metalness,side:m.side,transparent:m.transparent,
  opacity:m.opacity,alphaTest:m.alphaTest,depthWrite:m.depthWrite,vertexColors:m.vertexColors,toneMapped:m.toneMapped,
  map:m.map&&{width:image?.width,height:image?.height,colorSpace:m.map.colorSpace,anisotropy:m.map.anisotropy},key:m.customProgramCacheKey()};
}
function materials(object:T.Mesh){return Array.isArray(object.material)?object.material:[object.material];}
function compile(material:T.Material){
 const shader={uniforms:{},vertexShader:T.ShaderLib.standard.vertexShader,fragmentShader:T.ShaderLib.standard.fragmentShader} as Parameters<T.Material['onBeforeCompile']>[0];
 material.onBeforeCompile(shader,{} as T.WebGLRenderer);return shader;
}
function compareAuthoredData(original:T.Object3D[],cached:T.Object3D[]){
 assert.equal(cached.length,original.length);
 for(let i=0;i<original.length;i++){
  const a=original[i],b=cached[i];assert.equal(b.type,a.type);assert.equal(b.name,a.name);
  assert.equal(b.matrixAutoUpdate,false);assert.equal(b.matrixWorldAutoUpdate,true);
  assert.equal(a.matrixAutoUpdate,true);assert.equal(a.matrixWorldAutoUpdate,true);
  if(a instanceof T.Mesh&&b instanceof T.Mesh){
   assert.deepEqual(geometryState(b.geometry),geometryState(a.geometry));
   assert.deepEqual(materials(b).map(materialState),materials(a).map(materialState));
   for(let j=0;j<materials(a).length;j++){
    const x=compile(materials(a)[j]),y=compile(materials(b)[j]);
    assert.equal(y.vertexShader,x.vertexShader);assert.equal(y.fragmentShader,x.fragmentShader);
   }
  }
 }
}
function compareFrame(original:T.Object3D[],cached:T.Object3D[],camera:T.PerspectiveCamera){
 const frustum=new T.Frustum().setFromProjectionMatrix(new T.Matrix4().multiplyMatrices(camera.projectionMatrix,camera.matrixWorldInverse));
 for(let i=0;i<original.length;i++){
  const a=original[i],b=cached[i];
  assert.deepEqual(b.matrix.elements,a.matrix.elements);assert.deepEqual(b.matrixWorld.elements,a.matrixWorld.elements);
  assert.equal(b.visible,a.visible);assert.equal(b.layers.mask,a.layers.mask);assert.equal(b.castShadow,a.castShadow);assert.equal(b.receiveShadow,a.receiveShadow);assert.equal(b.renderOrder,a.renderOrder);
  if(a instanceof T.Mesh&&b instanceof T.Mesh){
   assert.equal(b.frustumCulled,a.frustumCulled);assert.equal(frustum.intersectsObject(b),frustum.intersectsObject(a));
   const originalView=new T.Matrix4().multiplyMatrices(camera.matrixWorldInverse,a.matrixWorld),cachedView=new T.Matrix4().multiplyMatrices(camera.matrixWorldInverse,b.matrixWorld);
   assert.deepEqual(cachedView.elements,originalView.elements);
   assert.deepEqual(new T.Matrix3().getNormalMatrix(cachedView).elements,new T.Matrix3().getNormalMatrix(originalView).elements);
   if(a instanceof T.InstancedMesh&&b instanceof T.InstancedMesh){
    assert.equal(b.count,a.count);assert.equal(bytes(b.instanceMatrix.array),bytes(a.instanceMatrix.array));
    assert.equal(b.instanceColor&&bytes(b.instanceColor.array),a.instanceColor&&bytes(a.instanceColor.array));
   }
  }
 }
}
function compareAuthoredRay(original:T.Object3D[],cached:T.Object3D[]){
 const index=original.findIndex(o=>o instanceof T.Mesh&&o.geometry.attributes.position.count>=3&&(!(o instanceof T.InstancedMesh)||o.count>0));
 assert(index>=0);const a=original[index] as T.Mesh,b=cached[index] as T.Mesh,geometry=a.geometry;
 const transform=a.matrixWorld.clone();
 if(a instanceof T.InstancedMesh){const instance=new T.Matrix4();a.getMatrixAt(0,instance);transform.multiply(instance);}
 const vertices=[0,1,2].map(i=>new T.Vector3().fromBufferAttribute(geometry.attributes.position,geometry.index?.getX(i)??i).applyMatrix4(transform));
 const normal=vertices[1].clone().sub(vertices[0]).cross(vertices[2].clone().sub(vertices[0])).normalize();assert(normal.lengthSq()>.99);
 const center=vertices[0].clone().add(vertices[1]).add(vertices[2]).multiplyScalar(1/3),ray=new T.Raycaster(center.clone().addScaledVector(normal,3),normal.clone().negate(),0,6);
 const state=(object:T.Mesh)=>ray.intersectObject(object,false).map(hit=>({distance:hit.distance,point:hit.point.toArray(),faceIndex:hit.faceIndex,instanceId:hit.instanceId}));
 const expected=state(a);assert(expected.length>0,'The unchanged authored mesh must actually be hit');assert.deepEqual(state(b),expected);
}
function parentPose(scene:T.Scene,step:number){
 scene.position.set(step*11,-step*.3,step*-7);scene.rotation.set(step*.03,step*.07,-step*.02);scene.scale.set(1+step*.04,1-step*.03,1+step*.06);
}
function frame(originalScene:T.Scene,cachedScene:T.Scene,original:T.Object3D[],cached:T.Object3D[],step:number){
 parentPose(originalScene,step);parentPose(cachedScene,step);
 const compose=T.Matrix4.prototype.compose,multiply=T.Matrix4.prototype.multiplyMatrices;
 const originalLocal=new Set(original.map(o=>o.matrix)),cachedLocal=new Set(cached.map(o=>o.matrix));
 const originalWorld=new Set(original.map(o=>o.matrixWorld)),cachedWorld=new Set(cached.map(o=>o.matrixWorld));
 const counts={originalCompose:0,cachedCompose:0,originalMultiply:0,cachedMultiply:0};
 T.Matrix4.prototype.compose=function(...args){if(originalLocal.has(this))counts.originalCompose++;if(cachedLocal.has(this))counts.cachedCompose++;return compose.apply(this,args);};
 T.Matrix4.prototype.multiplyMatrices=function(...args){if(originalWorld.has(this))counts.originalMultiply++;if(cachedWorld.has(this))counts.cachedMultiply++;return multiply.apply(this,args);};
 try{originalScene.updateMatrixWorld(true);cachedScene.updateMatrixWorld(true);}finally{T.Matrix4.prototype.compose=compose;T.Matrix4.prototype.multiplyMatrices=multiply;}
 assert.equal(counts.originalCompose,original.length);assert.equal(counts.cachedCompose,0);
 assert.equal(counts.cachedMultiply,counts.originalMultiply);assert.equal(counts.originalMultiply,original.length,'Native world propagation stays active');
 const camera=new T.PerspectiveCamera(58,1440/900,.1,10000);
 camera.position.set(-200+step*630,10+step*7,250+step*310);camera.lookAt(1200,2,1200);camera.updateMatrixWorld(true);
 compareFrame(original,cached,camera);compareAuthoredRay(original,cached);return counts;
}
function dispose(scene:T.Scene){
 const geometries=new Set<T.BufferGeometry>(),allMaterials=new Set<T.Material>();
 scene.traverse(o=>{if(o instanceof T.Mesh){geometries.add(o.geometry);materials(o).forEach(m=>allMaterials.add(m));}});
 geometries.forEach(g=>g.dispose());allMaterials.forEach(m=>{(m as T.MeshStandardMaterial).map?.dispose();m.dispose();});
}

test('all 432 actual street objects preserve data, culling and parent movement without local recomposition',async t=>{
 await fixtures(()=>{
  const scenes=[new T.Scene(),new T.Scene()],plan=fullStreetPlan(),original=addStreetDetails(scenes[0],plan),cached=addStreetDetails(scenes[1],plan);
  try{
   const a=descendants(scenes[0]),b=descendants(scenes[1]);a.forEach(o=>o.matrixAutoUpdate=true);
   assert.equal(a.length,432);compareAuthoredData(a,b);
   for(const [step,[x,z]]of [[0,0],[350,650],[1080,1220],[3000,1800],[128,128]].entries()){
    original.update(x,z);cached.update(x,z);const count=frame(scenes[0],scenes[1],a,b,step);
    if(step===0)t.diagnostic(JSON.stringify({objects:a.length,...count}));
   }
   assert.deepEqual(cached.batchSources().map(o=>o.name),original.batchSources().map(o=>o.name));
  }finally{scenes.forEach(dispose);}
 });
});

test('actual garden quality, seasonal wind and count changes retain identical transforms and instance data',async t=>{
 await fixtures(async()=>{
  const scenes=[new T.Scene(),new T.Scene()],original=await addGardens(scenes[0]),cached=await addGardens(scenes[1]);
  try{
   const a=descendants(scenes[0]),b=descendants(scenes[1]);a.forEach(o=>o.matrixAutoUpdate=true);
   assert.equal(a.length,74);compareAuthoredData(a,b);assert.deepEqual(cached.stats,original.stats);
   let step=0,windObserved=false,countChanged=false;
   for(const quality of ['high','smooth','automatic'])for(const [x,z]of [[1080,1228],[1200,1228],[0,0]]){
    original.setQuality(quality);cached.setQuality(quality);original.update(x,z);cached.update(x,z);original.animate(step*1.7);cached.animate(step*1.7);
    const count=frame(scenes[0],scenes[1],a,b,step);if(step===0)t.diagnostic(JSON.stringify({objects:a.length,...count}));
    for(let i=0;i<a.length;i++){
     const x=a[i] as T.InstancedMesh,y=b[i] as T.InstancedMesh;
     countChanged||=x.count<x.instanceMatrix.count;
     const p=compile(materials(x)[0]),q=compile(materials(y)[0]);
     assert.equal(p.uniforms.gardenTime.value,step*1.7);assert.equal(q.uniforms.gardenTime.value,p.uniforms.gardenTime.value);
     windObserved||=p.uniforms.gardenTime.value>0;
    }
    step++;
   }
   assert(windObserved);assert(countChanged,'The real distant-instance count path executed');
  }finally{scenes.forEach(dispose);}
 });
});

test('actual lake tiles preserve all authored instance transforms while moving ancestors and toggling culling',async t=>{
 await fixtures(async()=>{
  const scenes=[new T.Scene(),new T.Scene()],original=await addLakeHabitat(scenes[0]),cached=await addLakeHabitat(scenes[1]);
  try{
   const a=descendants(scenes[0]),b=descendants(scenes[1]);a.forEach(o=>o.matrixAutoUpdate=true);
   assert.equal(scenes[0].children.length,42);assert(a.length>120);compareAuthoredData(a,b);assert.deepEqual(cached.stats,original.stats);
   for(const [step,[x,z]]of [[0,0],[3000,1000],[4200,-200],[2500,400]].entries()){
    original.update(x,z);cached.update(x,z);const count=frame(scenes[0],scenes[1],a,b,step);
    if(step===0)t.diagnostic(JSON.stringify({objects:a.length,...count}));
   }
  }finally{scenes.forEach(dispose);}
 });
});
