import {inside,type ParkMap,type ParkTerrain} from './terrain.ts';
export const CASINO_WAY_REFERENCE={
 latitude:42.334700,longitude:-82.994120,
 source:'https://historicbridges.org/bridges/browser/?bridgebrowser=beam%2Fbellecasino%2F'
} as const;
/** Inferred by proximity of a historical 2003/2009 location and OSM geometry,
 * not by inventing a new bridge or trusting the generic "Park path" label. */
export const CASINO_WAY_MAPPED_ID='106948146';
export type CasinoView={x:number;z:number;lookX:number;lookZ:number;heading:number;distance:number;sideFraction:number;casinoAngle:number};
export function mappedCasinoWayBridge(map:ParkMap){
 const x=(CASINO_WAY_REFERENCE.longitude-map.origin[0])*111320*Math.cos(map.origin[1]*Math.PI/180);
 const z=(map.origin[1]-CASINO_WAY_REFERENCE.latitude)*111320;
 const candidates=map.roads.filter(r=>r.bridge&&r.points.length>=2).map(road=>{
  const a=road.points[0],b=road.points[road.points.length-1],center:[number,number]=[(a[0]+b[0])/2,(a[1]+b[1])/2];
  return {road,center,distance:Math.hypot(center[0]-x,center[1]-z)};
 }).sort((a,b)=>a.distance-b.distance);
 const m=candidates[0];
 return m&&m.road.id===CASINO_WAY_MAPPED_ID&&m.distance<=12&&
  (!candidates[1]||candidates[1].distance-m.distance>=15)?m:null;
}
/** Real dry-bank candidate search. The close rail portrait and the wider
 * Casino context are separate shots: neither alters world geometry/collision. */
export function planCasinoWayViews(map:ParkMap,terrain:Pick<ParkTerrain,'land'|'height'|'obstructed'|'bridge'>){
 const matched=mappedCasinoWayBridge(map);if(!matched)return null;
 const road=matched.road,a=road.points[0],b=road.points[road.points.length-1];
 const cx=matched.center[0],cz=matched.center[1],len=Math.hypot(b[0]-a[0],b[1]-a[1]);if(len<2)return null;
 const tx=(b[0]-a[0])/len,tz=(b[1]-a[1])/len,nx=-tz,nz=tx;
 const casino=map.landmarks.find(p=>p.name==='Belle Isle Casino');if(!casino)return null;
 const options:CasinoView[]=[];
 const offsets=[-145,-130,-115,-100,-90,-75,-60,-50,-42,-36,-30,-24,-19,19,24,30,36,42,50,60,75,90,100,115,130,145];
 const along=[-100,-80,-65,-50,-40,-30,-20,-12,0,12,20,30,40,50,65,80,100];
 for(const normal of offsets)for(const axial of along){
  const x=cx+nx*normal+tx*axial,z=cz+nz*normal+tz*axial,distance=Math.hypot(x-cx,z-cz);
  if(distance<18||distance>172||!terrain.land(x,z)||terrain.obstructed(x,z,2)||terrain.bridge(x,z).active)continue;
  if(!Number.isFinite(terrain.height(x,z))||map.areas.some(q=>q.kind==='beach'&&inside(x,z,q.points)))continue;
  const sideFraction=Math.abs(normal)/distance;
  if(sideFraction<.71)continue;
  const ax=cx-x,az=cz-z,bx=casino.x-x,bz=casino.z-z;
  const dot=(ax*bx+az*bz)/(Math.hypot(ax,az)*Math.hypot(bx,bz));
  const casinoAngle=Math.acos(Math.max(-1,Math.min(1,dot)))*180/Math.PI;
  options.push({x,z,lookX:cx,lookZ:cz,heading:Math.atan2(ax,az),distance,sideFraction,casinoAngle});
 }
 const side=options.filter(v=>v.distance>=23&&v.distance<=72&&v.sideFraction>=.88)
  .sort((a,b)=>(Math.abs(a.distance-37)+(1-a.sideFraction)*28)-(Math.abs(b.distance-37)+(1-b.sideFraction)*28))[0]??null;
 const base=options.filter(v=>v.distance>=82&&v.distance<=155&&v.sideFraction>=.76&&v.casinoAngle<=40)
  .sort((a,b)=>(a.casinoAngle*2+Math.abs(a.distance-112)*.35)-(b.casinoAngle*2+Math.abs(b.distance-112)*.35))[0]??null;
 const context=base?{...base,lookX:cx*.78+casino.x*.22,lookZ:cz*.78+casino.z*.22,
  heading:Math.atan2(cx*.78+casino.x*.22-base.x,cz*.78+casino.z*.22-base.z)}:null;
 return {bridgeId:matched.road.id,locationOffset:matched.distance,side,context};
}
