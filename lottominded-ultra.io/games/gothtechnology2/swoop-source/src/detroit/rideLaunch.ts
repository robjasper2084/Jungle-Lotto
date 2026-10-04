import {createGroundSample,type TerrainSampler,type Vec3} from './terrain.ts';
type Spawn=Vec3&{heading:number};
/** Keep a free-ride launch near its chosen place, with room for a mounted rider and an initial turn. */
export function freeRideLaunch(terrain:TerrainSampler,requested:Spawn,occupied:readonly Vec3[]=[]):Spawn{
 const ground=createGroundSample(),base=terrain.sampleGround(requested.x,requested.z,ground,requested.y).height;
 const offsets=[{along:0,side:0},...[1.5,3,6,9].flatMap(d=>[{along:-d,side:0},{along:d,side:0},{along:0,side:-d},{along:0,side:d}])];
 for(const offset of offsets){
  const x=requested.x+Math.sin(requested.heading)*offset.along+Math.cos(requested.heading)*offset.side,z=requested.z+Math.cos(requested.heading)*offset.along-Math.sin(requested.heading)*offset.side,g=terrain.sampleGround(x,z,ground,base),p={x,y:g.height,z};
  if(g.offCourse||g.normal.y<.8||Math.abs(g.height-base)>.55||occupied.some(o=>Math.abs(o.y-p.y)<2.2&&Math.hypot(o.x-x,o.z-z)<1.36))continue;
  for(const turn of [0,Math.PI/4,-Math.PI/4,Math.PI/2,-Math.PI/2,Math.PI]){
   const heading=requested.heading+turn;
   if(terrain.mountedClear&&!terrain.mountedClear(p,heading,.65,2.2))continue;
   if(terrain.raycastObstacle({x,y:p.y+.65,z},{x:Math.sin(heading),y:0,z:Math.cos(heading)},1.25,.3)!==null)continue;
   return {...p,heading};
  }
 }
 // Some indoor places require manual steering; retain the requested location if no nearby corridor exists.
 return {...requested,y:base};
}
