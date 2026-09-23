import * as T from 'three';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {CITY,nearestCut} from './geography.ts';
import {GEO,cutWidth} from './geo-profile.ts';
import {hash} from './world.ts';
import {drapeStreet,drapeJunction,streetElevation} from './street-geometry.ts';
import {curbRise,hasStreetCurb} from './streetCurbs.ts';
import type {DetroitWorld} from './world.ts';

/** Mapped polygons own both visible structure and collision. Facades remain authored art. */
export async function buildCity(_scene:T.Scene,world:DetroitWorld,groupAt:(x:number,z:number)=>T.Group,skins:Record<string,T.MeshStandardMaterial>){
 const loader=new T.TextureLoader();
 const maps=await Promise.all(['industrial_red','industrial_buff','storefront'].map(n=>loader.loadAsync('/textures/architecture/'+n+'.jpg')));
 maps.forEach(t=>{t.colorSpace=T.SRGBColorSpace;t.wrapS=t.wrapT=T.RepeatWrapping;t.anisotropy=8;});
 const facades=maps.map(map=>new T.MeshStandardMaterial({map,roughness:.9}));
 const roof=new T.MeshStandardMaterial({color:'#656865',roughness:.98});
 const curb=skins.concrete;
 const roadMat=skins.asphalt.clone();roadMat.polygonOffset=true;roadMat.polygonOffsetFactor=-1;
 const sidewalk=skins.sidewalk;
 const paint=new T.MeshStandardMaterial({color:'#d8bc68',roughness:.95,polygonOffset:true,polygonOffsetFactor:-2});
 const paths=new Map<T.Group,Map<T.Material,number[]>>();
 let streetTriangles=0,streetSections=0;
 function append(material:T.Material,pieces:ReturnType<typeof drapeStreet>){
   for(const {chunk,positions} of pieces){
     const g=groupAt(chunk.x,chunk.z);
     let bin=paths.get(g);if(!bin){bin=new Map();paths.set(g,bin);}let out=bin.get(material);if(!out){out=[];bin.set(material,out);}
     for(const v of positions)out.push(v);
     streetTriangles+=positions.length/9;
   }
 }
 function strip(material:T.Material,x0:number,z0:number,x1:number,z1:number,half:number,offset:number,elevation:(x:number,z:number,terrain:number)=>number,lift:number){
   append(material,drapeStreet({a:{x:x0,z:z0},b:{x:x1,z:z1},half,offset,lift},world.chunks,elevation));
 }
 const junctions=new Set<string>();
 for(const road of CITY.roads)for(let i=1;i<road.points.length;i++){
   const a=road.points[i-1],b=road.points[i],dx=b[0]-a[0],dz=b[1]-a[1],length=Math.hypot(dx,dz),x=(a[0]+b[0])/2,z=(a[1]+b[1])/2;
   if(length<.2)continue;
   const walk=['cycleway','footway','path','pedestrian'].includes(road.kind),width=(road.name==='Dequindre Cut Greenway'?cutWidth(nearestCut(x,z).d):road.width)/2;
   // Cull by the complete envelope, never by its midpoint. Each clipped piece owns its terrain tile.
   if(!world.chunks.some(c=>Math.max(a[0],b[0])+width+2>=c.x-50&&Math.min(a[0],b[0])-width-2<=c.x+50&&Math.max(a[1],b[1])+width+2>=c.z-50&&Math.min(a[1],b[1])-width-2<=c.z+50))continue;
   streetSections++;
   const concreteWalk=['footway','pedestrian'].includes(road.kind)&&road.name!=='Dequindre Cut Greenway';
   const elevation=(px:number,pz:number,terrain:number)=>streetElevation(road,px,pz,terrain);
   strip(concreteWalk?sidewalk:roadMat,a[0],a[1],b[0],b[1],width,0,elevation,.035);
   for(const p of [a,b]){
     const key=`${p[0]},${p[1]},${width},${walk},${road.bridge},${concreteWalk}`;
     if(junctions.has(key))continue;junctions.add(key);
     append(concreteWalk?sidewalk:roadMat,drapeJunction(p[0],p[1],width,world.chunks,elevation,.035));
   }
   if(hasStreetCurb(road)){
     for(const sign of [-1,1]){
       const raised=(px:number,pz:number,terrain:number)=>elevation(px,pz,terrain)+curbRise(road,px,pz);
       strip(sidewalk,a[0],a[1],b[0],b[1],.85,sign*(width+1),raised,.035);
       // A chamfered front and a separate cap replace the nearly flat painted ribbon.
       const face=(px:number,pz:number,terrain:number)=>{
         const lateral=Math.abs((px-a[0])*(-dz/length)+(pz-a[1])*(dx/length));
         return elevation(px,pz,terrain)+curbRise(road,px,pz)*Math.max(0,Math.min(1,(lateral-width)/.08));
       };
       strip(curb,a[0],a[1],b[0],b[1],.04,sign*(width+.04),face,.035);
       strip(curb,a[0],a[1],b[0],b[1],.12,sign*(width+.20),raised,.035);
     }
     if(['primary','secondary','tertiary','residential'].includes(road.kind)){
       for(let d=0;d<length;d+=8){const end=Math.min(d+4,length);strip(paint,a[0]+dx*d/length,a[1]+dz*d/length,a[0]+dx*end/length,a[1]+dz*end/length,.045,0,elevation,.045);}
     }
   }
 }
 for(const[g,bins]of paths)for(const[material,positions]of bins){const geo=new T.BufferGeometry();geo.setAttribute('position',new T.Float32BufferAttribute(positions,3));
   // These ribbons can sit above the bank terrain and extend beyond the deck.
   // Share their exact surface with riding, dog paws, falls and camera queries.
   if(material!==paint)world.addRideSurface(geo.attributes.position.array as Float32Array);
   const uv=[],scale=material===sidewalk?4:2;for(let i=0;i<positions.length;i+=3)uv.push(positions[i]/scale-Math.floor(g.userData.center.x/scale),positions[i+2]/scale-Math.floor(g.userData.center.z/scale));geo.setAttribute('uv',new T.Float32BufferAttribute(uv,2));geo.computeVertexNormals();const m=new T.Mesh(geo,material);m.name=material===sidewalk?'Concrete sidewalks':'Mapped street surface';m.receiveShadow=true;g.add(m);}
 const landmarks:string[]=[];
 for(const{data:b,geometry:geo}of world.buildingMeshes){
   geo.computeBoundingBox();const bounds=geo.boundingBox!,center=bounds.getCenter(new T.Vector3()),g=groupAt(center.x,center.z);
   const pos=geo.getAttribute('position'),normal=geo.getAttribute('normal'),uv=geo.getAttribute('uv');
   // Eight metre facade repeat preserves plausible door/window scale.
   for(let i=0;i<pos.count;i++)uv.setXY(i,(Math.abs(normal.getX(i))>.5?pos.getZ(i):pos.getX(i))/8,pos.getY(i)/7.5);
   const side=facades[Math.floor(hash(Number(b.id))*facades.length)];
   const mesh=new T.Mesh(geo,[roof,side]);mesh.name='OSM '+b.id+' '+b.name;mesh.userData={osmId:b.id,source:'OSM footprint; facade and height require visual verification'};mesh.castShadow=mesh.receiveShadow=true;g.add(mesh);
   // Cornice follows every polygon edge, including non-rectangular footprints.
   for(let i=1;i<b.points.length;i++){
     const a=b.points[i-1],c=b.points[i],len=Math.hypot(c[0]-a[0],c[1]-a[1]);if(len<.6)continue;
     const m=new T.Mesh(new T.BoxGeometry(.22,.22,len),curb);m.position.set((a[0]+c[0])/2,bounds.max.y,(a[1]+c[1])/2);m.rotation.y=Math.atan2(c[0]-a[0],c[1]-a[1]);m.castShadow=true;g.add(m);
   }
   // Retain custom architectural detail only where an exact named footprint exists.
   const id=b.id==='59452104'?'DS_Detroit_Globe_OAC':b.id==='59440457'?'DS_Detroit_Shed_3':null;
   if(id){
     const asset=(await new GLTFLoader().loadAsync('/exports/architecture/'+id+'.glb')).scene;
     const box=new T.Box3().setFromObject(asset),size=box.getSize(new T.Vector3());
     // Detail stays inside the mapped envelope; the envelope is authoritative.
     const scale=Math.min((bounds.max.x-bounds.min.x)/size.x,(bounds.max.z-bounds.min.z)/size.z,.98);
     asset.scale.setScalar(scale);asset.position.set(center.x-(box.min.x+size.x/2)*scale,geo.userData.streetBase-box.min.y*scale,center.z-(box.min.z+size.z/2)*scale);
     asset.traverse(o=>{if((o as T.Mesh).isMesh){o.castShadow=o.receiveShadow=true;}});g.add(asset);landmarks.push(id);
   }
 }
 return{blocks:world.buildingMeshes.length,landmarks,bridges:GEO.bridges.length,ramps:GEO.ramps.length,mapped:true,streetSections,streetTriangles,streetTiles:paths.size};
}
