import type {SceneryWorld} from './sceneryWorld.ts';
import * as T from 'three';
import data from './harbor-data.json' with {type:'json'};
import {buildHarborDetail,dockTimber} from './harborDetail.ts';
export const harborBoundary=data.ways.find(w=>w.tags.leisure==='marina')!.points;
const harborBounds={minX:Math.min(...harborBoundary.map(p=>p[0]))-12,maxX:Math.max(...harborBoundary.map(p=>p[0]))+12,minZ:Math.min(...harborBoundary.map(p=>p[1]))-12,maxZ:Math.max(...harborBoundary.map(p=>p[1]))+12};
/** A coarse 20 m grid makes the basin's edge spill diagonally into its paths. */
export const harborTerrainDetail=(x:number,z:number)=>x+50>=harborBounds.minX&&x-50<=harborBounds.maxX&&z+50>=harborBounds.minZ&&z-50<=harborBounds.maxZ;
export function inHarbor(x:number,z:number){let inside=false;for(let i=0,j=harborBoundary.length-1;i<harborBoundary.length;j=i++){const a=harborBoundary[i],b=harborBoundary[j];if((a[1]>z)!==(b[1]>z)&&x<(b[0]-a[0])*(z-a[1])/(b[1]-a[1])+a[0])inside=!inside;}return inside;}
/** OSM pier centrelines; deck width and fittings are authored visual detail. */
export function buildHarbor(world:SceneryWorld,groupAt:(x:number,z:number)=>T.Group){
 const wood=dockTimber(),steel=new T.MeshStandardMaterial({color:'#626a69',metalness:.65,roughness:.4}),edge=new T.MeshStandardMaterial({color:'#52594d',roughness:.95});
 const bins=new Map<T.Group,T.Matrix4[]>(),posts=new Map<T.Group,T.Matrix4[]>(),beams=new Map<T.Group,T.Matrix4[]>(),bolts=new Map<T.Group,T.Matrix4[]>();
 function add(bin:Map<T.Group,T.Matrix4[]>,x:number,y:number,z:number,w:number,h:number,d:number,angle:number){const group=groupAt(x,z),list=bin.get(group)??[];list.push(new T.Matrix4().compose(new T.Vector3(x,y,z),new T.Quaternion().setFromAxisAngle(new T.Vector3(0,1,0),angle),new T.Vector3(w,h,d)));bin.set(group,list);}
 for(const pier of data.ways.filter(w=>w.tags.man_made==='pier'))for(let i=1;i<pier.points.length;i++){
  const a=pier.points[i-1],b=pier.points[i],dx=b[0]-a[0],dz=b[1]-a[1],length=Math.hypot(dx,dz),angle=Math.atan2(dx,dz);
  for(let distance=0;distance<length;distance+=.3){const size=Math.min(.28,length-distance),t=(distance+size/2)/length;add(bins,a[0]+dx*t,.12,a[1]+dz*t,2.4,.22,size,angle);}
  const deck=new T.PlaneGeometry(2.4,length);deck.rotateX(-Math.PI/2);deck.rotateY(angle);deck.translate((a[0]+b[0])/2,.23,(a[1]+b[1])/2);const triangles=deck.toNonIndexed();world.addRideSurface(triangles.attributes.position.array as Float32Array);triangles.dispose();deck.dispose();
  for(const side of [-1,1]){const x=(a[0]+b[0])/2+side*dz/length*1.17,z=(a[1]+b[1])/2-side*dx/length*1.17;add(beams,x,-.035,z,.15,.22,length,angle);}
  for(let d=1;d<length;d+=8){const t=d/length,x=a[0]+dx*t,z=a[1]+dz*t;for(const side of [-1,1]){const px=x+side*dz/length*1.08,pz=z-side*dx/length*1.08;add(posts,px,.255,pz,.32,.05,.14,angle);add(posts,px,.30,pz,.065,.10,.065,angle);add(posts,px,.35,pz,.4,.055,.06,angle);}}
  for(let d=.14;d<length;d+=1.2){const t=d/length;for(const side of [-1,1])add(bolts,a[0]+dx*t+side*dz/length*.98,.233,a[1]+dz*t-side*dx/length*.98,.023,.005,.023,angle);}
 }
 for(const [bin,material,name]of [[bins,wood,'Milliken Harbor dock decking'],[posts,steel,'Milliken Harbor mooring cleats'],[beams,edge,'Harbor deck edge beams'],[bolts,steel,'Harbor plank fasteners']] as const)for(const [group,matrices]of bin){const mesh=new T.InstancedMesh(new T.BoxGeometry(1,1,1),material,matrices.length);matrices.forEach((m,i)=>{mesh.setMatrixAt(i,m);if(bin===bins)mesh.setColorAt(i,new T.Color().setScalar(.80+((i*73)%101)/500));});mesh.name=name;mesh.receiveShadow=true;mesh.computeBoundingSphere();group.add(mesh);}
 buildHarborDetail(groupAt);
}
