import type {Product} from '../commerce/types';
import {readDiscountPreview, DISCOUNT_PREVIEW_KEY} from '../public/arcade/rewards.js';
const KEY='gothtechnology.armory.local-wall.v1';
type Entry={id:string;at:number;handle:string;message:string};
type Wall={enabled:boolean;handle:string;entries:Entry[]};
let memory:Wall={enabled:false,handle:'',entries:[]};
let volatile=false;
const handleOK=(value:unknown):value is string=>typeof value==='string'&&/^(?:[A-Za-z0-9_-]{2,20})?$/.test(value);
function read():Wall{
 if(volatile)return memory;
 try{const raw=JSON.parse(localStorage.getItem(KEY)??'null');if(!raw)return {enabled:false,handle:'',entries:[]};
 return {enabled:raw.enabled===true,handle:handleOK(raw.handle)?raw.handle:'',entries:Array.isArray(raw.entries)?raw.entries.filter((e:Entry)=>e&&typeof e.id==='string'&&e.id.length<180&&Number.isFinite(e.at)&&e.at>0&&e.at<=Date.now()+1000&&handleOK(e.handle)&&typeof e.message==='string'&&e.message.length<=160).slice(0,8):[]};
 }catch{return memory;}
}
function write(state:Wall){memory=state;try{localStorage.setItem(KEY,JSON.stringify(state));volatile=false;}catch{volatile=true;}document.dispatchEvent(new Event('store:wall-change'));}
export function recordTransmission(message:string,id:string){
 const state=read();if(!state.enabled||state.entries.some(e=>e.id===id))return;
 write({...state,entries:[{id,at:Date.now(),handle:state.handle,message:message.slice(0,160)},...state.entries].slice(0,8)});
}
export function initTransmissions(products:Product[]){
 let points=readDiscountPreview().totalPoints;
 const updatePoints=()=>{const next=readDiscountPreview().totalPoints;const milestone=Math.floor(next/10000)*10000;if(milestone>0&&milestone>points)recordTransmission(`REACHED ${milestone.toLocaleString('en-US')} GAME POINTS · LOCAL PREVIEW`,'points:'+milestone);points=next;};
 document.addEventListener('store:discount-preview',updatePoints);
 document.addEventListener('store:game-progress',event=>{const e=(event as CustomEvent).detail;if(e&&['won','victory'].includes(e.mode)&&typeof e.game==='string'&&typeof e.runId==='string')recordTransmission(`COMPLETED ${e.game.replace(/-/g,' ').toUpperCase()}`,'complete:'+e.game+':'+e.runId);});
 document.querySelectorAll<HTMLVideoElement>('[data-inline-film] video').forEach(video=>video.addEventListener('ended',()=>recordTransmission('FINISHED '+(video.getAttribute('aria-label')??'CAMPAIGN FILM').toUpperCase(),'film:'+video.id)));
 const product=products.find(p=>location.pathname.endsWith('/products/'+p.handle+'/'));
 if(product)recordTransmission('SIGNAL EXPLORED: '+product.title.toUpperCase(),'signal:'+product.handle);
 const root=document.querySelector<HTMLElement>('[data-transmission-wall]');
 const render=()=>{if(!root)return;const state=read(),list=root.querySelector('[data-wall-events]')!;list.replaceChildren();
 for(const entry of state.entries){const row=document.createElement('li'),time=document.createElement('time'),copy=document.createElement('div'),handle=document.createElement('strong');time.dateTime=new Date(entry.at).toISOString();time.textContent=new Date(entry.at).toLocaleTimeString([],{hour:'2-digit',minute:'2-digit',hour12:false});time.title=new Date(entry.at).toLocaleString();handle.textContent=(entry.handle||'YOU')+' // ';copy.append(handle,document.createTextNode(entry.message));row.append(time,copy);list.append(row);}
 root.querySelector<HTMLElement>('[data-wall-empty]')!.hidden=state.entries.length>0;
 root.querySelector('[data-wall-state]')!.textContent=state.enabled?(volatile?'THIS PAGE ONLY':'RECORDING LOCALLY'):'STANDBY';};
 document.addEventListener('store:wall-change',render);
 window.addEventListener('storage',event=>{if(event.key===KEY||event.key===null)render();if(event.key===DISCOUNT_PREVIEW_KEY||event.key===null)updatePoints();});
 if(!root)return;const form=root.querySelector<HTMLFormElement>('form')!,enabled=form.elements.namedItem('enabled') as HTMLInputElement,handle=form.elements.namedItem('handle') as HTMLInputElement,status=root.querySelector('[data-wall-status]')!;
 enabled.checked=read().enabled;handle.value=read().handle;
 form.addEventListener('submit',event=>{event.preventDefault();if(!form.reportValidity())return;const state=read();write({...state,enabled:enabled.checked,handle:handle.value});points=readDiscountPreview().totalPoints;status.textContent=enabled.checked?'Local wall enabled. New activity will appear here.':'Local recording stopped.';});
 root.querySelector('[data-wall-clear]')!.addEventListener('click',()=>{write({...read(),entries:[]});status.textContent='Your local activity was cleared.';});render();
}
