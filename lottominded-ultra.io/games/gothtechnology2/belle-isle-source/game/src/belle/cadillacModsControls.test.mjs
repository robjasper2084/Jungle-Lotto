import test from 'node:test';
import assert from 'node:assert/strict';
import {fileURLToPath,pathToFileURL} from 'node:url';
import path from 'node:path';
import {build} from 'esbuild';

const game=fileURLToPath(new URL('../../',import.meta.url)),outfile=path.join(game,'.test/cadillac-mods-controls-runtime.mjs');
await build({absWorkingDir:game,stdin:{contents:"export * from './src/belle/cadillacModsControls.ts'; export * from './src/belle/cadillacModsPreferences.ts'; export {normalizeCadillacWheelSelection} from './src/belle/cadillacWheels.ts';",resolveDir:game,loader:'ts'},outfile,bundle:true,platform:'node',format:'esm',external:['three'],loader:{'.css':'empty'},logLevel:'error'});
const {CadillacModsControls,readCadillacModsPreferences,writeCadillacModsPreferences,CADILLAC_MODS_STORAGE_KEY,normalizeCadillacWheelSelection}=await import(pathToFileURL(outfile).href);

// Event ownership and state rollback are tested without pretending that a DOM
// stub proves browser layout, hit testing, actual WebGL rendering, or device FPS.
class Element{
 constructor(tag,doc){this.tagName=tag;this.ownerDocument=doc;this.children=[];this.attributes={};this.listeners={};this.hidden=false;this.open=false;this.disabled=false;this.textContent='';this.value='';this.id='';}
 append(...children){for(const child of children){child.remove?.();child.parentElement=this;this.children.push(child);}}
 after(child){if(!this.parentElement)return;const p=this.parentElement;child.remove();child.parentElement=p;p.children.splice(p.children.indexOf(this)+1,0,child);}
 remove(){if(this.parentElement){const p=this.parentElement;p.children.splice(p.children.indexOf(this),1);this.parentElement=null;}}
 setAttribute(key,value){this.attributes[key]=value;}
 getAttribute(key){return this.attributes[key]??null;}
 addEventListener(type,listener){(this.listeners[type]??=[]).push(listener);}
 dispatch(type){const event=new Event(type);for(const listener of this.listeners[type]??[])listener(event);if(type==='click')this.onclick?.(event);}
 click(){if(!this.disabled)this.dispatch('click');}
 focus(){this.ownerDocument.activeElement=this;}
 scrollIntoView(){this.scrolled=true;}
 showModal(){this.open=true;}
 close(){this.open=false;}
 querySelector(selector){return walk(this).find(node=>selector.startsWith('#')?node.id===selector.slice(1):node.tagName===selector)??null;}
}
function walk(root){return root.children.flatMap(child=>[child,...walk(child)]);}
function fixture(overrides={},withSettingsHeading=false){
 const doc={activeElement:null,createElement:tag=>new Element(tag,doc)};
 globalThis.document=doc;
 const saved=[];globalThis.localStorage={getItem:()=>null,setItem:(key,value)=>saved.push({key,value})};
 const settings=doc.createElement('dialog'),menu=doc.createElement('dialog'),canvas=doc.createElement('canvas'),access=doc.createElement('section');access.id='cadillac-controls';menu.append(access);
 if(withSettingsHeading){const heading=doc.createElement('h2'),other=doc.createElement('fieldset');heading.textContent='Ride your way.';other.id='other-settings';settings.append(heading,other);}
 const state={riding:true,parked:true,reduced:false,busy:false,minHeight:0,maxHeight:.24,targets:{FL:0,FR:0,RL:0,RR:0},wheels:{rim:'stock',tire:'standard',center:'gold'},...overrides};
 const calls=[];let rejection;
 const hooks={state:()=>state,request:(action)=>{
  calls.push({action,settingsOpen:settings.open});
  if(rejection)return{accepted:false,message:rejection};
  if(action.kind==='corner')state.targets={...state.targets,[action.corner]:action.metres};
  if(action.kind==='wheels')state.wheels=normalizeCadillacWheelSelection(action.selection);
  if(action.kind==='hop')state.busy=true;
  if(action.kind==='settle'){const height=Object.values(state.targets).reduce((sum,value)=>sum+value,0)/4;state.busy=true;state.targets={FL:height,FR:height,RL:height,RR:height};}
  return{accepted:true};
 }};
 const ui=new CadillacModsControls(settings,menu,canvas,hooks);
 const nodes=()=>[...walk(settings),...walk(menu)];
 return{ui,state,calls,settings,menu,canvas,doc,saved,reject:message=>{rejection=message;},id:id=>nodes().find(node=>node.id===id),button:label=>nodes().find(node=>node.tagName==='button'&&node.textContent===label),range:corner=>nodes().find(node=>node.id==='cadillac-height-'+corner),select:key=>nodes().find(node=>node.id==='cadillac-mod-'+key)};
}

test('one settings editor and a visible sibling launcher work when access controls are hidden',()=>{
 const f=fixture();f.id('cadillac-controls').hidden=true;f.menu.open=true;
 assert.equal(f.menu.children[1].id,'cadillac-modifications-entry');
 assert.equal(f.settings.children.length,1);
 f.button('Hydraulics, wheels & tires').click();
 assert.equal(f.menu.open,false);assert.equal(f.settings.open,true);assert.equal(f.id('cadillac-modifications').open,true);
 assert.equal(f.doc.activeElement.id,'cadillac-modifications-title');assert.equal(f.id('cadillac-modifications').scrolled,true);
 assert.equal(f.calls.length,0,'opening the editor never activates hydraulics');
});

test('the modifications editor appears immediately under the Ride your way heading',()=>{
 const f=fixture({},true);assert.deepEqual(f.settings.children.map(element=>element.tagName),['h2','details','fieldset']);
 assert.equal(f.settings.children[1].id,'cadillac-modifications');assert.equal(f.settings.children[2].id,'other-settings');
});

test('each corner changes independently while Settings stays open and input/change are deduplicated',()=>{
 const f=fixture();f.ui.open();
 for(const [corner,value]of [['FL',.05],['FR',.12],['RL',.04],['RR',.2]]){
  const input=f.range(corner);input.focus();input.value=String(value);input.dispatch('input');input.dispatch('change');
  assert.equal(f.state.targets[corner],value);assert.equal(f.settings.open,true);
  assert.equal(f.doc.activeElement,input);assert.equal(input.getAttribute('aria-valuetext'),Math.round(value*100)+' cm');
 }
 assert.equal(f.calls.length,4);assert(f.calls.every(call=>call.settingsOpen));assert.deepEqual(f.state.targets,{FL:.05,FR:.12,RL:.04,RR:.2});
 assert.equal(f.saved.length,0,'height changes are not persisted');
});

test('a rejected corner preview restores the actual value and announces the clearance reason',()=>{
 const f=fixture();f.ui.open();f.reject('Rear door would touch the curb.');const input=f.range('RL');input.value='.24';input.dispatch('input');
 assert.equal(input.value,'0');assert.equal(f.state.targets.RL,0);assert.equal(f.settings.open,true);assert.equal(f.doc.activeElement,input);
 assert.equal(f.id('cadillac-modifications-feedback').textContent,'Rear door would touch the curb.');
 assert.equal(f.saved.length,0);
});

test('out-of-range or nonfinite corner input never reaches the simulation',()=>{
 const f=fixture();for(const value of ['1','-.01','-.5','NaN','Infinity']){f.range('FL').value=value;f.range('FL').dispatch('input');assert.equal(f.range('FL').value,'0');}
 assert.equal(f.calls.length,0);assert.match(f.id('cadillac-modifications-feedback').textContent,/slider range/);
});

test('wheel selection applies without closing Settings and persists only accepted cosmetic choices',()=>{
 const f=fixture();f.ui.open();assert.equal(f.select('center').disabled,true);
 f.select('rim').value='wire-gold';f.select('rim').dispatch('change');assert.equal(f.select('center').disabled,false);
 f.select('tire').value='low-profile-whitewall';f.select('tire').dispatch('change');
 f.select('center').value='black';f.select('center').dispatch('change');
 assert.equal(f.settings.open,true);assert.deepEqual(f.state.wheels,{rim:'wire-gold',tire:'low-profile-whitewall',center:'black'});
 assert.equal(f.saved.length,3);const saved=JSON.parse(f.saved.at(-1).value);assert.deepEqual(Object.keys(saved).sort(),['version','wheels']);assert.equal(saved.version,1);assert.deepEqual(saved.wheels,f.state.wheels);
 f.reject('Wheel clearance is blocked.');f.select('tire').value='standard';f.select('tire').dispatch('change');
 assert.equal(f.select('tire').value,'low-profile-whitewall');assert.equal(f.saved.length,3);assert.equal(f.doc.activeElement,f.select('tire'));
});

test('accepted hops close Settings before dispatch, focus the game, and do not persist motion',()=>{
 const f=fixture();f.ui.open();f.button('Front hop').click();
 assert.deepEqual(f.calls[0],{action:{kind:'hop',mode:'front'},settingsOpen:false});
 assert.equal(f.settings.open,false);assert.equal(f.doc.activeElement,f.canvas);assert.equal(f.state.busy,true);assert.equal(f.saved.length,0);
});

test('rejected hops reopen Settings and return focus to the requested action',()=>{
 const f=fixture();f.ui.open();f.reject('No overhead clearance.');const button=f.button('Full-car hop');button.click();
 assert.equal(f.calls[0].settingsOpen,false);assert.equal(f.settings.open,true);assert.equal(f.doc.activeElement,button);assert.equal(f.state.busy,false);
 assert.equal(f.id('cadillac-modifications-feedback').textContent,'No overhead clearance.');
});

test('reduced motion disables hops but preserves static height and wheel customization',()=>{
 const f=fixture({reduced:true});f.ui.open();assert.equal(f.button('Front hop').disabled,true);assert.equal(f.button('Full-car hop').disabled,true);
 f.button('Front hop').onclick(new Event('click'));assert.equal(f.calls.length,0);assert.equal(f.settings.open,true);
 assert.equal(f.range('FL').disabled,false);assert.equal(f.select('rim').disabled,false);
 f.range('FL').value='.1';f.range('FL').dispatch('input');assert.equal(f.state.targets.FL,.1);
});

test('moving state blocks setup changes; finishing an active hop closes Settings and preserves average height',()=>{
 const f=fixture({parked:false,targets:{FL:.08,FR:.16,RL:0,RR:0}});assert.equal(f.select('rim').disabled,true);assert.equal(f.range('FR').disabled,true);assert.equal(f.button('Finish motion & level').disabled,true);
 f.button('Raise').onclick(new Event('click'));assert.equal(f.calls.length,0);
 f.state.parked=true;f.state.busy=true;f.ui.refresh();assert.equal(f.button('Rear hop').disabled,true);assert.equal(f.range('RR').disabled,true);assert.equal(f.button('Finish motion & level').disabled,false);
 f.ui.open();f.button('Finish motion & level').click();assert.equal(f.settings.open,false);assert.deepEqual(f.calls.at(-1),{action:{kind:'settle'},settingsOpen:false});assert.equal(f.state.busy,true);
 assert.deepEqual(f.state.targets,{FL:.06,FR:.06,RL:.06,RR:.06});assert.equal(f.doc.activeElement,f.canvas);assert.equal(f.saved.length,0);
});

test('a rejected settle reopens Settings with unchanged targets and restores focus',()=>{
 const f=fixture({busy:true,targets:{FL:.12,FR:.12,RL:.04,RR:.04}});f.ui.open();f.reject('Resume the game before finishing suspension motion.');const button=f.button('Finish motion & level');button.click();
 assert.deepEqual(f.calls.at(-1),{action:{kind:'settle'},settingsOpen:false});assert.equal(f.settings.open,true);assert.equal(f.doc.activeElement,button);assert.equal(f.state.busy,true);
 assert.deepEqual(f.state.targets,{FL:.12,FR:.12,RL:.04,RR:.04});assert.equal(f.id('cadillac-modifications-feedback').textContent,'Resume the game before finishing suspension motion.');assert.equal(f.saved.length,0);
});

test('background refresh preserves an active slider gesture, then resynchronizes on blur',()=>{
 const f=fixture(),input=f.range('FL');input.focus();input.value='.13';f.state.reason='Checking clearance.';f.ui.refresh();assert.equal(input.value,'.13');
 f.doc.activeElement=null;input.dispatch('blur');assert.equal(input.value,'0');
});

test('unavailable rides hide both entry points, and disposed controls cannot request changes',()=>{
 const f=fixture({riding:false});assert.equal(f.id('cadillac-modifications').hidden,true);assert.equal(f.id('cadillac-modifications-entry').hidden,true);assert.equal(f.ui.open(),false);
 f.state.riding=true;f.ui.refresh();const retained=f.button('Raise');f.ui.dispose();f.ui.dispose();assert.equal(f.settings.children.length,0);assert.equal(f.menu.children.length,1);retained.onclick(new Event('click'));assert.equal(f.calls.length,0);
});

test('cosmetic preferences tolerate corrupt storage, unknown versions, and unavailable storage',()=>{
 const defaults={rim:'stock',tire:'standard',center:'gold'};
 for(const raw of [null,'{bad','null','[]','{"version":2,"wheels":{"rim":"wire-gold"}}'])assert.deepEqual(readCadillacModsPreferences({getItem:()=>raw}),defaults);
 assert.deepEqual(readCadillacModsPreferences({getItem:()=>{throw Error('blocked');}}),defaults);
 assert.equal(writeCadillacModsPreferences(defaults,{setItem:()=>{throw Error('quota');}}),false);
});

test('cosmetic preference round trip excludes untrusted or stale motion fields',()=>{
 const reader={getItem:()=>JSON.stringify({version:1,wheels:{rim:'wire-chrome',tire:'whitewall',center:'white'},targets:{FL:.24},hop:'all',active:true})};
 const saved=readCadillacModsPreferences(reader);assert.deepEqual(saved,{rim:'wire-chrome',tire:'whitewall',center:'white'});
 let record;assert.equal(writeCadillacModsPreferences(saved,{setItem:(key,value)=>{record={key,value};}}),true);
 assert.equal(record.key,CADILLAC_MODS_STORAGE_KEY);assert.deepEqual(JSON.parse(record.value),{version:1,wheels:saved});
});
