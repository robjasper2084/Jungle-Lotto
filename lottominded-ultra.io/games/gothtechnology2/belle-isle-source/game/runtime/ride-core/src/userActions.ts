import {USER_ACTIONS} from './userActionData.ts';
export {USER_ACTIONS};
export type UserAction=keyof typeof USER_ACTIONS;
/** Loops wrap; one-shots clamp and hold their final frame. Phase is owned by gameplay. */
export function sampleUserAction(name:UserAction,phase:number):number[]{
 const c=USER_ACTIONS[name],p=c.loop?((phase%1)+1)%1:Math.max(0,Math.min(1,phase));
 const f=p*(c.frames.length-1),a=Math.floor(f),b=Math.min(a+1,c.frames.length-1);
 return c.frames[a].values.map((v,k)=>v+(c.frames[b].values[k]-v)*(f-a));
}
export function userFoot(name:UserAction,row:number[],side:number,length:number){
 const k=24+side*3,scale=length/USER_ACTIONS[name].legLength;
 return {z:row[k]*scale,lift:row[k+1]*scale,pitch:row[k+2]};
}
