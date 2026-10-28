import {Euler,Quaternion} from 'three';
import {REFERENCE_RUN} from './referenceRunData.ts';
import {sampleSmoothSprint} from './kimodoAthletic.ts';
import {footCycleDistance} from './onFootGait.ts';

export function referenceRunChannels(phase:number){
 const rows=REFERENCE_RUN.frames,n=rows.length-1,f=((phase%1+1)%1)*n,i=Math.floor(f),t=f-i;
 return rows[i].map((v,k)=>v+(rows[i+1][k]-v)*t);
}
/** Blender-authored contact, flight, arm swing and counter-rotation share one phase. */
export function referenceSprint(phase:number){
 const row=sampleSmoothSprint(phase),c=referenceRunChannels(phase);
 for(let side=0;side<2;side++){
  const p=referenceRunChannels(phase+side*.5),sign=side===0?1:-1;
  const a=p[3],b=a+p[4],spread=.075;
  row.splice(12+side*6,6,sign*spread,-Math.cos(a)*Math.sqrt(1-spread*spread),Math.sin(a)*Math.sqrt(1-spread*spread),sign*.025,-Math.cos(b)*Math.sqrt(1-.025**2),Math.sin(b)*Math.sqrt(1-.025**2));
 }
 new Quaternion().setFromEuler(new Euler(c[5],c[6],-.012*Math.sin(phase*Math.PI*2),'YXZ')).toArray(row,30);
 new Quaternion().setFromEuler(new Euler(c[5]*1.5,c[7],.018*Math.sin(phase*Math.PI*2),'YXZ')).toArray(row,34);
 new Quaternion().setFromEuler(new Euler(c[5]*.35,c[7]*.2,0,'YXZ')).toArray(row,47);
 row[44]=Math.sin(phase*Math.PI*2)*.008;row[45]=c[8];row[46]=0;
 return row;
}
export function referenceSprintFoot(phase:number,speed:number,legLength:number){
 const c=referenceRunChannels(phase),distance=footCycleDistance(speed)*Math.max(.2,legLength/.9);
 return {z:c[0]*distance/2.88*.72,lift:c[1]*legLength*Math.min(1,legLength/.7),pitch:c[2],contact:((phase%1+1)%1)<2/12};
}
