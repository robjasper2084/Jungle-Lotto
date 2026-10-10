import {roadsidePoint,roadwayClearance,streetFacingHeading} from './roadsidePlacement.ts';
import {dryStreetSite} from './dryStreetSite.ts';
import {heightAt} from './world.ts';
import {CITY,riverEdge,nearestCut,pointOnCut} from './geography.ts';
import {clearStreetJunction} from './streetFurnitureLayout.ts';
import {streetSurfaceLift} from './street-geometry.ts';
import {cutWidth} from './geo-profile.ts';
import {segmentDistance} from './roadsidePlacement.ts';
import {studioMap,studioCoordinates} from './mackStudioSite.ts';
export const FOOD_TRUCK_REVISION='atwater-curb-cut-carts-20261010-v5';
export const VENDORS={
 'sauce-pitt':{name:'Sauce Pitt BBQ',menu:'Smoked wings · Brisket · Ribs · Burgers',asset:'sauce-pitt-truck'},
 'paradise':{name:'Paradise Sea Moss',menu:'Sea moss drinks · Tropical smoothies · Jamaican patties',asset:'paradise-truck'},
 'tacos':{name:'Atwater Taco Kitchen',menu:'Street tacos · Quesadillas · Fresh lime drinks',asset:'taco-truck'},
 'burgers':{name:'River City Burgers',menu:'Smash burgers · Fries · Lemonade',asset:'burger-truck'},
 'ice-cream':{name:'RiverWalk Scoops',menu:'Ice cream · Sundaes · Fruit pops',asset:'ice-cream-truck'},
 'coffee':{name:'Cut Coffee',menu:'Coffee · Cold brew · Pastries',asset:'coffee-truck'},
} as const;
export type VendorId=keyof typeof VENDORS;
/** Fictional gathering spots; never presented as actual vendor locations. */
const wanted:Array<{name:string;x:number;z:number;vendor:VendorId}>=[{name:'Atwater / Milliken',x:-56,z:-1235,vendor:'sauce-pitt'},{name:'Atwater / Valade',x:-145,z:-1780,vendor:'sauce-pitt'},{name:'Atwater east',x:15,z:380,vendor:'sauce-pitt'},{name:'Mack studio gathering',x:2495,z:-1465,vendor:'sauce-pitt'},
 {name:'Atwater / Paradise',x:-147,z:-1748,vendor:'paradise'},{name:'Atwater / Taco Kitchen',x:-125,z:-1600,vendor:'tacos'},{name:'Atwater / Burgers',x:-83,z:-1050,vendor:'burgers'},{name:'Atwater / Scoops',x:-58,z:-480,vendor:'ice-cream'},{name:'Atwater / Coffee',x:-17,z:150,vendor:'coffee'}];
export function truckFootprint(p:{x:number;z:number;yaw:number}){return [[-1.5,-3.7],[3.05,-3.7],[3.05,3.7],[-1.5,3.7],[0,0]].map(([x,z])=>({x:p.x+Math.cos(p.yaw)*x+Math.sin(p.yaw)*z,z:p.z-Math.sin(p.yaw)*x+Math.cos(p.yaw)*z}));}
/** Previous snapshot truck proxies are retired when the fixture is rebuilt. */
export const LEGACY_TRUCK_SITES=wanted.slice(0,4).flatMap(site=>{
 const yaw=streetFacingHeading(site,site.name.startsWith('Atwater')?'Atwater Street':undefined)-Math.PI/2;
 const point=roadsidePoint(site.x,site.z,(x,z)=>{
  const footprint=truckFootprint({x,z,yaw}),heights=footprint.map(q=>heightAt(q.x,q.z));
  return Math.max(...heights)-Math.min(...heights)<.22&&footprint.every(q=>{const safe=roadsidePoint(q.x,q.z);return dryStreetSite(q.x,q.z,.2)&&roadwayClearance(q)>3.2&&safe?.x===q.x&&safe?.z===q.z;});
 });
 return point?[{...point,y:heightAt(point.x,point.z),yaw,name:site.name,vendor:site.vendor}]:[];
});
const atwater=CITY.roads.filter(r=>r.name==='Atwater Street'&&!r.bridge&&r.width>=8.4);
export function atwaterCurb(p:{x:number;z:number}){let best:{distance:number;road:typeof CITY.roads[number];a:number[];b:number[];t:number;x:number;z:number}|undefined;
 for(const road of atwater)for(let i=1;i<road.points.length;i++){const a=road.points[i-1],b=road.points[i],dx=b[0]-a[0],dz=b[1]-a[1],l2=dx*dx+dz*dz;if(l2<.01)continue;const t=Math.max(0,Math.min(1,((p.x-a[0])*dx+(p.z-a[1])*dz)/l2)),x=a[0]+dx*t,z=a[1]+dz*t,distance=Math.hypot(p.x-x,p.z-z);if(!best||distance<best.distance)best={distance,road,a,b,t,x,z};}return best;
}
export const FOOD_TRUCK_SITES: Array<{x:number;z:number;y:number;yaw:number;name:string;vendor:VendorId;curbside:boolean}>=[];
for(const site of wanted){
 if(!site.name.startsWith('Atwater')){const legacy=LEGACY_TRUCK_SITES.find(p=>p.name===site.name);if(legacy)FOOD_TRUCK_SITES.push({...legacy,curbside:false});continue;}
 const nearest=atwaterCurb(site);if(!nearest)continue;
 const {road,a,b}=nearest,dx=b[0]-a[0],dz=b[1]-a[1],len=Math.hypot(dx,dz),nx=-dz/len,nz=dx/len,preferred=(site.x-nearest.x)*nx+(site.z-nearest.z)*nz<0?-1:1;
 let parked=false;
 for(const side of [preferred,-preferred])for(const shift of [0,16,-16,32,-32,48,-48,64,-64,80,-80]){
  if(parked)break;const station=Math.max(0,Math.min(len,nearest.t*len+shift)),base={x:a[0]+dx*station/len,z:a[1]+dz*station/len};
  const offset=road.width/2-1.38-.30,x=base.x+nx*side*offset,z=base.z+nz*side*offset,yaw=Math.atan2(dx,dz)+(side>0?Math.PI:0);
  const body=[[-1.38,-3.55],[1.38,-3.55],[1.38,3.55],[-1.38,3.55]].map(([u,v])=>({x:x+Math.cos(yaw)*u+Math.sin(yaw)*v,z:z-Math.sin(yaw)*u+Math.cos(yaw)*v}));
  if(!clearStreetJunction(road,x,z,10)||FOOD_TRUCK_SITES.some(p=>Math.hypot(p.x-x,p.z-z)<16))continue;
  if(body.some(q=>{const curb=atwaterCurb(q),c=nearestCut(q.x,q.z);return !dryStreetSite(q.x,q.z,.2)||!curb||curb.distance>curb.road.width/2-.12||curb.distance<1.0||(c.d<15&&Math.abs(c.u)<10);}))continue;
  const heights=body.map(q=>heightAt(q.x,q.z));if(Math.max(...heights)-Math.min(...heights)>.18)continue;
  FOOD_TRUCK_SITES.push({x,z,y:heightAt(x,z)+streetSurfaceLift(road),yaw,name:site.name,vendor:site.vendor,curbside:true});parked=true;
 }
}
const walks=CITY.roads.filter(r=>/riverwalk/i.test(r.name||''));
function nearestWalk(x:number,z:number){let best:{x:number;z:number;width:number;distance:number}|undefined;for(const r of walks)for(let i=1;i<r.points.length;i++){const a=r.points[i-1],b=r.points[i],dx=b[0]-a[0],dz=b[1]-a[1],len=dx*dx+dz*dz;if(len<.01)continue;const t=Math.max(0,Math.min(1,((x-a[0])*dx+(z-a[1])*dz)/len)),q={x:a[0]+dx*t,z:a[1]+dz*t,width:r.width,distance:segmentDistance({x,z},a,b)};if(!best||q.distance<best.distance)best=q;}return best;}
export function cartFootprint(p:{x:number;z:number;yaw:number}){return [[-.85,-1.25],[.85,-1.25],[.85,1.25],[-.85,1.25],[0,0]].map(([x,z])=>({x:p.x+Math.cos(p.yaw)*x+Math.sin(p.yaw)*z,z:p.z-Math.sin(p.yaw)*x+Math.cos(p.yaw)*z}));}
export const FOOD_CART_SITES=[-1840,-1580,-1150,-900,-380,70].flatMap((z,i)=>{
 const walk=nearestWalk(riverEdge(z)+16,z);if(!walk)return[];
 const seed={x:walk.x+walk.width/2+3.2,z:walk.z};
 const yaw=Math.atan2(walk.x-seed.x,walk.z-seed.z)-Math.PI/2;
 const point=roadsidePoint(seed.x,seed.z,(x,z)=>{const f=cartFootprint({x,z,yaw}),hs=f.map(q=>heightAt(q.x,q.z));return Math.max(...hs)-Math.min(...hs)<.2&&f.every(q=>dryStreetSite(q.x,q.z,.25)&&roadwayClearance(q)>1.5);});
 return point?[{...point,y:heightAt(point.x,point.z),yaw,name:'RiverWalk Sea Moss cart '+(i+1),vendor:'paradise' as const}]:[];
});
for(const [i,station]of [90,570,1110,1590].entries()){
 let placed=false;
 for(const shift of [0,12,-12,24,-24,40,-40])for(const side of [-1,1])for(const extra of [1.7,2.2,3.0,4.0]){
  if(placed)break;const d=station+shift,center=pointOnCut(d),p=pointOnCut(d,side*(cutWidth(d)/2+extra)),yaw=Math.atan2(center.x-p.x,center.z-p.z)-Math.PI/2,f=cartFootprint({...p,yaw}),hs=f.map(q=>heightAt(q.x,q.z));
  if(Math.max(...hs)-Math.min(...hs)>.18||FOOD_CART_SITES.some(q=>Math.hypot(q.x-p.x,q.z-p.z)<12)||!f.every(q=>{const c=nearestCut(q.x,q.z);return Math.abs(c.u)>cutWidth(c.d)/2+.5&&dryStreetSite(q.x,q.z,.25)&&roadwayClearance(q)>.75;}))continue;
  FOOD_CART_SITES.push({...p,y:heightAt(p.x,p.z),yaw,name:'Dequindre Cut Sea Moss cart '+(i+1),vendor:'paradise'});placed=true;
 }
}

// Place small carts at the sidewalk's grass edge. Keep the full pedestrian
// corridor open and leave the truck's serving space and street junctions clear.
for(const [i,z]of [-1680,-1410,-840,-260].entries()){
 const near=atwaterCurb({x:-70,z});if(!near)continue;
 const {road,a,b}=near,dx=b[0]-a[0],dz=b[1]-a[1],len=Math.hypot(dx,dz),nx=-dz/len,nz=dx/len;let placed=false;
 for(const shift of [0,12,-12,24,-24,40,-40])for(const side of [-1,1])for(const verge of [3.85,4.8,5.8,7.0]){
  if(placed)break;const d=Math.max(0,Math.min(len,near.t*len+shift)),offset=road.width/2+verge;
  const p={x:a[0]+dx*d/len+nx*side*offset,z:a[1]+dz*d/len+nz*side*offset},yaw=Math.atan2(dx,dz)+(side<0?Math.PI:0),f=cartFootprint({...p,yaw}),hs=f.map(q=>heightAt(q.x,q.z));
  if(!clearStreetJunction(road,p.x,p.z,8)||Math.max(...hs)-Math.min(...hs)>.18||[...FOOD_CART_SITES,...FOOD_TRUCK_SITES].some(q=>Math.hypot(q.x-p.x,q.z-p.z)<12)||!f.every(q=>dryStreetSite(q.x,q.z,.25)&&roadwayClearance(q)>2.8))continue;
  FOOD_CART_SITES.push({...p,y:heightAt(p.x,p.z),yaw,name:'Atwater curb Sea Moss cart '+(i+1),vendor:'paradise'});placed=true;
 }
}
const outside=studioMap(12,25.7),outsideYaw=Math.atan2(studioMap(0,25.7).x-outside.x,studioMap(0,25.7).z-outside.z)-Math.PI/2;
if(cartFootprint({...outside,yaw:outsideYaw}).every(p=>{const q=studioCoordinates(p.x,p.z);return q.v>22.2&&Math.abs(q.u)>5&&dryStreetSite(p.x,p.z,.25);}))FOOD_CART_SITES.push({...outside,y:heightAt(outside.x,outside.z),yaw:outsideYaw,name:'GothTech storefront Sea Moss cart',vendor:'paradise'});
export function foodTruckSolids(){return FOOD_TRUCK_SITES.flatMap(p=>[
 {x:p.x,y:p.y+1.55,z:p.z,hx:1.38,hy:1.55,hz:3.55,yaw:p.yaw,kind:'Food truck · '+p.vendor},
 {x:p.x+Math.cos(p.yaw)*2.7+Math.sin(p.yaw)*.75,y:p.y+.9,z:p.z-Math.sin(p.yaw)*2.7+Math.cos(p.yaw)*.75,hx:.16,hy:.9,hz:1.03,yaw:p.yaw,kind:'Food truck menu'}
 ]).concat(FOOD_CART_SITES.map(p=>({x:p.x,y:p.y+.75,z:p.z,hx:.8,hy:.75,hz:1.15,yaw:p.yaw,kind:p.name.replace(/ \d+$/,'')})));}
