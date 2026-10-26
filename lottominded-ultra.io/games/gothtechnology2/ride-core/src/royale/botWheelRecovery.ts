import {angle,clamp} from '../rideDynamics.ts';
import {createGroundSample,type Vec3} from '../terrain.ts';
import type {Actor,Command} from './rules.ts';
import type {BattleTerrain} from './battleTerrain.ts';

export const botWheelRecovery=()=>({returning:false,replan:0,path:[] as Vec3[],approach:undefined as Vec3|undefined,stayMountedUntil:0});
/** Host-owned intent only: use the ordinary foot collision, stagger, health and
 * pickup/remount checks. Never reset/teleport the actor or shorten its animation. */
export function recoverBotWheel(a:Actor,c:Command,state:ReturnType<typeof botWheelRecovery>,terrain:BattleTerrain,tick:number){
 const p=a.pose;
 if(p.footMode&&p.footStagger>0&&!state.returning){state.returning=true;state.replan=0;state.path=[];state.approach=undefined;}
 if(state.returning&&!p.footMode){state.returning=false;state.path=[];state.approach=undefined;state.stayMountedUntil=tick+240;}
 if(!state.returning)return false;
 c.slot=a.slot;
 // Let the impact settle and let an in-progress pickup finish without AI fire,
 // reload or steering immediately cancelling it.
 if(p.footMode!==2||p.footStagger>0||(a.combat.melee?.staggerUntil??0)>tick)return true;
 if(a.integrity<=15||a.repairUntil){c.repair=a.integrity<=15&&!a.repairUntil&&a.repairs>0&&tick-a.lastDamage>180;return true;}
 const wheel={x:p.parkX,y:p.parkY,z:p.parkZ},distance=Math.hypot(wheel.x-p.x,wheel.z-p.z);
 // Match onFoot's body sweep and its endpoint margin. A short sight ray can
 // accept a wheel beside a wall even though the actual pickup rejects it.
 const clear=(from:Vec3,to:Vec3)=>{
  const dx=to.x-from.x,dz=to.z-from.z,d=Math.hypot(dx,dz);if(d<1e-7)return true;
  const low=p.footProne>.5,heights=low?[.30,.5]:p.footCrouch>.5?[.62,.95]:[.62,1.1,1.58],offsets=low?[-.75,0,.65]:[0];
  return offsets.every(offset=>heights.every(h=>{const hit=terrain.raycastObstacle({x:from.x+Math.sin(p.headingY)*offset,y:Math.min(from.y,to.y)+h,z:from.z+Math.cos(p.headingY)*offset},{x:dx/d,y:0,z:dz/d},d+.3,.27);return hit===null||hit>d+.27;}));
 };
 if(distance<=1.05&&Math.abs(p.y-wheel.y)<.3&&p.airHeight<.04&&clear(p,wheel)){
  // Recover survives a rejected/temporarily interrupted pickup without holding
  // the edge-triggered dismount button forever.
  c.recover=true;return true;
 }
 let destination=wheel,approachChanged=false;
 if(!clear(p,wheel)){
  if(tick>=state.replan){
   const candidates:Vec3[]=[];
   for(let i=0;i<16;i++){
    const yaw=i*Math.PI/8,x=wheel.x+Math.sin(yaw)*.85,z=wheel.z+Math.cos(yaw)*.85,g=terrain.sampleGround(x,z,createGroundSample(),wheel.y),q={x,y:g.height,z};
    if(!g.offCourse&&g.normal.y>.85&&Math.abs(g.height-wheel.y)<.3&&clear(q,wheel))candidates.push(q);
   }
   // Prefer a directly walkable approach. Otherwise ordinary route finding
   // still handles a wheel separated by cover; no pose or wheel is relocated.
   candidates.sort((a,b)=>Number(clear(p,b))-Number(clear(p,a))||Math.hypot(a.x-p.x,a.z-p.z)-Math.hypot(b.x-p.x,b.z-p.z));
   state.approach=candidates[0];state.path=[];state.replan=tick+30;approachChanged=true;
  }
  if(state.approach)destination=state.approach;
 }
 let next:Vec3|undefined;
 if(clear(p,destination))next=destination;
 else{
  if(tick>=state.replan||approachChanged){state.path=terrain.route(p,destination);state.replan=tick+30;}
  while(state.path.length&&Math.hypot(state.path[0].x-p.x,state.path[0].z-p.z)<.65)state.path.shift();
  while(state.path.length>1&&clear(p,state.path[1]))state.path.shift();
  next=state.path[0];
 }
 if(!next)return true; // A blocked wheel is never a reason to cross solid cover.
 const dx=next.x-p.x,dz=next.z-p.z,d=Math.hypot(dx,dz)||1;
 const facing=angle(p.headingY+clamp(angle(Math.atan2(dx,dz)-p.headingY),-.09,.09));
 c.facingYaw=facing;c.throttle=clamp((dx*Math.sin(facing)+dz*Math.cos(facing))/d,-1,1);
 c.steer=clamp(-(dx*Math.cos(facing)-dz*Math.sin(facing))/d,-1,1);c.burst=distance>3;
 return true;
}
