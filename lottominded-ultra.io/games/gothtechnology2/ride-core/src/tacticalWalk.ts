import {Euler,Quaternion,Vector3} from 'three';
import {TACTICAL_MOTION} from './tacticalMotionData.ts';
/** Existing TacticalOnFoot capture, fitted for a compact combat-ready walk.
 * This is our pack-derived motion, not extracted PUBG animation data. */
export const TACTICAL_WALK={legLength:.9};
const source=TACTICAL_MOTION.walk.samples;
const headings=[30,34].map(offset=>source.slice(0,-1).reduce((sum,r)=>sum+new Euler().setFromQuaternion(new Quaternion().fromArray(r,offset),'YXZ').y,0)/(source.length-1));
const frames=source.map(r=>{
 const row=r.slice();
 for(let k=0;k<12;k+=3){const d=new Vector3().fromArray(row,k);d.z*=.85;d.normalize().toArray(row,k);}
 for(let side=0;side<2;side++){
  const k=12+side*6,sign=side===0?1:-1;
  const swing=Math.atan2(r[k+2],-r[k+1])*.38+.08;
  const flex=Math.max(.72,Math.min(1.05,Math.atan2(Math.sin(Math.atan2(r[k+5],-r[k+4])-Math.atan2(r[k+2],-r[k+1])),Math.cos(Math.atan2(r[k+5],-r[k+4])-Math.atan2(r[k+2],-r[k+1])))));
  new Vector3(sign*.10,-Math.cos(swing),Math.sin(swing)).normalize().toArray(row,k);
  new Vector3(sign*.06,-Math.cos(swing+flex),Math.sin(swing+flex)).normalize().toArray(row,k+3);
 }
 for(const [i,offset]of [30,34].entries()){
  const e=new Euler().setFromQuaternion(new Quaternion().fromArray(r,offset),'YXZ');
  e.x=e.x*.5+.055;e.y=(e.y-headings[i])*.45;e.z*=.45;
  new Quaternion().setFromEuler(e).toArray(row,offset);
 }
 const ankles=[0,1].map(side=>new Vector3().fromArray(row,side*6).multiplyScalar(.45).addScaledVector(new Vector3().fromArray(row,side*6+3),.45));
 const floor=Math.min(...ankles.map(a=>a.y));
 for(let side=0;side<2;side++){row[24+side*3]=ankles[side].z;row[25+side*3]=Math.max(0,ankles[side].y-floor);row[26+side*3]=0;}
 row[44]=0;row[45]=0;row[46]=.018;
 return row;
});
export function sampleTacticalWalk(phase:number){
 const f=((phase%1)+1)%1*(frames.length-1),i=Math.floor(f),t=f-i,a=frames[i],b=frames[i+1];
 const row=a.map((n,k)=>n+(b[k]-n)*t);
 for(const offset of [30,34])new Quaternion().fromArray(a,offset).slerp(new Quaternion().fromArray(b,offset),t).toArray(row,offset);
 return row;
}
export function tacticalFoot(row:number[],side:number,legLength:number){
 const k=24+side*3,scale=legLength/TACTICAL_WALK.legLength;
 return {z:row[k]*scale,lift:row[k+1]*scale,pitch:row[k+2]};
}
