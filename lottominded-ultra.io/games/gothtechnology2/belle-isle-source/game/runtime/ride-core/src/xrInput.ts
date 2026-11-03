import {deadAxis,brakeAxis} from './gamepadInput.ts';
import type {RidePose} from './controller.ts';
export type XRPadSource={handedness:string;gamepad?:{mapping:string;axes:readonly number[];buttons:readonly {pressed:boolean;value:number}[]}|null};
export const emptyXR=()=>({connected:false,wands:false,throttle:0,steer:0,crouch:false,hop:false,hopHeld:false,trick:false,nextTrick:false,recover:false,pause:false,recenter:false,snap:0});
/** xr-standard uses axes 2/3 for sticks and 0/1 for touched trackpads. */
export class XRControllerInput {
 private previous=new Map<string,boolean[]>();private snapHeld=false;
 reset(){this.previous.clear();this.snapHeld=false;}
 sample(sources:readonly XRPadSource[],speed:number){
  const out=emptyXR(),seen=new Set<string>();let rightX=0,rightPresent=false;
  for(const source of sources){const p=source.gamepad;if(!p||p.mapping!=='xr-standard')continue;
   const hand=source.handedness;if(hand!=='left'&&hand!=='right')continue;seen.add(hand);out.connected=true;
   const old=this.previous.get(hand)??[],pressed=(i:number)=>p.buttons[i]?.pressed===true,edge=(i:number)=>pressed(i)&&!old[i];
   const wand=p.buttons.length<6;out.wands ||= wand;
   const x=deadAxis(wand?p.axes[0]:p.axes[2]),y=deadAxis(wand?p.axes[1]:p.axes[3]);
   out.crouch ||= pressed(1);
   if(hand==='left'){
    out.steer=x;out.throttle=pressed(0)?brakeAxis(speed):-y;out.recover=edge(4)||(wand&&edge(2)&&y<-.25);out.pause=edge(5)||(wand&&edge(2)&&y>=-.25);
   }else{
    rightPresent=true;rightX=x;out.hopHeld=pressed(0);out.hop=!pressed(0)&&!!old[0];out.trick=edge(4)||(wand&&edge(2)&&y>=-.25);out.nextTrick=edge(5)||(wand&&edge(2)&&y<-.25);out.recenter=edge(3);
   }
   this.previous.set(hand,p.buttons.map(b=>b.pressed));
  }
  for(const hand of this.previous.keys())if(!seen.has(hand))this.previous.delete(hand);
  if(Math.abs(rightX)<.3||!rightPresent)this.snapHeld=false;
  if(Math.abs(rightX)>.7&&!this.snapHeld){out.snap=Math.sign(rightX)*Math.PI/6;this.snapHeld=true;}
  return out;
 }
}
/** Comfort speed limiter brakes either travel direction without reversing at rest. */
export function vrThrottle(throttle:number,speed:number,comfort:boolean){
 if(!comfort)return throttle;
 if(Math.abs(speed)>6)return brakeAxis(speed)*Math.min(.6,(Math.abs(speed)-6)*.6);
 return throttle;
}
export function vrHeading(previous:number,p:RidePose,trick:boolean,crashed:boolean,dt:number){
 if(trick||crashed||p.airBlend>.1)return previous;
 const delta=Math.atan2(Math.sin(p.headingY-previous),Math.cos(p.headingY-previous)),step=Math.max(0,Math.min(dt,.06))*1.8;
 return previous+Math.max(-step,Math.min(step,delta));
}
export function vrOrigin(p:RidePose,heading:number,viewYaw:number,headYaw:number,center:{x:number;z:number},comfort:boolean){
 const yaw=heading+Math.PI+viewYaw-headYaw,c=Math.cos(yaw),s=Math.sin(yaw);
 return {x:p.x-(center.x*c+center.z*s),y:p.y-(comfort?p.airHeight:0),z:p.z-(-center.x*s+center.z*c),yaw};
}
