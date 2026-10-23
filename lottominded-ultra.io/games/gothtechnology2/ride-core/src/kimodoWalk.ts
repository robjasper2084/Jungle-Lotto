import {Quaternion,Vector3} from 'three';
import {KIMODO_WALK_DATA} from './kimodoWalkData.ts';

export const KIMODO_WALK=KIMODO_WALK_DATA;
/** One approved two-step cycle. Phase comes from actual controller travel. */
export function sampleKimodoWalk(phase:number):number[]{
 const frames=KIMODO_WALK.frames,f=((phase%1)+1)%1*(frames.length-1),i=Math.floor(f),t=f-i,a=frames[i],b=frames[i+1];
 const row=a.map((value,k)=>value+(b[k]-value)*t);
 for(const offset of [30,34,47])new Quaternion().fromArray(a,offset).slerp(new Quaternion().fromArray(b,offset),t).normalize().toArray(row,offset);
 for(const offset of [0,3,6,9,12,15,18,21,38,41])new Vector3().fromArray(row,offset).normalize().toArray(row,offset);
 return row;
}
export function kimodoWalkFoot(row:number[],side:number,legLength:number){
 const k=24+side*3,scale=legLength/KIMODO_WALK.legLength;
 return {z:row[k]*scale,lift:Math.max(0,row[k+1]*scale),pitch:row[k+2]};
}
