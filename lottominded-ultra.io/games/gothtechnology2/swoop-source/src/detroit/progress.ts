import {cutCoords,CUT_LENGTH,cutPoint} from './world.ts';
import {toMap} from './geo-profile.ts';
/** Ordered northbound gates use mapped arc length, never an axis coordinate. */
export const GATES=Array.from({length:8},(_,i)=>(CUT_LENGTH-35)*(i+1)/8);
export function nextCheckpoint(gate:number,before:{x:number;z:number},after:{x:number;z:number}){
  if(gate>=GATES.length)return gate;
  const a=toMap(before.x,0,before.z),b=toMap(after.x,0,after.z),ca=cutCoords(a.x,a.z),cb=cutCoords(b.x,b.z),p=cutPoint(GATES[gate]);
  const forward=(b.x-a.x)*Math.sin(p.heading)+(b.z-a.z)*Math.cos(p.heading);
  return forward>0&&ca.d<GATES[gate]&&cb.d>=GATES[gate]&&Math.abs(cb.u)<2?gate+1:gate;
}
