import {PointerTrack,HeldControls,stickAxes} from './mobileInput.ts';
import './mobileHud.css';

type Hooks={blocked:()=>boolean;movementBlocked:()=>boolean;clear:()=>void;move:(steer:number,throttle:number)=>void;look:(x:number,y:number)=>void;hop:()=>void};
const get=<E extends HTMLElement=HTMLElement>(id:string)=>document.getElementById(id) as E;
const read=(key:string)=>{try{return localStorage.getItem(key);}catch{return null;}};
const save=(key:string,value:string)=>{try{localStorage.setItem(key,value);}catch{}};
const number=(key:string,fallback:number,min:number,max:number)=>{const saved=read(key),n=saved===null?fallback:Number(saved);return Number.isFinite(n)?Math.max(min,Math.min(max,n)):fallback;};

export function createMobileHud(h:Hooks){
 const zone=get('touch-zone'),stick=get('stick'),canvas=get<HTMLCanvasElement>('game');
 const movement=new PointerTrack(),look=new PointerTrack(),held=new HeldControls();
 const stickMode=get<HTMLSelectElement>('joystick-mode');stickMode.value=read('belle-joystick-mode')==='fixed'?'fixed':'floating';document.body.dataset.joystickMode=stickMode.value;zone.setAttribute('aria-label',stickMode.value==='floating'?'Floating movement area':'Fixed movement joystick');
 const captured=new Map<number,HTMLElement>();let originX=0,originY=0,running=false;
 const capture=(element:HTMLElement,id:number)=>{element.setPointerCapture(id);captured.set(id,element);};
 const releaseCapture=(id:number)=>{const owner=captured.get(id);captured.delete(id);if(owner?.hasPointerCapture(id))owner.releasePointerCapture(id);};
 function resetStick(){stick.style.removeProperty('left');stick.style.removeProperty('top');stick.style.removeProperty('bottom');stick.firstElementChild!.removeAttribute('style');stick.classList.remove('is-active');h.move(0,0);}
 function syncHeld(){for(const action of ['hop','brake'])get(action).classList.toggle('is-held',held.has(action));}
 function clear(){movement.clear();look.clear();held.clear();running=false;get('sprint').setAttribute('aria-pressed','false');resetStick();syncHeld();for(const id of [...captured.keys()])releaseCapture(id);}
 zone.onpointerdown=e=>{
  if(e.button!==0||h.blocked()||h.movementBlocked()||!movement.begin(e.pointerId,e.clientX,e.clientY))return;
  e.preventDefault();const rect=zone.getBoundingClientRect(),r=stick.getBoundingClientRect(),floating=stickMode.value==='floating';originX=floating?e.clientX:r.left+r.width/2;originY=floating?e.clientY:r.top+r.height/2;capture(zone,e.pointerId);
  if(floating){stick.style.left=(originX-rect.left-r.width/2)+'px';stick.style.top=(originY-rect.top-r.height/2)+'px';stick.style.bottom='auto';}stick.classList.add('is-active');const axes=stickAxes(e.clientX-originX,e.clientY-originY,r.width*.37);h.move(axes.steer,axes.throttle);
 };
 zone.onpointermove=e=>{
  if(movement.id!==e.pointerId)return;
  if(h.blocked()||h.movementBlocked()){clear();return;}
  const radius=stick.getBoundingClientRect().width*.37,axes=stickAxes(e.clientX-originX,e.clientY-originY,radius);
  h.move(axes.steer,axes.throttle);
  (stick.firstElementChild as HTMLElement).style.transform='translate('+axes.steer*radius*.68+'px,'+(-axes.throttle*radius*.68)+'px)';
 };
 const endMove=(e:PointerEvent)=>{if(!movement.end(e.pointerId))return;resetStick();releaseCapture(e.pointerId);};
 zone.onpointerup=endMove;zone.onpointercancel=endMove;zone.onlostpointercapture=endMove;
 canvas.onpointerdown=e=>{if(e.button!==0||h.blocked()||!look.begin(e.pointerId,e.clientX,e.clientY))return;e.preventDefault();capture(canvas,e.pointerId);};
 canvas.onpointermove=e=>{if(h.blocked()){if(look.id!==null)clear();return;}const delta=look.delta(e.pointerId,e.clientX,e.clientY);if(delta){h.look(delta.x*sensitivity,delta.y*sensitivity);document.body.classList.add('has-looked');}};
 const endLook=(e:PointerEvent)=>{if(look.end(e.pointerId))releaseCapture(e.pointerId);};
 canvas.onpointerup=endLook;canvas.onpointercancel=endLook;canvas.onlostpointercapture=endLook;
 for(const action of ['hop','brake']){
  const button=get<HTMLButtonElement>(action);
  button.onpointerdown=e=>{if(e.button!==0||button.disabled||h.blocked()||h.movementBlocked()||!held.press(e.pointerId,action))return;e.preventDefault();capture(button,e.pointerId);syncHeld();if(action==='hop')h.hop();};
  const end=(e:PointerEvent)=>{held.release(e.pointerId);releaseCapture(e.pointerId);syncHeld();};
  button.onpointerup=end;button.onpointercancel=end;button.onlostpointercapture=end;
  button.onclick=e=>{if(e.detail===0&&!h.blocked()&&!h.movementBlocked()&&action==='hop')h.hop();};
  button.onkeydown=e=>{if((e.code==='Space'||e.code==='Enter')&&!h.blocked()&&!h.movementBlocked()){e.preventDefault();held.press(-1,action);syncHeld();if(action==='hop'&&!e.repeat)h.hop();}};
  button.onkeyup=e=>{if(e.code==='Space'||e.code==='Enter'){held.release(-1);syncHeld();}};
  button.onblur=()=>{held.release(-1);syncHeld();};
 }
 get('sprint').onclick=()=>{if(h.blocked()||h.movementBlocked())return;running=!running;get('sprint').setAttribute('aria-pressed',String(running));};
 for(const surface of [canvas,zone,get('ridehud')])surface.addEventListener('contextmenu',e=>{if(!h.blocked())e.preventDefault();});
 const touch=get<HTMLInputElement>('touch'),auto=()=>matchMedia('(pointer:coarse), (max-width: 900px)').matches;
 touch.checked=read('belle-touch-controls')===null?auto():read('belle-touch-controls')==='true';
 const syncTouch=()=>{document.body.classList.toggle('touch-controls',touch.checked);zone.hidden=document.body.classList.contains('at-start')||document.body.classList.contains('on-hoverbike')||!touch.checked;clear();};
 touch.onchange=()=>{save('belle-touch-controls',String(touch.checked));syncTouch();};syncTouch();
 window.addEventListener('resize',()=>{if(read('belle-touch-controls')===null)touch.checked=auto();syncTouch();});
 let sensitivity=number('belle-look-sensitivity',1,.4,1.8);
 function slider(id:string,key:string,fallback:number,min:number,max:number,apply:(v:number)=>void){
  const input=get<HTMLInputElement>(id),out=get<HTMLOutputElement>(id+'-value');input.value=String(number(key,fallback,min,max));
  const update=()=>{const v=Number(input.value);out.value=Math.round(v*100)+'%';apply(v);};
  input.oninput=()=>{update();save(key,input.value);clear();};update();return ()=>{input.value=String(fallback);input.oninput!(new Event('input'));};
 }
 const resets=[slider('control-opacity','belle-control-opacity',.45,.2,.85,v=>document.body.style.setProperty('--control-alpha',String(v))),slider('control-size','belle-control-size',1,.85,1.2,v=>document.body.style.setProperty('--control-scale',String(v))),slider('look-sensitivity','belle-look-sensitivity',1,.4,1.8,v=>sensitivity=v)];
 const spacing=get<HTMLSelectElement>('control-layout');spacing.value=read('belle-control-layout')==='wide'?'wide':'standard';
 const applySpacing=()=>document.body.dataset.controlLayout=spacing.value;
 spacing.onchange=()=>{save('belle-control-layout',spacing.value);applySpacing();clear();};applySpacing();
 stickMode.onchange=()=>{save('belle-joystick-mode',stickMode.value);document.body.dataset.joystickMode=stickMode.value;h.clear();};
 get('reset-mobile').onclick=()=>{stickMode.value='floating';stickMode.onchange!(new Event('change'));resets.forEach(reset=>reset());spacing.value='standard';spacing.onchange!(new Event('change'));touch.checked=auto();try{localStorage.removeItem('belle-touch-controls');}catch{}syncTouch();};
 const menu=get<HTMLDialogElement>('ride-menu'),toggle=get('tools-toggle');
 const closeMenu=()=>{if(!menu.open)return;h.clear();menu.close();toggle.setAttribute('aria-expanded','false');if(!document.querySelector('dialog[open]'))canvas.focus();};
 toggle.onclick=()=>{h.clear();menu.showModal();toggle.setAttribute('aria-expanded','true');};
 menu.querySelector<HTMLButtonElement>('[data-close="ride-menu"]')!.onclick=closeMenu;
 menu.addEventListener('cancel',e=>{e.preventDefault();closeMenu();});
 // Close events can arrive after a tool has already started a new input session.
 menu.addEventListener('close',()=>{toggle.setAttribute('aria-expanded',String(menu.open));});
 menu.querySelector('nav')!.addEventListener('click',e=>{if((e.target as HTMLElement).closest('button'))closeMenu();},true);
 menu.addEventListener('click',e=>{if(e.target===menu){const r=menu.getBoundingClientRect();if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)closeMenu();}});
 get('photo-open').onclick=()=>document.querySelector<HTMLButtonElement>('#camera-capture>button')?.click();
 // Native dialogs and room panels must never leave a held steering/brake input behind.
 const observer=new MutationObserver(records=>{if(records.some(r=>r.type==='attributes'&&(r.target as HTMLDialogElement).open))h.clear();});
 for(const dialog of document.querySelectorAll('dialog'))observer.observe(dialog,{attributes:true,attributeFilter:['open']});
 return {clear,held, get running(){return running;},mode(onFoot:boolean){
  get('mount-label').textContent=onFoot?'Ride':'Dismount';get('mount').setAttribute('aria-label',onFoot?'Get on wheel (F)':'Get off wheel (F)');
  get('sprint').hidden=!onFoot||!touch.checked;get('brake-label').textContent=onFoot?'Stop':'Brake';get('ride-mode').textContent=onFoot?'ON FOOT':'EUC';
 },collectTools(){const companion=get('companion-tray');if(companion)menu.querySelector('nav')!.append(companion);}};
}
