/** Render-only articulation. No steering, collision or race-state writes. */
export interface RiderReaction {lean:number;pitch:number;compression:number;headPitch:number;headRoll:number;look:number}
export interface RiderArticulation extends RiderReaction {hipLean:number;chestLean:number;hipYaw:number;chestYaw:number;breath:number}
const bounded=(n:number,a:number,b:number)=>Math.max(a,Math.min(b,n));
const follow=(value:number,target:number,rate:number,dt:number)=>target+(value-target)*Math.exp(-rate*dt);
export class RiderPresence {
 readonly pose:RiderArticulation={lean:0,pitch:0,compression:0,headPitch:0,headRoll:0,look:0,hipLean:0,chestLean:0,hipYaw:0,chestYaw:0,breath:0};
 private time=0;private ready=false;private x=0;private y=0;private z=0;
 reset(){for(const key of Object.keys(this.pose) as (keyof RiderArticulation)[])this.pose[key]=0;this.time=0;this.ready=false;return this.pose;}
 update(seconds:number,base:RiderReaction,vehicle:{x:number;y:number;z:number;speed:number;pitch:number;roll:number},running:boolean,reduced:boolean){
  const s=this.pose;
  if(reduced)return this.reset();
  if(!running)return s;
  if(!Number.isFinite(seconds)||!Number.isFinite(vehicle.x)||!Number.isFinite(vehicle.y)||!Number.isFinite(vehicle.z)||!Number.isFinite(vehicle.speed)||!Number.isFinite(vehicle.pitch)||!Number.isFinite(vehicle.roll)||!Number.isFinite(base.lean)||!Number.isFinite(base.pitch)||!Number.isFinite(base.compression)||!Number.isFinite(base.headPitch)||!Number.isFinite(base.headRoll)||!Number.isFinite(base.look))return this.reset();
  const dt=bounded(seconds,0,.12);if(!dt)return s;
  if(this.ready&&Math.hypot(vehicle.x-this.x,vehicle.y-this.y,vehicle.z-this.z)>8)this.reset();
  this.x=vehicle.x;this.y=vehicle.y;this.z=vehicle.z;this.ready=true;this.time+=dt;
  // Exponential response separates pelvis, chest and head without a physics spring.
  const cruise=bounded((Math.abs(vehicle.speed)-5)/19,0,1),turn=bounded(base.look*1.55,-.21,.21);
  s.lean=bounded(base.lean,-.24,.24);
  s.pitch=bounded(base.pitch*1.35+cruise*.045,-.10,.19);
  s.compression=bounded(base.compression*1.15,0,.082);
  s.hipLean=follow(s.hipLean,s.lean,4.5,dt);
  s.chestLean=follow(s.chestLean,s.lean,12,dt);
  s.hipYaw=follow(s.hipYaw,turn*.12,4.5,dt);
  s.chestYaw=follow(s.chestYaw,turn*.29,9,dt);
  s.look=follow(s.look,turn-s.chestYaw,15,dt);
  // A 4 mm-equivalent chest breath, not camera shake or artificial vehicle wobble.
  s.breath=Math.sin(this.time*1.6)*.004*(1-cruise*.65)*Math.min(1,this.time);
  s.headPitch=follow(s.headPitch,-s.pitch*.68-vehicle.pitch*.45-s.breath,13,dt);
  s.headRoll=follow(s.headRoll,-(s.hipLean*.08+s.chestLean*.92)*.65-vehicle.roll*.5,13,dt);
  return s;
 }
}
/** Reduce only decorative articulation when a shipped limb cannot reach its socket. */
export function articulationStrength(handError:number,footError:number,attempt:number){
 return Number.isFinite(handError)&&Number.isFinite(footError)&&Math.max(handError,footError)<=.015?1:attempt===0?.5:0;
}
