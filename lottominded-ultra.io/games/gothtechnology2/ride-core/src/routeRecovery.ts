import {createGroundSample,type TerrainSampler,type NavigationObstacle} from './terrain.ts';
export type RouteRecovery={origin:number;goal?:number;backTo?:number;backing:boolean;backUsed:boolean};
type Rider={id:string;s:number;offset:number;x:number;y:number;z:number};
type Point={x:number;z:number;headingY:number};
type RouteAt=(station:number,offset:number)=>Point;
const clamp=(n:number,a:number,b:number)=>Math.max(a,Math.min(b,n));

/** A route-constrained, swept escape from scenery. At most 1.2m of backing per blockage. */
export function recoverRouteWall(terrain:TerrainSampler,at:RouteAt,r:Rider,state:RouteRecovery,dt:number,edge:number,contacts:readonly NavigationObstacle[],minStation=-Infinity){
 const ground=createGroundSample(),nearby=contacts.filter(o=>o.id!==r.id&&!o.raycastSolid&&Math.abs(o.y-r.y)<2);
 const clear=(from:{x:number;y:number;z:number},to:Point)=>{
  const dx=to.x-from.x,dz=to.z-from.z,d=Math.hypot(dx,dz);if(d<1e-6)return true;
  const hit=terrain.raycastObstacle({x:from.x,y:from.y+.6,z:from.z},{x:dx/d,y:0,z:dz/d},d,.32);
  if(hit!==null&&hit<d-1e-6)return false;
  let height=from.y;
  for(let step=1;step<=Math.ceil(d/.25);step++){
   const f=step/Math.ceil(d/.25),g=terrain.sampleGround(from.x+dx*f,from.z+dz*f,ground,height);
   if(g.offCourse||g.surface==='grass'||g.normal.y<.85||Math.abs(g.height-height)>.3)return false;height=g.height;
  }
  for(const o of nearby){
   const radius=o.radius+.6,start=Math.hypot(from.x-o.x,from.z-o.z),end=Math.hypot(to.x-o.x,to.z-o.z),f=clamp(((o.x-from.x)*dx+(o.z-from.z)*dz)/(d*d),0,1),closest=Math.hypot(from.x+dx*f-o.x,from.z+dz*f-o.z);
   // An existing overlap may separate, but an escape never moves into a player or follower.
   if(start<radius?end<=start+1e-6||closest<start-1e-6:closest<radius)return false;
  }
  return true;
 };
 const forwardClear=(offset:number)=>{
  const p=at(r.s,offset),g=terrain.sampleGround(p.x,p.z,ground,r.y);if(g.offCourse||g.surface==='grass')return false;
  return clear({x:p.x,y:g.height,z:p.z},at(r.s+1.2,offset));
 };
 const move=(station:number,offset:number)=>{
  const p=at(station,offset);if(!clear(r,p))return undefined;
  const y=terrain.sampleGround(p.x,p.z,ground,r.y).height;
  return {...p,y,s:station,offset,targetOffset:offset};
 };
 if(state.backing){
  const station=Math.max(state.backTo!,r.s-.65*dt),step=move(station,r.offset);
  if(!step||station<=state.backTo!+.001)state.backing=false;
  return step;
 }
 if(forwardClear(r.offset))return undefined;
 // Keep a chosen side until it is no longer safe; a statically clear lane wins even
 // when there are no other actors from which to gain the old clearance score.
 const candidates=[state.goal,-edge,edge,0].filter((v):v is number=>v!==undefined).map(offset=>clamp(offset,-edge,edge));
 const goal=candidates.filter(offset=>Math.abs(offset-r.offset)>.02&&clear(r,at(r.s,offset))&&forwardClear(offset)).sort((a,b)=>a===state.goal?-1:b===state.goal?1:Math.abs(a-r.offset)-Math.abs(b-r.offset))[0];
 if(goal!==undefined){
  state.goal=goal;const offset=r.offset+clamp(goal-r.offset,-1.4*dt,1.4*dt),step=move(r.s,offset);
  if(step)return {...step,targetOffset:goal};
 }
 // Only scenery triggers backing: a player standing in the lane remains a yield,
 // and the finite backout also stops safely at dead ends with no reachable bypass.
 const forward=at(r.s+.8,r.offset),d=Math.hypot(forward.x-r.x,forward.z-r.z);
 const wall=d>1e-6?terrain.raycastObstacle({x:r.x,y:r.y+.6,z:r.z},{x:(forward.x-r.x)/d,y:0,z:(forward.z-r.z)/d},d,.32):null;
 if(!state.backUsed&&wall!==null&&wall<d){
  state.backUsed=true;state.backTo=Math.max(minStation,state.origin-1.2);state.backing=r.s>state.backTo+.01;
  if(state.backing){const step=move(Math.max(state.backTo,r.s-.65*dt),r.offset);if(step)return step;state.backing=false;}
 }
 return undefined;
}

export const newRouteRecovery=(station:number):RouteRecovery=>({origin:station,backing:false,backUsed:false});
