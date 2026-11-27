import {districts} from './detroitGround.ts';
import {JEFFERSON_BUILDINGS,planJeffersonBuildings,type JeffersonBuildingPlan} from './jeffersonBuildings.ts';
import {JEFFERSON_SIGNAL_INVENTORY,JEFFERSON_SIGNAL_SOURCE,projectJeffersonSignal} from './jeffersonSignalPlan.ts';
import {inside,segment,type Landmark,type ParkTerrain,type Point} from './terrain.ts';

type Road={id:string;name:string;width:number;points:readonly Point[];foot?:boolean;bridge?:boolean;sidewalk?:boolean};
type Building={id:string;points:Point[];holes?:Point[][]};
type RoadSegment={road:Road;a:Point;b:Point;dx:number;dz:number;length:number};
export type JeffersonTravelView={x:number;z:number;heading:number;pitch:number;lookX:number;lookZ:number;lookY:number;sourceId:string;roadId:string;distance:number;surface:'sidewalk'|'road'};
const CLEARANCE=1.25,MAX_VIEW_DISTANCE=140;
const streetStops=[
 {id:'jefferson-street-grand-boulevard',name:'Jefferson Avenue · East Grand Boulevard',sourceId:214},
 {id:'jefferson-street-woodward',name:'Jefferson Avenue · Woodward downtown',sourceId:1204},
] as const;
export const jeffersonStreetDestinations:readonly Landmark[]=Object.freeze(streetStops.map(stop=>{
 const source=JEFFERSON_SIGNAL_INVENTORY.find(s=>s.objectId===stop.sourceId)!,[x,z]=projectJeffersonSignal(source.longitude,source.latitude);
 return Object.freeze({id:stop.id,name:stop.name,x,z,kind:'trail',viewDistance:45,reference:JEFFERSON_SIGNAL_SOURCE,description:stop.sourceId===214?'East Jefferson at East Grand Boulevard. Look west along the street toward downtown.':'East Jefferson at Woodward Avenue. View the downtown intersection and its surrounding buildings.'});
}));

function lineCrossing(from:Point,to:Point,a:Point,b:Point):number|undefined{
 const dx=to[0]-from[0],dz=to[1]-from[1],ex=b[0]-a[0],ez=b[1]-a[1],det=dx*ez-dz*ex;
 if(Math.abs(det)<1e-10)return;
 const ax=a[0]-from[0],az=a[1]-from[1],t=(ax*ez-az*ex)/det,u=(ax*dz-az*dx)/det;
 return t>=0&&t<=1&&u>=0&&u<=1?t:undefined;
}
/** Exact edge crossings avoid missing narrow occluders between sample points. */
function occupiedIntervals(from:Point,to:Point,building:Building){
 const cuts=[0,1];
 for(const ring of [building.points,...(building.holes??[])])for(let i=0;i<ring.length;i++){
  const hit=lineCrossing(from,to,ring[i],ring[(i+1)%ring.length]);if(hit!==undefined)cuts.push(hit);
 }
 cuts.sort((a,b)=>a-b);
 const intervals:[number,number][]=[];
 for(let i=1;i<cuts.length;i++){
  if(cuts[i]-cuts[i-1]<1e-10)continue;
  const t=(cuts[i]+cuts[i-1])*.5,x=from[0]+(to[0]-from[0])*t,z=from[1]+(to[1]-from[1])*t;
  if(inside(x,z,building.points)&&!(building.holes??[]).some(h=>inside(x,z,h)))intervals.push([cuts[i-1],cuts[i]]);
 }
 return intervals;
}
/** The exact source ID is excluded, never the UI's prefixed destination ID and
 * never a proximity-based set of neighboring buildings. Courtyards remain open. */
export function jeffersonViewOccluded(from:Point,to:Point,targetSourceId:string|undefined,buildings:readonly Building[]){
 return buildings.some(b=>b.id!==targetSourceId&&occupiedIntervals(from,to,b).length>0);
}
function mainlineSegments(roads:readonly Road[]){
 const all:RoadSegment[]=[];
 for(const road of roads){
  if(road.foot||road.bridge||!/jefferson/i.test(road.name)||!Number.isFinite(road.width)||road.width<=0)continue;
  for(let i=1;i<road.points.length;i++){
   const a=road.points[i-1],b=road.points[i],dx=b[0]-a[0],dz=b[1]-a[1],length=Math.hypot(dx,dz);
   if(!Number.isFinite(length)||length<.1||Math.abs((dx*.864-dz*.503)/length)<.78)continue;
   all.push({road,a,b,dx,dz,length});
  }
 }
 // Keep the road component joined to the existing Grand Boulevard arrival.
 // The extension's first segment shares the exact existing Jefferson endpoint.
 const connected=new Set(all.filter(s=>segment(0,0,s.a,s.b).d<48));
 let changed=true;
 while(changed){changed=false;for(const candidate of all){
  if(connected.has(candidate))continue;
  for(const present of connected){
   if(segment(...candidate.a,present.a,present.b).d<=3||segment(...candidate.b,present.a,present.b).d<=3||segment(...present.a,candidate.a,candidate.b).d<=3||segment(...present.b,candidate.a,candidate.b).d<=3){connected.add(candidate);changed=true;break;}
  }
 }}
 return [...connected];
}
type Candidate={point:Point;roadPoint:Point;road:Road;surface:'sidewalk'|'road';score:number};
function candidates(segments:readonly RoadSegment[],look:Point,score:(point:Point,surface:'sidewalk'|'road')=>number){
 const output:Candidate[]=[],seen=new Set<string>();
 for(const s of segments){
  if(segment(...look,s.a,s.b).d>MAX_VIEW_DISTANCE)continue;
  const steps=Math.max(1,Math.ceil(s.length/4)),rx=-s.dz/s.length,rz=s.dx/s.length;
  const offsets:{value:number;surface:'sidewalk'|'road'}[]=[{value:0,surface:'road'},{value:Math.max(0,s.road.width*.5-1.5),surface:'road'},{value:-Math.max(0,s.road.width*.5-1.5),surface:'road'}];
  // Match detroitScene's qualified City sidewalks. An omitted sidewalk must
  // never supply a Guide position merely because its road uses a City ID.
  if(s.road.sidewalk!==false&&s.road.id.startsWith('city-'))offsets.unshift({value:s.road.width*.5+.85,surface:'sidewalk'},{value:-s.road.width*.5-.85,surface:'sidewalk'});
  for(let i=0;i<=steps;i++){
   const roadPoint:Point=[s.a[0]+s.dx*i/steps,s.a[1]+s.dz*i/steps];
   for(const offset of offsets){
    const point:Point=[roadPoint[0]+rx*offset.value,roadPoint[1]+rz*offset.value];
    const distance=Math.hypot(point[0]-look[0],point[1]-look[1]);if(distance<12||distance>MAX_VIEW_DISTANCE)continue;
    const value=score(point,offset.surface);if(!Number.isFinite(value))continue;
    const key=point.map(v=>v.toFixed(2)).join(',');if(seen.has(key))continue;seen.add(key);
    output.push({point,roadPoint,road:s.road,surface:offset.surface,score:value});
   }
  }
 }
 return output.sort((a,b)=>a.score-b.score);
}
function clearRoadConnection(candidate:Candidate,terrain:ParkTerrain){
 const p=candidate.point,q=candidate.roadPoint,steps=Math.max(1,Math.ceil(Math.hypot(p[0]-q[0],p[1]-q[1])));
 for(let i=0;i<=steps;i++){const x=p[0]+(q[0]-p[0])*i/steps,z=p[1]+(q[1]-p[1])*i/steps;if(!terrain.land(x,z)||terrain.obstructed(x,z,CLEARANCE))return false;}
 return true;
}
function clearView(candidate:Candidate,look:Point,lookY:number,terrain:ParkTerrain,buildings:readonly Building[],target?:Building){
 let end:Point=look;
 if(target){
  const first=occupiedIntervals(candidate.point,look,target)[0];if(!first)return false;
  const distance=Math.hypot(look[0]-candidate.point[0],look[1]-candidate.point[1]);
  const t=Math.max(0,first[0]-.5/distance);
  if(t<=0)return false;
  end=[candidate.point[0]+(look[0]-candidate.point[0])*t,candidate.point[1]+(look[1]-candidate.point[1])*t];
 }
 if(jeffersonViewOccluded(candidate.point,end,target?.id,buildings))return false;
 // The original camera collision query retains poles, bridges, rails and all
 // unrelated solids. Stop before the target facade rather than bypassing it.
 const eye={x:candidate.point[0],y:terrain.height(...candidate.point)+1.65,z:candidate.point[1]};
 const dx=end[0]-eye.x,dz=end[1]-eye.z,fullDistance=Math.hypot(look[0]-eye.x,look[1]-eye.z);
 const dy=(lookY-eye.y)*Math.hypot(dx,dz)/fullDistance,length=Math.hypot(dx,dy,dz);
 return length>.1&&terrain.raycastCamera(eye,{x:dx/length,y:dy/length,z:dz/length},length,.16)===null;
}

/** Normal Guide travel, using the existing player travel path. No camera/actor
 * mutation, no capture hook, and no distant fallback when a safe view is absent. */
export function selectJeffersonTravelView(terrain:ParkTerrain,destinationId:string,options:{roads?:readonly Road[];plans?:readonly JeffersonBuildingPlan[];buildings?:readonly Building[]}={}):JeffersonTravelView|undefined{
 const profile=JEFFERSON_BUILDINGS.find(p=>'jefferson-'+p.id===destinationId),stop=jeffersonStreetDestinations.find(s=>s.id===destinationId);
 if(!profile&&!stop)return;
 const roads=options.roads??[...terrain.map.roads,...districts.roads],segments=mainlineSegments(roads);
 const buildings=options.buildings??[...terrain.map.buildings,...districts.buildings];
 let look:Point,lookY:number,sourceId:string,target:Building|undefined,rank:(p:Point,s:'sidewalk'|'road')=>number;
 if(profile){
  const plan=(options.plans??planJeffersonBuildings(terrain.map,(x,z)=>terrain.height(x,z))).find(p=>p.profile.id===profile.id);if(!plan)return;
  look=plan.center;target=plan.source;sourceId=profile.id;
  const height=Math.max(profile.wallHeight,profile.rearHeight??0)+profile.roofHeight,desired=Math.max(28,Math.min(100,Math.max(height*1.25,(plan.u1-plan.u0)*.65)));
  lookY=plan.base+height*.46;
  rank=(p,s)=>{const dx=p[0]-look[0],dz=p[1]-look[1],distance=Math.hypot(dx,dz),front=(dx*plan.front[0]+dz*plan.front[1])/distance;
   return front<.28?Infinity:Math.abs(distance-desired)*.55+(1-front)*52+(s==='sidewalk'?0:9);};
 }else{
  look=[stop!.x,stop!.z];lookY=terrain.height(...look)+3.8;sourceId=streetStops.find(s=>s.id===destinationId)!.sourceId.toString();
  // Both public viewpoints approach their intersection from the east and face
  // west along Jefferson; source street geometry still determines the position.
  const desired:Point=[look[0]+.864*45,look[1]-.503*45];
  rank=(p,s)=>{const dx=p[0]-look[0],dz=p[1]-look[1];return dx*.864-dz*.503<18?Infinity:Math.hypot(p[0]-desired[0],p[1]-desired[1])+(s==='sidewalk'?0:9);};
 }
 for(const candidate of candidates(segments,look,rank)){
  if(!clearRoadConnection(candidate,terrain)||!clearView(candidate,look,lookY,terrain,buildings,target))continue;
  const [x,z]=candidate.point,distance=Math.hypot(look[0]-x,look[1]-z);
  return{x,z,heading:Math.atan2(look[0]-x,look[1]-z),pitch:-Math.atan2(lookY-terrain.height(x,z)-1.65,distance),lookX:look[0],lookZ:look[1],lookY,sourceId,roadId:candidate.road.id,distance,surface:candidate.surface};
 }
}
