type Layout={x:number;y:number;size:number;opacity:number};
type Saved=Partial<Record<'portrait'|'landscape',Layout>>;
const clamp=(v:number,min:number,max:number)=>Math.max(min,Math.min(max,v));
/** Shares the same touch/keyboard editor in both games; no extra render loop. */
export class MapLayout{
 readonly editor=document.createElement('dialog');
 private saved:Saved={};private backup:Saved={};private draft:Layout|null=null;
 private size=document.createElement('input');private opacity=document.createElement('input');
 private orientation=document.createElement('span');private status=document.createElement('p');
 private returnFocus:HTMLElement|null=null;private key:string;private editingOrientation=this.orient();
 private map:HTMLElement;private pause:()=>void;
 constructor(map:HTMLElement,title:string,pause:()=>void){
  this.map=map;this.pause=pause;
  this.key='tactical-map-layout-v1-'+title.toLowerCase().replaceAll(' ','-');
  try{const parsed=JSON.parse(localStorage.getItem(this.key)||'{}');for(const o of ['portrait','landscape'] as const){const p=parsed[o];if(p&&['x','y','size','opacity'].every(k=>typeof p[k]==='number'&&Number.isFinite(p[k])))this.saved[o]={x:clamp(p.x,0,1),y:clamp(p.y,0,1),size:clamp(p.size,80,240),opacity:clamp(p.opacity,.35,1)};}}catch{}
  this.editor.className='tactical-map-layout';this.editor.setAttribute('aria-label','Customize mini-map');
  const panel=document.createElement('section');panel.className='map-layout-panel';
  const heading=document.createElement('h2');heading.textContent='Customize mini-map';
  const help=document.createElement('p');help.textContent='Drag the map anywhere. Arrow keys move it; Shift moves faster. Portrait and landscape save separately.';
  const fields=document.createElement('div');fields.className='map-layout-fields';
  for(const [name,input,min,max,step]of [['Size',this.size,80,240,4],['Opacity',this.opacity,35,100,5]] as const){const label=document.createElement('label');label.append(name+' ',input);input.type='range';input.min=String(min);input.max=String(max);input.step=String(step);input.setAttribute('aria-label','Mini-map '+name.toLowerCase());fields.append(label);}
  this.size.oninput=()=>{if(this.draft){this.draft.size=Number(this.size.value);this.apply();}};
  this.opacity.oninput=()=>{if(this.draft){this.draft.opacity=Number(this.opacity.value)/100;this.apply();}};
  const actions=document.createElement('div');actions.className='map-layout-actions';
  for(const [name,action]of [['Move panel',()=>panel.classList.toggle('at-top')],['Reset',()=>{this.draft={x:1,y:.08,size:innerWidth<600?124:162,opacity:1};this.sync();}],['Cancel',()=>this.finish(false)],['Save layout',()=>this.finish(true)]] as const){const b=document.createElement('button');b.type='button';b.textContent=name;b.onclick=action;actions.append(b);}
  this.status.setAttribute('role','status');panel.append(heading,this.orientation,help,fields,actions,this.status);this.editor.append(panel);document.body.append(this.editor);
  this.editor.addEventListener('cancel',e=>{e.preventDefault();this.finish(false);});this.editor.addEventListener('keydown',e=>e.stopPropagation());
  let drag:{id:number;x:number;y:number;left:number;top:number}|null=null;
  map.addEventListener('pointerdown',e=>{if(!this.active)return;e.preventDefault();e.stopPropagation();const r=map.getBoundingClientRect();drag={id:e.pointerId,x:e.clientX,y:e.clientY,left:r.left,top:r.top};map.setPointerCapture(e.pointerId);map.focus();});
  map.addEventListener('pointermove',e=>{if(!drag||e.pointerId!==drag.id||!this.draft)return;e.preventDefault();this.move(drag.left+e.clientX-drag.x,drag.top+e.clientY-drag.y);});
  const end=()=>{drag=null;};map.addEventListener('pointerup',end);map.addEventListener('pointercancel',end);map.addEventListener('lostpointercapture',end);
  map.addEventListener('click',e=>{if(this.active){e.preventDefault();e.stopImmediatePropagation();}},true);
  map.addEventListener('keydown',e=>{if(!this.active||!e.key.startsWith('Arrow'))return;e.preventDefault();const r=map.getBoundingClientRect(),d=e.shiftKey?10:2;this.move(r.left+(e.key==='ArrowRight'?d:e.key==='ArrowLeft'?-d:0),r.top+(e.key==='ArrowDown'?d:e.key==='ArrowUp'?-d:0));});
  addEventListener('resize',()=>{if(this.active&&this.editingOrientation!==this.orient()){if(this.draft)this.saved[this.editingOrientation]={...this.draft};this.editingOrientation=this.orient();this.draft={...(this.saved[this.editingOrientation]??{x:1,y:.08,size:innerWidth<600?124:162,opacity:1})};this.sync();}else this.apply();});
  this.apply();
 }
 get active(){return this.editor.open;}
 refresh(){this.apply();}
 private orient(){return innerHeight>innerWidth?'portrait' as const:'landscape' as const;}
 private bounds(){return {x:Math.max(0,innerWidth-this.map.offsetWidth-24),y:Math.max(0,innerHeight-this.map.offsetHeight-24)};}
 private move(left:number,top:number){if(!this.draft)return;const b=this.bounds();this.draft.x=clamp((left-12)/(b.x||1),0,1);this.draft.y=clamp((top-12)/(b.y||1),0,1);this.apply();}
 private apply(){const v=this.active?this.draft:this.saved[this.orient()];if(!v){for(const key of ['left','top','right','bottom','width','opacity'])this.map.style.removeProperty(key);return;}this.map.style.width=Math.min(v.size,innerWidth-24)+'px';this.map.style.opacity=String(v.opacity);const b=this.bounds();Object.assign(this.map.style,{left:12+b.x*v.x+'px',top:12+b.y*v.y+'px',right:'auto',bottom:'auto'});}
 private sync(){if(!this.draft)return;this.size.value=String(this.draft.size);this.opacity.value=String(Math.round(this.draft.opacity*100));this.orientation.textContent=this.editingOrientation+' layout';this.apply();}
 edit(){
  if(this.active)return;this.pause();this.returnFocus=document.activeElement as HTMLElement|null;this.backup=structuredClone(this.saved);this.editingOrientation=this.orient();
  const r=this.map.getBoundingClientRect(),b=this.bounds();this.draft={...(this.saved[this.editingOrientation]??{x:clamp((r.left-12)/(b.x||1),0,1),y:clamp((r.top-12)/(b.y||1),0,1),size:r.width||162,opacity:1})};
  this.editor.append(this.map);this.map.classList.add('map-being-edited');this.map.hidden=false;this.map.tabIndex=0;this.map.setAttribute('aria-label','Move mini-map');this.editor.showModal();this.status.textContent='';this.sync();this.map.focus();
 }
 private finish(save:boolean){
  if(save&&this.draft){this.saved[this.editingOrientation]={...this.draft};try{localStorage.setItem(this.key,JSON.stringify(this.saved));}catch{this.status.textContent='Storage is unavailable. Your layout will last for this session.';}}
  else this.saved=this.backup;
  this.editor.close();document.body.append(this.map);this.map.classList.remove('map-being-edited');this.map.tabIndex=-1;this.map.setAttribute('aria-label',this.map.dataset.mapTitle+' mini-map controls');this.draft=null;this.apply();this.returnFocus?.focus();
 }
}
