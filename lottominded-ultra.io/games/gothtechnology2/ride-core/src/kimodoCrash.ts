import {KIMODO_CRASHES} from './kimodoCrashData.ts';
export const CRASH_KINDS=['front','side','back','landing'] as const;
export type CrashKind=typeof CRASH_KINDS[number];
const clamp=(n:number,a=0,b=1)=>Math.max(a,Math.min(b,n));
export function crashKind(reason:string,forward:number,lateral:number,bank:number):CrashKind{
 if(reason==='hard landing')return 'landing';
 if(reason==='sideways landing'||reason==='dog power-up'||Math.abs(lateral)>Math.abs(forward)*.7&&Math.abs(lateral)>.4)return 'side';
 if(forward<-.2)return 'back';
 if(reason==='collision')return 'front';
 return Math.abs(bank)>.25?'side':'front';
}
export function crashSample(kind:number,progress:number){
 const clip=KIMODO_CRASHES[CRASH_KINDS[clamp(Math.round(kind)-1,0,3)]],frame=clamp(progress)*(clip.samples.length-1),i=Math.floor(frame),a=clip.samples[i],b=clip.samples[Math.min(i+1,clip.samples.length-1)],u=frame-i;
 return a.map((v,n)=>v+(b[n]-v)*u);
}
export function crashProgress(kind:CrashKind,age:number,contact:number,settle:number){
 const pivot=KIMODO_CRASHES[kind].contact;
 return age<=contact?clamp(age/contact)*pivot:pivot+(1-pivot)*clamp((age-contact)/Math.max(.01,settle-contact));
}
/** Captured limb directions are mirrored as a whole; never independently flip joints. */
export function crashLimb(kind:number,progress:number,index:number,side:number,leg=false){
 const mirror=side<0,source=mirror?1-index:index,row=crashSample(kind,progress),offset=(leg?9:3)+source*3;
 const result={x:row[offset]*(mirror?-1:1),y:row[offset+1],z:row[offset+2]};
 if(!leg){
  // Reference: EUC spills brace with bent, unequal arms. Preserve the take's
  // direction but leave elbow travel to absorb impact instead of locking both
  // hands at maximum reach. Relax this correction again as the body settles.
  const pivot=KIMODO_CRASHES[CRASH_KINDS[clamp(Math.round(kind)-1,0,3)]].contact;
  const ease=(n:number)=>{n=clamp(n);return n*n*(3-2*n);};
  const absorb=ease((progress-pivot+.08)/.14)*(1-ease((progress-pivot-.16)/.30));
  const reach=.96-(source===0?.16:.10)*absorb,length=Math.hypot(result.x,result.y,result.z);
  if(length>reach){const scale=reach/length;result.x*=scale;result.y*=scale;result.z*=scale;}
 }
 return result;
}
