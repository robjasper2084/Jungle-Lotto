import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import type {SkySettings} from './skyModel.ts';
import {ART_STYLE_IDS,ART_DIRECTIONS,DEFAULT_ART_STYLE,normalizeArtStyle,artStyleSkyPreset} from './artDirection.ts';
test('four selectable looks and safe default for corrupt local storage',()=>{
 assert.deepEqual(ART_STYLE_IDS,['authentic','golden','noir','detroit2084']);
 for(const id of ART_STYLE_IDS)assert.equal(normalizeArtStyle(id),id);
 for(const x of [null,undefined,'',{},false,'unknown','__proto__'])assert.equal(normalizeArtStyle(x),DEFAULT_ART_STYLE);
});
test('bounded environmental grade and unchanged graphic settings',()=>{
 for(const id of ART_STYLE_IDS){
  const look=ART_DIRECTIONS[id],v=artStyleSkyPreset(id);
  assert(Number.isFinite(v.hour)&&v.hour>=0&&v.hour<24);
  assert.equal(v.cycle,false);
  assert(['changing','clear','wispy','scattered','layered','overcast'].includes(v.clouds));
  assert.deepEqual(Object.keys(v).sort(),['clouds','cycle','hour']);
  for(const key of ['mix','fogMix','reflectionMix'] as const)assert(look[key]>=0&&look[key]<=.6);
  for(const key of ['ambientScale','sunScale','hazeScale','environmentScale'] as const)assert(look[key]>=.85&&look[key]<=1.15);
  for(const color of Object.values(look.palette))assert.match(color,/^#[0-9a-f]{6}$/i);
 }
 assert.equal(ART_DIRECTIONS.authentic.mix,0);assert.equal(ART_DIRECTIONS.authentic.hazeScale,1);
});
test('settings HTML includes accessible four-style control',()=>{
 const html=readFileSync(new URL('../../index.html',import.meta.url),'utf8');
 assert.match(html,/<select id="art-style"/);
 for(const id of ART_STYLE_IDS)assert(html.includes('<option value="'+id+'">'));
 assert.match(html,/Visual atmosphere/);
});

test('actual style control selects local palette and preserves host sky when disabled',async()=>{
 const {connectSkySettings}=await import('./skySettings.ts');
 const names=['sky-hour','sky-clock','sky-cycle','sky-speed','sky-clouds','sky-preset','art-style'];
 const controls=Object.fromEntries(names.map(id=>[id,{id,value:'',checked:false,disabled:false,onchange:null as null|(()=>void),oninput:null as null|(()=>void)}])) as Record<string,any>;
 const options:{value:string;textContent:string}[]=[];
 Object.assign(controls['sky-preset'],{querySelector:()=>options.find(x=>x.value==='17.55')??null,append:(x:{value:string;textContent:string})=>options.push(x)});
 let state:SkySettings={hour:12,cycle:true,dayMinutes:60,clouds:'overcast'};
 let style:'authentic'|'golden'|'noir'|'detroit2084'='authentic',changes=0;
 const fake={
  get settings(){return {...state};},get hour(){return state.hour;},
  get artStyle(){return style;},
  configure(next:Partial<typeof state>){state={...state,...next};changes++;},
  setArtStyle(next:typeof style,applyTime=true){style=next;if(applyTime){const preset=artStyleSkyPreset(next);state={...state,...preset};}}
 };
 const prev=Object.getOwnPropertyDescriptor(globalThis,'document');
 const body={dataset:{} as Record<string,string>};
 Object.defineProperty(globalThis,'document',{configurable:true,value:{body,activeElement:null,getElementById:(id:string)=>controls[id],createElement:()=>({value:'',textContent:''})}});
 try{
  connectSkySettings(fake);
  assert.equal(changes,0);assert.equal(body.dataset.artStyle,'authentic');
  controls['art-style'].value='golden';controls['art-style'].onchange();
  assert.equal(body.dataset.artStyle,'golden');assert.equal(state.hour,17.55);assert.equal(state.clouds,'wispy');assert.equal(state.cycle,false);
  controls['sky-cycle'].disabled=true;
  controls['art-style'].value='noir';controls['art-style'].onchange();
  assert.equal(body.dataset.artStyle,'noir');assert.equal(state.hour,17.55);assert.equal(state.clouds,'wispy');
 }finally{if(prev)Object.defineProperty(globalThis,'document',prev);else delete(globalThis as any).document;}
});
