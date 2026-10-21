import {angle,clamp} from '../rideDynamics.ts';
import type {Vec3} from '../terrain.ts';
import type {Actor,Command} from './rules.ts';
import type {BattleTerrain} from './battleTerrain.ts';

export const botWheelRecovery=()=>({returning:false,replan:0,path:[] as Vec3[],stayMountedUntil:0});
/** Host-owned intent only: use the ordinary foot collision, stagger, health and
 * pickup/remount checks. Never reset/teleport the actor or shorten its animation. */
export function recoverBotWheel(a:Actor,c:Command,state:ReturnType<typeof botWheelRecovery>,terrain:BattleTerrain,tick:number){
 const p=a.pose;
 if(p.footMode&&p.footStagger>0&&!state.returning){state.returning=true;state.replan=0;state.path=[];}
 if(state.returning&&!p.footMode){state.returning=false;state.path=[];state.stayMountedUntil=tick+240;}
 if(!state.returning)return false;
 c.slot=a.slot;
 // Let the impact settle and let an in-progress pickup finish without AI fire,
 // reload or steering immediately cancelling it.
 if(p.footMode!==2||p.footStagger>0||(a.combat.melee?.staggerUntil??0)>tick)return true;
 if(a.integrity<=15||a.repairUntil){c.repair=a.integrity<=15&&!a.repairUntil&&a.repairs>0&&tick-a.lastDamage>180;return true;}
 const wheel={x:p.parkX,y:p.parkY,z:p.parkZ},distance=Math.hypot(wheel.x-p.x,wheel.z-p.z);
 const clear=(to:Vec3)=>terrain.line({x:p.x,y:p.y+.7,z:p.z},{...to,y:to.y+.7},.35);
 if(distance<=1.05&&Math.abs(p.y-wheel.y)<.3&&p.airHeight<.04&&clear(wheel)){
  c.dismount=true;return true;
 }
 let next:Vec3|undefined;
 if(clear(wheel))next=wheel;
 else{
  if(tick>=state.replan){state.path=terrain.route(p,wheel);state.replan=tick+30;}
  while(state.path.length&&Math.hypot(state.path[0].x-p.x,state.path[0].z-p.z)<.65)state.path.shift();
  while(state.path.length>1&&clear(state.path[1]))state.path.shift();
  next=state.path[0];
 }
 if(!next)return true; // A blocked wheel is never a reason to cross solid cover.
 const dx=next.x-p.x,dz=next.z-p.z,d=Math.hypot(dx,dz)||1;
 const facing=angle(p.headingY+clamp(angle(Math.atan2(dx,dz)-p.headingY),-.09,.09));
 c.facingYaw=facing;c.throttle=clamp((dx*Math.sin(facing)+dz*Math.cos(facing))/d,-1,1);
 c.steer=clamp(-(dx*Math.cos(facing)-dz*Math.sin(facing))/d,-1,1);c.burst=distance>3;
 return true;
}
