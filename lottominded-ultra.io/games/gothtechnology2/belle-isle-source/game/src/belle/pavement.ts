import * as T from 'three';
import {loadStartupBytes} from './startupAssets.ts';
import {limitGroundDrawRange,type GroundRange,type GroundRangeOwner} from './groundDrawRange.ts';
import type {RoadContactSurface} from './roadContactSurface.ts';
export type PavementPart={kind:string;offset:number;vertices:number;indices:number[];ranges?:GroundRange[]};
export type PavementFactoryOwner=Readonly<{source:T.Mesh;geometry:T.BufferGeometry;kind:string;range:GroundRangeOwner|undefined}>;
const factoryOwners=new WeakMap<T.Mesh,PavementFactoryOwner>();
/** Names and userData cannot grant ownership of a depth-pass source. */
export const pavementFactoryOwner=(mesh:T.Mesh)=>factoryOwners.get(mesh);

/** Keep joined asphalt inputs in the same packed format as the other road meshes. */
export function createPavementGeometry(buffer:ArrayBuffer,part:PavementPart,stride:number){
 const array=new Float32Array(buffer,part.offset,part.vertices*stride),g=new T.BufferGeometry();
 if(part.kind==='asphalt'){
  // Copy component bits, including signed zero, without recomputing normals.
  // All three attributes are separate so the interleaved data is not also uploaded.
  const source=new Uint32Array(array.buffer,array.byteOffset,array.length);
  for(const [name,size,offset] of [['position',3,0],['normal',3,3],['uv',2,6]] as const){
   const values=new Float32Array(part.vertices*size),bits=new Uint32Array(values.buffer);
   for(let vertex=0;vertex<part.vertices;vertex++)for(let component=0;component<size;component++)
    bits[vertex*size+component]=source[vertex*stride+offset+component];
   g.setAttribute(name,new T.BufferAttribute(values,size));
  }
 }else{
  const data=new T.InterleavedBuffer(array,stride);
  g.setAttribute('position',new T.InterleavedBufferAttribute(data,3,0));
  g.setAttribute('normal',new T.InterleavedBufferAttribute(data,3,3));
  g.setAttribute('uv',new T.InterleavedBufferAttribute(data,2,6));
 }
 g.setIndex(part.indices);g.computeBoundingSphere();return g;
}

/** The one construction path used by both the runtime asset loader and proofs. */
export function createPavementMesh(buffer:ArrayBuffer,part:PavementPart,stride:number,material:T.Material){
 const geometry=createPavementGeometry(buffer,part,stride),mesh=new T.Mesh(geometry,material);
 mesh.name='Joined island pavement · '+part.kind;mesh.receiveShadow=true;
 const range=limitGroundDrawRange(mesh,part.ranges);
 factoryOwners.set(mesh,Object.freeze({source:mesh,geometry,kind:part.kind,range}));
 return mesh;
}

export async function addPavement(scene:T.Scene,materials:Record<string,T.Material>,roadContact:RoadContactSurface){
 const [meta,buffer]=await Promise.all([fetch('./belle/pavement.json').then(r=>{if(!r.ok)throw Error('Pavement '+r.status);return r.json();}),loadStartupBytes('./belle/pavement.bin')]);
 for(const part of meta.groups){
  if(!part.vertices)continue;
  const mesh=createPavementMesh(buffer,part,meta.stride,materials[part.kind]);
  roadContact.add(mesh.geometry);scene.add(mesh);
 }
 return {triangles:meta.triangles,bytes:meta.bytes};
}
