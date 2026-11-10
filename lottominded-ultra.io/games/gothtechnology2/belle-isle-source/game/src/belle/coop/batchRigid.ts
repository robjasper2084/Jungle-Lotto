import * as T from 'three';
import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js';
/** Combine sibling rigid pieces only. Animated parents, skinning, sockets and materials survive. */
export function batchRigidChildren(root:T.Object3D,animatedNames:ReadonlySet<string>=new Set()){
 const owned:T.BufferGeometry[]=[],parents:T.Object3D[]=[];root.traverse(o=>parents.push(o));
 let before=0,after=0;
 for(const parent of parents){
  const groups=new Map<string,T.Mesh[]>();
  for(const child of parent.children){const m=child as T.Mesh;if(!m.isMesh||(m as T.InstancedMesh).isInstancedMesh||(m as T.SkinnedMesh).isSkinnedMesh||m.children.length||!m.visible||Array.isArray(m.material)||m.material.transparent||m.geometry.morphAttributes.position||animatedNames.has(m.name))continue;
   const key=[m.material.uuid,m.castShadow,m.receiveShadow,m.renderOrder,m.layers.mask,!!m.geometry.index,Object.keys(m.geometry.attributes).sort().join(',')].join('|');groups.set(key,[...(groups.get(key)??[]),m]);
  }
  for(const pieces of groups.values()){if(pieces.length<2)continue;const geos=pieces.map(m=>{m.updateMatrix();return m.geometry.clone().applyMatrix4(m.matrix);});const geo=mergeGeometries(geos,false);geos.forEach(g=>g.dispose());if(!geo)continue;
   geo.computeBoundingSphere();const first=pieces[0],batch=new T.Mesh(geo,first.material);batch.name='Rigid batch · '+parent.name;batch.castShadow=first.castShadow;batch.receiveShadow=first.receiveShadow;batch.renderOrder=first.renderOrder;batch.layers.mask=first.layers.mask;parent.add(batch);for(const m of pieces)m.removeFromParent();owned.push(geo);before+=pieces.length;after++;
  }
 }
 return {before,after,dispose(){owned.forEach(g=>g.dispose());}};
}
