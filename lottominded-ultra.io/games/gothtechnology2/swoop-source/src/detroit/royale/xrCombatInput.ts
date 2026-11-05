type Pad={handedness:string;gamepad?:{axes:readonly number[];buttons:readonly {pressed:boolean;value:number}[]}|null};
const axis=(p:Pad['gamepad'],i:number)=>{const n=p?.axes[(p.axes.length>=4?2:0)+i]??0;return Math.abs(n)<.18?0:Math.sign(n)*Math.min(1,(Math.abs(n)-.18)/.82);};
export class XRCombatInput {
 private ready=false;private down=new Set<string>();
 reset(){this.ready=false;this.down.clear();}
 sample(sources:readonly Pad[]){
  const left=sources.find(s=>s.handedness==='left')?.gamepad,right=sources.find(s=>s.handedness==='right')?.gamepad;
  const held=(p:Pad['gamepad'],i:number)=>!!p?.buttons[i]?.pressed;
  const now=new Set<string>();
  for(const [key,pressed]of [['fire',held(right,0)],['ads',held(left,0)],['reload',held(right,4)&&!held(left,1)],['heal',held(right,4)&&held(left,1)],['mount',held(right,5)&&!held(left,1)],['holster',held(right,5)&&held(left,1)],['switch',held(right,3)],['recover',held(left,4)],['pause',held(left,5)],['crouch',held(right,1)],['brake',held(left,1)],['snapLeft',axis(right,0)<-.7],['snapRight',axis(right,0)>.7],['hop',axis(right,1)<-.7]] as const)if(pressed)now.add(key);
  const throttle=-axis(left,1),steer=axis(left,0),active=this.ready&&!!left&&!!right;
  if(!this.ready&&!now.size&&!throttle&&!steer&&left&&right)this.ready=true;
  const edge=(key:string)=>active&&now.has(key)&&!this.down.has(key);
  const packet={throttle:active?throttle:0,steer:active?steer:0,fire:active&&now.has('fire'),ads:active&&now.has('ads'),brake:active&&now.has('brake'),crouch:active&&now.has('crouch'),reload:edge('reload'),mount:edge('mount'),heal:edge('heal'),holster:edge('holster'),switch:edge('switch'),recover:edge('recover'),pause:edge('pause'),hop:edge('hop'),snap:edge('snapLeft')?Math.PI/6:edge('snapRight')?-Math.PI/6:0};
  this.down=now;if(!left||!right)this.ready=false;return packet;
 }
}
