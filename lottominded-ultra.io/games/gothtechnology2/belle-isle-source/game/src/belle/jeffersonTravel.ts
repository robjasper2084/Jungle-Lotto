import {districts} from './detroitGround.ts';
import {JEFFERSON_BUILDINGS,planJeffersonBuildings,type JeffersonBuildingPlan} from './jeffersonBuildings.ts';
import {JEFFERSON_SIGNAL_INVENTORY,JEFFERSON_SIGNAL_SOURCE,projectJeffersonSignal} from './jeffersonSignalPlan.ts';
import {inside,segment,type Landmark,type ParkTerrain,type Point} from './terrain.ts';

type Road={id:string;name:string;width:number;points:readonly Point[];foot?:boolean;bridge?:boolean;sidewalk?:boolean};
type Building={id:string;points:Point[];holes?:Point[][]};
type RoadSegment={road:Road;a:Point;b:Point;dx:number;dz:number;length:number;join?:Point};
export type JeffersonTravelView={x:number;z:number;heading:number;pitch:number;lookX:number;lookZ:number;lookY:number;sourceId:string;roadId:string;
 /** Horizontal distance to the actual facade aim point (intersection for a
  * street stop). The separate 140 m travel bound uses the source centroid. */
 distance:number;surface:'sidewalk'|'road';
 /** Building-only result: true fits the complete source/roof envelope with a
  * screen margin; false preserves a local frontage and full vertical extent
  * while some horizontal silhouette remains outside that margin. */
 fullFootprint?:boolean;
};
export type JeffersonTravelOptions={roads?:readonly Road[];plans?:readonly JeffersonBuildingPlan[];buildings?:readonly Building[];aspect?:number;verticalFov?:number};
// Normal, dismounted first-person play uses a 60-degree vertical FOV and a
// 1.55 m eye. The caller supplies its live viewport aspect; these are not
// capture-specific cameras or positions.
const CLEARANCE=1.25,MAX_VIEW_DISTANCE=140,EYE_HEIGHT=1.55,FRAME_MARGIN=.92;
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
function mainlineSegments(roads:readonly Road[],approachCenter?:Point){
 const all:RoadSegment[]=[],cross:RoadSegment[]=[];
 for(const road of roads){
  if(road.foot||road.bridge||!Number.isFinite(road.width)||road.width<=0)continue;
  for(let i=1;i<road.points.length;i++){
   const a=road.points[i-1],b=road.points[i],dx=b[0]-a[0],dz=b[1]-a[1],length=Math.hypot(dx,dz);
   if(!Number.isFinite(length)||length<.1)continue;
   const mainline=/jefferson/i.test(road.name)&&Math.abs((dx*.864-dz*.503)/length)>=.78;
   (mainline?all:cross).push({road,a,b,dx,dz,length});
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
 const result=[...connected];
 if(!approachCenter)return result;
 // Building portraits can step along a real cross street directly joined to
 // Jefferson. Only the intersecting source segment is eligible (at most 90 m
 // from its junction); this never floods into unrelated, multi-hop streets.
 for(const s of cross){
  if(segment(...approachCenter,s.a,s.b).d>MAX_VIEW_DISTANCE)continue;
  const joins:number[]=[];
  for(const main of connected){
   if(segment(...approachCenter,main.a,main.b).d>MAX_VIEW_DISTANCE+90)continue;
   const crossing=lineCrossing(s.a,s.b,main.a,main.b);if(crossing!==undefined)joins.push(crossing);
   if(segment(...s.a,main.a,main.b).d<=3)joins.push(0);
   if(segment(...s.b,main.a,main.b).d<=3)joins.push(1);
   for(const endpoint of [main.a,main.b]){const hit=segment(...endpoint,s.a,s.b);if(hit.d<=3)joins.push(hit.t);}
  }
  for(const join of joins){
   const t0=Math.max(0,join-90/s.length),t1=Math.min(1,join+90/s.length);
   const a:Point=[s.a[0]+s.dx*t0,s.a[1]+s.dz*t0],b:Point=[s.a[0]+s.dx*t1,s.a[1]+s.dz*t1];
   const dx=b[0]-a[0],dz=b[1]-a[1];
   result.push({road:s.road,a,b,dx,dz,length:Math.hypot(dx,dz),join:[s.a[0]+s.dx*join,s.a[1]+s.dz*join]});
  }
 }
 return result;
}
type Candidate={point:Point;roadPoint:Point;road:Road;surface:'sidewalk'|'road';score:number;join?:Point};
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
    const key=point.map(v=>v.toFixed(2)).join(',');if(seen.has(key))continue;seen.add(key);
    const value=score(point,offset.surface);if(!Number.isFinite(value))continue;
    output.push({point,roadPoint,road:s.road,surface:offset.surface,score:value,join:s.join});
   }
  }
 }
 return output.sort((a,b)=>a.score-b.score);
}
function clearRoadConnection(candidate:Candidate,terrain:ParkTerrain){
 const paths=[candidate.point,candidate.roadPoint,...(candidate.join?[candidate.join]:[])];
 for(let j=1;j<paths.length;j++){
  const p=paths[j-1],q=paths[j],steps=Math.max(1,Math.ceil(Math.hypot(p[0]-q[0],p[1]-q[1])));
  for(let i=0;i<=steps;i++){const x=p[0]+(q[0]-p[0])*i/steps,z=p[1]+(q[1]-p[1])*i/steps;if(!terrain.land(x,z)||terrain.obstructed(x,z,CLEARANCE))return false;}
 }
 return true;
}
type BuildingFrame={look:Point;lookY:number;heading:number;pitch:number;fullFootprint:boolean;extent:number;wholeExtent:number;front:number};
/** Bounds are measured from the source perimeter, including its depth, instead
 * of treating the centroid distance as the distance to the street facade. A
 * perspective divide after pitch is essential on narrow portrait viewports. */
function buildingFrame(point:Point,plan:JeffersonBuildingPlan,terrain:ParkTerrain,aspect:number,verticalFov:number):BuildingFrame|undefined{
 const dx=plan.center[0]-point[0],dz=plan.center[1]-point[1],distance=Math.hypot(dx,dz),front=(-dx*plan.front[0]-dz*plan.front[1])/distance;
 if(front<.28)return;
 const eyeY=terrain.height(...point)+EYE_HEIGHT,cfg=plan.profile;
 // Match the full roof/finial envelope, not just the wall or an estimated
 // mid-height at the footprint centroid. The source outline is unchanged.
 const top=plan.base+Math.max(cfg.wallHeight+cfg.roofHeight,cfg.rearHeight??0)+(cfg.kind==='bagley'||cfg.kind==='wells'?1.1:0);
 const tanV=Math.tan(verticalFov*Math.PI/360),tanH=tanV*aspect,centerHeading=Math.atan2(dx,dz);
 const angle=(q:Point)=>Math.atan2(Math.sin(Math.atan2(q[0]-point[0],q[1]-point[1])-centerHeading),Math.cos(Math.atan2(q[0]-point[0],q[1]-point[1])-centerHeading));
 const all=plan.source.points;
 const midpoint=(points:readonly Point[])=>{const angles=points.map(angle);return centerHeading+(Math.min(...angles)+Math.max(...angles))/2;};
 const frameAt=(heading:number,horizontal:readonly Point[],fullFootprint:boolean):BuildingFrame|undefined=>{
  const sin=Math.sin(heading),cos=Math.cos(heading);
  const vertices=all.flatMap(q=>[plan.base,top].map(y=>({q,side:(q[0]-point[0])*cos-(q[1]-point[1])*sin,depth:(q[0]-point[0])*sin+(q[1]-point[1])*cos,dy:y-eyeY})));
  if(vertices.some(v=>v.depth<=.1))return;
  const elevations=vertices.map(v=>Math.atan2(v.dy,v.depth)),up=(Math.min(...elevations)+Math.max(...elevations))/2,cu=Math.cos(up),su=Math.sin(up);
  const projected=vertices.map(v=>({...v,x:v.side/(v.depth*cu+v.dy*su)/tanH,y:(v.dy*cu-v.depth*su)/(v.depth*cu+v.dy*su)/tanV}));
  const xExtent=Math.max(...projected.filter(v=>horizontal.includes(v.q)).map(v=>Math.abs(v.x))),yExtent=Math.max(...projected.map(v=>Math.abs(v.y)));
  if(xExtent>FRAME_MARGIN||yExtent>FRAME_MARGIN)return;
  // Aim along the angular centre, stopping at an actual source facade. This
  // keeps the existing exact-source visibility test, even for concave courts.
  const far=Math.max(...all.map(q=>Math.hypot(q[0]-point[0],q[1]-point[1])))+1;
  const end:Point=[point[0]+sin*far,point[1]+cos*far],entry=occupiedIntervals(point,end,plan.source)[0];if(!entry)return;
  const lookDistance=far*(entry[0]+Math.min((entry[1]-entry[0])/2,.25/far));
  const look:Point=[point[0]+sin*lookDistance,point[1]+cos*lookDistance];
  return{look,lookY:eyeY+Math.tan(up)*lookDistance,heading,pitch:-up,fullFootprint,extent:Math.max(xExtent,yExtent),wholeExtent:Math.max(...projected.map(v=>Math.abs(v.x))),front};
 };
 const fullHeading=midpoint(all),full=frameAt(fullHeading,all,true);if(full)return full;
 // A very long building may have no complete portrait silhouette from this
 // local street. Its visible street-facing walls can still provide a useful
 // view; this fallback is explicitly marked and never extends the travel bound.
 const frontage=plan.edges.filter(e=>{
  if(e.nx*plan.front[0]+e.nz*plan.front[1]<.6)return false;
  const mid:Point=[(e.a[0]+e.b[0])/2,(e.a[1]+e.b[1])/2],ex=point[0]-mid[0],ez=point[1]-mid[1];
  if(ex*e.nx+ez*e.nz<=0)return false;
  const end:Point=[mid[0]+e.nx*.02,mid[1]+e.nz*.02];
  return occupiedIntervals(point,end,plan.source).length===0;
 }).flatMap(e=>[e.a,e.b]);
 if(frontage.length<2)return;
 const frontageHeading=midpoint(frontage);let best:BuildingFrame|undefined;
 // Shift only as far toward the complete frontage as needed. Centering every
 // fallback on a single visible wall needlessly crops the rest of the building.
 for(let step=0;step<=12;step++){
  const frame=frameAt(fullHeading+(frontageHeading-fullHeading)*step/12,frontage,false);
  if(frame&&(!best||frame.wholeExtent<best.wholeExtent))best=frame;
 }
 return best;
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
 const eye={x:candidate.point[0],y:terrain.height(...candidate.point)+EYE_HEIGHT,z:candidate.point[1]};
 const dx=end[0]-eye.x,dz=end[1]-eye.z,fullDistance=Math.hypot(look[0]-eye.x,look[1]-eye.z);
 const dy=(lookY-eye.y)*Math.hypot(dx,dz)/fullDistance,length=Math.hypot(dx,dy,dz);
 return length>.1&&terrain.raycastCamera(eye,{x:dx/length,y:dy/length,z:dz/length},length,.16)===null;
}

/** Normal Guide travel, using the existing player travel path. Pass the live
 * viewport aspect and vertical FOV in degrees (defaults 16/9 and 60). Building
 * views may use a sourced, directly connected cross-street approach; the two
 * street stops remain on Jefferson. No camera/actor mutation, capture hook or
 * distant fallback when a safe local view is absent. */
export function selectJeffersonTravelView(terrain:ParkTerrain,destinationId:string,options:JeffersonTravelOptions={}):JeffersonTravelView|undefined{
 const profile=JEFFERSON_BUILDINGS.find(p=>'jefferson-'+p.id===destinationId),stop=jeffersonStreetDestinations.find(s=>s.id===destinationId);
 if(!profile&&!stop)return;
 const aspect=options.aspect??16/9,verticalFov=options.verticalFov??60;
 if(!Number.isFinite(aspect)||aspect<=0||!Number.isFinite(verticalFov)||verticalFov<=0||verticalFov>=180)return;
 const roads=options.roads??[...terrain.map.roads,...districts.roads];
 const buildings=options.buildings??[...terrain.map.buildings,...districts.buildings];
 const frames=new Map<Point,BuildingFrame>();
 let look:Point,lookY:number,sourceId:string,target:Building|undefined,rank:(p:Point,s:'sidewalk'|'road')=>number;
 if(profile){
  const plan=(options.plans??planJeffersonBuildings(terrain.map,(x,z)=>terrain.height(x,z))).find(p=>p.profile.id===profile.id);if(!plan)return;
  look=plan.center;target=plan.source;sourceId=profile.id;
  lookY=plan.base+profile.wallHeight/2;
  rank=(p,s)=>{const frame=buildingFrame(p,plan,terrain,aspect,verticalFov);if(!frame)return Infinity;frames.set(p,frame);
   return(frame.fullFootprint?0:10000+frame.wholeExtent*250)+(1-frame.front)*35+Math.abs(frame.extent-.78)*18+(s==='sidewalk'?0:3);};
 }else{
  look=[stop!.x,stop!.z];lookY=terrain.height(...look)+3.8;sourceId=streetStops.find(s=>s.id===destinationId)!.sourceId.toString();
  // Both public viewpoints approach their intersection from the east and face
  // west along Jefferson; source street geometry still determines the position.
  const desired:Point=[look[0]+.864*45,look[1]-.503*45];
  rank=(p,s)=>{const dx=p[0]-look[0],dz=p[1]-look[1];return dx*.864-dz*.503<18?Infinity:Math.hypot(p[0]-desired[0],p[1]-desired[1])+(s==='sidewalk'?0:9);};
 }
 for(const candidate of candidates(mainlineSegments(roads,profile?look:undefined),look,rank)){
  const frame=frames.get(candidate.point),aim=frame?.look??look,aimY=frame?.lookY??lookY;
  if(!clearRoadConnection(candidate,terrain)||!clearView(candidate,aim,aimY,terrain,buildings,target))continue;
  const [x,z]=candidate.point,distance=Math.hypot(aim[0]-x,aim[1]-z);
  return{x,z,heading:frame?.heading??Math.atan2(aim[0]-x,aim[1]-z),pitch:frame?.pitch??-Math.atan2(aimY-terrain.height(x,z)-EYE_HEIGHT,distance),lookX:aim[0],lookZ:aim[1],lookY:aimY,sourceId,roadId:candidate.road.id,distance,surface:candidate.surface,...(frame?{fullFootprint:frame.fullFootprint}:{})};
 }
}
