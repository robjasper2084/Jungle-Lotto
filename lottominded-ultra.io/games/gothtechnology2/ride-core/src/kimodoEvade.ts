import {Quaternion} from 'three';
import {KIMODO_EVADE} from './kimodoEvadeData.ts';
export {KIMODO_EVADE};
export function sampleKimodoEvade(phase:number){
 const frames=KIMODO_EVADE.frames,f=Math.max(0,Math.min(1,phase))*(frames.length-1),i=Math.floor(f),a=frames[i],b=frames[Math.min(i+1,frames.length-1)],u=f-i,row=a.map((v,k)=>v+(b[k]-v)*u);
 for(const k of [30,34,47,51,55])new Quaternion().fromArray(a,k).slerp(new Quaternion().fromArray(b,k),u).normalize().toArray(row,k);
 return row;
}
