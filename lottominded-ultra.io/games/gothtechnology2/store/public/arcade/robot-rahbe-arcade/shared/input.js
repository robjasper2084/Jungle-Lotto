export const DEFAULT_BINDINGS={ArrowLeft:'left',KeyA:'left',ArrowRight:'right',KeyD:'right',ArrowUp:'up',KeyW:'up',ArrowDown:'down',KeyS:'down',Space:'jump',KeyK:'jump',KeyJ:'shoot',KeyX:'shoot',KeyE:'interact',KeyF:'interact'};
export const RUNNER_BINDINGS={Space:'jump',KeyW:'jump',ArrowUp:'jump',KeyS:'down',ArrowDown:'down',KeyJ:'shoot',KeyX:'shoot',KeyK:'dash',ShiftLeft:'overdrive',ShiftRight:'overdrive',KeyE:'interact'};
export class Input{
 constructor({pause=()=>{},map=()=>{},start=()=>{},active=()=>true,bindings=DEFAULT_BINDINGS,pad={jump:[0],shoot:[2,7],interact:[3,1]},selector='[data-action]',attribute='action',disconnectPause=true,menu=()=>false}){
  Object.assign(this,{onPause:pause,onStart:start,active,bindings,pad,menu,disconnectPause});this.held=new Set();this.touch=new Map();this.previous={};this.edges={};this.wasPad=false;this.padPause=false;this.enabled=true;this.listeners=[];
  this.on(window,'keydown',e=>{if(e.target.closest('dialog')||e.target.tagName==='BUTTON'&&['Enter','Space'].includes(e.code))return;if(['Escape','KeyP'].includes(e.code)){e.preventDefault();if(!e.repeat)pause();return;}if(e.code==='KeyM'){if(!e.repeat)map();return;}if(e.code==='Enter'&&!e.repeat){start();return;}const action=bindings[e.code];if(action&&active()){e.preventDefault();if(!this.held.has(e.code))this.edges[action+'Pressed']=true;this.held.add(e.code);}});
  this.on(window,'keyup',e=>{if(this.held.has(e.code))this.edges[bindings[e.code]+'Released']=true;this.held.delete(e.code);});
  this.on(window,'blur',()=>{this.clear();if(active())pause(true);});this.on(document,'visibilitychange',()=>{if(document.hidden){this.clear();if(active())pause(true);}});
  for(const b of document.querySelectorAll(selector)){this.on(b,'pointerdown',e=>{e.preventDefault();b.setPointerCapture(e.pointerId);const action=b.dataset[attribute];this.touch.set(e.pointerId,action);this.edges[action+'Pressed']=true;b.classList.add('held');});const release=e=>{const action=this.touch.get(e.pointerId);if(action)this.edges[action+'Released']=true;this.touch.delete(e.pointerId);b.classList.remove('held');};for(const event of ['pointerup','pointercancel','lostpointercapture'])this.on(b,event,release);}
 }
 on(target,type,fn){target.addEventListener(type,fn);this.listeners.push(()=>target.removeEventListener(type,fn));}
 clear(){this.held.clear();this.touch.clear();this.previous={};this.edges={};document.querySelectorAll('.held').forEach(b=>b.classList.remove('held'));}
 read(){const a={};let pad;try{pad=Array.from(navigator.getGamepads?.()||[]).find(x=>x?.connected);}catch{}const pressed=i=>!!pad?.buttons[i]?.pressed;
  if(!this.enabled){const pause=pressed(9);if(pause&&!this.padPause)this.onPause();this.padPause=pause;return a;}
  for(const key of this.held)a[this.bindings[key]]=true;for(const action of this.touch.values())a[action]=true;
  if(pad){a.left||=pad.axes[0]<-.22||pressed(14);a.right||=pad.axes[0]>.22||pressed(15);a.up||=pad.axes[1]<-.3||pressed(12);a.down||=pad.axes[1]>.3||pressed(13);for(const [action,ids]of Object.entries(this.pad))a[action]||=ids.some(pressed);if(pressed(9)&&!this.padPause)this.onPause();this.padPause=pressed(9);}
  else if(this.wasPad){if(this.disconnectPause)this.onPause(true);this.clear();this.padPause=false;}this.wasPad=!!pad;
  for(const action of new Set([...Object.values(this.bindings),...Object.keys(this.pad)])){a[action+'Pressed']=!!this.edges[action+'Pressed']||!!a[action]&&!this.previous[action];a[action+'Released']=!!this.edges[action+'Released']||!a[action]&&!!this.previous[action];}
  if(this.menu()&&a.jumpPressed)this.onStart();this.previous={...a};this.edges={};return a;
 }
 destroy(){this.clear();this.enabled=false;this.listeners.forEach(fn=>fn());this.listeners=[];}
}
