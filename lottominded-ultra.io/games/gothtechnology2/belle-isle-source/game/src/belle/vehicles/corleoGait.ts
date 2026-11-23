import {MathUtils,Object3D,Vector3} from 'three';
import type {HoverPose} from '../hoverController.ts';
export type CorleoGait='IDLE'|'WALK'|'TROT'|'RUN';
export const CORLEO_LEGS=['FL','FR','RL','RR'] as const;
// Cheetah-inspired four-beat walk, diagonal trot and rotary sprint: FR, FL,
// gathered flight, RL, RR, extended flight. Retargeted to a rigid robot chassis.
// Walk/trot timing: https://doi.org/10.1186/s40462-022-00305-w (figure 4).
// Sprint reference: the user's Adobe cheetah cycle and
// Bertram & Gutmann (2009), https://pmc.ncbi.nlm.nih.gov/articles/PMC2696142/.
export const CORLEO_GAITS={
 IDLE:{duty:1,stride:0,lift:0,height:1.62,offset:[0,0,0,0]},
 WALK:{duty:.67,stride:1.18,lift:.14,height:1.48,offset:[.25,.75,0,.5]},
 TROT:{duty:.40,stride:1.65,lift:.24,height:1.43,offset:[.5,0,0,.5]},
 RUN:{duty:.22,stride:2.35,lift:.72,height:1.24,offset:[.08,0,.46,.54]},
} as const;
export const corleoGaitForSpeed=(speed:number):CorleoGait=>Math.abs(speed)<.045?'IDLE':Math.abs(speed)<1.9?'WALK':Math.abs(speed)<6?'TROT':'RUN';
export function corleoCadence(speed:number,gait:CorleoGait){const g=CORLEO_GAITS[gait];return g.stride?Math.min(3.1,Math.abs(speed)*g.duty/(g.stride*.64)):0;}
const cycle=(n:number)=>((n%1)+1)%1;
export function sampleCorleoStride(gait:CorleoGait,phase:number,reverse=false){
 const g=CORLEO_GAITS[gait],p=cycle(phase),tau=p*Math.PI*2;
 const flex=Math.cos((p-.38)*Math.PI*2);
 const bob=gait==='TROT'?.022*(1-Math.cos(tau*2)):gait==='RUN'?.035*Math.cos(tau*2):gait==='WALK'?.006*Math.cos(tau*2):0;
 const pitch=gait==='RUN'?.035*flex:gait==='WALK'?.009*Math.sin(tau):gait==='TROT'?.012*Math.sin(tau*2):0;
 return {height:g.height+bob,pitch,rearPitch:gait==='RUN'?-.26*flex:gait==='WALK'?.045*Math.sin(tau-.7):gait==='TROT'?.06*Math.sin(tau*2-.4):0,riderLean:gait==='RUN'?-.23+.025*flex:gait==='TROT'?-.09:gait==='WALK'?-.035:0,
  feet:CORLEO_LEGS.map((id,i)=>{
   const t=cycle(p-g.offset[i]),stance=t<g.duty,u=stance?t/g.duty:(t-g.duty)/(1-g.duty);
   // A planted hoof moves backwards at constant speed; swing folds it under
   // the body and brings it forward with a smooth, raised recovery arc.
   const swing=u*u*u*(u*(u*6-15)+10);
   const stride=gait==='IDLE'?0:stance?u-.5:.5-swing;
   const shoulder=(gait==='WALK'?.065:gait==='TROT'?.045:0)*-Math.cos(t*Math.PI*2);
   return {id,x:id[1]==='L'?-.58:.58,y:.15+(stance?0:g.lift*Math.pow(Math.sin(Math.PI*u),1.5)),z:(id[0]==='F'?-.81:.91)+stride*g.stride*(reverse?-1:1),stance,shoulder};
  })};
}
/** Adapt the original mechanical two-link legs; never scale their segments. */
export function createCorleoGait(model:Object3D){
 const node=(name:string)=>{const n=model.getObjectByName(name);if(!n)throw Error('CORLEO gait joint missing: '+name);return n;};
 const root=node('CR_Root'),body=node('CR_Body'),rear=node('CR_RearSwing'),lean=node('CR_RiderLean');
 const joints=CORLEO_LEGS.map(id=>{const hip=node('CR_'+id+'_Hip');return{id,hip,hipOrigin:hip.position.clone(),upper:node('CR_'+id+'_Upper'),lower:node('CR_'+id+'_Lower'),foot:node('CR_'+id+'_Foot'),target:new Vector3()};});
 const world=new Vector3(),local=new Vector3();let active=false,height=1.62,pitch=0,rearPitch=0,riderLean=0;
 return {resetOffsets(){for(const j of joints)j.hip.position.copy(j.hipOrigin);},update(p:HoverPose,dt:number){
  const action=p.corleoAction??corleoGaitForSpeed(p.speed);
  if(!['IDLE','WALK','TROT','RUN'].includes(action)){active=false;return;}
  const gait=action as CorleoGait,sample=sampleCorleoStride(gait,p.corleoPhase??0,p.speed<0),blend=active?1-Math.exp(-Math.max(0,dt)*18):1;
  height=MathUtils.lerp(height,sample.height,blend);pitch=MathUtils.lerp(pitch,sample.pitch,blend);rearPitch=MathUtils.lerp(rearPitch,sample.rearPitch,blend);riderLean=MathUtils.lerp(riderLean,sample.riderLean,blend);
  root.position.set(0,height,0);body.rotation.set(pitch,0,0);rear.rotation.set(rearPitch,0,0);lean.rotation.x=riderLean;
  for(let i=0;i<joints.length;i++){const j=joints[i];j.hip.position.copy(j.hipOrigin);if(j.id[0]==='F')j.hip.position.z+=sample.feet[i].shoulder;}
  model.updateWorldMatrix(true,true);
  for(let i=0;i<joints.length;i++){
   const j=joints[i],f=sample.feet[i];if(!active)j.target.set(f.x,f.y,f.z);else j.target.lerp(world.set(f.x,f.y,f.z),blend);
   local.copy(j.hip.worldToLocal(model.localToWorld(world.copy(j.target))));
   const a=j.lower.position.length(),b=j.foot.position.length(),d=MathUtils.clamp(Math.hypot(local.y,local.z),.04,a+b-.0001);
   const knee=(j.id[0]==='F'?-1:1)*Math.acos(MathUtils.clamp((d*d-a*a-b*b)/(2*a*b),-1,1));
   const upper=Math.atan2(-local.z,-local.y)-Math.atan2(b*Math.sin(knee),a+b*Math.cos(knee));
   j.upper.rotation.set(upper,0,0);j.lower.rotation.set(knee,0,0);
   // Keep split hooves level at contact, with a small toe fold during swing.
   j.foot.rotation.set(-upper-knee-pitch-(j.id[0]==='R'?rear.rotation.x:0),0,0);
  }
  active=true;model.updateWorldMatrix(true,true);
 }};
}
