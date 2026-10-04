export const CONTROL_IDS=['stick','specialMove','brake','crouch','hop','recover'] as const;
export type ControlId=typeof CONTROL_IDS[number];
export type ControlPosition={x:number;y:number;scale:number;opacity?:number};
export type ControlLayout=Partial<Record<ControlId,ControlPosition>>;
export const LAYOUT_KEY='swoop-control-positions-v1';
export function readLayout(raw:string|null):ControlLayout{
 const out:ControlLayout={};try{const data=JSON.parse(raw??'{}');for(const id of CONTROL_IDS){const p=data?.[id];if(p&&[p.x,p.y,p.scale].every(Number.isFinite))out[id]={x:Math.max(0,Math.min(1,p.x)),y:Math.max(0,Math.min(1,p.y)),scale:Math.max(.75,Math.min(1.6,p.scale)),...(Number.isFinite(p.opacity)?{opacity:Math.max(.35,Math.min(1,p.opacity))}:{})};}}catch{}return out;
}
export function controlRect(p:ControlPosition,w:number,h:number,vw:number,vh:number){
 const width=Math.min(Math.max(48,w*p.scale),Math.max(48,vw-24)),height=Math.min(Math.max(48,h*p.scale),Math.max(48,vh-24));
 return {width,height,left:Math.max(12,Math.min(vw-width-12,p.x*vw-width/2)),top:Math.max(12,Math.min(vh-height-12,p.y*vh-height/2))};
}
export function defaultTouchPosition(id:ControlId,w:number,h:number):ControlPosition{
 const short=h<540,point=(right:number,bottom:number)=>({x:(w-right)/w,y:(h-bottom)/h,scale:1,opacity:.8});
 if(id==='stick')return {x:Math.max(68,w*.16)/w,y:(h-(short?110:145))/h,scale:w<360?.8:w<400?.9:1,opacity:.75};
 return id==='hop'?point(65,short?168:195):id==='crouch'?point(65,short?88:110):id==='brake'?point(150,short?88:110):id==='specialMove'?point(153,short?168:195):point(short?235:65,short?168:280);
}
export function installTouchLayout(beforeEdit:()=>void){
 const orientation=()=>innerWidth>=innerHeight?'landscape':'portrait';
 let currentOrientation=orientation();
 const readSaved=()=>{try{return readLayout(localStorage.getItem(LAYOUT_KEY+'-'+currentOrientation)??localStorage.getItem(LAYOUT_KEY));}catch{return {};}};
 let saved:ControlLayout=readSaved();
 const elements=Object.fromEntries(CONTROL_IDS.map(id=>[id,document.getElementById(id)!])) as Record<ControlId,HTMLElement>;
 const base=(id:ControlId)=>id==='stick'?{w:136,h:136}:id==='hop'?{w:80,h:80}:{w:64,h:64};
 function place(el:HTMLElement,id:ControlId,p:ControlPosition){const b=base(id),r=controlRect(p,b.w,b.h,innerWidth,innerHeight);Object.assign(el.style,{position:'fixed',left:r.left+'px',top:r.top+'px',right:'auto',bottom:'auto',width:r.width+'px',height:r.height+'px',minHeight:'48px',margin:'0',opacity:el.classList.contains('layoutControl')?'1':String(p.opacity??.8)});}
 function apply(){for(const id of CONTROL_IDS)place(elements[id],id,saved[id]??defaultTouchPosition(id,innerWidth,innerHeight));}
 apply();window.addEventListener('resize',()=>{if(orientation()!==currentOrientation){currentOrientation=orientation();saved=readSaved();}apply();});document.addEventListener('swoop-restore-stick',apply);
 const launch=document.createElement('button');launch.textContent='Customize touch controls';launch.id='editTouchLayout';document.getElementById('helpPanel')!.append(launch);
 launch.onclick=()=>{
  beforeEdit();const previousFocus=document.activeElement as HTMLElement|null;
  const overlay=document.createElement('section');overlay.id='touchLayoutEditor';overlay.setAttribute('role','dialog');overlay.setAttribute('aria-modal','true');overlay.setAttribute('aria-label','Customize touch controls');
  overlay.innerHTML='<div class="layoutToolbar"><details open><summary>Customize buttons · collapse to move</summary><div><span>Drag a control. Select it to resize. Arrow keys also move it. Portrait and landscape save separately.</span><label>Size <input aria-label="Selected control size" type="range" min="75" max="160" value="100"></label><label>Opacity <input aria-label="Selected control opacity" type="range" min="35" max="100" value="80"></label><button data-mirror>Swap sides</button></div></details><button data-save>Save layout</button><button data-cancel>Cancel</button><button data-reset>Reset positions</button><p role="status"></p></div>';
  document.body.append(overlay);let draft:ControlLayout=JSON.parse(JSON.stringify(saved)),selected:ControlId='stick';const proxies=new Map<ControlId,HTMLButtonElement>();const slider=overlay.querySelector<HTMLInputElement>('[aria-label="Selected control size"]')!,opacity=overlay.querySelector<HTMLInputElement>('[aria-label="Selected control opacity"]')!;
  function initial(id:ControlId){return defaultTouchPosition(id,innerWidth,innerHeight);}
  function draw(){for(const id of CONTROL_IDS){const p=draft[id]??=initial(id);place(proxies.get(id)!,id,p);proxies.get(id)!.setAttribute('aria-pressed',String(id===selected));}slider.value=String(Math.round(draft[selected]!.scale*100));opacity.value=String(Math.round((draft[selected]!.opacity??.8)*100));}
  for(const id of CONTROL_IDS){const button=document.createElement('button');button.className='layoutControl';button.textContent=id==='stick'?'Joystick':elements[id].textContent;button.setAttribute('aria-label','Position '+button.textContent);overlay.append(button);proxies.set(id,button);let drag:{id:number;x:number;y:number;px:number;py:number}|undefined;
   button.onpointerdown=e=>{e.preventDefault();selected=id;button.focus();const p=draft[id]!;drag={id:e.pointerId,x:e.clientX,y:e.clientY,px:p.x,py:p.y};button.setPointerCapture(e.pointerId);draw();};
   button.onpointermove=e=>{if(!drag||drag.id!==e.pointerId)return;const p=draft[id]!;p.x=Math.max(0,Math.min(1,drag.px+(e.clientX-drag.x)/innerWidth));p.y=Math.max(0,Math.min(1,drag.py+(e.clientY-drag.y)/innerHeight));draw();};
   button.onpointerup=button.onpointercancel=button.onlostpointercapture=()=>{drag=undefined;};
   button.onfocus=()=>{selected=id;draw();};button.onkeydown=e=>{const delta=e.shiftKey?.04:.01,p=draft[id]!;if(e.key.startsWith('Arrow')){e.preventDefault();if(e.key==='ArrowLeft')p.x-=delta;if(e.key==='ArrowRight')p.x+=delta;if(e.key==='ArrowUp')p.y-=delta;if(e.key==='ArrowDown')p.y+=delta;p.x=Math.max(0,Math.min(1,p.x));p.y=Math.max(0,Math.min(1,p.y));draw();}};
  }
  opacity.oninput=()=>{draft[selected]!.opacity=Number(opacity.value)/100;};
  overlay.querySelector<HTMLButtonElement>('[data-mirror]')!.onclick=()=>{for(const id of CONTROL_IDS)draft[id]!.x=1-draft[id]!.x;draw();};
  draw();slider.oninput=()=>{draft[selected]!.scale=Number(slider.value)/100;draw();};
  const close=()=>{window.removeEventListener('resize',draw);overlay.remove();previousFocus?.focus();};
  overlay.querySelector<HTMLButtonElement>('[data-save]')!.onclick=()=>{saved=readLayout(JSON.stringify(draft));apply();try{localStorage.setItem(LAYOUT_KEY+'-'+currentOrientation,JSON.stringify(saved));close();}catch{overlay.querySelector('[role=status]')!.textContent='Applied for this session. Storage unavailable; Cancel closes the editor.';}};
  overlay.querySelector<HTMLButtonElement>('[data-cancel]')!.onclick=close;
  overlay.querySelector<HTMLButtonElement>('[data-reset]')!.onclick=()=>{draft={};draw();};
  overlay.addEventListener('keydown',e=>{e.stopPropagation();if(e.key==='Escape'){e.preventDefault();close();}if(e.key==='Tab'){const list=[...overlay.querySelectorAll<HTMLElement>('button,input')],first=list[0],last=list[list.length-1];if(e.shiftKey&&document.activeElement===first){e.preventDefault();last.focus();}else if(!e.shiftKey&&document.activeElement===last){e.preventDefault();first.focus();}}});
  window.addEventListener('resize',draw);overlay.querySelector<HTMLButtonElement>('[data-save]')!.focus();
 };
 return launch;
}
