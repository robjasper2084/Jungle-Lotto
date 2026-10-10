import {installedMocap} from './installedMocapData.ts';
export type MocapAction=keyof typeof installedMocap;
export const INSTALLED_MOCAP_INFO=Object.fromEntries(Object.entries(installedMocap).map(([id,c])=>[id,{name:c.name,source:c.source,duration:c.duration}]));
/** Source rotations converted to anatomical shoulder/elbow/torso angles in Blender.
 * They drive each hero's own limb lengths; feet remain controlled by contact IK. */
export function sampleMocap(action:MocapAction,phase:number,loop=true):number[]{
 const samples=installedMocap[action].samples;
 const t=(loop?((phase%1)+1)%1:Math.max(0,Math.min(1,phase)))*64;
 const i=Math.min(63,Math.floor(t)),f=t-i;
 return samples[i].map((v,k)=>v+(samples[i+1][k]-v)*f);
}
export function locomotionMocap(phase:number,jog:boolean,run:number){
 const a=sampleMocap(jog?'jog':'walk',phase);
 if(!jog||run<=0)return a;
 const b=sampleMocap('run',phase);return a.map((v,k)=>v+(b[k]-v)*run);
}
