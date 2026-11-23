import * as T from 'three';
import {loadStartupBytes} from './startupAssets.ts';
import {limitGroundDrawRange} from './groundDrawRange.ts';
export async function addPavement(scene:T.Scene,materials:Record<string,T.Material>){
 const [meta,buffer]=await Promise.all([fetch('./belle/pavement.json').then(r=>{if(!r.ok)throw Error('Pavement '+r.status);return r.json();}),loadStartupBytes('./belle/pavement.bin')]);
 for(const part of meta.groups){
  if(!part.vertices)continue;
  const array=new Float32Array(buffer,part.offset,part.vertices*meta.stride);
  const data=new T.InterleavedBuffer(array,meta.stride),g=new T.BufferGeometry();
  g.setAttribute('position',new T.InterleavedBufferAttribute(data,3,0));
  g.setAttribute('normal',new T.InterleavedBufferAttribute(data,3,3));
  g.setAttribute('uv',new T.InterleavedBufferAttribute(data,2,6));
  g.setIndex(part.indices);g.computeBoundingSphere();
  const mesh=new T.Mesh(g,materials[part.kind]);mesh.name='Joined island pavement · '+part.kind;
  mesh.receiveShadow=true;limitGroundDrawRange(mesh,part.ranges);scene.add(mesh);
 }
 return {triangles:meta.triangles,bytes:meta.bytes};
}
