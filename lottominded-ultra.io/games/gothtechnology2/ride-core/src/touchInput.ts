// Pointer ownership keeps two-thumb input independent, including cancellations.
export class TouchRideInput {
 throttle=0;steer=0;private stickId:number|undefined;
 private held=new Map<'brake'|'crouch'|'jump',number>();private jumpQueued=false;
 get crouch(){return this.held.has('crouch')||this.held.has('jump')||this.jumpQueued;}
 get hopHeld(){return this.held.has('jump');}
 get braking(){return this.held.has('brake');}
 brakeThrottle(speed:number){return Math.abs(speed)<.08?0:speed>0?-1:1;}
 startStick(id:number){if(this.stickId!==undefined)return false;this.stickId=id;return true;}
 moveStick(id:number,x:number,y:number){if(id!==this.stickId)return;const length=Math.hypot(x,y),scale=Math.max(1,length);const dead=(n:number)=>Math.abs(n)<.08?0:Math.sign(n)*(Math.abs(n)-.08)/.92;this.steer=dead(x/scale);this.throttle=dead(y/scale);}
 endStick(id:number){if(id!==this.stickId)return;this.stickId=undefined;this.steer=this.throttle=0;}
 press(action:'brake'|'crouch'|'jump',id:number){if(this.held.has(action))return false;this.held.set(action,id);return true;}
 release(action:'brake'|'crouch'|'jump',id:number,cancelled=false){if(this.held.get(action)!==id)return;this.held.delete(action);if(action==='jump'&&!cancelled)this.jumpQueued=true;}
 consumeHop(){const hop=this.jumpQueued;this.jumpQueued=false;return hop;}
 reset(){this.stickId=undefined;this.held.clear();this.jumpQueued=false;this.throttle=this.steer=0;}
}
export function bindTouchControls(input:TouchRideInput,enabled:()=>boolean){
 const stick=document.getElementById('stick')!,thumb=document.getElementById('stickThumb')!;
 const update=()=>{const radius=stick.clientWidth*.32;thumb.style.transform=`translate(calc(-50% + ${input.steer*radius}px),calc(-50% + ${-input.throttle*radius}px))`;};
 function move(e:PointerEvent){const r=stick.getBoundingClientRect();input.moveStick(e.pointerId,(e.clientX-r.left-r.width/2)/(r.width*.32),(r.top+r.height/2-e.clientY)/(r.height*.32));update();}
 stick.onpointerdown=e=>{if(!enabled()||!input.startStick(e.pointerId))return;e.preventDefault();stick.setPointerCapture(e.pointerId);stick.classList.add('held');move(e);};stick.onpointermove=move;
 const end=(e:PointerEvent)=>{input.endStick(e.pointerId);update();if(!input.steer&&!input.throttle)stick.classList.remove('held');};stick.onpointerup=stick.onpointercancel=stick.onlostpointercapture=end;
 for(const [id,action]of [['brake','brake'],['crouch','crouch'],['hop','jump']] as const){const button=document.getElementById(id)!;
  button.onpointerdown=e=>{if(!enabled()||!input.press(action,e.pointerId))return;e.preventDefault();button.setPointerCapture(e.pointerId);button.classList.add('held');button.setAttribute('aria-pressed','true');};
  const release=(e:PointerEvent)=>{input.release(action,e.pointerId,e.type!=='pointerup');button.classList.remove('held');button.setAttribute('aria-pressed','false');};button.onpointerup=button.onpointercancel=button.onlostpointercapture=release;
 }
 return ()=>{input.reset();update();for(const element of document.querySelectorAll('.held')){element.classList.remove('held');element.setAttribute('aria-pressed','false');}};
}
