import test from 'node:test';
import assert from 'node:assert/strict';
import * as T from 'three';
import type {TypedArray} from 'three';
import {FarTreeVisibility} from './farTreeVisibility.ts';
import {NatureRenderProbe} from './renderDiagnostics.ts';

// Portable frozen capture/bounds oracle from candidate 3 (16d42322), source
// SHA-256 01e37a3e7969e7a1ae6cd8bf7250fd0a5568c5c9b062fb4c9b82a4a4fe5f8cf8.
// Its original arithmetic and traversal order make byte-level signed-zero,
// inactive-tail and partial-failure comparisons possible without local Git.
// It deliberately always computes world bounds separately from photo bounds.
type Stream={attribute:T.BufferAttribute;source:TypedArray};
type Part={mesh:T.InstancedMesh;base:T.Sphere;streams:Stream[];saved:Map<T.BufferAttribute,Stream>;matrix:Stream|undefined;world:Float64Array};
type State={parts:Part[];renderProbe?:NatureRenderProbe;ready:boolean;count:number;shown:number;indices:Uint32Array;bounds:Float64Array;matrix:T.Matrix4;combined:T.Matrix4;sphere:T.Sphere;union:T.Sphere;updateBounds:()=>void};
const FLOAT32_EPSILON=2**-23;

function finiteMatrix(matrix:T.Matrix4){return matrix.elements.every(Number.isFinite);}
function affine(matrix:T.Matrix4){const e=matrix.elements;return finiteMatrix(matrix)&&e[3]===0&&e[7]===0&&e[11]===0&&e[15]===1;}
function finiteSphere(sphere:T.Sphere){return Number.isFinite(sphere.center.x)&&Number.isFinite(sphere.center.y)&&Number.isFinite(sphere.center.z)&&Number.isFinite(sphere.radius)&&sphere.radius>=0;}

/** sqrt(||A||1 * ||A||infinity) bounds the largest linear stretch, including
 * shear. Matrix4.getMaxScaleOnAxis alone is not conservative for sheared parents.
 * Use the stored instance floats, plus a coordinate-scaled float32 margin for
 * the GPU's matrix arithmetic and clip-plane edge rounding. These tree shaders
 * change fragment tint/discard only; they do not displace vertices.
 */
function transformedSphere(source:T.Sphere,matrix:T.Matrix4,target:T.Sphere,intermediateMagnitude=0){
 if(!finiteSphere(source)||!affine(matrix))return false;
 const e=matrix.elements,a=Math.abs;
 const columns=Math.max(a(e[0])+a(e[1])+a(e[2]),a(e[4])+a(e[5])+a(e[6]),a(e[8])+a(e[9])+a(e[10]));
 const rows=Math.max(a(e[0])+a(e[4])+a(e[8]),a(e[1])+a(e[5])+a(e[9]),a(e[2])+a(e[6])+a(e[10]));
 target.center.copy(source.center).applyMatrix4(matrix);
 target.radius=source.radius*Math.sqrt(columns*rows);
 const x=a(source.center.x)+source.radius,y=a(source.center.y)+source.radius,z=a(source.center.z)+source.radius;
 const magnitude=Math.max(a(e[0])*x+a(e[4])*y+a(e[8])*z+a(e[12]),a(e[1])*x+a(e[5])*y+a(e[9])*z+a(e[13]),a(e[2])*x+a(e[6])*y+a(e[10])*z+a(e[14]),intermediateMagnitude);
 target.radius+=Math.max(.02,16*FLOAT32_EPSILON*(magnitude+target.radius+1));
 return finiteSphere(target);
}

function transformMagnitude(source:T.Sphere,instance:T.Matrix4,world:T.Matrix4){
 const a=Math.abs,e=instance.elements,w=world.elements;
 const x=a(source.center.x)+source.radius,y=a(source.center.y)+source.radius,z=a(source.center.z)+source.radius;
 const ix=a(e[0])*x+a(e[4])*y+a(e[8])*z+a(e[12]);
 const iy=a(e[1])*x+a(e[5])*y+a(e[9])*z+a(e[13]);
 const iz=a(e[2])*x+a(e[6])*y+a(e[10])*z+a(e[14]);
 // Absolute sums retain the precision budget when a parent and instance have
 // large opposing translations that cancel in their double-precision product.
 return Math.max(a(w[0])*ix+a(w[4])*iy+a(w[8])*iz+a(w[12]),a(w[1])*ix+a(w[5])*iy+a(w[9])*iz+a(w[13]),a(w[2])*ix+a(w[6])*iy+a(w[10])*iz+a(w[14]));
}

function referenceCapture(state:State){
  state.ready=false;
  const count=state.parts[0]?.mesh.count??0;
  if(!Number.isSafeInteger(count)||count<0||state.parts.some(({mesh})=>mesh.count!==count||mesh.castShadow||mesh.morphTexture))return;
  if(state.indices.length<count){state.indices=new Uint32Array(count);state.bounds=new Float64Array(count*4);}
  for(const part of state.parts){
   const {mesh}=part;part.streams.length=0;
   const attributes=[mesh.instanceMatrix,...(mesh.instanceColor?[mesh.instanceColor]:[]),...Object.values(mesh.geometry.attributes).filter(attribute=>(attribute as T.InstancedBufferAttribute).isInstancedBufferAttribute)];
   for(const attribute of attributes){
    if(!(attribute instanceof T.BufferAttribute)||attribute.count<count||(attribute as T.InstancedBufferAttribute).meshPerAttribute!==1)return;
    let stream=part.saved.get(attribute);
    if(!stream||stream.source.length!==attribute.array.length){stream={attribute,source:attribute.array.slice()};part.saved.set(attribute,stream);}
    else stream.source.set(attribute.array);
    // Three's first bufferData upload does not consume updateRanges. A later
    // full source rewrite must replace any earlier compact-prefix range even
    // when the new view keeps every source and render() makes no further edit.
    attribute.clearUpdateRanges();
    if(count)attribute.addUpdateRange(0,count*attribute.itemSize);
    attribute.needsUpdate=true;
    if(state.renderProbe?.active)state.renderProbe.marked('capture',count?count*attribute.itemSize*attribute.array.BYTES_PER_ELEMENT:attribute.array.byteLength);
    part.streams.push(stream);
    if(attribute===mesh.instanceMatrix)part.matrix=stream;
   }
   if(!part.matrix)return;
   // Photo-subject raycasts use this same mesh after the world render. Keep its
   // broad-phase sphere over ALL selected sources, not just the first view.
   state.union.makeEmpty();let valid=true;
   for(let i=0;i<count;i++){
    state.matrix.fromArray(part.matrix.source,i*16);
    if(!transformedSphere(part.base,state.matrix,state.sphere)){valid=false;break;}
    state.union.union(state.sphere);
   }
   if(!mesh.boundingSphere)mesh.boundingSphere=new T.Sphere();
   if(valid)mesh.boundingSphere.copy(state.union);
   else mesh.boundingSphere.set(new T.Vector3(),Infinity);
  }
  state.count=state.shown=count;
  for(let i=0;i<count;i++)state.indices[i]=i;
  state.ready=true;referenceUpdateBounds(state);
}
function referenceUpdateBounds(state:State){
  for(const part of state.parts)part.world.set(part.mesh.matrixWorld.elements);
  for(let i=0;i<state.count;i++){
   state.union.makeEmpty();let valid=true;
   for(const part of state.parts){
    state.matrix.fromArray(part.matrix!.source,i*16);
    state.combined.multiplyMatrices(part.mesh.matrixWorld,state.matrix);
    if(!transformedSphere(part.base,state.combined,state.sphere,transformMagnitude(part.base,state.matrix,part.mesh.matrixWorld))){valid=false;break;}
    state.union.union(state.sphere);
   }
   const j=i*4;
   state.bounds[j]=state.union.center.x;state.bounds[j+1]=state.union.center.y;state.bounds[j+2]=state.union.center.z;
   // A malformed bound or transform retains this source instance.
   state.bounds[j+3]=valid?state.union.radius:Infinity;
  }
}

const state=(helper:FarTreeVisibility)=>helper as unknown as State;
const bytes=(array:TypedArray)=>new Uint8Array(array.buffer,array.byteOffset,array.byteLength);
const sphereValues=(sphere:T.Sphere|null)=>sphere?[sphere.center.x,sphere.center.y,sphere.center.z,sphere.radius]:null;
const attributes=(mesh:T.InstancedMesh)=>[mesh.instanceMatrix,...(mesh.instanceColor?[mesh.instanceColor]:[]),...Object.values(mesh.geometry.attributes).filter(a=>(a as T.InstancedBufferAttribute).isInstancedBufferAttribute)] as T.BufferAttribute[];
function fixture(reference=false){
 const probe=new NatureRenderProbe(()=>0);
 const meshes=[new T.BoxGeometry(1,6,1).translate(0,3,0),new T.BoxGeometry(6,6,6).translate(-.25,8,.9)].map(geometry=>{
  const mesh=new T.InstancedMesh(geometry,new T.MeshBasicMaterial({side:T.DoubleSide}),6);
  mesh.castShadow=false;mesh.frustumCulled=false;mesh.count=0;
  geometry.setAttribute('lodWeight',new T.InstancedBufferAttribute(new Float32Array(6),1));
  geometry.setAttribute('canopyDensity',new T.InstancedBufferAttribute(new Float32Array(6).fill(1),1));
  geometry.setAttribute('id',new T.InstancedBufferAttribute(new Uint32Array(6),1));mesh.updateMatrixWorld(true);return mesh;
 });
 const helper=new FarTreeVisibility(meshes,probe);let fallbacks=0;
 const update=state(helper).updateBounds.bind(helper);state(helper).updateBounds=()=>{fallbacks++;update();};
 if(reference)helper.capture=()=>referenceCapture(state(helper));
 return{helper,meshes,probe,get fallbacks(){return fallbacks;}};
}
type Fixture=ReturnType<typeof fixture>;
function fill(f:Fixture,matrices:T.Matrix4[],season=0){
 for(const mesh of f.meshes){
  mesh.count=matrices.length;
  matrices.forEach((matrix,i)=>{mesh.setMatrixAt(i,matrix);mesh.setColorAt(i,new T.Color(.2+i*.11,.3+season*.01,.4));mesh.geometry.getAttribute('lodWeight').setX(i,.1+i*.13);mesh.geometry.getAttribute('canopyDensity').setX(i,season===1?0:.5+i*.03);mesh.geometry.getAttribute('id').setX(i,i);});
  for(const attribute of attributes(mesh))attribute.needsUpdate=true;
 }
}
function same(a:Fixture,b:Fixture,label:string){
 const x=state(a.helper),y=state(b.helper);
 assert.deepEqual([y.count,y.shown,y.ready],[x.count,x.shown,x.ready],label+' lifecycle');
 assert.deepEqual(bytes(y.bounds),bytes(x.bounds),label+' full bounds including inactive tail');
 assert.deepEqual(bytes(y.indices),bytes(x.indices),label+' selected order');
 for(let p=0;p<x.parts.length;p++){
  const u=x.parts[p],v=y.parts[p];assert.deepEqual(bytes(v.world),bytes(u.world),label+' parent stamp');assert.equal(v.mesh.count,u.mesh.count,label+' mesh count');
  assert.deepEqual(sphereValues(v.mesh.boundingSphere),sphereValues(u.mesh.boundingSphere),label+' source photo sphere');
  const ua=attributes(u.mesh),va=attributes(v.mesh);assert.equal(va.length,ua.length);
  for(let i=0;i<ua.length;i++){assert.deepEqual(bytes(va[i].array),bytes(ua[i].array),label+' full attribute bytes');assert.equal(va[i].version,ua[i].version,label+' version');assert.deepEqual(va[i].updateRanges,ua[i].updateRanges,label+' upload ranges');}
  assert.equal(v.streams.length,u.streams.length);
  for(let i=0;i<u.streams.length;i++)assert.deepEqual(bytes(v.streams[i].source),bytes(u.streams[i].source),label+' source snapshots');
 }
}
function captureBoth(a:Fixture,b:Fixture){for(const f of [a,b]){f.probe.beginFrame(true);f.helper.capture();}}
function counters(a:Fixture,b:Fixture){assert.deepEqual(b.probe.finishFrame(),a.probe.finishFrame(),'diagnostic counts and marked bytes');}
const translation=(x:number,z:number,y=1)=>new T.Matrix4().makeTranslation(x,y,z);
function camera(reverse=false){const c=new T.PerspectiveCamera(60,1.5,.1,2000);c.position.set(10,4,0);c.lookAt(10,4,reverse?100:-100);c.updateMatrixWorld(true);return c;}
function renderBoth(a:Fixture,b:Fixture,view=camera()){a.helper.render(view);b.helper.render(view);same(a,b,'render');}

test('identity capture reuses exact ordered part bounds while preserving photo unions and upload bookkeeping',()=>{
 const a=fixture(true),b=fixture(),matrices=[translation(10,-40),translation(10,40),translation(70,-55),translation(-20,-90)];
 fill(a,matrices);fill(b,matrices);captureBoth(a,b);same(a,b,'capture');assert.equal(b.fallbacks,0,'ordinary nonzero identity bounds exercise the shortcut');
 renderBoth(a,b,camera(true));renderBoth(a,b);counters(a,b);
 const ray=new T.Raycaster(new T.Vector3(10,4,0),new T.Vector3(0,0,-1));
 const hit=(f:Fixture)=>ray.intersectObject(f.meshes[0],false).map(h=>[h.distance,h.instanceId,h.faceIndex,h.point.x,h.point.y,h.point.z]);
 assert.deepEqual(hit(b),hit(a));assert(hit(b).length>0,'front trunk remains a photo occluder after opposite view');
 assert(b.meshes[0].boundingSphere!.containsPoint(new T.Vector3(10,4,40)),'photo broad phase includes hidden opposite source');
});

test('empty, shrinking and refreshed captures preserve full tails and restore compacted streams',()=>{
 const a=fixture(true),b=fixture();
 for(const [round,matrices]of [[translation(10,-40),translation(10,40),translation(70,-55),translation(-20,-90)],[translation(10,-20),translation(10,-70)],[],[translation(10,-400),translation(10,400),translation(20,-500)]].entries()){
  fill(a,matrices,round%2);fill(b,matrices,round%2);captureBoth(a,b);same(a,b,'refresh '+round);renderBoth(a,b);renderBoth(a,b,camera(true));counters(a,b);
 }
 for(const f of [a,b]){
  f.meshes[0].instanceMatrix=new T.InstancedBufferAttribute(new Float32Array(6*16),16);
  f.meshes[1].geometry.setAttribute('extra',new T.InstancedBufferAttribute(new Int16Array([1,2,3,4,5,6]),1));
  fill(f,[translation(10,-70),translation(10,70)]);
 }
 captureBoth(a,b);same(a,b,'replaced and added attributes');renderBoth(a,b);counters(a,b);
});

test('both signs of zero and signed-zero identity parents take the original arithmetic path',()=>{
 for(const sign of [0,-0]){
  const a=fixture(true),b=fixture(),matrix=new T.Matrix4();matrix.elements.fill(sign);matrix.elements[15]=1;
  for(const f of [a,b]){fill(f,[matrix]);for(const part of state(f.helper).parts)part.base.set(new T.Vector3(1,1,1),0);}
  captureBoth(a,b);same(a,b,'zero '+Object.is(sign,-0));assert.equal(b.fallbacks,1);renderBoth(a,b);counters(a,b);
 }
 // This case has local +0, but I*instance produces -0 because the identity
 // parent itself contains signed-zero coefficients. Guarding only -0 fails.
 const a=fixture(true),b=fixture(),matrix=new T.Matrix4(),parent=new T.Matrix4();
 matrix.elements=[-0,0,0,0,Math.fround(1e-40),-0,0,0,0,0,0,0,1e10,-0,Math.fround(-1e38),1];for(const k of [1,6,11,13])parent.elements[k]=-0;
 for(const f of [a,b]){fill(f,[matrix]);for(const part of state(f.helper).parts){part.base.set(new T.Vector3(-Number.MIN_VALUE,-1e-40,-1),1);part.mesh.matrixWorld.copy(parent);}}
 captureBoth(a,b);same(a,b,'positive-to-negative-zero identity');assert.equal(b.fallbacks,1);renderBoth(a,b);counters(a,b);
});

test('subnormals, huge finite values, degenerate scales and invalid transforms retain baseline bounds and sentinels',()=>{
 const cases:T.Matrix4[]=[];
 for(const value of [2**-149,-(2**-149),3.4028234663852886e38,-3.4028234663852886e38,0,-0,NaN,Infinity,-Infinity])for(const index of [0,4,10,12,13,14,3,15]){
  const matrix=translation(10,-40);matrix.elements[index]=value;cases.push(matrix);
 }
 for(const matrix of cases){
  const a=fixture(true),b=fixture();for(const f of [a,b])fill(f,[translation(10,-30),matrix]);captureBoth(a,b);same(a,b,'arithmetic edge');renderBoth(a,b);counters(a,b);
 }
 for(const radius of [Number.MIN_VALUE,1e300,Number.MAX_VALUE,Infinity,NaN,-1]){
  const a=fixture(true),b=fixture();for(const f of [a,b]){fill(f,[translation(3.4028234663852886e38,-30)]);for(const part of state(f.helper).parts)part.base.set(new T.Vector3(1e100,1e100,1e100),radius);}
  captureBoth(a,b);same(a,b,'base overflow');renderBoth(a,b);counters(a,b);
 }
});

test('nonidentity parents and later parent movement retain the original update behavior',()=>{
 const a=fixture(true),b=fixture(),matrices=[translation(10,-40),translation(10,40)];
 fill(a,matrices);fill(b,matrices);captureBoth(a,b);same(a,b,'identity first');assert.equal(b.fallbacks,0);
 const transforms=[new T.Matrix4().makeTranslation(25,-2,10),new T.Matrix4().set(-1,.3,0,3170,0,1,.1,0,0,0,1,245,0,0,0,1),new T.Matrix4()];
 for(const [i,transform]of transforms.entries()){
  for(const f of [a,b])f.meshes[1].matrixWorld.copy(transform);
  renderBoth(a,b);assert.equal(b.fallbacks,i+1,'world stamp invalidates after movement');
 }
 counters(a,b);
 for(const parent of [new T.Matrix4().makeTranslation(100000003,0,0),new T.Matrix4().makeScale(NaN,1,1),new T.Matrix4().makeScale(Infinity,1,1)]){
  for(const f of [a,b]){fill(f,[translation(-100000000,-2)]);f.meshes[1].matrixWorld.copy(parent);}
  const previous:number=b.fallbacks;captureBoth(a,b);same(a,b,'nonidentity capture');assert.equal(b.fallbacks,previous+1);renderBoth(a,b);counters(a,b);
 }
});

test('a later malformed stream leaves paired bounds and partial capture state exactly unchanged',()=>{
 const a=fixture(true),b=fixture();for(const f of [a,b])fill(f,[translation(10,-30),translation(10,30),translation(70,-40)]);captureBoth(a,b);renderBoth(a,b);counters(a,b);
 const old=state(b.helper).bounds.slice();
 for(const f of [a,b]){
  fill(f,[translation(100,-100),translation(-100,-100),translation(10,-400)]);
  f.meshes[1].geometry.setAttribute('bad',new T.InstancedBufferAttribute(new Float32Array(1),1));
 }
 captureBoth(a,b);same(a,b,'late invalid stream');assert.equal(state(b.helper).ready,false);assert.deepEqual(bytes(state(b.helper).bounds),bytes(old));renderBoth(a,b);counters(a,b);
 for(const f of [a,b]){f.meshes[1].geometry.deleteAttribute('bad');fill(f,[translation(10,-20),translation(10,20)]);}
 captureBoth(a,b);same(a,b,'valid after failure');renderBoth(a,b);counters(a,b);
});
