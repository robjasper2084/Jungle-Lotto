import * as T from 'three';
import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js';
/** Join only identity-transform, baked ground patches with the exact same material.
 * Does not touch landmark visibility, dynamic actors or the terrain collision data. */
export function batchStaticGround(sources:T.Mesh[]){
 const groups=new Map<string,T.Mesh[]>();
 for(const mesh of sources){
  mesh.updateMatrix();
  if(!mesh.parent||mesh.children.length||!mesh.visible||Array.isArray(mesh.material)||!mesh.matrix.equals(new T.Matrix4())||mesh.geometry.groups.length>1)continue;
  const key=mesh.parent.uuid+'|'+mesh.material.uuid+'|'+mesh.castShadow+'|'+mesh.receiveShadow+'|'+mesh.renderOrder+'|'+Object.keys(mesh.geometry.attributes).sort().join(',')+'|'+!!mesh.geometry.index;
  groups.set(key,[...(groups.get(key)??[]),mesh]);
 }
 const stats={before:0,after:0};
 for(const sources of groups.values()){
  if(sources.length<2)continue;
  const geometry=mergeGeometries(sources.map(s=>s.geometry),false);if(!geometry)continue;
  geometry.computeBoundingSphere();geometry.computeBoundingBox();
  const first=sources[0],mesh=new T.Mesh(geometry,first.material);mesh.name='Joined ground · '+(first.material as T.Material).name;mesh.receiveShadow=first.receiveShadow;mesh.castShadow=first.castShadow;mesh.renderOrder=first.renderOrder;first.parent!.add(mesh);
  // Sources were generated only for this display surface, not shared geometry.
  for(const source of sources){source.removeFromParent();source.geometry.dispose();}
  stats.before+=sources.length;stats.after++;
 }
 return stats;
}
