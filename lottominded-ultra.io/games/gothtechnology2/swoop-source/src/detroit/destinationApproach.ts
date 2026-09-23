import * as T from 'three';
import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js';
import {destinationLayout} from './destinationLayout.ts';
import {toMap,toLocal} from './geo-profile.ts';
import {heightAt} from './world.ts';
/** A level-changing paved walk from Mack's sidewalk to the gallery forecourt. */
export function buildGalleryApproach(scene:T.Scene){
 const l=destinationLayout(),f=new T.Vector3(Math.sin(l.heading),0,Math.cos(l.heading));
 const forecourt=new T.Vector3(l.local.x,l.local.y,l.local.z).addScaledVector(f,10*l.scale);
 const corner=forecourt.clone().addScaledVector(f,7);
 const m=toMap(corner.x,0,corner.z);
 // Mack Avenue's western sidewalk; its local centreline is x ~= 2539.
 const end=toLocal(2526,heightAt(2526,m.z),m.z);
 const points=[forecourt,corner,new T.Vector3(end.x,end.y,end.z)];
 const material=new T.MeshStandardMaterial({color:0xa79b85,roughness:.93});
 const edgeMaterial=new T.MeshStandardMaterial({color:0x454743,roughness:.8});
 const group=new T.Group();group.name='Serengeti paved approach from Mack';scene.add(group);
 for(let s=1;s<points.length;s++){
  const a=points[s-1],b=points[s],d=b.clone().sub(a);d.y=0;const length=d.length();d.normalize();const side=new T.Vector3(d.z,0,-d.x);
  const count=Math.ceil(length/.9);
  for(let i=0;i<count;i++){
   const t=(i+.5)/count,p=a.clone().lerp(b,t),map=toMap(p.x,0,p.z),ground=toLocal(map.x,heightAt(map.x,map.z),map.z).y;
   for(const [offset,width,mat] of [[0,3.6,material],[-1.9,.18,edgeMaterial],[1.9,.18,edgeMaterial]] as const){
    const tile=new T.Mesh(new T.BoxGeometry(width,.045,length/count-.025),mat);tile.position.copy(p).addScaledVector(side,offset);tile.position.y=ground+.045;tile.rotation.y=Math.atan2(d.x,d.z);tile.receiveShadow=true;group.add(tile);
   }
  }
 }
 // Static paving shares just two draw calls, regardless of walkway length.
 for(const mat of [material,edgeMaterial]){
  const parts:T.BufferGeometry[]=[];
  for(const child of [...group.children]){const mesh=child as T.Mesh;if(mesh.material!==mat)continue;mesh.updateMatrix();parts.push(mesh.geometry.applyMatrix4(mesh.matrix));group.remove(mesh);}
  if(parts.length){const merged=mergeGeometries(parts);const mesh=new T.Mesh(merged,mat);mesh.receiveShadow=true;group.add(mesh);for(const geometry of parts)geometry.dispose();}
 }
 return group;
}
