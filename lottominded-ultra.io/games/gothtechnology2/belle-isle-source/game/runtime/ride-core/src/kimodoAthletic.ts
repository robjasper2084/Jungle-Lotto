import {Quaternion,Vector3,MathUtils} from 'three';
import {KIMODO_ATHLETIC} from './kimodoAthleticData.ts';
export {KIMODO_ATHLETIC};
export type AthleticClip=keyof typeof KIMODO_ATHLETIC.clips;
export function blendAthletic(a:number[],b:number[],weight:number){
 const t=MathUtils.clamp(weight,0,1),row=a.map((n,k)=>MathUtils.lerp(n,b[k],t));
 for(const k of [30,34,47])new Quaternion().fromArray(a,k).slerp(new Quaternion().fromArray(b,k),t).normalize().toArray(row,k);
 for(const k of [0,3,6,9,12,15,18,21,38,41])new Vector3().fromArray(row,k).normalize().toArray(row,k);
 return row;
}
export function sampleAthletic(name:AthleticClip,phase:number){
 const clip=KIMODO_ATHLETIC.clips[name],p=clip.loop?((phase%1)+1)%1:MathUtils.clamp(phase,0,1),f=p*(clip.frames.length-1),i=Math.floor(f);
 return blendAthletic(clip.frames[i],clip.frames[Math.min(i+1,clip.frames.length-1)],f-i);
}
// Retain the generated sprint, but remove the take's left/right limping bias.
// Pair opposite half-strides before filtering; leave walk, crouch and lean data
// untouched. A periodic cubic sampler keeps velocity continuous at the seam.
const sprintRows=(()=>{
 const source=KIMODO_ATHLETIC.clips.sprint.frames,n=source.length-1;
 const paired=source.slice(0,n).map((a,i)=>{
  const b=source[(i+n/2)%n],row=a.slice();
  for(let side=0;side<2;side++){
   for(const base of [0,3,12,15])for(let axis=0;axis<3;axis++)row[base+side*6+axis]=(a[base+side*6+axis]+b[base+(1-side)*6+axis]*(axis===0?-1:1))*.5;
   for(let axis=0;axis<3;axis++)row[24+side*3+axis]=(a[24+side*3+axis]+b[24+(1-side)*3+axis])*.5;
   for(let axis=0;axis<3;axis++)row[38+side*3+axis]=(a[38+side*3+axis]+b[38+(1-side)*3+axis]*(axis===0?-1:1))*.5;
  }
  for(const off of [30,34,47])new Quaternion().fromArray(a,off).slerp(new Quaternion(b[off],-b[off+1],-b[off+2],b[off+3]),.5).toArray(row,off);
  row[44]=(a[44]-b[44])*.5;row[45]=(a[45]+b[45])*.5;row[46]=(a[46]+b[46])*.5;
  return row;
 });
 return paired.map((row,i)=>row.map((_,k)=>[-2,-1,0,1,2].reduce((sum,d,j)=>sum+paired[(i+d+n)%n][k]*[1,4,6,4,1][j]/16,0)));
})();
export function sampleSmoothSprint(phase:number){
 const n=sprintRows.length,f=(((phase%1)+1)%1)*n,i=Math.floor(f),t=f-i;
 const a=sprintRows[(i+n-1)%n],b=sprintRows[i],c=sprintRows[(i+1)%n],d=sprintRows[(i+2)%n];
 const row=b.map((v,k)=>.5*(2*v+(-a[k]+c[k])*t+(2*a[k]-5*v+4*c[k]-d[k])*t*t+(-a[k]+3*v-3*c[k]+d[k])*t*t*t));
 for(const off of [30,34,47])new Quaternion().fromArray(row,off).normalize().toArray(row,off);
 for(const off of [0,3,6,9,12,15,18,21,38,41])new Vector3().fromArray(row,off).normalize().toArray(row,off);
 // Shoes should roll off the ground, not point vertically through recovery.
 for(const off of [26,29])row[off]=.60*Math.tanh(row[off]/.60);
 return row;
}
export function athleticFoot(row:number[],side:number,legLength:number){
 const k=24+side*3,scale=legLength/KIMODO_ATHLETIC.clips.sprint.legLength;
 return {z:row[k]*scale,lift:Math.max(0,row[k+1]*scale),pitch:row[k+2]};
}
