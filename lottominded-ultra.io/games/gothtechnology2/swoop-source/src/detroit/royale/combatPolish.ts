import {Vector3} from 'three';
import type {Scope} from '../../../../ride-core/src/royale/scopes.ts';
import {scopeZoom} from '../../../../ride-core/src/royale/scopes.ts';
import type {ScopeSensitivity} from './scopeSensitivity.ts';

export type CombatPreferences={firstFov:number;thirdFov:number;firstLook:number;thirdLook:number;shoulder:number;controlStyle:'burntwax'|'classic'};
export function readCombatPreferences(raw:unknown):CombatPreferences{
 const p=(raw&&typeof raw==='object'?raw:{}) as Partial<CombatPreferences>;
 const number=(key:'firstFov'|'thirdFov'|'firstLook'|'thirdLook',fallback:number,min:number,max:number)=>typeof p[key]==='number'&&Number.isFinite(p[key])?Math.max(min,Math.min(max,p[key]!)):fallback;
 return {firstFov:number('firstFov',76,55,90),thirdFov:number('thirdFov',68,55,90),firstLook:number('firstLook',1,.2,2),thirdLook:number('thirdLook',1,.2,2),shoulder:p.shoulder===-1?-1:1,controlStyle:p.controlStyle==='classic'?'classic':'burntwax'};
}
/** Each channel is independent: equipping an optic cannot slow unscoped turns. */
export function combatLookGain(base:number,general:number,adsGain:number,mode:number,first:boolean,scope:Scope|null,values:ScopeSensitivity,p:CombatPreferences,firing=false){
 return base*general*(mode===2?adsGain*values[scope??'iron'][firing?'ads':'look']/scopeZoom(scope):values.iron.look*(first||mode===1?p.firstLook:p.thirdLook));
}
/** Right shoulder is screen-right (-X when facing +Z). */
export function combatChaseEye(anchor:Vector3,yaw:number,scale:number,shoulder:number,aiming:boolean){
 const back=(aiming?1.65:3.1)*scale,side=-(aiming?.48:.62)*scale*shoulder;
 return anchor.clone().add(new Vector3(-Math.sin(yaw)*back+Math.cos(yaw)*side,.22*scale,-Math.cos(yaw)*back-Math.sin(yaw)*side));
}
/** Combat cameras retract along their boom; never orbit across the aim axis. */
export function retractCombatCamera(eye:Vector3,anchor:Vector3,cast:(o:Vector3,d:Vector3,max:number)=>number|null,floor:number){
 const delta=eye.clone().sub(anchor),length=delta.length();
 if(length>.001){delta.multiplyScalar(1/length);let hit=cast(anchor,delta,length+.12);
  // The camera has width: a centre ray alone misses a sign edge or thin post
  // passing through the near plane. Keep every correction on the aim boom.
  const right=new Vector3(delta.z,0,-delta.x).normalize();
  for(const offset of [-.14,.14]){const edge=cast(anchor.clone().addScaledVector(right,offset),delta,length+.12);if(edge!==null&&(hit===null||edge<hit))hit=edge;}
  if(hit!==null&&hit<length+.12)eye.copy(anchor).addScaledVector(delta,Math.max(.02,hit-.16));}
 eye.y=Math.max(floor+.18,eye.y);return eye;
}

export class CombatPreferencesControls {
 value=readCombatPreferences(null);private key='royale-combat-camera-v1';
 constructor(){try{this.value=readCombatPreferences(JSON.parse(localStorage.getItem(this.key)??'null'));}catch{}}
 mount(parent:HTMLElement){
  const field=document.createElement('fieldset'),legend=document.createElement('legend');legend.textContent='Combat camera';field.append(legend);
  const save=()=>{try{localStorage.setItem(this.key,JSON.stringify(this.value));}catch{}};
  const styleLabel=document.createElement('label'),style=document.createElement('select');styleLabel.textContent='On-foot combat controls';style.setAttribute('aria-label','On-foot combat controls');style.add(new Option('BurntWax-style · sprint / aim priority','burntwax'));style.add(new Option('Classic · aim always cancels sprint','classic'));style.value=this.value.controlStyle;style.onchange=()=>{this.value.controlStyle=style.value==='classic'?'classic':'burntwax';save();};styleLabel.append(style);field.append(styleLabel);
  const guide=document.createElement('p');guide.textContent='BurntWax-style: sprint lowers sights; aim or fire stops sprinting. Reload lowers sights until ready. Your saved keys, touch layout and ADS preset still apply.';field.append(guide);
  for(const [key,title,min,max,step]of [['firstFov','First-person field of view',55,90,1],['thirdFov','Third-person field of view',55,90,1],['firstLook','First-person look speed',.2,2,.05],['thirdLook','Third-person look speed',.2,2,.05]] as const){
   const row=document.createElement('label'),input=document.createElement('input'),out=document.createElement('output');row.textContent=title;input.type='range';input.min=String(min);input.max=String(max);input.step=String(step);input.value=String(this.value[key]);input.setAttribute('aria-label',title);
   const refresh=()=>out.value=key.endsWith('Fov')?Math.round(this.value[key])+'°':Math.round(this.value[key]*100)+'%';input.oninput=()=>{this.value[key]=Number(input.value);refresh();save();};refresh();row.append(input,out);field.append(row);
  }
  const row=document.createElement('label'),side=document.createElement('select');row.textContent='Third-person aim shoulder';side.add(new Option('Right shoulder','1'));side.add(new Option('Left shoulder','-1'));side.value=String(this.value.shoulder);side.onchange=()=>{this.value.shoulder=Number(side.value);save();};row.append(side);field.append(row);parent.append(field);
 }
}
