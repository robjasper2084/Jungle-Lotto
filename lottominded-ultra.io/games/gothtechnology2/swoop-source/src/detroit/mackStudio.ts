import * as T from 'three';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js';
import {MACK_STUDIO,studioMap} from './mackStudioSite.ts';
import {toLocal,toMap} from './geo-profile.ts';
import {heightAt,type DetroitWorld} from './world.ts';
/** A single shared exterior; retail rooms are supplied by GalleryVisit. */
export async function buildMackStudio(scene:T.Scene,world:DetroitWorld){
 const group=new T.Group();group.name='2000 Mack · GothTech Studio / Pellerito building';scene.add(group);
 const centre=toLocal(MACK_STUDIO.x,MACK_STUDIO.floor,MACK_STUDIO.z),building=(await new GLTFLoader().loadAsync('/exports/atwater/mack-gothtech-studio.glb')).scene;
 building.position.set(centre.x,centre.y,centre.z);building.rotation.y=MACK_STUDIO.heading;group.add(building);
 building.traverse(o=>{if((o as T.Mesh).isMesh){o.castShadow=o.receiveShadow=true;}});
 const bins=new Map<T.Material,T.BufferGeometry[]>();
 const steel=new T.MeshStandardMaterial({color:'#444c49',metalness:.6,roughness:.62}),paint=new T.MeshStandardMaterial({color:'#d8b958',roughness:.95}),curb=new T.MeshStandardMaterial({color:'#aeada1',roughness:.96}),asphalt=new T.MeshStandardMaterial({color:'#454845',roughness:.97});
 function point(u:number,v:number,y=0){const p=studioMap(u,v),local=toLocal(p.x,heightAt(p.x,p.z)+y,p.z);return new T.Vector3(local.x,local.y,local.z);}
 function box(u:number,v:number,y:number,w:number,h:number,d:number,mat:T.Material,solid=false){const pos=point(u,v,y),g=new T.BoxGeometry(w,h,d);g.rotateY(MACK_STUDIO.heading);g.translate(pos.x,pos.y,pos.z);const bin=bins.get(mat)??[];bin.push(g);bins.set(mat,bin);if(solid){const p=toMap(pos.x,pos.y,pos.z);world.addBox({x:p.x,y:p.y,z:p.z,hx:w/2,hy:h/2,hz:d/2,yaw:-MACK_STUDIO.heading,kind:'studio fence'});}}
 // Drape the entire private yard to the same collision surface as the rider.
 const vertices:number[]=[];for(let u=-102;u<46;u+=2)for(let v=-96;v<40;v+=2){const q=[[u,v],[u+2,v],[u+2,v+2],[u,v+2]].map(([a,b])=>point(a,b,.035));for(const i of [0,1,2,0,2,3])vertices.push(...q[i].toArray());}
 const lot=new T.BufferGeometry();lot.setAttribute('position',new T.Float32BufferAttribute(vertices,3));lot.computeVertexNormals();const paved=new T.Mesh(lot,asphalt);paved.material.side=T.DoubleSide;paved.receiveShadow=true;group.add(paved);
 const ground:number[]=[];for(let i=0;i<vertices.length;i+=3){const p=toMap(vertices[i],vertices[i+1],vertices[i+2]);ground.push(p.x,p.y,p.z);}world.addRideSurface(new Float32Array(ground),true);
 // 34 full-size bays, with clear pedestrian route and vehicle gate at +X end.
 for(let i=0;i<=18;i++){const u=-92+i*2.65;box(u,36.2,.052,.085,.025,5.3,paint);if(i<18)box(u+1.325,38.2,.13,1.7,.20,.18,curb,true);}
 for(let i=0;i<=16;i++){const u=-88+i*2.65;box(u,-78,.052,.085,.025,5.3,paint);}
 function fence(a:[number,number],b:[number,number]){
  const len=Math.hypot(a[0]-b[0],a[1]-b[1]),count=Math.ceil(len/2.8),along=new T.Vector3().subVectors(point(...b),point(...a)).normalize();
  for(let i=0;i<=count;i++){const t=i/count;box(a[0]+(b[0]-a[0])*t,a[1]+(b[1]-a[1])*t,1.17,.075,2.34,.075,steel);}
  const positions:number[]=[];
  // Line geometry avoids hundreds of transparent meshes on older phones.
  for(let d=0;d<len;d+=.21)for(const slope of [-1,1]){const e=Math.min(len,d+1.15),p=point(a[0]+(b[0]-a[0])*d/len,a[1]+(b[1]-a[1])*d/len,.12+(slope<0?2.1:0)),q=point(a[0]+(b[0]-a[0])*e/len,a[1]+(b[1]-a[1])*e/len,.12+(slope<0?0:2.1));positions.push(...p.toArray(),...q.toArray());}
  for(const y of [.18,2.2])positions.push(...point(...a,y).toArray(),...point(...b,y).toArray());
  const geo=new T.BufferGeometry();geo.setAttribute('position',new T.Float32BufferAttribute(positions,3));group.add(new T.LineSegments(geo,new T.LineBasicMaterial({color:'#4e5853'})));
  for(let i=0;i<count;i++){const t=(i+.5)/count,u=a[0]+(b[0]-a[0])*t,v=a[1]+(b[1]-a[1])*t,p=point(u,v,1.1),m=toMap(p.x,p.y,p.z);world.addBox({x:m.x,y:m.y,z:m.z,hx:.065,hy:1.1,hz:len/count/2,yaw:-Math.atan2(along.x,along.z),kind:'studio fence'});}
 }
 fence([-102,40],[29,40]);fence([40,40],[46,40]);fence([-102,40],[-102,-96]);fence([-102,-96],[46,-96]);fence([46,-96],[46,40]);
 // Sliding gate retracted beside a genuine 11 m vehicle/pedestrian opening.
 fence([17,39.6],[28,39.6]);box(29,40,1.2,.15,2.4,.15,steel,true);box(40,40,1.2,.15,2.4,.15,steel,true);
 // Matching shell colliders with the central loading entrance left open.
 function shell(x:number,z:number,w:number,h:number,d:number,y=h/2){const p=studioMap(x,z);world.addBox({x:p.x,y:MACK_STUDIO.floor+y,z:p.z,hx:w/2,hy:h/2,hz:d/2,yaw:-MACK_STUDIO.heading,kind:'studio building'});}
 shell(-24.266,0,.26,6.1,43.912);shell(24.266,0,.26,6.1,43.912);shell(0,-21.956,48.533,6.1,.26);
 for(const side of [-1,1])shell(side*13.048,21.956,22.436,6.1,.26);
 shell(0,21.956,3.66,1.2,.26,5.5);
 const q=[[-24.266,-21.956],[-24.266,21.956],[24.266,21.956],[24.266,-21.956]].map(([u,v])=>studioMap(u,v));world.addRideSurface(new Float32Array([0,2,1,0,3,2].flatMap(i=>[q[i].x,MACK_STUDIO.floor+.05,q[i].z])),true);
 for(const [mat,parts]of bins){const g=mergeGeometries(parts),m=new T.Mesh(g,mat);m.castShadow=m.receiveShadow=true;group.add(m);parts.forEach(p=>p.dispose());}
 const fineDetails:T.Object3D[]=[];building.traverse(o=>{const m=o as T.Mesh;if(m.isMesh&&['Recessed block joints','Green seam highlights'].includes((m.material as T.Material).name))fineDetails.push(o);});
 return{group,update(x:number,z:number){const d=Math.hypot(x-centre.x,z-centre.z);group.visible=d<380;for(const o of fineDetails)o.visible=d<95&&document.documentElement.dataset.renderQuality!=='compact';}};
}
