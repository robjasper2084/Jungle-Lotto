import {TEMPLATE_ACTIONS} from './templateActionData.ts';
export {TEMPLATE_ACTIONS};
type Value=number|{x:number;y:number;z:number};
type Key={time:number;value:Value;inSlope:Value;outSlope:Value};
type Curve={kind:string;path:string;attribute:string;keys:Key[]};
const clips=TEMPLATE_ACTIONS as Record<string,{duration:number;curves:Curve[]}>;
const scalar=(v:Value,axis:'x'|'y'|'z')=>typeof v==='number'?v:v[axis];
/** Unity's unweighted Hermite keys, including their authored tangent slopes. */
export function sampleTemplateCurve(name:string,path:string,kind:string,time:number,axis:'x'|'y'|'z'='x',attribute=''){
 const curve=clips[name]?.curves.find(c=>c.path===path&&c.kind===kind&&c.attribute===attribute);if(!curve)return 0;
 const keys=curve.keys;if(time<=keys[0].time)return scalar(keys[0].value,axis);
 const last=keys[keys.length-1];if(time>=last.time)return scalar(last.value,axis);
 const i=keys.findIndex(k=>k.time>=time),a=keys[i-1],b=keys[i],dt=b.time-a.time,t=(time-a.time)/dt,t2=t*t,t3=t2*t;
 return (2*t3-3*t2+1)*scalar(a.value,axis)+(t3-2*t2+t)*dt*scalar(a.outSlope,axis)+(-2*t3+3*t2)*scalar(b.value,axis)+(t3-t2)*dt*scalar(b.inSlope,axis);
}
const body='Pistol_Compact_East.Rig/Body';
export function templateWeapon(name:'Pistol Idle'|'Pistol Fire'|'Pistol Reload',time:number){
 const vector=(path:string,kind:string,scale:number)=>['x','y','z'].map(a=>scale*(sampleTemplateCurve(name,path,kind,time,a as 'x')-sampleTemplateCurve(name,path,kind,0,a as 'x')));
 return {rotation:vector(body,'m_EulerCurves',Math.PI/180),position:vector(body,'m_PositionCurves',100),
  hand:vector(body+'/HandIKLeft','m_PositionCurves',100),handRotation:vector(body+'/HandIKLeft','m_EulerCurves',Math.PI/180),
  magazine:vector(body+'/Magazine','m_PositionCurves',100),slide:vector(body+'/Slide','m_PositionCurves',100),
  trigger:vector(body+'/Trigger','m_EulerCurves',Math.PI/180),hammer:vector(body+'/Hammer','m_EulerCurves',Math.PI/180),
  flash:sampleTemplateCurve(name,body+'/Attach_Muzzle/FireSFX/Point Light','m_FloatCurves',time,'x','m_Intensity')};
}
/** Map the authored insertion (1.5 s) to the server's real ammunition commit. */
export function templateReloadTime(start:number,commit:number,end:number,tick:number){
 return tick<commit?1.5*Math.max(0,Math.min(1,(tick-start)/Math.max(1,commit-start))):1.5+1.55*Math.max(0,Math.min(1,(tick-commit)/Math.max(1,end-commit)));
}
/** Unity muscle-space curves are retargeted to the existing rig's joint limits.
 * Root/shoulder curves are masked: the motor and two-hand weapon IK own those. */
export function templateLook(yaw:number,pitch:number){
 const values:Record<string,number>={};
 for(const [angle,negative,positive,inner,outer]of [[yaw,'Left','Right',40,90],[pitch,'Down','Up',pitch<0?32:40,pitch<0?46.777:82.733]] as const){
  const degrees=Math.abs(angle)*180/Math.PI,dir=angle<0?negative:positive,t=Math.max(0,Math.min(1,(degrees-inner)/(outer-inner)));
  for(const [name,w]of [[`Look${dir} ${inner}`,Math.min(1,degrees/inner)*(1-t)],[`Look${dir} ${outer}`,t]] as const){
   for(const curve of clips[name].curves){if(!/^(Head|Neck|Chest|UpperChest|Spine) /.test(curve.attribute))continue;
    values[curve.attribute]=(values[curve.attribute]??0)+sampleTemplateCurve(name,'','m_FloatCurves',clips[name].duration,'x',curve.attribute)*w;
   }
  }
 }
 return values;
}
export function templateFinger(finger:string,joint:number){
 const source=finger==='Pinky'?'Little':finger;
 return sampleTemplateCurve('RightHandGunPose','','m_FloatCurves',1,'x',`RightHand.${source}.${joint} Stretched`);
}
