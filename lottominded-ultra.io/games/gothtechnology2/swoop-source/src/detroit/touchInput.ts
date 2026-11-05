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
type TouchAction='brake'|'crouch'|'jump'|'trick'|'recover';
const defaults:Record<string,TouchAction>={specialMove:'trick',brake:'brake',crouch:'crouch',hop:'jump',recover:'recover'};
const names:Record<TouchAction,string>={brake:'Brake',crouch:'Crouch',jump:'Hold / hop',trick:'Trick',recover:'Recover'};
export function bindTouchControls(input:TouchRideInput,enabled:()=>boolean,onTap:(action:'trick'|'recover')=>void=()=>{}){
 let floating=true;const bindings={...defaults};
 try{const saved=JSON.parse(localStorage.getItem('swoop-touch-layout')??'null');if(saved){floating=saved.floatVersion===2?saved.floating!==false:true;for(const id of Object.keys(defaults))if(Object.hasOwn(names,saved.bindings?.[id]))bindings[id]=saved.bindings[id];}}catch{}
 const save=()=>{try{localStorage.setItem('swoop-touch-layout',JSON.stringify({floating,bindings,floatVersion:2}));}catch{}};
 const captures=new Map<number,HTMLElement>();
 const actions=new Map<number,TouchAction>();
 const stick=document.getElementById('stick')!,thumb=document.getElementById('stickThumb')!;
 const update=()=>{const radius=stick.clientWidth*.32;thumb.style.transform=`translate(calc(-50% + ${input.steer*radius}px),calc(-50% + ${-input.throttle*radius}px))`;};
 let origin:{x:number;y:number}|undefined;
 function move(e:PointerEvent){const r=stick.getBoundingClientRect(),center=origin??{x:r.left+r.width/2,y:r.top+r.height/2};input.moveStick(e.pointerId,(e.clientX-center.x)/(r.width*.32),(center.y-e.clientY)/(r.height*.32));update();}
 function floatAt(e:PointerEvent){origin={x:e.clientX,y:e.clientY};const radius=stick.clientWidth/2;Object.assign(stick.style,{position:'fixed',left:(e.clientX-radius)+'px',top:(e.clientY-radius)+'px',right:'auto',bottom:'auto'});}
 function begin(e:PointerEvent){if(!enabled()||!input.startStick(e.pointerId))return; e.preventDefault();if(e.pointerType==='touch')document.dispatchEvent(new Event('swoop-touch-start'));if(floating&&e.pointerType==='touch')floatAt(e);stick.setPointerCapture(e.pointerId);captures.set(e.pointerId,stick);stick.classList.add('held');move(e);}
 stick.onpointerdown=begin;stick.onpointermove=move;
 const restoreStick=()=>{origin=undefined;stick.style.position='';stick.style.left='';stick.style.top='';document.dispatchEvent(new Event('swoop-restore-stick'));};
 const end=(e:PointerEvent)=>{if(captures.get(e.pointerId)!==stick)return;input.endStick(e.pointerId);captures.delete(e.pointerId);update();stick.classList.remove('held');restoreStick();};stick.onpointerup=stick.onpointercancel=stick.onlostpointercapture=end;
 document.addEventListener('pointerdown',e=>{
  const home=stick.getBoundingClientRect(),rightHanded=home.left+home.width/2>innerWidth/2;
  const target=e.target instanceof Element?e.target:null;
  if(e.pointerType!=='touch'||!floating||!enabled()||(rightHanded?e.clientX<innerWidth*.5:e.clientX>innerWidth*.5)||e.clientY<64||target?.closest('button,a,input,select,textarea,summary,dialog,[role=dialog],.nearby-tools,#helpPanel,#menu,#mapPanel'))return;
  begin(e);if(captures.get(e.pointerId)===stick)e.stopImmediatePropagation();
 },{capture:true});
 const render=()=>{for(const id of Object.keys(bindings)){const button=document.getElementById(id)!;button.dataset.touchAction=bindings[id];button.textContent=names[bindings[id]];button.setAttribute('aria-label',names[bindings[id]]);}};
 for(const id of Object.keys(bindings)){const button=document.getElementById(id)!;
  button.onpointerdown=e=>{const action=bindings[id];if(action==='trick'||action==='recover')return;if(!enabled()||!input.press(action,e.pointerId))return;e.preventDefault();actions.set(e.pointerId,action);button.setPointerCapture(e.pointerId);captures.set(e.pointerId,button);button.classList.add('held');button.setAttribute('aria-pressed','true');};
  const release=(e:PointerEvent)=>{const action=actions.get(e.pointerId);if(!action)return;if(action==='brake'||action==='crouch'||action==='jump')input.release(action,e.pointerId,e.type!=='pointerup');actions.delete(e.pointerId);captures.delete(e.pointerId);button.classList.remove('held');button.setAttribute('aria-pressed','false');};button.onpointerup=button.onpointercancel=button.onlostpointercapture=release;
  button.addEventListener('click',e=>{e.stopImmediatePropagation();const action=bindings[id];if(action==='trick'||action==='recover')onTap(action);},{capture:true});
 }
 const reset=()=>{input.reset();for(const[id,el]of captures)if(el.hasPointerCapture(id))el.releasePointerCapture(id);captures.clear();actions.clear();restoreStick();update();for(const element of document.querySelectorAll('.held')){element.classList.remove('held');element.setAttribute('aria-pressed','false');}};
 const settings=document.createElement('fieldset');settings.className='touchSettings';const legend=document.createElement('legend');legend.textContent='Touch control layout';settings.append(legend);
 const modeLabel=document.createElement('label');modeLabel.textContent='Joystick';const mode=document.createElement('select');mode.setAttribute('aria-label','Touch joystick mode');for(const [value,text] of [['float','Floating · touch left side'],['fixed','Fixed position']])mode.add(new Option(text,value));mode.value=floating?'float':'fixed';mode.onchange=()=>{reset();floating=mode.value==='float';save();};modeLabel.append(mode);settings.append(modeLabel);
 Object.keys(bindings).forEach((id,index)=>{const label=document.createElement('label');label.textContent=index===0?'Wide button':'Button '+index;const select=document.createElement('select');select.setAttribute('aria-label','Assign '+label.textContent.toLowerCase());for(const action of Object.keys(names) as TouchAction[])select.add(new Option(names[action],action));select.value=bindings[id];select.onchange=()=>{reset();bindings[id]=select.value as TouchAction;render();save();};select.dataset.slot=id;label.append(select);settings.append(label);});
 const restore=document.createElement('button');restore.textContent='Reset touch layout';restore.onclick=()=>{reset();Object.assign(bindings,defaults);floating=true;mode.value='float';settings.querySelectorAll<HTMLSelectElement>('[data-slot]').forEach(s=>s.value=bindings[s.dataset.slot!]);render();save();};settings.append(restore);document.getElementById('helpPanel')!.append(settings);render();
 return reset;
}
