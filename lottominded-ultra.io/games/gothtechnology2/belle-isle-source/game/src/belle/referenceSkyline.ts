import * as T from 'three';
import data from './referenceRoofs.json' with {type:'json'};
import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js';
/** Thin crown details use the same mapped roof elevations and footprint as the skyline asset. */
export function addReferenceSkyline(scene:T.Scene){
 const parts:T.BufferGeometry[]=[],q=new T.Quaternion(),matrix=new T.Matrix4(),up=new T.Vector3(0,1,0);
 for(const roof of data.roofs)for(let i=1;i<roof.points.length;i++){
  const a=new T.Vector3(roof.points[i-1][0],roof.height+.3,roof.points[i-1][1]),b=new T.Vector3(roof.points[i][0],roof.height+.3,roof.points[i][1]);if(a.distanceTo(b)<.01)continue;
  q.setFromUnitVectors(up,b.clone().sub(a).normalize());matrix.compose(a.clone().add(b).multiplyScalar(.5),q,new T.Vector3(1,1,1));parts.push(new T.CylinderGeometry(.42,.42,a.distanceTo(b),4).applyMatrix4(matrix));
 }
 if(!parts.length)return;const mesh=new T.Mesh(mergeGeometries(parts)!,new T.MeshStandardMaterial({color:0x8caeb5,metalness:.5,roughness:.28,emissive:0x5dcfe2,emissiveIntensity:.6}));parts.forEach(g=>g.dispose());mesh.name='Mapped Renaissance Center crown trim';scene.add(mesh);
}
