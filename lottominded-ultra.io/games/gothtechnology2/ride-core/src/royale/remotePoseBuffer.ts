import type {RidePose} from '../controller.ts';
type Sample={id:string;spawnSerial:number;pose:RidePose};
/** 100 ms interpolation buffer. Never extrapolates or reintroduces hidden actors. */
export class RemotePoseBuffer {
 private frames:{tick:number;at:number;actors:readonly Sample[]}[]=[];private round='';
 reset(){this.frames=[];this.round='';}
 push(round:string,tick:number,actors:readonly Sample[],at:number){if(round!==this.round){this.reset();this.round=round;}const last=this.frames.at(-1);if(last&&tick<=last.tick)return false;this.frames.push({tick,at,actors});if(this.frames.length>12)this.frames.shift();return true;}
 pose(id:string,current:RidePose,serial:number,now:number){
  const latest=this.frames.at(-1);if(!latest||!latest.actors.some(a=>a.id===id&&a.spawnSerial===serial))return current;
  const tick=Math.min(latest.tick,latest.tick+(now-latest.at)*.06-6);let left=this.frames[0],right=left;
  for(const frame of this.frames){if(frame.tick<=tick)left=frame;if(frame.tick>=tick){right=frame;break;}right=frame;}
  const a=left.actors.find(a=>a.id===id&&a.spawnSerial===serial),b=right.actors.find(a=>a.id===id&&a.spawnSerial===serial);if(!a||!b||Math.hypot(a.pose.x-b.pose.x,a.pose.z-b.pose.z)>20)return current;
  const f=Math.max(0,Math.min(1,(tick-left.tick)/Math.max(1,right.tick-left.tick))),out={...current};
  for(const key of ['x','y','z','footCycle','footBlend','footCrouch','footProne','airHeight','speed'] as const)out[key]=a.pose[key]+(b.pose[key]-a.pose[key])*f;
  out.footPhase=out.footCycle%1;out.headingY=a.pose.headingY+Math.atan2(Math.sin(b.pose.headingY-a.pose.headingY),Math.cos(b.pose.headingY-a.pose.headingY))*f;return out;
 }
}
