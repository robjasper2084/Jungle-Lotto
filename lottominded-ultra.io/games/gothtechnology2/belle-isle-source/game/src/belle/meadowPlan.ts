import {inside,segment,ParkTerrain,type ParkMap,type Point} from './terrain.ts';

export const MEADOW_CELL=6;
export type MeadowCell=[number,number,number,number]; // grid x, grid z, ground height, lawn/rough/woodland
export type MeadowPlan={version:1;cellSize:number;cells:MeadowCell[]};
export const meadowBudget={smooth:{tufts:1400,radius:23},automatic:{tufts:4600,radius:38},high:{tufts:8200,radius:50}};
export function meadowRandom(x:number,z:number,n=0){let v=Math.imul(x^0x51f35,z^0x6b4d)+Math.imul(n+1,0x27d4eb2d);v=Math.imul(v^(v>>>15),0x85ebca6b);return((v^(v>>>13))>>>0)/4294967296;}

/** Offline placement: complete cells are clear of water, roads and authored facilities. */
export function makeMeadowPlan(map:ParkMap):MeadowPlan{
 const terrain=new ParkTerrain(map),half=MEADOW_CELL/2,margin=Math.SQRT2*half+.45,bucketSize=64;
 type Edge={a:Point;b:Point;width:number};const buckets=new Map<string,Edge[]>();
 for(const road of map.roads)for(let i=1;i<road.points.length;i++){
  const a=road.points[i-1],b=road.points[i],width=road.width/2+margin+2;
  for(let x=Math.floor((Math.min(a[0],b[0])-width)/bucketSize);x<=Math.floor((Math.max(a[0],b[0])+width)/bucketSize);x++)
   for(let z=Math.floor((Math.min(a[1],b[1])-width)/bucketSize);z<=Math.floor((Math.max(a[1],b[1])+width)/bucketSize);z++){
    const key=x+','+z,list=buckets.get(key)||[];list.push({a,b,width:road.width/2});buckets.set(key,list);
   }
 }
 const rings=[map.island,map.mainland,...(map.outerIslets||[]).map(i=>i.points)];
 const bounds=(p:Point[])=>({minX:Math.min(...p.map(q=>q[0])),maxX:Math.max(...p.map(q=>q[0])),minZ:Math.min(...p.map(q=>q[1])),maxZ:Math.max(...p.map(q=>q[1]))});
 const forbidden=map.areas.filter(a=>['pitch','track','pedestrian','playground','golf_course','swimming_pool','outdoor_seating','fitness_station','beach','marina','garden','parking'].includes(a.kind)).map(a=>({...a,...bounds(a.points)}));
 const water=map.water.map(a=>({...a,...bounds(a.points)})),woods=map.areas.filter(a=>['wood','forest'].includes(a.kind));
 const edgeDistance=(x:number,z:number,p:Point[])=>p.some((b,i)=>i>0&&segment(x,z,p[i-1],b).d<margin);
 const seen=new Set<string>(),cells:MeadowCell[]=[];
 for(const ring of rings){const b=bounds(ring);
  for(let ix=Math.ceil(b.minX/MEADOW_CELL);ix<=Math.floor(b.maxX/MEADOW_CELL);ix++)for(let iz=Math.ceil(b.minZ/MEADOW_CELL);iz<=Math.floor(b.maxZ/MEADOW_CELL);iz++){
   const key=ix+','+iz;if(seen.has(key))continue;const x=ix*MEADOW_CELL,z=iz*MEADOW_CELL;
   if(!inside(x,z,ring))continue;seen.add(key);
   if(!terrain.land(x,z,2)||terrain.bridge(x,z).active)continue;
   if(![-1,1].every(dx=>[-1,1].every(dz=>terrain.land(x+dx*half,z+dz*half,2))))continue;
   if(terrain.obstructed(x,z,margin+1))continue;
   if(map.entranceSign&&Math.hypot(x-map.entranceSign.point[0],z-map.entranceSign.point[1])<17)continue;
   const edges=buckets.get(Math.floor(x/bucketSize)+','+Math.floor(z/bucketSize))||[];
   if(edges.some(e=>segment(x,z,e.a,e.b).d<e.width+margin+1.1))continue;
   if(forbidden.some(a=>x>=a.minX-margin&&x<=a.maxX+margin&&z>=a.minZ-margin&&z<=a.maxZ+margin&&(inside(x,z,a.points)||edgeDistance(x,z,a.points))))continue;
   if(water.some(a=>x>=a.minX-margin&&x<=a.maxX+margin&&z>=a.minZ-margin&&z<=a.maxZ+margin&&(edgeDistance(x,z,a.points)||a.holes.some(h=>edgeDistance(x,z,h)))))continue;
   const woodland=woods.some(a=>inside(x,z,a.points));
   const roadside=edges.some(e=>segment(x,z,e.a,e.b).d<e.width+24);
   const zone=woodland?2:roadside?0:1;
   cells.push([ix,iz,Math.round(terrain.height(x,z,2)*1000)/1000,zone]);
  }
 }
 return{version:1,cellSize:MEADOW_CELL,cells};
}
