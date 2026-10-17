import {Quaternion} from 'three';
import {BROTHER_WALK} from './brotherWalkData.ts';
export {BROTHER_WALK};
/** Preserve the supplied take's full 3D limb directions and body rotation. */
export function sampleBrotherWalk(phase:number):number[]{
 const f=((phase%1)+1)%1*(BROTHER_WALK.frames.length-1),i=Math.floor(f),t=f-i,a=BROTHER_WALK.frames[i],b=BROTHER_WALK.frames[i+1];
 const row=a.map((v,k)=>v+(b[k]-v)*t);
 for(const offset of [30,34])new Quaternion().fromArray(a,offset).slerp(new Quaternion().fromArray(b,offset),t).toArray(row,offset);
 return row;
}
export function brotherFoot(row:number[],side:number,legLength:number){
 const k=24+side*3,scale=legLength/BROTHER_WALK.legLength;
 return {z:row[k]*scale,lift:row[k+1]*scale,pitch:row[k+2]};
}
