import test from 'node:test';
import assert from 'node:assert/strict';
import * as T from 'three';
import type {TypedArray} from 'three';
import {LocalTreeBoundsCache} from './localTreeBoundsCache.ts';
import {FarTreeVisibility} from './farTreeVisibility.ts';
import {NatureRenderProbe} from './renderDiagnostics.ts';

const bytes=(array:TypedArray)=>new Uint8Array(array.buffer,array.byteOffset,array.byteLength).slice();
const sphereBytes=(sphere:T.Sphere|null)=>sphere?bytes(new Float64Array([sphere.center.x,sphere.center.y,sphere.center.z,sphere.radius])):null;
const matrix=(id:number,part=0)=>new T.Matrix4().makeRotationY(id*.17).scale(new T.Vector3(1+part*.15,1+id*.03,1)).setPosition(12+id*17,1+part,id%2?40+id*9:-40-id*13);

test('local cache requires exact matrix bits and preserves source offsets and signed-zero sphere values',()=>{
 const cache=new LocalTreeBoundsCache(3),storage=new Float32Array(40),source=new Float32Array(storage.buffer,16,32);
 source.set(matrix(1).elements);source.set(matrix(2).elements,16);
 const base=new T.Sphere(new T.Vector3(0,3,0),4),result=new T.Sphere(new T.Vector3(-0,7,11),-0),target=new T.Sphere();
 cache.prepare(base,source);assert.equal(cache.restore(2,16,target),false);
 cache.remember(2,16,result);assert.equal(cache.restore(2,16,target),true);assert.deepEqual(sphereBytes(target),sphereBytes(result));
 assert.equal(cache.restore(2,0,target),false,'another source row cannot reuse a hint alone');
 source[16+1]=-0;assert.equal(cache.restore(2,16,target),false,'all matrix bits distinguish signed zero');
 source[16+1]=0;assert.equal(cache.restore(2,16,target),true);
 source[16+12]+=1;assert.equal(cache.restore(2,16,target),false,'same source ID with changed transform is a miss');
});

test('fixed storage rejects malformed hints, incomplete matrix spans and unsupported arrays',()=>{
 const cache=new LocalTreeBoundsCache(2),source=new Float32Array(matrix(1).elements),base=new T.Sphere(new T.Vector3(1,2,3),4),result=base.clone();
 cache.prepare(base,source);cache.remember(0,0,result);
 for(const id of [undefined,-1,2,100,1.5,NaN,Infinity,-Infinity]){
  assert.equal(cache.restore(id,0,result),false);cache.remember(id,0,result);
 }
 for(const offset of [-1,1,15,16,1.5,NaN,Infinity]){
  assert.equal(cache.restore(0,offset,result),false);cache.remember(0,offset,result);
 }
 cache.prepare(base,source.subarray(0,15));assert.equal(cache.restore(0,0,result),false);
 for(const unsupported of [new Float64Array(source),new Int32Array(source)]){
  cache.prepare(base,unsupported);assert.equal(cache.restore(0,0,result),false);cache.remember(0,0,result);
 }
 cache.prepare(base,source);assert.equal(cache.restore(0,0,result),true,'unchanged valid bits remain usable after unsupported snapshots');
 const internal=cache as unknown as {matrices:Uint32Array;spheres:Float64Array;valid:Uint8Array};
 assert.deepEqual([internal.matrices.length,internal.spheres.length,internal.valid.length],[32,8,2]);
});

test('base changes invalidate all prior sphere results including signed-zero changes and restoration',()=>{
 const cache=new LocalTreeBoundsCache(2),source=new Float32Array(matrix(1).elements),base=new T.Sphere(new T.Vector3(0,3,0),4),result=new T.Sphere(new T.Vector3(12,4,-40),5);
 cache.prepare(base,source);cache.remember(0,0,result);assert.equal(cache.restore(0,0,result),true);
 base.center.x=-0;cache.prepare(base,source);assert.equal(cache.restore(0,0,result),false);
 cache.remember(0,0,result);base.center.x=0;cache.prepare(base,source);assert.equal(cache.restore(0,0,result),false);
 for(const radius of [NaN,Infinity,-1]){
  base.radius=radius;cache.prepare(base,source);cache.remember(0,0,result);assert.equal(cache.restore(0,0,result),false);
 }
 base.radius=4;cache.prepare(base,source);assert.equal(cache.restore(0,0,result),false);
 for(const value of [NaN,Infinity,-Infinity]){
  result.center.x=value;cache.remember(0,0,result);assert.equal(cache.restore(0,0,result),false);
 }
});

type PartState={base:T.Sphere;mesh:T.InstancedMesh;world:Float64Array;streams:{attribute:T.BufferAttribute;source:TypedArray}[]};
type HelperState={parts:PartState[];ready:boolean;count:number;shown:number;indices:Uint32Array;bounds:Float64Array};
const state=(helper:FarTreeVisibility)=>helper as unknown as HelperState;
const attributes=(mesh:T.InstancedMesh)=>[mesh.instanceMatrix,...(mesh.instanceColor?[mesh.instanceColor]:[]),...Object.values(mesh.geometry.attributes).filter(attribute=>(attribute as T.InstancedBufferAttribute).isInstancedBufferAttribute)] as T.BufferAttribute[];
function fixture(capacity=6){
 const probe=new NatureRenderProbe(()=>0);
 const meshes=[new T.BoxGeometry(1,6,1).translate(0,3,0),new T.BoxGeometry(6,6,6).translate(-.25,8,.9)].map(geometry=>{
  const mesh=new T.InstancedMesh(geometry,new T.MeshBasicMaterial({side:T.DoubleSide}),capacity);
  mesh.castShadow=false;mesh.frustumCulled=false;mesh.count=0;
  geometry.setAttribute('lodWeight',new T.InstancedBufferAttribute(new Float32Array(capacity),1));
  geometry.setAttribute('canopyDensity',new T.InstancedBufferAttribute(new Float32Array(capacity),1));
  geometry.setAttribute('sourceId',new T.InstancedBufferAttribute(new Uint32Array(capacity),1));
  mesh.updateMatrixWorld(true);return mesh;
 });
 return {helper:new FarTreeVisibility(meshes,probe),meshes,probe};
}
type Fixture=ReturnType<typeof fixture>;
function fill(f:Fixture,ids:number[],makeMatrix:(id:number,part:number)=>T.Matrix4=matrix){
 for(const [part,mesh]of f.meshes.entries()){
  mesh.count=ids.length;
  ids.forEach((id,i)=>{
   mesh.setMatrixAt(i,makeMatrix(id,part));mesh.setColorAt(i,new T.Color(.2+id*.03,.3+part*.07,.4));
   mesh.geometry.getAttribute('lodWeight').setX(i,(id%5)/4);
   mesh.geometry.getAttribute('canopyDensity').setX(i,(id%3)/2);
   mesh.geometry.getAttribute('sourceId').setX(i,id);
  });
  for(const attribute of attributes(mesh))attribute.needsUpdate=true;
 }
}
function snapshot(f:Fixture){
 const s=state(f.helper);
 return {ready:s.ready,count:s.count,shown:s.shown,indices:bytes(s.indices),bounds:bytes(s.bounds),parts:s.parts.map(part=>({
  world:bytes(part.world),count:part.mesh.count,sphere:sphereBytes(part.mesh.boundingSphere),
  attributes:attributes(part.mesh).map(attribute=>({bytes:bytes(attribute.array),version:attribute.version,ranges:attribute.updateRanges.map(range=>({...range}))})),
  streams:part.streams.map(stream=>bytes(stream.source)),
 }))};
}
function same(a:Fixture,b:Fixture){assert.deepEqual(snapshot(b),snapshot(a));}
function view(reverse=false){const c=new T.PerspectiveCamera(60,1.5,.1,2000);c.position.set(10,4,0);c.lookAt(10,4,reverse?100:-100);c.updateMatrixWorld(true);return c;}
function capture(a:Fixture,b:Fixture,hints?:ArrayLike<number>){
 a.probe.beginFrame(true);b.probe.beginFrame(true);a.helper.capture();b.helper.capture(hints);same(a,b);
}
function render(a:Fixture,b:Fixture,camera:T.Camera=view()){
 a.helper.render(camera);b.helper.render(camera);same(a,b);
}
function counters(a:Fixture,b:Fixture){assert.deepEqual(b.probe.finishFrame(),a.probe.finishFrame());}

test('hinted capture matches the original miss path across repeats, reorders, subsets, empty captures and views',()=>{
 const a=fixture(),b=fixture();
 for(const ids of [[0,1,2,3],[0,1,2,3],[3,0,2],[2],[],[1,5,4,0]]){
  fill(a,ids);fill(b,ids);capture(a,b,ids);render(a,b);render(a,b,view(true));render(a,b);counters(a,b);
 }
 const ray=new T.Raycaster(new T.Vector3(12,4,0),new T.Vector3(0,0,-1));
 const hits=(f:Fixture)=>ray.intersectObject(f.meshes[0],false).map(hit=>[hit.distance,hit.instanceId,hit.faceIndex,hit.point.x,hit.point.y,hit.point.z]);
 assert.deepEqual(hits(b),hits(a));assert(hits(b).length>0,'source-wide photo bounds retain the front trunk');
});

test('wrong, duplicate, missing and invalid hints preserve outputs when source matrices change',()=>{
 const a=fixture(),b=fixture();
 const hints:(ArrayLike<number>|undefined)[]=[[0,1,2],[0,0,0],[2,1,0],undefined,[0],[-1,NaN,Infinity],[6,1.5,-Infinity],new Uint32Array([0,1,2,0xffffffff,0xffffffff,0xffffffff]),{length:Infinity,0:0,1:1,2:2}];
 for(const [round,ids]of hints.entries()){
  const make=(id:number,part:number)=>matrix(id+round,part);
  fill(a,[0,1,2],make);fill(b,[0,1,2],make);capture(a,b,ids);render(a,b);counters(a,b);
 }
});

test('mutated bases, zero centres and non-finite transforms preserve fallback state after cache warmup',()=>{
 const a=fixture(),b=fixture();
 for(const f of [a,b])fill(f,[0,1]);capture(a,b,[0,1]);render(a,b);counters(a,b);
 const cases=[0,-0,2**-149,-(2**-149),NaN,Infinity,-Infinity,3.4028234663852886e38];
 for(const value of cases){
  const make=(id:number,part:number)=>{const m=matrix(id,part);if(id===1)m.elements[12]=value;return m;};
  for(const f of [a,b])fill(f,[0,1],make);capture(a,b,[0,1]);render(a,b);counters(a,b);
 }
 for(const x of [-0,0,23,NaN,Infinity,0]){
  for(const f of [a,b]){fill(f,[0,1]);state(f.helper).parts[1].base.center.x=x;}
  capture(a,b,[0,1]);render(a,b);counters(a,b);
 }
 for(const sign of [0,-0]){
  const make=()=>{const m=new T.Matrix4();m.elements.fill(sign);m.elements[15]=1;return m;};
  for(const f of [a,b]){fill(f,[0],make);for(const part of state(f.helper).parts)part.base.set(new T.Vector3(1,1,1),0);}
  capture(a,b,[0]);render(a,b);counters(a,b);
 }
});

test('attribute replacement, capacity growth and malformed late streams retain exact partial capture state',()=>{
 const a=fixture(),b=fixture();
 for(const f of [a,b])fill(f,[0,1,2]);capture(a,b,[0,1,2]);render(a,b);counters(a,b);
 for(const f of [a,b]){
  fill(f,[2,1,0]);f.meshes[1].geometry.setAttribute('bad',new T.InstancedBufferAttribute(new Float32Array(1),1));
 }
 capture(a,b,[2,1,0]);assert.equal(state(b.helper).ready,false);render(a,b);counters(a,b);
 for(const f of [a,b])f.meshes[1].geometry.deleteAttribute('bad');
 for(const useFloat64 of [true,false]){
  for(const f of [a,b])for(const mesh of f.meshes){
   mesh.instanceMatrix=new T.InstancedBufferAttribute(useFloat64?new Float64Array(8*16):new Float32Array(8*16),16);
  }
  for(const f of [a,b])fill(f,[7,6,1]);capture(a,b,[7,6,1]);render(a,b);counters(a,b);
 }
});

test('parent changes, opposing and XR views and layer filtering preserve hinted capture state',()=>{
 const a=fixture(),b=fixture();
 const parents=[new T.Matrix4(),new T.Matrix4().makeTranslation(30,2,15),new T.Matrix4().set(-1,.3,0,3170,0,1,.1,0,0,0,1,245,0,0,0,1),new T.Matrix4()];
 for(const parent of parents){
  for(const f of [a,b]){fill(f,[0,1,2]);f.meshes[1].matrixWorld.copy(parent);}
  capture(a,b,[0,1,2]);render(a,b);render(a,b,view(true));render(a,b,new T.ArrayCamera([view(),view(true)]));
  const layered=view();layered.layers.set(3);render(a,b,layered);
  for(const f of [a,b])f.meshes[0].matrixWorld.makeTranslation(-12,3,0);
  render(a,b);counters(a,b);
 }
});
