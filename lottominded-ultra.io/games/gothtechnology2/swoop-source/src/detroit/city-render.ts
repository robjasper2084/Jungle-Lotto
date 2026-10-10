import type {SceneryWorld} from './sceneryWorld.ts';
import type {SpatialAssetStream} from './spatialAssetStream.ts';
import * as T from 'three';
import {orleansFloors,orleansMaterial} from './orleansLanding.ts';
import {inMillikenPark} from './parkPaths.ts';
import {inValadePark} from './valadeSite.ts';
import {GLTFLoader} from './compressedGLTFLoader.ts';
import {CITY,nearestCut} from './geography.ts';
import {GEO,cutWidth} from './geo-profile.ts';
import {hash} from './world.ts';
import {drapeStreet,drapeJunction,streetElevation,streetSurfaceLift,streetVertexNormal,insideStreetFootprint,streetFootprint,type StreetPoint} from './street-geometry.ts';
import {curbRise,hasStreetCurb} from './streetCurbs.ts';
import {parallelStreetSidewalk} from './streetSidewalk.ts';
import {streetJoinExclusions} from './streetJunctions.ts';
import {heightAt} from './world.ts';
import {clearStreetJunction,sidewalkHalfWidth,streetMarkingStyle} from './streetFurnitureLayout.ts';
import {loadStreetSurfaceCache} from './streetSurfaceCache.ts';

/** Mapped polygons own both visible structure and collision. Facades remain authored art. */
export async function buildCity(_scene:T.Scene,world:SceneryWorld,groupAt:(x:number,z:number)=>T.Group,skins:Record<string,T.MeshStandardMaterial>,stream?:SpatialAssetStream){
 const loader=new T.TextureLoader();
 const maps=await Promise.all(['industrial_red','industrial_buff','storefront'].map(n=>loader.loadAsync('/textures/architecture/'+n+'.jpg')));
 maps.forEach(t=>{t.colorSpace=T.SRGBColorSpace;t.wrapS=t.wrapT=T.RepeatWrapping;t.anisotropy=8;});
 const facades=maps.map(map=>new T.MeshStandardMaterial({map,roughness:.9}));
 const roof=new T.MeshStandardMaterial({color:'#656865',roughness:.98});
 const curb=skins.concrete;
 const roadMat=skins.asphalt.clone();roadMat.polygonOffset=true;roadMat.polygonOffsetFactor=-1;
 const parkMat=skins.asphalt.clone();parkMat.color.set('#a5aaa8');parkMat.normalScale.set(.13,.13);parkMat.roughness=.98;parkMat.polygonOffset=true;parkMat.polygonOffsetFactor=-1;
 const parkEdge=skins.concrete.clone();parkEdge.color.set('#c5c3b8');parkEdge.polygonOffset=true;parkEdge.polygonOffsetFactor=-1;
 const sidewalk=skins.sidewalk;
 const paint=new T.MeshStandardMaterial({color:'#e8c75d',roughness:.88,polygonOffset:true,polygonOffsetFactor:-2});
 const whitePaint=new T.MeshStandardMaterial({color:'#ebece1',roughness:.92,polygonOffset:true,polygonOffsetFactor:-2});
 const seam=new T.MeshStandardMaterial({color:'#8b8982',roughness:1,polygonOffset:true,polygonOffsetFactor:-2});
 const cacheMaterials:Record<string,T.Material>={road:roadMat,park:parkMat,parkEdge,sidewalk,curb,yellow:paint,white:whitePaint,seam};
 const cached=await loadStreetSurfaceCache();
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
 function strip(material:T.Material,x0:number,z0:number,x1:number,z1:number,half:number,offset:number,elevation:(x:number,z:number,terrain:number)=>number,lift:number,maxSpan?:number,joins?:{joinA:StreetPoint;joinB:StreetPoint},exclude?:StreetPoint[][]){
   append(material,drapeStreet({a:{x:x0,z:z0},b:{x:x1,z:z1},half,offset,lift,maxSpan,...joins,exclude},world.chunks,elevation));
 }
 const junctions=new Set<string>();
 if(!cached)for(const road of CITY.roads)for(let i=1;i<road.points.length;i++){
   const a=road.points[i-1],b=road.points[i],dx=b[0]-a[0],dz=b[1]-a[1],length=Math.hypot(dx,dz),x=(a[0]+b[0])/2,z=(a[1]+b[1])/2;
   if(length<.2)continue;
   const walk=['cycleway','footway','path','pedestrian'].includes(road.kind),width=(road.name==='Dequindre Cut Greenway'?cutWidth(nearestCut(x,z).d):road.width)/2;
   if(walk&&road.name!=='Dequindre Cut Greenway'&&parallelStreetSidewalk(a,b))continue;
   // Cull by the complete envelope, never by its midpoint. Each clipped piece owns its terrain tile.
   if(!world.chunks.some(c=>Math.max(a[0],b[0])+width+2>=c.x-50&&Math.min(a[0],b[0])-width-2<=c.x+50&&Math.max(a[1],b[1])+width+2>=c.z-50&&Math.min(a[1],b[1])-width-2<=c.z+50))continue;
   streetSections++;
   const concreteWalk=['footway','pedestrian'].includes(road.kind)&&road.name!=='Dequindre Cut Greenway';
   const valadeWalk=walk&&inValadePark(x,z);
   const parkWalk=walk&&(inMillikenPark(x,z)||valadeWalk)&&road.name!=='Dequindre Cut Greenway';
   const surface=valadeWalk?sidewalk:parkWalk?parkMat:concreteWalk?sidewalk:roadMat;
   const lift=streetSurfaceLift(road),joins={joinA:streetVertexNormal(road.points,i-1),joinB:streetVertexNormal(road.points,i)};
   const exclusions=streetJoinExclusions(road,a,b,width+4,heightAt);
   const sidewalkApproach=!hasStreetCurb(road);
   const elevation=(px:number,pz:number,terrain:number)=>streetElevation(road,px,pz,terrain);
   // Thin flush aggregate border, batched underneath the entire path surface.
   if(parkWalk)strip(parkEdge,a[0],a[1],b[0],b[1],width+.14,0,elevation,.025,undefined,joins,exclusions);
   strip(surface,a[0],a[1],b[0],b[1],width,0,elevation,lift,undefined,joins,sidewalkApproach?exclusions:undefined);
   for(const p of [a,b]){
     // A path or driveway stops at the sidewalk. A rounded cap centred
     // inside that corridor can otherwise poke through into the opposite lawn.
     if(sidewalkApproach&&exclusions.some(poly=>insideStreetFootprint({x:p[0],z:p[1]},poly)))continue;
     const key=`${p[0]},${p[1]},${width},${walk},${road.bridge},${concreteWalk},${parkWalk}`;
     if(junctions.has(key))continue;junctions.add(key);
     if(parkWalk)append(parkEdge,drapeJunction(p[0],p[1],width+.14,world.chunks,elevation,.025,exclusions));
     append(surface,drapeJunction(p[0],p[1],width,world.chunks,elevation,lift,sidewalkApproach?exclusions:undefined));
   }
   if(hasStreetCurb(road)){
     for(const sign of [-1,1]){
       const raised=(px:number,pz:number,terrain:number)=>elevation(px,pz,terrain)+curbRise(road,px,pz);
       const walkHalf=sidewalkHalfWidth(road);
       strip(sidewalk,a[0],a[1],b[0],b[1],walkHalf,sign*(width+.15+walkHalf),raised,.035,1.2,joins,exclusions);
       // A chamfered front and a separate cap replace the nearly flat painted ribbon.
       const face=(px:number,pz:number,terrain:number)=>{
         const lateral=Math.abs((px-a[0])*(-dz/length)+(pz-a[1])*(dx/length));
         return elevation(px,pz,terrain)+curbRise(road,px,pz)*Math.max(0,Math.min(1,(lateral-width)/.08));
       };
       strip(curb,a[0],a[1],b[0],b[1],.04,sign*(width+.04),face,.035,1.2,joins,exclusions);
       strip(curb,a[0],a[1],b[0],b[1],.12,sign*(width+.20),raised,.035,1.2,joins,exclusions);
       // Fine expansion joints distinguish slabs without making physical bumps.
       for(let d=1.6;d<length-.4;d+=2.1){
        const px=a[0]+dx*d/length,pz=a[1]+dz*d/length;
        if(!clearStreetJunction(road,px,pz,3))continue;
        const offset=sign*(width+.15+walkHalf),nx=-dz/length,nz=dx/length;
        strip(seam,px+nx*(offset-walkHalf+.04),pz+nz*(offset-walkHalf+.04),px+nx*(offset+walkHalf-.04),pz+nz*(offset+walkHalf-.04),.009,0,raised,.044);
       }
     }
     const marking=streetMarkingStyle(road);
     if(marking!=='none'){
       // Short draped pieces follow bends and preserve unpainted junction mouths.
       for(let d=0;d<length;d+=2){
        const end=Math.min(d+2,length),mid=(d+end)/2,px=a[0]+dx*mid/length,pz=a[1]+dz*mid/length;
        if(!clearStreetJunction(road,px,pz,3))continue;
        const x0=a[0]+dx*d/length,z0=a[1]+dz*d/length,x1=a[0]+dx*end/length,z1=a[1]+dz*end/length;
        const mark=(material:T.Material,half:number,offset:number,lift:number)=>{
          const boundary=streetFootprint({a:{x:a[0],z:a[1]},b:{x:b[0],z:b[1]},half,offset,lift,...joins});
          append(material,drapeStreet({a:{x:x0,z:z0},b:{x:x1,z:z1},half,offset,lift,boundary,exclude:material===whitePaint?exclusions:undefined,joinA:d===0?joins.joinA:undefined,joinB:end===length?joins.joinB:undefined},world.chunks,elevation));
        };
        if(marking==='double-yellow')for(const offset of [-.10,.10])mark(paint,.055,offset,.047);
        else if(Math.floor(d/2)%4<2)mark(paint,.06,0,.047);
        for(const side of [-1,1])mark(whitePaint,.055,side*(width-.32),.048);
       }
     }
   }
 }
 const surfaces:Array<[T.Group,Array<[T.Material,number[]|Float32Array]>]>=cached?cached.tiles.map(t=>[groupAt(t.x,t.z),[[cacheMaterials[t.material],cached.positions.subarray(t.offset,t.offset+t.count)]]]):[...paths].map(([g,bins])=>[g,[...bins]]);
 if(cached){streetSections=cached.sections;streetTriangles=cached.triangles;}
 for(const[g,bins]of surfaces)for(const[material,positions]of bins){if(!material)throw Error('Unknown cached street material');const geo=new T.BufferGeometry();geo.userData.streetCacheMaterial=Object.keys(cacheMaterials).find(k=>cacheMaterials[k]===material);geo.setAttribute('position',positions instanceof Float32Array?new T.BufferAttribute(positions,3):new T.Float32BufferAttribute(positions,3));
   // These ribbons can sit above the bank terrain and extend beyond the deck.
   // Share their exact surface with riding, dog paws, falls and camera queries.
   if(material!==paint&&material!==whitePaint&&material!==seam)world.addRideSurface(geo.attributes.position.array as Float32Array);
   const uv=new Float32Array(positions.length/3*2),scale=material===parkMat?1.1:material===sidewalk?4:2;for(let i=0;i<positions.length;i+=3){const u=i/3*2;uv[u]=positions[i]/scale-Math.floor(g.userData.center.x/scale);uv[u+1]=positions[i+2]/scale-Math.floor(g.userData.center.z/scale);}geo.setAttribute('uv',new T.BufferAttribute(uv,2));geo.computeVertexNormals();const m=new T.Mesh(geo,material);m.name=material===parkMat?'Milliken smooth park paths':material===sidewalk?'Concrete sidewalks':'Mapped street surface';m.receiveShadow=true;g.add(m);}
 if(!world.buildingMeshes.length)return{blocks:0,landmarks:[] as string[],bridges:GEO.bridges.length,ramps:GEO.ramps.length,mapped:true,streetSections,streetTriangles,streetTiles:paths.size,cached:!!cached};
 const residential=new Map([[3,orleansMaterial(3)],[4,orleansMaterial(4)]]);
 const landmarks:string[]=[];
 for(const{data:b,geometry:geo}of world.buildingMeshes){
   if(b.id==='777936143')continue; // Original Blender Shed replaces generic facade, retaining footprint collision.
   geo.computeBoundingBox();const bounds=geo.boundingBox!,center=bounds.getCenter(new T.Vector3()),g=groupAt(center.x,center.z);
   const pos=geo.getAttribute('position'),normal=geo.getAttribute('normal'),uv=geo.getAttribute('uv');
   // Eight metre facade repeat preserves plausible door/window scale.
   for(let i=0;i<pos.count;i++)uv.setXY(i,(Math.abs(normal.getX(i))>.5?pos.getZ(i):pos.getX(i))/8,pos.getY(i)/7.5);
   const floors=orleansFloors(b.id);
   if(floors)for(let i=0;i<pos.count;i++)uv.setXY(i,(Math.abs(normal.getX(i))>.5?pos.getZ(i):pos.getX(i))/9.6,(pos.getY(i)-bounds.min.y)/(floors*3.3));
   const side=floors?residential.get(floors)!:facades[Math.floor(hash(Number(b.id))*facades.length)];
   const mesh=new T.Mesh(geo,[roof,side]);mesh.name='OSM '+b.id+' '+b.name;mesh.userData={osmId:b.id,source:'OSM footprint; facade and height require visual verification'};mesh.castShadow=mesh.receiveShadow=true;g.add(mesh);
   // Cornice follows every polygon edge, including non-rectangular footprints.
   for(let i=1;i<b.points.length;i++){
     const a=b.points[i-1],c=b.points[i],len=Math.hypot(c[0]-a[0],c[1]-a[1]);if(len<.6)continue;
     const m=new T.Mesh(new T.BoxGeometry(.22,.22,len),curb);m.position.set((a[0]+c[0])/2,bounds.max.y,(a[1]+c[1])/2);m.rotation.y=Math.atan2(c[0]-a[0],c[1]-a[1]);m.castShadow=true;g.add(m);
   }
   // Retain custom architectural detail only where an exact named footprint exists.
   const id=b.id==='59452104'?'DS_Detroit_Globe_OAC':b.id==='59440457'?'DS_Detroit_Shed_3':null;
   if(id){const load=async()=>{
     const asset=(await new GLTFLoader().loadAsync('/exports/architecture/'+id+'.glb')).scene;
     const box=new T.Box3().setFromObject(asset),size=box.getSize(new T.Vector3());
     // Detail stays inside the mapped envelope; the envelope is authoritative.
     const scale=Math.min((bounds.max.x-bounds.min.x)/size.x,(bounds.max.z-bounds.min.z)/size.z,.98);
     asset.scale.setScalar(scale);asset.position.set(center.x-(box.min.x+size.x/2)*scale,geo.userData.streetBase-box.min.y*scale,center.z-(box.min.z+size.z/2)*scale);
     asset.traverse(o=>{if((o as T.Mesh).isMesh){o.castShadow=o.receiveShadow=true;}});g.add(asset);landmarks.push(id);};if(stream)stream.add({id:'architecture-'+id,centers:[{x:center.x,z:center.z}],load});else await load();
   }
 }
 return{blocks:world.buildingMeshes.length,landmarks,bridges:GEO.bridges.length,ramps:GEO.ramps.length,mapped:true,streetSections,streetTriangles,streetTiles:cached?new Set(cached.tiles.map(t=>t.x+','+t.z)).size:paths.size,cached:!!cached};
}
