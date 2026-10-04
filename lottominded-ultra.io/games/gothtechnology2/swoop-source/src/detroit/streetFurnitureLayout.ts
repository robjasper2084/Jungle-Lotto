import {CITY} from './geography.ts';
import {hasStreetCurb} from './streetCurbs.ts';
import {roadsidePoint,roadwayClearance,segmentDistance,streetFacingHeading} from './roadsidePlacement.ts';
import {dryStreetSite} from './dryStreetSite.ts';

export type StreetAsset='street-lamp'|'camera-pole'|'hydrant'|'bench'|'waste-bin'|'bike-rack'|'drain-grate'|'utility-cover';
export type StreetSite={asset:StreetAsset;x:number;z:number;heading:number;street:string;side:number};
type Road=typeof CITY.roads[number];
const streets=CITY.roads.filter(r=>r.name&&hasStreetCurb(r)&&!r.bridge);
const crossSegments=streets.flatMap(r=>r.points.slice(1).map((b,i)=>({road:r,a:r.points[i],b})));
const junctionGrid=new Map<string,typeof crossSegments>();
for(const s of crossSegments)for(let x=Math.floor((Math.min(s.a[0],s.b[0])-16)/64);x<=Math.floor((Math.max(s.a[0],s.b[0])+16)/64);x++)for(let z=Math.floor((Math.min(s.a[1],s.b[1])-16)/64);z<=Math.floor((Math.max(s.a[1],s.b[1])+16)/64);z++){
 const key=x+','+z,list=junctionGrid.get(key)??[];list.push(s);junctionGrid.set(key,list);
}
/** Keep lane paint, drains and furniture clear of differently named junctions. */
export function clearStreetJunction(road:Road,x:number,z:number,margin=2){
 return (junctionGrid.get(Math.floor(x/64)+','+Math.floor(z/64))??[]).every(s=>s.road.name===road.name||segmentDistance({x,z},s.a,s.b)>s.road.width/2+margin);
}
export function sidewalkHalfWidth(road:Pick<Road,'name'>){return road.name==='Atwater Street'?1.4:.95;}
export function streetMarkingStyle(road:Road){
 if(!hasStreetCurb(road)||!road.name||road.kind==='service')return 'none';
 return road.name==='Atwater Street'||['primary','secondary','tertiary'].includes(road.kind)?'double-yellow':'dashed-yellow';
}

/** Stable metre spacing over entire polylines, rather than resetting each OSM vertex.
 * Original assets have estimated placement; road footprints remain mapped. */
export function streetFurnitureSites(allowed:(x:number,z:number)=>boolean){
 const sites:StreetSite[]=[],occupied=new Map<string,StreetSite[]>();
 function accept(site:StreetSite,minDistance:number){
  const cx=Math.floor(site.x/20),cz=Math.floor(site.z/20);
  for(let x=cx-1;x<=cx+1;x++)for(let z=cz-1;z<=cz+1;z++)if((occupied.get(x+','+z)??[]).some(s=>Math.hypot(s.x-site.x,s.z-site.z)<minDistance))return;
  sites.push(site);const key=cx+','+cz,list=occupied.get(key)??[];list.push(site);occupied.set(key,list);
 }
 for(const road of streets){
  let distance=0;
  for(let i=1;i<road.points.length;i++){
   const a=road.points[i-1],b=road.points[i],dx=b[0]-a[0],dz=b[1]-a[1],length=Math.hypot(dx,dz);if(length<.01)continue;
   const ux=dx/length,uz=dz/length,nx=-uz,nz=ux;
   const add=(asset:StreetAsset,period:number,phase:number,side:number,flush=false)=>{
    for(let at=Math.ceil((distance-phase)/period)*period+phase;at<distance+length;at+=period){
     const t=(at-distance)/length,x=a[0]+dx*t,z=a[1]+dz*t;
     if(!allowed(x,z)||!clearStreetJunction(road,x,z,flush?4:7))continue;
     const offset=flush?(asset==='drain-grate'?road.width/2-.35:road.width/2+1.05):road.width/2+sidewalkHalfWidth(road)*2+.65;
     const px=x+nx*side*offset,pz=z+nz*side*offset;
     // Tall furniture stays outside both the full sidewalk and all crossing paths.
     const minClearance=sidewalkHalfWidth(road)*2+.45;
     const point=flush?{x:px,z:pz}:roadsidePoint(px,pz,(qx,qz)=>allowed(qx,qz)&&roadwayClearance({x:qx,z:qz})>=minClearance);
     if(!point||!allowed(point.x,point.z)||!dryStreetSite(point.x,point.z))continue;
     const heading=asset==='bench'?streetFacingHeading(point,road.name):flush?Math.atan2(ux,uz):Math.atan2(-nx*side,-nz*side);
     accept({asset,...point,heading,street:road.name,side},flush?6:asset==='street-lamp'?17:5);
    }
   };
   for(const side of [-1,1]){
    add('street-lamp',38,side<0?10:29,side);
    add('drain-grate',28,16,side,true);
   }
   add('hydrant',112,45,1);add('utility-cover',76,25,1,true);
   add('camera-pole',228,83,1);
   if(road.name==='Atwater Street'){
    add('bench',88,54,-1);add('waste-bin',88,59,-1);add('bike-rack',176,64,-1);
   }
   distance+=length;
  }
 }
 return sites;
}
