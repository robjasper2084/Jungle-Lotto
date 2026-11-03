import {Quaternion,Vector3,MathUtils} from 'three';
import {TEMPLATE_MOTION} from './templateMotionData.ts';
export {TEMPLATE_MOTION};
export type TemplateClip=keyof typeof TEMPLATE_MOTION;
const offsets=[30,34,47,51,55];
export function blendTemplate(a:number[],b:number[],t:number){
 const row=a.map((n,k)=>MathUtils.lerp(n,b[k],t));
 for(const o of offsets)new Quaternion().fromArray(a,o).slerp(new Quaternion().fromArray(b,o),t).normalize().toArray(row,o);
 for(const o of [0,3,6,9,12,15,18,21,38,41])new Vector3().fromArray(row,o).normalize().toArray(row,o);
 return row;
}
export function sampleTemplate(name:TemplateClip,phase:number){
 const clip=TEMPLATE_MOTION[name],phaseSafe=Number.isFinite(phase)?phase:0;
 const f=(clip.loop?((phaseSafe%1)+1)%1:MathUtils.clamp(phaseSafe,0,1))*(clip.frames.length-1),i=Math.floor(f);
 return blendTemplate(clip.frames[i],clip.frames[Math.min(i+1,clip.frames.length-1)],f-i);
}
/** The game motor owns root travel. Captured poses follow its distance cycle. */
export function templateLocomotion(speed:number,direction:number,phase:number,time:number){
 const idle=sampleTemplate('idle',time/TEMPLATE_MOTION.idle.duration);
 const travel=MathUtils.smoothstep(speed,0,.8),run=MathUtils.smoothstep(speed,2.6,5.2);
 const forward=blendTemplate(sampleTemplate('walk',phase),sampleTemplate('run',phase),run);
 const backward=sampleTemplate('back',phase);
 return blendTemplate(idle,blendTemplate(forward,backward,MathUtils.smoothstep(-Math.cos(direction),0,.65)),travel);
}
