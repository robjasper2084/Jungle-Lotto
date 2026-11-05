import {MANNY_WALK} from './mannyWalkData.ts';
/** Root travel is removed in Blender. Distance-driven phase stays owned by the controller. */
export function sampleMannyWalk(phase:number):number[]{
 const f=((phase%1)+1)%1*(MANNY_WALK.frames.length-1),i=Math.floor(f),t=f-i;
 return MANNY_WALK.frames[i].values.map((v,k)=>v+(MANNY_WALK.frames[i+1].values[k]-v)*t);
}
export function mannyFoot(row:number[],side:number,legLength:number){
 const i=24+side*3,scale=legLength/MANNY_WALK.legLength;
 // Match the existing 1.65m controller cycle; IK still limits each rider's reach.
 const strideScale=1.65*Math.max(.35,legLength/.9)/MANNY_WALK.cycleDistance;
 return{z:row[i]*strideScale,lift:row[i+1]*scale,pitch:row[i+2]};
}
