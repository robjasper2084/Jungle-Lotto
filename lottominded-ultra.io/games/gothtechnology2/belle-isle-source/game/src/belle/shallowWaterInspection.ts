import type {ParkMap,ParkTerrain} from './terrain.ts';
import {inside} from './terrain.ts';
import {planShallows} from './shallowWater.ts';

/** Player-accessible, map-derived bank camera for inspecting the real lagoon
 * sediment and stones. No browser state injection, synthetic camera or physics. */
export type ShallowInspectionView={
 x:number;z:number;lookX:number;lookZ:number;pitch:number;
 targetStone:{x:number;y:number;z:number;size:number};
 nearbyStones:number;roadDistance:number;
};
const mappedPathCandidates=[
 [197.6,1456.4],[125.8,1328.4],[196.3,1079.9],[228.8,1438.4]
] as const;
const segmentDistance=(x:number,z:number,a:readonly number[],b:readonly number[])=>{
 const dx=b[0]-a[0],dz=b[1]-a[1],s=dx*dx+dz*dz;
 const t=s?Math.max(0,Math.min(1,((x-a[0])*dx+(z-a[1])*dz)/s)):0;
 return Math.hypot(x-a[0]-dx*t,z-a[1]-dz*t);
};
/** Candidate points are within metres of actual OSM paths. Prefer a clear,
 * off-bridge bank with >=3 real submerged stones close to the camera. */
export function planShallowWaterInspection(map:ParkMap,terrain:Pick<ParkTerrain,'land'|'height'|'bridge'|'obstructed'>):ShallowInspectionView|null{
 const stones=planShallows(map).stones;
 for(const [x,z] of mappedPathCandidates){
  const roadDistance=Math.min(Infinity,...map.roads.filter(r=>!r.bridge).flatMap(r=>
   r.points.slice(1).map((b,i)=>segmentDistance(x,z,r.points[i],b))));
  if(roadDistance>1.8||!terrain.land(x,z)||terrain.obstructed(x,z,1.2)||terrain.bridge(x,z).active)continue;
  const close=stones.map(s=>({stone:s,d:Math.hypot(x-s.x,z-s.z)})).filter(v=>v.d>=3&&v.d<24)
   .sort((a,b)=>a.d-b.d);
  if(close.length<3||close[0].d>17)continue;
  const nearest=close[0].stone;
  if(!map.water.some(w=>inside(nearest.x,nearest.z,w.points)&&!w.holes.some(h=>inside(nearest.x,nearest.z,h))))continue;
  const pitch=Math.max(.18,Math.min(.55,Math.atan2(terrain.height(x,z)+1.55-1.05,close[0].d)));
  return {x,z,lookX:nearest.x,lookZ:nearest.z,pitch,
   targetStone:{x:nearest.x,y:nearest.y,z:nearest.z,size:nearest.size},
   nearbyStones:close.length,roadDistance};
 }
 return null;
}
