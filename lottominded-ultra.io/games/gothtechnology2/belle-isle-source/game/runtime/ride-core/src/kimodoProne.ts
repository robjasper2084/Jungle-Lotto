import {Quaternion} from 'three';
import {KIMODO_PRONE} from './kimodoProneData.ts';
export {KIMODO_PRONE};
/** Deliberately clamps instead of wrapping: holding prone holds the last frame.
 * The controller's reversible phase selects the same pose on descent and rise. */
export function sampleKimodoProne(phase:number){
 const frames=KIMODO_PRONE.frames,f=Math.max(0,Math.min(1,Number.isFinite(phase)?phase:0))*(frames.length-1),i=Math.floor(f),a=frames[i],b=frames[Math.min(i+1,frames.length-1)],u=f-i;
 const row=a.map((value,k)=>value+(b[k]-value)*u);
 for(const k of [30,34,47,51,55])new Quaternion().fromArray(a,k).slerp(new Quaternion().fromArray(b,k),u).normalize().toArray(row,k);
 return row;
}
