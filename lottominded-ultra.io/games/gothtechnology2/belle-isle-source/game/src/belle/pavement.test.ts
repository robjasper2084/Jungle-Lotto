import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import * as T from 'three';
import {createPavementGeometry,type PavementPart} from './pavement.ts';
import {limitGroundDrawRange} from './groundDrawRange.ts';
import {RoadContactSurface} from './roadContactSurface.ts';

const meta=JSON.parse(readFileSync(new URL('../../public/belle/pavement.json',import.meta.url),'utf8')) as {stride:number;groups:PavementPart[]};
const bytes=readFileSync(new URL('../../public/belle/pavement.bin',import.meta.url));
const buffer=Uint8Array.from(bytes).buffer;
const asphalt=meta.groups.find(part=>part.kind==='asphalt')!;

/** Original asset layout, before asphalt attributes were separated. */
function originalGeometry(part:PavementPart){
 const data=new T.InterleavedBuffer(new Float32Array(buffer,part.offset,part.vertices*meta.stride),meta.stride),g=new T.BufferGeometry();
 g.setAttribute('position',new T.InterleavedBufferAttribute(data,3,0));
 g.setAttribute('normal',new T.InterleavedBufferAttribute(data,3,3));
 g.setAttribute('uv',new T.InterleavedBufferAttribute(data,2,6));
 g.setIndex(part.indices);g.computeBoundingSphere();return g;
}

test('actual pavement preserves every authored component and index while only asphalt uses packed attributes',t=>{
 assert(asphalt&&asphalt.vertices>0);assert.equal(meta.stride,8);
 const input=JSON.stringify(meta),geometries:T.BufferGeometry[]=[];
 t.after(()=>geometries.forEach(g=>g.dispose()));
 for(const part of meta.groups.filter(part=>part.vertices)){
  const actual=createPavementGeometry(buffer,part,meta.stride),original=originalGeometry(part);geometries.push(actual,original);
  assert.deepEqual(Object.keys(actual.attributes),['position','normal','uv']);
  assert.equal(actual.index!.array.constructor,original.index!.array.constructor);
  assert.deepEqual(actual.index!.array,original.index!.array,'authored index order and values');
  assert.deepEqual(actual.groups,original.groups);assert.deepEqual(actual.drawRange,original.drawRange);
  assert.equal(actual.boundingBox,original.boundingBox);
  assert(actual.boundingSphere!.equals(original.boundingSphere!));
  let vertexBytes=0;const allocations=new Set<ArrayBufferLike>();
  for(const name of ['position','normal','uv']){
   const attribute=actual.getAttribute(name),reference=original.getAttribute(name) as T.InterleavedBufferAttribute;
   assert.equal(attribute.itemSize,reference.itemSize);assert.equal(attribute.count,reference.count);
   assert.equal(attribute.normalized,reference.normalized);
   if(part.kind==='asphalt'){
    assert(attribute instanceof T.BufferAttribute);assert(attribute.array instanceof Float32Array);
    assert.notEqual(attribute.array.buffer,buffer);allocations.add(attribute.array.buffer);vertexBytes+=attribute.array.byteLength;
    const actualBits=new Uint32Array(attribute.array.buffer,attribute.array.byteOffset,attribute.array.length);
    const sourceBits=new Uint32Array(reference.data.array.buffer,reference.data.array.byteOffset,reference.data.array.length);
    for(let vertex=0;vertex<attribute.count;vertex++)for(let component=0;component<attribute.itemSize;component++)
     assert.equal(actualBits[vertex*attribute.itemSize+component],sourceBits[vertex*reference.data.stride+reference.offset+component],name+' authored bits at '+vertex+':'+component);
   }else{
    assert(attribute instanceof T.InterleavedBufferAttribute);
    assert.equal(attribute.data.array.buffer,buffer);assert.equal(attribute.data.array.byteOffset,part.offset);
    assert.equal(attribute.offset,reference.offset);assert.equal(attribute.data.stride,meta.stride);
    assert.deepEqual(attribute.data.array,reference.data.array);
    assert.equal(attribute.data,(actual.getAttribute('position') as T.InterleavedBufferAttribute).data);
   }
  }
  if(part.kind==='asphalt'){
   assert.equal(allocations.size,3,'no retained interleaved attribute causes a second upload');
   assert.equal(vertexBytes,part.vertices*meta.stride*Float32Array.BYTES_PER_ELEMENT);
  }
 }
 assert.deepEqual(new Uint8Array(buffer),new Uint8Array(bytes.buffer,bytes.byteOffset,bytes.byteLength),'source asset stays intact');
 assert.equal(JSON.stringify(meta),input,'metadata, indices and culling ranges stay intact');
});

test('actual asphalt road contact retains rendered support and elevation selection with packed positions',t=>{
 const actual=createPavementGeometry(buffer,asphalt,meta.stride),original=originalGeometry(asphalt);
 t.after(()=>{actual.dispose();original.dispose();});
 const road=new RoadContactSurface(),reference=new RoadContactSurface();road.add(actual);reference.add(original);
 const position=original.getAttribute('position'),index=original.index!;let raised=0,checked=0;
 // Sample throughout the authored triangle order, including the first and last runs.
 const starts=new Set([0,index.count-3]);for(let start=0;start<index.count;start+=137*3)starts.add(start);
 for(const start of starts){
  const vertices=[index.getX(start),index.getX(start+1),index.getX(start+2)];
  const x=vertices.reduce((sum,v)=>sum+position.getX(v),0)/3;
  const z=vertices.reduce((sum,v)=>sum+position.getZ(v),0)/3;
  const y=vertices.reduce((sum,v)=>sum+position.getY(v),0)/3;
  for(const terrainY of [y-.08,y+.5,y-.5]){
   const expected=reference.height(x,z,terrainY);assert.equal(road.height(x,z,terrainY),expected);
   if(expected>terrainY)raised++;checked++;
  }
 }
 assert(checked>900&&raised>250,'samples exercise actual support across the asphalt mesh');
 for(const [x,z,y] of [[-50000,0,2],[50000,50000,6],[0,-50000,2]])assert.equal(road.height(x,z,y),y);
});

test('actual asphalt camera ranges, hook restoration and road contact are unchanged',t=>{
 const geometry=createPavementGeometry(buffer,asphalt,meta.stride),original=originalGeometry(asphalt),material=new T.MeshStandardMaterial();
 const mesh=new T.Mesh(geometry,material),baseline=new T.Mesh(original,material),scene=new T.Scene();
 mesh.receiveShadow=baseline.receiveShadow=true;scene.add(mesh,baseline);scene.updateMatrixWorld(true);
 const road=new RoadContactSurface();road.add(geometry);
 const position=geometry.getAttribute('position'),ids=[0,1,2].map(i=>geometry.index!.getX(i));
 const x=ids.reduce((s,i)=>s+position.getX(i),0)/3,z=ids.reduce((s,i)=>s+position.getZ(i),0)/3,y=ids.reduce((s,i)=>s+position.getY(i),0)/3;
 const support=road.height(x,z,y-.08),indices=geometry.index!.array.slice();
 const originalRanges=JSON.stringify(asphalt.ranges);
 let before=0,after=0;
 mesh.onBeforeRender=()=>{before++;assert.deepEqual(geometry.drawRange,{start:0,count:Infinity});};
 mesh.onAfterRender=()=>{after++;assert.deepEqual(geometry.drawRange,{start:0,count:Infinity});};
 limitGroundDrawRange(mesh,asphalt.ranges);limitGroundDrawRange(baseline,asphalt.ranges);
 assert.equal(mesh.onBeforeShadow,T.Object3D.prototype.onBeforeShadow,'asphalt remains a noncaster');
 const camera=new T.PerspectiveCamera(60,1440/900,.08,22000);
 const views=[[60,8,1488,400,2,1300],[1300,9,1200,1800,2,250],[3200,12,0,1000,2,1000],[50000,10,50000,51000,10,50000]];
 let trimmed=false,empty=false;
 for(const [px,py,pz,tx,ty,tz] of views){
  camera.position.set(px,py,pz);camera.lookAt(tx,ty,tz);camera.updateMatrixWorld(true);
  const args=(g:T.BufferGeometry)=>[{} as T.WebGLRenderer,scene,camera,g,material,undefined] as unknown as Parameters<typeof mesh.onBeforeRender>;
  mesh.onBeforeRender(...args(geometry));baseline.onBeforeRender(...args(original));
  assert.deepEqual(geometry.drawRange,original.drawRange);
  trimmed ||= geometry.drawRange.count<indices.length;empty ||= geometry.drawRange.count===0;
  assert.equal(road.height(x,z,y-.08),support,'render trimming does not alter wheel support');
  mesh.onAfterRender(...args(geometry));baseline.onAfterRender(...args(original));
  assert.deepEqual(geometry.drawRange,{start:0,count:Infinity});assert.deepEqual(original.drawRange,geometry.drawRange);
 }
 assert(trimmed&&empty,'actual range metadata exercises both trimmed and empty draws');
 assert.equal(before,views.length);assert.equal(after,views.length);
 assert.equal(mesh.material,material);assert(mesh.receiveShadow);assert.equal(mesh.castShadow,false);
 assert.deepEqual(geometry.index!.array,indices);assert.equal(JSON.stringify(asphalt.ranges),originalRanges);
 t.after(()=>{geometry.dispose();original.dispose();material.dispose();});
});
