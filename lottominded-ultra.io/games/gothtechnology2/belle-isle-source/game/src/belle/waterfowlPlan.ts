import {inside,segment,type ParkMap} from './terrain.ts';
export type WaterfowlRoute={species:'swan'|'duck';x:number;z:number;rx:number;rz:number;period:number;phase:number;plumage:'white'|'drake'|'hen';angle?:number;habitat?:string};
/** Six individual residents, close enough to see from the east lagoon footpath. */
export const WATERFOWL:readonly WaterfowlRoute[]=[
 {species:'swan',plumage:'white',x:3936,z:-186,rx:3.2,rz:2.3,period:68,phase:0},
 {species:'swan',plumage:'white',x:3925,z:-182,rx:3.5,rz:2.7,period:77,phase:1.2},
 {species:'swan',plumage:'white',x:3916,z:-171,rx:3.4,rz:2.4,period:73,phase:2.8},
 {species:'swan',plumage:'white',x:3927,z:-166,rx:3.1,rz:2.2,period:82,phase:4.1},
 {species:'duck',plumage:'drake',x:3940,z:-194,rx:2.2,rz:1.7,period:49,phase:.8},
 {species:'duck',plumage:'hen',x:3933,z:-200,rx:2.4,rz:1.8,period:54,phase:3.5},
];
export function waterfowlPose(route:WaterfowlRoute,time:number){
 const t=(Number.isFinite(time)?time:0)*Math.PI*2/route.period+route.phase;
 const c=Math.cos(route.angle||0),s=Math.sin(route.angle||0),a=Math.cos(t)*route.rx,b=Math.sin(t)*route.rz,dx=-Math.sin(t)*route.rx,dz=Math.cos(t)*route.rz;
 return {x:route.x+a*c-b*s,z:route.z+a*s+b*c,y:1.05+Math.sin(t*3+route.phase)*.012,heading:Math.atan2(dx*c-dz*s,dx*s+dz*c),roll:Math.sin(t*4)*.012};
}

/** Small resident groups follow long, clear sections of the mapped canals. */
export function canalWaterfowl(map:ParkMap):WaterfowlRoute[]{
 const residents:WaterfowlRoute[]=[];
 for(const canal of map.waterwayRoutes||[]){
  if(!/^(Loop|Nashua|Sylvan) Canal$/.test(canal.name))continue;
  const stretches=canal.points.slice(1).map((b,i)=>({a:canal.points[i],b,length:Math.hypot(b[0]-canal.points[i][0],b[1]-canal.points[i][1])})).filter(s=>s.length>55).sort((a,b)=>b.length-a.length);
  let groups=0;
  for(const {a,b,length}of stretches){
   if(groups===2)break;
   const cx=(a[0]+b[0])/2,cz=(a[1]+b[1])/2,dx=(b[0]-a[0])/length,dz=(b[1]-a[1])/length;
   if(residents.some(r=>Math.hypot(cx-r.x,cz-r.z)<38))continue;
   const candidates=Array.from({length:4},(_,j):WaterfowlRoute=>({species:j<2?'swan':'duck',plumage:j<2?'white':j===2?'drake':'hen',x:cx+dx*(j-1.5)*10,z:cz+dz*(j-1.5)*10,rx:3.5,rz:.8,angle:Math.atan2(dz,dx),period:62+j*7,phase:j*1.7+groups,habitat:canal.name}));
   const safe=candidates.every(r=>Array.from({length:32},(_,i)=>waterfowlPose(r,r.period*i/32)).every(p=>{
    const inWater=map.water.some(w=>inside(p.x,p.z,w.points)&&!w.holes.some(h=>inside(p.x,p.z,h)))||segment(p.x,p.z,a,b).d<canal.width/2-1;
    return inWater&&!map.roads.some(road=>road.points.slice(1).some((v,i)=>segment(p.x,p.z,road.points[i],v).d<road.width/2+2))&&!map.buildings.some(building=>inside(p.x,p.z,building.points));
   }));
   if(safe){residents.push(...candidates);groups++;}
  }
 }
 return residents;
}
