/** Quest Touch / xr-standard controls. Every interruption requires neutral input
 * before re-arming, so a held trigger cannot activate a menu or restart a ride. */
export type VRSource={handedness:string;gamepad?:{mapping:string;axes:readonly number[];buttons:readonly {pressed:boolean;value:number}[]}|null};
export const neutralVR=()=>({ready:false,throttle:0,steer:0,brake:false,mount:false,hop:false,hopHeld:false,recover:false,menu:false,select:false,step:0,page:0,snap:0,recenter:false});
const axis=(n=0)=>Number.isFinite(n)&&Math.abs(n)>.18?Math.sign(n)*Math.min(1,(Math.abs(n)-.18)/.82):0;
export class BelleVRInput {
 private armed=false;
 private previous=new Map<string,boolean[]>();
 private heldTurn=false;private heldStep=false;private heldPage=false;
 reset(){this.armed=false;this.previous.clear();this.heldTurn=this.heldStep=this.heldPage=false;}
 sample(sources:readonly VRSource[],menuOpen=false){
  const out=neutralVR(),pads=sources.filter(s=>s.gamepad?.mapping==='xr-standard'&&['left','right'].includes(s.handedness));
  const left=pads.find(s=>s.handedness==='left')?.gamepad,right=pads.find(s=>s.handedness==='right')?.gamepad;
  if(!left||!right){this.reset();return out;}
  if(!this.armed){
   if(pads.some(s=>s.gamepad!.buttons.some(b=>b.pressed||b.value>.2)||s.gamepad!.axes.some(a=>Math.abs(a)>.18)))return out;
   this.armed=true;
  }
  out.ready=true;
  const pressed=(p:NonNullable<VRSource['gamepad']>,i:number)=>!!p.buttons[i]?.pressed;
  const edge=(hand:string,p:NonNullable<VRSource['gamepad']>,i:number)=>pressed(p,i)&&!this.previous.get(hand)?.[i];
  const lx=axis(left.axes[2]),ly=axis(left.axes[3]),rx=axis(right.axes[2]);
  out.menu=edge('left',left,5);out.recenter=edge('right',right,3);
  if(menuOpen){
   out.select=edge('right',right,0)||edge('right',right,4);
   if(Math.abs(ly)<.25)this.heldStep=false;
   if(Math.abs(ly)>.6&&!this.heldStep){out.step=Math.sign(ly);this.heldStep=true;}
   if(Math.abs(rx)<.25)this.heldPage=false;
   if(Math.abs(rx)>.6&&!this.heldPage){out.page=Math.sign(rx);this.heldPage=true;}
  }else{
   out.throttle=-ly;out.steer=lx;out.brake=pressed(left,0);
   out.mount=edge('right',right,4);out.hop=edge('right',right,5);out.hopHeld=pressed(right,5);out.recover=edge('left',left,4);
   if(Math.abs(rx)<.25)this.heldTurn=false;
   if(Math.abs(rx)>.6&&!this.heldTurn){out.snap=Math.sign(rx)*Math.PI/6;this.heldTurn=true;}
  }
  for(const s of pads)this.previous.set(s.handedness,s.gamepad!.buttons.map(b=>b.pressed));
  return out;
 }
}

/** Braking must oppose the wheel's current motion, including reverse. */
export function comfortThrottle(demand:number,speed:number,brake:boolean,comfort:boolean){
 if(brake)return Math.abs(speed)<.08?0:-Math.sign(speed);
 if(comfort&&Math.abs(speed)>6)return -Math.sign(speed)*Math.min(.6,(Math.abs(speed)-6)*.6);
 return demand;
}
