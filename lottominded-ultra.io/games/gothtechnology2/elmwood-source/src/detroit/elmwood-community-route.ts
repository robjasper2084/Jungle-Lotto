import {LaneRoute,type RoutePoint} from './riding/communityRide.ts';

type Feature={id:string;kind:string;tags:Record<string,string>;points:number[][]};
/** A connected tour of the mapped roads, from Creek Lane through the west,
 * northern grove, eastern lanes and entrance. No straight-line grass shortcuts. */
export function elmwoodCommunityRoute(features:readonly Feature[]){
 const roads=features.filter(f=>f.kind==='path'&&f.tags.highway==='service');
 const nodes=new Map<string,RoutePoint>(),edges=new Map<string,Map<string,number>>();
 const key=(p:readonly number[])=>p[0]+','+p[1];
 for(const f of roads)for(let i=0;i<f.points.length;i++){
  const p=f.points[i],id=key(p);nodes.set(id,{x:p[0],z:-p[1],width:4});if(!edges.has(id))edges.set(id,new Map());
  if(i){const previous=key(f.points[i-1]),d=Math.hypot(p[0]-f.points[i-1][0],p[1]-f.points[i-1][1]);edges.get(id)!.set(previous,d);edges.get(previous)!.set(id,d);}
 }
 const path=(start:string,end:string)=>{
  const costs=new Map([[start,0]]),before=new Map<string,string>(),pending=new Set([start]),done=new Set<string>();
  while(pending.size){const id=[...pending].reduce((a,b)=>costs.get(a)!<costs.get(b)!?a:b);pending.delete(id);if(id===end)break;done.add(id);
   for(const [next,d]of edges.get(id)??[]){if(done.has(next))continue;const cost=costs.get(id)!+d;if(cost<(costs.get(next)??Infinity)){costs.set(next,cost);before.set(next,id);pending.add(next);}}
  }
  if(!costs.has(end))throw Error('Elmwood tour must use connected mapped roads');
  const result=[end];while(result[0]!==start)result.unshift(before.get(result[0])!);return result.map(id=>nodes.get(id)!);
 };
 const creek=new LaneRoute(features.find(f=>f.id==='59197492')!.points.map(p=>({x:p[0],z:-p[1],width:4})));
 const points=[...creek.section(25,creek.length).points];
 // Use both ends of the western loop so shortest-path routing cannot create
 // a hairpin at its junction by immediately retracing the incoming road.
 const stops=[[-165.145,331.002],[-412.161,618.582],[-448.936,631.967],[-377.95,741.616],[-330.005,832.993],[-211.24,887.922],[-29.084,650.03],[61.168,444.5],[145.382,130.777],[-33.091,66.704]];
 for(let i=1;i<stops.length;i++)points.push(...path(key(stops[i-1]),key(stops[i])).slice(1));
 points.push(...creek.section(0,25).points.slice(1));
 // Round junctions inside their paved corridor. Abrupt tangent changes flip
 // lane offsets across the corner and can wedge a group at the same vertex.
 const rounded:RoutePoint[]=[points[0]];
 for(let i=1;i<points.length-1;i++){
  const a=points[i-1],p=points[i],b=points[i+1],before=Math.hypot(p.x-a.x,p.z-a.z),after=Math.hypot(b.x-p.x,b.z-p.z);
  const angle=Math.acos(Math.max(-1,Math.min(1,((p.x-a.x)*(b.x-p.x)+(p.z-a.z)*(b.z-p.z))/(before*after))));
  if(angle<.25){rounded.push(p);continue;}
  const trim=Math.min(3,before*.35,after*.35),start={x:p.x+(a.x-p.x)*trim/before,z:p.z+(a.z-p.z)*trim/before},end={x:p.x+(b.x-p.x)*trim/after,z:p.z+(b.z-p.z)*trim/after};
  for(let j=0;j<=8;j++){const t=j/8,u=1-t;rounded.push({x:u*u*start.x+2*u*t*p.x+t*t*end.x,z:u*u*start.z+2*u*t*p.z+t*t*end.z,width:angle>.6?3.4:4});}
 }
 rounded.push(points.at(-1)!);
 return new LaneRoute(rounded);
}
