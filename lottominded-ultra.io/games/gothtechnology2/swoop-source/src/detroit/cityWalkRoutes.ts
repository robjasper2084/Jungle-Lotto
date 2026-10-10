import {CITY} from './geography.ts';
import {mappedSpline} from './mapped-spline.ts';
import type {CrowdPath} from './crowdFlow.ts';
/** Two parallel passes with curved end turns: a continuous loop, with no visible teleport. */
export function walkingLoop(points:number[][],offset=0){
 const route=mappedSpline(points),length=route.length,r=.65,cap=Math.PI*r,total=length*2+cap*2;
 return {length:total,runout:0,offsetSign:1,width:()=>1.8,point(distance:number,lane:number){
  const d=((distance%total)+total)%total;let station:number,side:number,heading:number,forward=0;
  if(d<length){station=d;side=offset-r-lane;heading=0;}
  else if(d<length+cap){const theta=(d-length)/r;station=length;side=offset-(r+lane)*Math.cos(theta);forward=(r+lane)*Math.sin(theta);heading=-theta;}
  else if(d<length*2+cap){station=length-(d-length-cap);side=offset+r+lane;heading=Math.PI;}
  else{const theta=(d-length*2-cap)/r;station=0;side=offset+(r+lane)*Math.cos(theta);forward=-(r+lane)*Math.sin(theta);heading=Math.PI-theta;}
  const p=route.sample(station,side);return{x:p.x+Math.sin(p.heading)*forward,z:p.z+Math.cos(p.heading)*forward,heading:p.heading+heading};
 }};
}
/** Join OSM pieces only at actual shared endpoints, preserving divided streets. */
export function cityWalkRoutes(){
 const result:Array<{name:string;path:ReturnType<typeof walkingLoop>}> = [];
 for(const name of ['Atwater Street','Detroit Riverwalk','Mack Avenue','Chene Street']){
  const remaining=CITY.roads.filter(r=>r.name===name&&!r.bridge&&r.points.length>1).map(r=>({points:r.points.map(p=>[...p]),width:r.width}));
  while(remaining.length){const first=remaining.shift()!,points=first.points;let changed=true;
   while(changed){changed=false;for(let i=0;i<remaining.length;i++){const q=remaining[i];if(Math.abs(q.width-first.width)>.1)continue;const end=points.at(-1)!;
    if(Math.hypot(end[0]-q.points[0][0],end[1]-q.points[0][1])<.3){points.push(...q.points.slice(1));remaining.splice(i,1);changed=true;break;}
    if(Math.hypot(end[0]-q.points.at(-1)![0],end[1]-q.points.at(-1)![1])<.3){points.push(...q.points.slice(0,-1).reverse());remaining.splice(i,1);changed=true;break;}
    const start=points[0];if(Math.hypot(start[0]-q.points.at(-1)![0],start[1]-q.points.at(-1)![1])<.3){points.unshift(...q.points.slice(0,-1));remaining.splice(i,1);changed=true;break;}
    if(Math.hypot(start[0]-q.points[0][0],start[1]-q.points[0][1])<.3){points.unshift(...q.points.slice(1).reverse());remaining.splice(i,1);changed=true;break;}
   }}
   const centre=mappedSpline(points);if(centre.length<65)continue;
   // RiverWalk visitors use its paving; street visitors use the outer half of the sidewalk.
   const offset=name==='Detroit Riverwalk'?0:first.width/2+1.5;
   result.push({name,path:walkingLoop(points,offset)});
  }
 }
 return result;
}
export function freshCrowdSeed(){return Math.floor(Math.random()*0xffffffff)>>>0;}
export function crowdRandom(seed:number){let value=seed>>>0;return()=>{value=(Math.imul(value,1664525)+1013904223)>>>0;return value/4294967296;};}
export function seedCityPeople(routes:ReturnType<typeof cityWalkRoutes>,seed:number,height:(x:number,z:number)=>number,clear:(x:number,y:number,z:number)=>boolean){
 const random=crowdRandom(seed),groups:Array<{name:string;path:CrowdPath;agents:import('./crowdFlow.ts').CrowdAgent[]}>=[];
 let id=62;
 for(const name of ['Atwater Street','Detroit Riverwalk','Mack Avenue','Chene Street']){
  const district=routes.filter(r=>r.name===name).sort(()=>random()-.5).slice(0,4);
  for(const route of district){const path:CrowdPath={...route.path,point(d,u){const p=route.path.point(d,u);return {...p,y:height(p.x,p.z)};},walkable:clear};const agents:import('./crowdFlow.ts').CrowdAgent[]=[];
   for(let j=0;j<2;j++)for(let tries=0;tries<50;tries++){
    const distance=random()*path.length,lane=0,p=path.point(distance,lane);if(!clear(p.x,p.y,p.z)||agents.some(a=>Math.hypot(a.x-p.x,a.z-p.z)<4))continue;
    const kind=id%5===0?'jogger':'pedestrian',pace=(kind==='jogger'?2.5:1.05)*(.88+random()*.24);
    agents.push({id:'traffic-'+id++,kind,distance,lane,direction:1,pace,speed:pace,radius:.32,height:1.68,...p});break;
   }
   if(agents.length)groups.push({name,path,agents});
  }
 }
 return groups;
}
