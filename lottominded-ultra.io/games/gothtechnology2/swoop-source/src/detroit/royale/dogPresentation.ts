import type {BattleDog} from '../../../../ride-core/src/royale/dogPower.ts';

/** Timestamped samples avoid restarting interpolation on whichever display
 * callback happens to notice a 20 Hz authority update. Keep enough history
 * for the same delayed clock used by remote riders; never extrapolate. */
export class BattleDogPresentation {
 private frames:{tick:number;pose:BattleDog}[]=[];
 sample(current:BattleDog,tick:number,displayTick:number):BattleDog {
  const last=this.frames.at(-1);
  if(last&&(tick<last.tick||current.time<last.pose.time||Math.hypot(current.x-last.pose.x,current.y-last.pose.y,current.z-last.pose.z)>3))this.frames=[];
  const latest=this.frames.at(-1);
  if(!latest||current.time!==latest.pose.time){
   this.frames.push({tick:Math.floor(tick/3)*3,pose:{...current}});
   if(this.frames.length>12)this.frames.shift();
  }
  let left=this.frames[0],right=left;
  for(const frame of this.frames){if(frame.tick<=displayTick)left=frame;if(frame.tick>=displayTick){right=frame;break;}right=frame;}
  const alpha=right.tick===left.tick?1:(displayTick-left.tick)/(right.tick-left.tick);
  return sampleBattleDog(left.pose,right.pose,alpha);
 }
}

/** One presentation clock for translation, gait, banking and pounce. Authority stays at 20 Hz. */
export function sampleBattleDog(previous:BattleDog,current:BattleDog,alpha:number):BattleDog{
 const t=Math.max(0,Math.min(1,alpha)),pose={...current};
 for(const key of ['x','y','z','time','phase','speed','pitch','roll','turnRate'] as const)pose[key]=previous[key]+(current[key]-previous[key])*t;
 pose.heading=previous.heading+Math.atan2(Math.sin(current.heading-previous.heading),Math.cos(current.heading-previous.heading))*t;
 for(const key of ['jumpHeight','jumpProgress','landing'] as const){
  if(previous[key]===undefined&&current[key]===undefined)continue;
  const a=previous[key]??0,b=key==='jumpProgress'&&(previous.jumpHeight??0)>0&&!(current.jumpHeight??0)&&t<1?1:current[key]??0;
  pose[key]=a+(b-a)*t;
 }
 return pose;
}
