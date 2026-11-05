import {createPose,lerpPose,type RidePose} from './controller.ts';
const keys=Object.keys(createPose()) as (keyof RidePose)[];
export const GHOST_SECONDS=120;
export type GhostRun={version:1;map:string;rig:string;keys:string[];frames:number[][]};
/** One bounded, map/rig-specific recording. Ghosts never enter simulation. */
export class RideGhostTrack{
 frames:number[][]=[];time=0;private next=0;
 step(dt:number,p:RidePose){this.time=Math.min(GHOST_SECONDS,this.time+Math.max(0,dt));if(this.time<this.next)return;this.next=this.time+.1;this.frames.push([+this.time.toFixed(3),...keys.map(k=>+p[k].toFixed(4))]);}
 finish(map:string,rig:string):GhostRun{return{version:1,map,rig,keys:[...keys],frames:this.frames};}
}
export function readGhost(raw:string|null,map:string):GhostRun|undefined{
 try{const r=JSON.parse(raw??'null') as GhostRun;
 if(!r||r.version!==1||r.map!==map||typeof r.rig!=='string'||r.rig.length>150||!Array.isArray(r.keys)||r.keys.join(',')!==keys.join(',')||!Array.isArray(r.frames)||r.frames.length<2||r.frames.length>1202)return;
 let t=-1;for(const row of r.frames){if(!Array.isArray(row)||row.length!==keys.length+1||row.some(v=>!Number.isFinite(v)||Math.abs(v)>1e7)||row[0]<=t||row[0]>GHOST_SECONDS+.01)return;t=row[0];}return r;
 }catch{return;}
}
export function sampleGhost(run:GhostRun,time:number,out:RidePose){
 const f=run.frames;let low=0,high=f.length-1;while(low+1<high){const m=(low+high)>>1;if(f[m][0]<=time)low=m;else high=m;}
 const a=createPose(),b=createPose();keys.forEach((k,i)=>{a[k]=f[low][i+1];b[k]=f[high][i+1];});
 const alpha=Math.max(0,Math.min(1,(time-f[low][0])/Math.max(.001,f[high][0]-f[low][0])));
 // Mounting, respawn and recovery change several coordinates as one state.
 if(a.footMode!==b.footMode||Math.hypot(a.x-b.x,a.y-b.y,a.z-b.z)>8)Object.assign(out,alpha<1?a:b);
 else{lerpPose(a,b,alpha,out);out.headingY=a.headingY+Math.atan2(Math.sin(b.headingY-a.headingY),Math.cos(b.headingY-a.headingY))*alpha;}
 return out;
}
