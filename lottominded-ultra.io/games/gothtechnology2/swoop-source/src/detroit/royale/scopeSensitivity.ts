import type {Scope} from '../../../../ride-core/src/royale/scopes.ts';
export const OPTICS=['iron','scope2','scope4','scope8'] as const;
export const CHANNELS=['look','ads','gyro'] as const;
type Optic=typeof OPTICS[number];type Channel=typeof CHANNELS[number];
export type ScopeSensitivity=Record<Optic,Record<Channel,number>>;
export function readScopeSensitivity(raw:unknown):ScopeSensitivity{
 const input=raw as Partial<ScopeSensitivity>|null;
 return Object.fromEntries(OPTICS.map(optic=>[optic,Object.fromEntries(CHANNELS.map(channel=>{
  const value=input?.[optic]?.[channel];return[channel,typeof value==='number'&&Number.isFinite(value)?Math.max(.1,Math.min(2,value)):1];
 }))])) as ScopeSensitivity;
}
export class ScopeSensitivityControls {
 value=readScopeSensitivity(null);private key='royale-scope-sensitivity-v1';
 constructor(){try{this.value=readScopeSensitivity(JSON.parse(localStorage.getItem(this.key)??'null'));}catch{}}
 gain(scope:Scope|null,channel:Channel){return this.value[scope??'iron'][channel];}
 mount(parent:HTMLElement){
  const root=document.createElement('fieldset'),legend=document.createElement('legend');legend.textContent='Per-scope sensitivity';root.append(legend);
  const choose=document.createElement('select'),label=document.createElement('label');label.textContent='Optic ';label.append(choose);root.append(label);
  for(const [value,text]of [['iron','Iron sights / hip fire'],['scope2','2× scope'],['scope4','4× scope'],['scope8','8× scope']])choose.add(new Option(text,value));
  const controls:HTMLInputElement[]=[],outputs:HTMLOutputElement[]=[];
  const refresh=()=>controls.forEach((input,i)=>{input.value=String(this.value[choose.value as Optic][CHANNELS[i]]);outputs[i].value=Math.round(Number(input.value)*100)+'%';});
  const save=()=>{try{localStorage.setItem(this.key,JSON.stringify(this.value));}catch{}};
  for(const [i,channel]of CHANNELS.entries()){
   const row=document.createElement('label'),input=document.createElement('input'),out=document.createElement('output');
   row.textContent=['Camera look ','Aiming down sights ','Gyroscope '][i];input.type='range';input.min='.1';input.max='2';input.step='.05';input.setAttribute('aria-label','Scope '+['camera','ADS','gyro'][i]+' sensitivity');
   input.oninput=()=>{this.value[choose.value as Optic][channel]=Number(input.value);out.value=Math.round(Number(input.value)*100)+'%';save();};
   controls.push(input);outputs.push(out);row.append(input,out);root.append(row);
  }
  const reset=document.createElement('button');reset.type='button';reset.textContent='Reset this optic';reset.onclick=()=>{this.value[choose.value as Optic]={look:1,ads:1,gyro:1};save();refresh();};
  const note=document.createElement('p');note.textContent='Adjust each optic separately. These values multiply your general sensitivity; scope zoom still adds precision.';root.append(note,reset);choose.onchange=refresh;refresh();parent.append(root);
 }
}
