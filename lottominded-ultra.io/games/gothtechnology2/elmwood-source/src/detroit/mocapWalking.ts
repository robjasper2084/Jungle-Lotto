import * as T from 'three';
import {mocapWalk} from './mocapWalkData.ts';
/** Cyclic rotations from Blender's CMU 07_01 retarget. Remove bind alignment,
 * then layer recorded chest/shoulder/head/arm motion over grounded locomotion. */
const references=new Map<string,T.Quaternion>();
for(const [name,values] of Object.entries(mocapWalk.bones)){const q=new T.Quaternion().fromArray(values),sum=[0,0,0,0];for(let i=0;i<values.length;i+=4){const sign=q.dot(new T.Quaternion().fromArray(values,i))<0?-1:1;for(let j=0;j<4;j++)sum[j]+=values[i+j]*sign;}references.set(name,new T.Quaternion().fromArray(sum).normalize().invert());}
export const MOCAP_WALK_INFO={source:mocapWalk.source,duration:mocapWalk.duration,nominalSpeed:mocapWalk.nominalSpeed,cycleMetres:mocapWalk.cycleMetres};
export function mocapWalking(bones:readonly {o:T.Object3D}[],phase:number,weight:number){const t=((phase%1)+1)%1*mocapWalk.duration;let i=0;while(i<mocapWalk.times.length-2&&mocapWalk.times[i+1]<t)i++;const blend=(t-mocapWalk.times[i])/(mocapWalk.times[i+1]-mocapWalk.times[i]);for(const b of bones){const values=(mocapWalk.bones as Record<string,number[]>)[b.o.name];if(!values||!/Spine|neck|Neck|Head/.test(b.o.name))continue;const motion=new T.Quaternion().fromArray(values,i*4).slerp(new T.Quaternion().fromArray(values,(i+1)*4),blend).premultiply(references.get(b.o.name)!);const amount=/Shoulder|Spine|Head|neck|Neck/.test(b.o.name)?.72:.25;b.o.quaternion.multiply(new T.Quaternion().slerp(motion,weight*amount));} }
