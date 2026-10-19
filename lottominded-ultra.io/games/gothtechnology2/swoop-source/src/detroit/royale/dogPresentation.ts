import type {BattleDog} from '../../../../ride-core/src/royale/dogPower.ts';

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
