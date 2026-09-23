import {deadAxis,brakeAxis} from './gamepadInput.ts';
import type {RidePose} from './controller.ts';
export type XRPadSource={handedness:string;gamepad?:{mapping:string;axes:readonly number[];buttons:readonly {pressed:boolean;value:number}[]}|null};
export const emptyXR=()=>({connected:false,wands:false,braking:false,throttle:0,steer:0,crouch:false,hop:false,hopHeld:false,trick:false,nextTrick:false,recover:false,pause:false,recenter:false,toggleHud:false,sit:false,snap:0});
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
    out.braking=pressed(0);
    out.toggleHud ||= !wand&&edge(3);
    out.steer=x;out.throttle=pressed(0)?brakeAxis(speed):-y;out.recover=edge(4)||(wand&&edge(2)&&y<-.25);out.pause=edge(5)||(wand&&edge(2)&&y>=-.25);
   }else{
    const hudClick=wand&&edge(2)&&Math.abs(x)<.25&&Math.abs(y)<.25;
    const recenterClick=hudClick&&sources.some(s=>s.handedness==='left'&&s.gamepad?.buttons[1]?.pressed);
    const leftGrip=sources.some(s=>s.handedness==='left'&&s.gamepad?.buttons[1]?.pressed);
    out.sit=!wand&&edge(4)&&leftGrip;
    out.toggleHud ||= hudClick&&!recenterClick;
    rightPresent=true;rightX=x;out.hopHeld=pressed(0);out.hop=!pressed(0)&&!!old[0];out.trick=(!out.sit&&edge(4))||(wand&&edge(2)&&!hudClick&&y>=-.25);out.nextTrick=edge(5)||(wand&&edge(2)&&y<-.25);out.recenter=edge(3)||recenterClick;
   }
   this.previous.set(hand,p.buttons.map(b=>b.pressed));
  }
  for(const hand of this.previous.keys())if(!seen.has(hand))this.previous.delete(hand);
  if(Math.abs(rightX)<.3||!rightPresent)this.snapHeld=false;
  if(Math.abs(rightX)>.7&&!this.snapHeld){out.snap=Math.sign(rightX)*Math.PI/6;this.snapHeld=true;}
  if(out.recenter||out.sit)out.crouch=false;
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
/** Turn toward the headset's horizontal gaze; looking up/down never adds throttle. */
export function vrGazeSteer(lookHeading:number,riderHeading:number,speed:number){
 if(![lookHeading,riderHeading,speed].every(Number.isFinite)||Math.abs(speed)<.1)return 0;
 const delta=Math.atan2(Math.sin(lookHeading-riderHeading),Math.cos(lookHeading-riderHeading));
 const dead=6*Math.PI/180,range=39*Math.PI/180;
 if(Math.abs(delta)<=dead)return 0;
 // Reserve the most aggressive carve input for deliberate controller steering.
 return -Math.sign(delta)*Math.min(.8,(Math.abs(delta)-dead)/range)*(speed<0?-1:1);
}

/** Positional headset lean in metres, not head pitch. Upright actively slows the wheel. */
export class VRLeanDrive {
 private reverseArmed=false;private neutralTime=0;
 reset(){this.reverseArmed=false;this.neutralTime=0;}
 sample(forwardMetres:number,speed:number,dt:number){
  if(![forwardMetres,speed,dt].every(Number.isFinite)){this.reset();return 0;}
  const amount=Math.max(0,Math.min(1,(Math.abs(forwardMetres)-.04)/.16));
  if(amount===0){this.reset();return Math.abs(speed)<.05?0:brakeAxis(speed)*Math.min(1,Math.abs(speed)*.8);}
  if(forwardMetres>0){this.reset();return amount;}
  if(speed>.08){this.reset();return -amount;}
  // Release the brake latch at rest before permitting deliberate reverse travel.
  if(!this.reverseArmed&&speed>=-.08){this.neutralTime+=Math.max(0,Math.min(dt,.06));if(this.neutralTime<.12)return 0;this.reverseArmed=true;}
  return -amount;
 }
}
