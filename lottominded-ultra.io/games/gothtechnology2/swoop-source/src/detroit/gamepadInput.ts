export type PadLike={id:string;index:number;connected:boolean;mapping:string;axes:readonly number[];buttons:readonly {pressed:boolean;value:number}[]};
export const deadAxis=(v=0,dead=.14)=>Number.isFinite(v)&&Math.abs(v)>dead?Math.sign(v)*Math.min(1,(Math.abs(v)-dead)/(1-dead)):0;
const amount=(v=0)=>Number.isFinite(v)?Math.max(0,Math.min(1,v)):0;
export const brakeAxis=(speed:number)=>Math.abs(speed)<.08?0:speed>0?-1:1;
export function emptyPad(){return {connected:false,id:'',throttle:0,steer:0,lookX:0,lookY:0,crouch:false,hop:false,hopHeld:false,trick:false,nextTrick:false,previousTrick:false,recover:false,sit:false,camera:false,pause:false,start:false};}
/** Standard browser mapping covers Xbox and browser-mapped PlayStation pads. */
export class GamepadRideInput {
 private last:boolean[]=[];private identity='';
 reset(){this.last=[];this.identity='';}
 sample(pads:readonly (PadLike|null)[],speed:number){
  const p=pads.find(p=>p?.connected&&p.mapping==='standard');if(!p){this.reset();return emptyPad();}
  const id=p.index+':'+p.id;if(id!==this.identity){this.last=[];this.identity=id;}
  const pressed=(i:number)=>p.buttons[i]?.pressed===true,edge=(i:number)=>pressed(i)&&!this.last[i];
  const brake=amount(p.buttons[6]?.value),drive=amount(p.buttons[7]?.value),stick=-deadAxis(p.axes[1]);
  const out={connected:true,id:p.id,throttle:brake>.05?brakeAxis(speed)*brake:Math.max(-1,Math.min(1,stick+drive)),steer:deadAxis(p.axes[0]),lookX:deadAxis(p.axes[2]),lookY:deadAxis(p.axes[3]),crouch:pressed(4)||pressed(0),hop:!pressed(0)&&!!this.last[0],hopHeld:pressed(0),trick:edge(1),nextTrick:edge(5)||edge(15),previousTrick:edge(14),recover:edge(2),sit:edge(13),camera:edge(3),pause:edge(9),start:edge(9)};
  this.last=p.buttons.map(b=>b.pressed);return out;
 }
}
