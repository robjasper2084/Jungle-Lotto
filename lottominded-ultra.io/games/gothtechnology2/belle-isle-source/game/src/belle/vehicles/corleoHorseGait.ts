import {MathUtils,Object3D,Vector3} from 'three';
import type {HoverPose} from '../hoverController.ts';
export type HorseGait='IDLE'|'WALK'|'TROT'|'RUN';
export const HORSE_LEGS=['FL','FR','RL','RR'] as const;
// Horse walk/trot, then a cheetah rotary sprint: FR, FL, gathered flight,
// RL, RR, extended flight. Reference: the user's Adobe cheetah cycle and
// Bertram & Gutmann (2009), https://pmc.ncbi.nlm.nih.gov/articles/PMC2696142/.
export const HORSE_GAITS={
 IDLE:{duty:1,stride:0,lift:0,height:1.62,offset:[0,0,0,0]},
 WALK:{duty:.70,stride:1.0,lift:.23,height:1.60,offset:[.25,.75,0,.5]},
 TROT:{duty:.44,stride:1.4,lift:.37,height:1.52,offset:[.5,0,0,.5]},
 RUN:{duty:.22,stride:2.35,lift:.72,height:1.24,offset:[.08,0,.46,.54]},
} as const;
export const horseGait=(speed:number):HorseGait=>Math.abs(speed)<.045?'IDLE':Math.abs(speed)<1.9?'WALK':Math.abs(speed)<6?'TROT':'RUN';
export function horseCadence(speed:number,gait:HorseGait){const g=HORSE_GAITS[gait];return g.stride?Math.min(3.1,Math.abs(speed)*g.duty/(g.stride*.64)):0;}
const cycle=(n:number)=>((n%1)+1)%1;
export function horseStride(gait:HorseGait,phase:number,reverse=false){
 const g=HORSE_GAITS[gait],p=cycle(phase),tau=p*Math.PI*2;
 const flex=Math.cos((p-.38)*Math.PI*2);
 const bob=gait==='TROT'?.045*(1-Math.cos(tau*2)):gait==='RUN'?.035*Math.cos(tau*2):gait==='WALK'?.012*Math.cos(tau*2):0;
 const pitch=gait==='RUN'?.035*flex:gait==='WALK'?.012*Math.sin(tau):0;
 return {height:g.height+bob,pitch,rearPitch:gait==='RUN'?-.26*flex:-pitch*.25,riderLean:gait==='RUN'?-.23+.025*flex:gait==='TROT'?-.05:0,
  feet:HORSE_LEGS.map((id,i)=>{
   const t=cycle(p-g.offset[i]),stance=t<g.duty,u=stance?t/g.duty:(t-g.duty)/(1-g.duty);
   // A planted hoof moves backwards at constant speed; swing folds it under
   // the body and brings it forward with a smooth, raised recovery arc.
   const swing=u*u*u*(u*(u*6-15)+10);
   const stride=gait==='IDLE'?0:stance?u-.5:.5-swing;
   return {id,x:id[1]==='L'?-.58:.58,y:.15+(stance?0:g.lift*Math.pow(Math.sin(Math.PI*u),1.5)),z:(id[0]==='F'?-.81:.91)+stride*g.stride*(reverse?-1:1),stance};
  })};
}
/** Adapt the original mechanical two-link legs; never scale their segments. */
export function createHorseGait(model:Object3D){
 const node=(name:string)=>{const n=model.getObjectByName(name);if(!n)throw Error('CORLEO gait joint missing: '+name);return n;};
 const root=node('CR_Root'),body=node('CR_Body'),rear=node('CR_RearSwing'),lean=node('CR_RiderLean');
 const joints=HORSE_LEGS.map(id=>({id,hip:node('CR_'+id+'_Hip'),upper:node('CR_'+id+'_Upper'),lower:node('CR_'+id+'_Lower'),foot:node('CR_'+id+'_Foot'),target:new Vector3()}));
 const world=new Vector3(),local=new Vector3();let active=false,height=1.62,pitch=0,rearPitch=0,riderLean=0;
 return {update(p:HoverPose,dt:number){
  const action=p.corleoAction??horseGait(p.speed);
  if(!['IDLE','WALK','TROT','RUN'].includes(action)){active=false;return;}
  const gait=action as HorseGait,sample=horseStride(gait,p.corleoPhase??0,p.speed<0),blend=active?1-Math.exp(-Math.max(0,dt)*18):1;
  height=MathUtils.lerp(height,sample.height,blend);pitch=MathUtils.lerp(pitch,sample.pitch,blend);rearPitch=MathUtils.lerp(rearPitch,sample.rearPitch,blend);riderLean=MathUtils.lerp(riderLean,sample.riderLean,blend);
  root.position.set(0,height,0);body.rotation.set(pitch,0,0);rear.rotation.set(rearPitch,0,0);lean.rotation.x=riderLean;
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
