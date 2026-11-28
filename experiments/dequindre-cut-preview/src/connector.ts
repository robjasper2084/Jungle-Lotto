import {districts} from '../../../lottominded-ultra.io/games/gothtechnology2/belle-isle-source/game/src/belle/detroitGround.ts';
import {CITY,pointOnCut} from '../../../lottominded-ultra.io/games/gothtechnology2/swoop-source/src/detroit/geography.ts';
import type {GroundSample} from '../../../lottominded-ultra.io/games/gothtechnology2/swoop-source/src/detroit/terrain.ts';
import type {ParkMap} from './terrain.ts';
import {fromSourceMap,type Vector} from './geo.ts';

type Point=[number,number];
type Edge={to:string;length:number;source:string;name:string};
type Node={point:Point;edges:Edge[]};
export type ConnectorSegment={from:Point;to:Point;length:number;source:string;name:string};
export type ConnectorRoute={id:string;name:string;points:Point[];segments:ConnectorSegment[];length:number;junctionGap:number;sourceRoadIds:string[];entranceStation:number};
export const CONNECTOR_ROAD_IDS=Object.freeze({saintAubin:'8734274',atwater:'334443405',cutApproach:'68304612'});
const key=(p:Point)=>p[0].toFixed(6)+','+p[1].toFixed(6);
const distance=(a:Point,b:Point)=>Math.hypot(b[0]-a[0],b[1]-a[1]);

/** A bounded graph of the already-authored bridge/Jefferson approach and mapped
 * Saint Aubin–Atwater streets. No proximity connections are made at overpasses.
 * The single municipality/OSM join is recorded and limited to half a metre. */
export function buildConnectorRoute():ConnectorRoute {
  const graph=new Map<string,Node>();
  function node(point:Point){const id=key(point);if(!graph.has(id))graph.set(id,{point:[...point],edges:[]});return id;}
  function edge(a:Point,b:Point,source:string,name:string){
    const from=node(a),to=node(b),length=distance(a,b);if(length<1e-8)return;
    graph.get(from)!.edges.push({to,length,source,name});graph.get(to)!.edges.push({to:from,length,source,name});
  }
  function line(points:Point[],source:string,name:string){for(let i=1;i<points.length;i++)edge(points[i-1],points[i],source,name);}
  const roads=Object.fromEntries(Object.entries(CONNECTOR_ROAD_IDS).map(([role,id])=>{
    const road=CITY.roads.find(r=>r.id===id);
    if(!road||road.bridge||/steps|motorway|construction/.test(road.kind))throw new Error('Missing at-grade source road '+id);
    return [role,{road,points:road.points.map(([x,z])=>{const p=fromSourceMap(x,0,z);return [p.x,p.z] as Point;})}];
  }));
  const sourceJunction=roads.saintAubin.points.at(-1)!;
  let at=-1,gap=Infinity;
  districts.routes.cut.forEach((p,index)=>{const d=distance(p,sourceJunction);if(d<gap){gap=d;at=index;}});
  if(at<1||gap>.5)throw new Error('Municipal/OSM Saint Aubin junction no longer aligns');
  const mainland=districts.routes.cut.slice(0,at+1).map(p=>[...p] as Point);
  line(mainland,'belle:districts.routes.cut','MacArthur Bridge / East Jefferson');
  edge(mainland.at(-1)!,sourceJunction,'junction:municipal-osm-saint-aubin','Saint Aubin junction');
  line(roads.saintAubin.points,'swoop:'+roads.saintAubin.road.id,roads.saintAubin.road.name);
  line(roads.atwater.points,'swoop:'+roads.atwater.road.id,roads.atwater.road.name);
  const cutPoints=roads.cutApproach.points;
  const targetMap=pointOnCut(8),target3=fromSourceMap(targetMap.x,0,targetMap.z),target:Point=[target3.x,target3.z];
  let segment=-1,projection:Point=[0,0],separation=Infinity;
  for(let i=1;i<cutPoints.length;i++){
    const a=cutPoints[i-1],b=cutPoints[i],dx=b[0]-a[0],dz=b[1]-a[1],t=Math.max(0,Math.min(1,((target[0]-a[0])*dx+(target[1]-a[1])*dz)/(dx*dx+dz*dz)));
    const p:Point=[a[0]+t*dx,a[1]+t*dz],d=distance(p,target);if(d<separation){segment=i;projection=p;separation=d;}
  }
  if(segment<0||separation>.02)throw new Error('Cut starting grid no longer lies on the mapped entrance');
  const approach=cutPoints.slice();approach.splice(segment,0,projection);
  line(approach,'swoop:'+roads.cutApproach.road.id,roads.cutApproach.road.name);
  // The source point is analytically on this same line; its float roundoff is
  // retained in the recorded join instead of moving a street or changing a ramp.
  edge(projection,target,'source:fullRoute.ROUTE_START','Dequindre Cut starting grid');
  const start=key(mainland[0]),finish=node(target),cost=new Map([[start,0]]),previous=new Map<string,{from:string;edge:Edge}>(),open=new Set([start]);
  while(open.size){
    let current='';for(const id of open)if(!current||cost.get(id)!<cost.get(current)!)current=id;
    open.delete(current);if(current===finish)break;
    for(const e of graph.get(current)!.edges){const candidate=cost.get(current)!+e.length;if(candidate<(cost.get(e.to)??Infinity)){cost.set(e.to,candidate);previous.set(e.to,{from:current,edge:e});open.add(e.to);}}
  }
  if(!cost.has(finish))throw new Error('No connected mapped route to the Atwater entrance');
  const segments:ConnectorSegment[]=[];let current=finish;
  while(current!==start){const p=previous.get(current);if(!p)throw new Error('Incomplete connector path');segments.push({from:[...graph.get(p.from)!.point],to:[...graph.get(current)!.point],length:p.edge.length,source:p.edge.source,name:p.edge.name});current=p.from;}
  segments.reverse();
  return {id:'preview-macarthur-atwater-cut',name:'Belle Isle to Dequindre Cut via Saint Aubin and Atwater',points:[segments[0].from,...segments.map(s=>s.to)],segments,length:cost.get(finish)!,junctionGap:gap,sourceRoadIds:Object.values(CONNECTOR_ROAD_IDS),entranceStation:8};
}

export interface ConnectorTerrain {
  height(x:number,z:number,referenceY?:number):number;
  sampleGround(x:number,z:number,out:GroundSample,referenceY?:number):GroundSample;
  land(x:number,z:number,referenceY?:number):boolean;
  raycast(origin:Vector,direction:Vector,maxDistance:number):number|null;
  raycastObstacle(origin:Vector,direction:Vector,maxDistance:number,half?:number):number|null;
}
export type ConnectorIssue={kind:'unsupported'|'grade'|'step'|'body-obstacle'|'headroom';sample:number;station:number;x:number;y:number;z:number;value:number;source:string};
export type ConnectorValidation={ok:boolean;routeId:string;routeIdentity:string;direction:'outbound'|'return';phase:'base-terrain'|'complete-scene';samples:number;distance:number;maximumGrade:number;maximumStep:number;issues:ConnectorIssue[];limits:{spacing:number;maxGrade:number;maxStep:number;halfWidth:number;height:number}};
const routeIdentity=(route:ConnectorRoute)=>route.id+':'+route.points.map(p=>p.join(',')).join(';');

/** Run after source scenery has registered its extra colliders for final preview
 * acceptance. A successful base-terrain report deliberately is not a release gate. */
export function validateConnectorRoute(terrain:ConnectorTerrain,route=buildConnectorRoute(),options:{reverse?:boolean;phase?:'base-terrain'|'complete-scene';spacing?:number;maxGrade?:number;maxStep?:number;halfWidth?:number;height?:number}={}):ConnectorValidation {
  const limits={spacing:options.spacing??.75,maxGrade:options.maxGrade??.18,maxStep:options.maxStep??.15,halfWidth:options.halfWidth??.4,height:options.height??1.9};
  if(!Object.values(limits).every(v=>Number.isFinite(v)&&v>0)||limits.spacing>.75||limits.maxGrade>.18||limits.maxStep>.15||limits.halfWidth<.4||limits.height<1.9)throw new Error('Invalid or weakened connector validation limits');
  const segments:ConnectorSegment[]=options.reverse?[...route.segments].reverse().map(s=>({...s,from:[...s.to],to:[...s.from]})):route.segments;
  const first=segments[0].from,ground:GroundSample={height:0,normal:{x:0,y:1,z:0},surface:'pavement',offCourse:false};
  let previous={x:first[0],y:terrain.height(...first),z:first[1]},station=0,samples=0,maximumGrade=0,maximumStep=0;
  const issues:ConnectorIssue[]=[];
  const record=(kind:ConnectorIssue['kind'],x:number,y:number,z:number,value:number,source:string)=>issues.push({kind,sample:samples,station,x,y,z,value,source});
  for(const segment of segments){
    const length=distance(segment.from,segment.to),steps=Math.max(1,Math.ceil(length/limits.spacing));
    for(let i=1;i<=steps;i++){
      const t=i/steps,x=segment.from[0]+(segment.to[0]-segment.from[0])*t,z=segment.from[1]+(segment.to[1]-segment.from[1])*t;
      terrain.sampleGround(x,z,ground,previous.y);samples++;station+=length/steps;
      const y=ground.height,dx=x-previous.x,dz=z-previous.z,travel=Math.hypot(dx,dz),step=Math.abs(y-previous.y),grade=travel>1e-6?step/travel:0;
      maximumGrade=Math.max(maximumGrade,grade);maximumStep=Math.max(maximumStep,step);
      if(!Number.isFinite(y)||ground.offCourse||!terrain.land(x,z,y))record('unsupported',x,y,z,0,segment.source);
      if(grade>limits.maxGrade)record('grade',x,y,z,grade,segment.source);
      if(step>limits.maxStep)record('step',x,y,z,step,segment.source);
      if(travel>1e-6){
        const direction={x:dx/travel,y:0,z:dz/travel};
        for(const offset of [.18,.75,1.35,limits.height]){
          const hit=terrain.raycastObstacle({x:previous.x,y:previous.y+offset,z:previous.z},direction,travel,limits.halfWidth);
          if(hit!==null&&hit<travel-1e-5){record('body-obstacle',x,y,z,hit,segment.source);break;}
        }
      }
      const overhead=terrain.raycast({x,y:y+.05,z},{x:0,y:1,z:0},limits.height-.05);
      if(overhead!==null)record('headroom',x,y,z,overhead,segment.source);
      previous={x,y,z};
    }
  }
  return {ok:issues.length===0,routeId:route.id,routeIdentity:routeIdentity(route),direction:options.reverse?'return':'outbound',phase:options.phase??'base-terrain',samples,distance:station,maximumGrade,maximumStep,issues,limits};
}

/** Navigation metadata only. Append after geometry construction; never draw a
 * second pavement strip over the independently rendered original streets. */
export function connectorNavigationRoad(route:ConnectorRoute,outbound:ConnectorValidation,inbound:ConnectorValidation):ParkMap['roads'][number] {
  const identity=routeIdentity(route);
  if(!outbound.ok||!inbound.ok||outbound.issues.length||inbound.issues.length||outbound.direction!=='outbound'||inbound.direction!=='return'||outbound.phase!=='complete-scene'||inbound.phase!=='complete-scene'||outbound.routeIdentity!==identity||inbound.routeIdentity!==identity)throw new Error('Connector requires full-scene physical verification in both directions on this exact route');
  return {id:route.id,name:route.name,points:route.points.map(p=>[...p]),width:3,foot:true,bridge:false,surface:'pavement',surfaceEvidence:'Navigation-only chain of existing mapped streets; no duplicate geometry'};
}
