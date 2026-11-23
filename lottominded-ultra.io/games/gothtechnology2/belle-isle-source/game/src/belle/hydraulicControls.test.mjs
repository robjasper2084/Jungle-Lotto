import test from 'node:test';
import assert from 'node:assert/strict';
import {fileURLToPath,pathToFileURL} from 'node:url';
import path from 'node:path';
import {build} from 'esbuild';

const game=fileURLToPath(new URL('../../',import.meta.url)),outfile=path.join(game,'.test/hydraulic-controls-runtime.mjs');
await build({absWorkingDir:game,entryPoints:['src/belle/hydraulicControls.ts'],outfile,bundle:true,platform:'node',format:'esm',loader:{'.css':'empty'},logLevel:'error'});
const {HydraulicControls}=await import(pathToFileURL(outfile).href);

// This event/state fixture exercises real component handlers. It does not
// certify browser layout, native hit testing, rendering, or physical hardware.
class Element{
 constructor(tag,doc){this.tagName=tag;this.ownerDocument=doc;this.children=[];this.attributes={};this.listeners={};this.hidden=false;this.open=false;this.disabled=false;this._text='';this.textWrites=0;this.value='';this.id='';const classes=new Set();this.classList={toggle:(value,on)=>{if(on)classes.add(value);else classes.delete(value);},remove:(...values)=>{for(const value of values)classes.delete(value);},contains:value=>classes.has(value)};}
 set textContent(value){this._text=value;this.textWrites++;}
 get textContent(){return this._text;}
 append(...children){for(const child of children){child.remove?.();child.parentElement=this;this.children.push(child);}}
 after(child){if(!this.parentElement)return;const parent=this.parentElement;child.remove();child.parentElement=parent;parent.children.splice(parent.children.indexOf(this)+1,0,child);}
 remove(){if(this.parentElement){const parent=this.parentElement;parent.children.splice(parent.children.indexOf(this),1);this.parentElement=null;}}
 contains(node){return node===this||this.children.some(child=>child.contains(node));}
 setAttribute(key,value){this.attributes[key]=String(value);}
 getAttribute(key){return this.attributes[key]??null;}
 addEventListener(type,listener){(this.listeners[type]??=[]).push(listener);}
 dispatch(type,properties={}){
  const event={type,target:this,defaultPrevented:false,stopped:false,...properties,preventDefault(){this.defaultPrevented=true;},stopPropagation(){this.stopped=true;}};
  if(type==='click')this.onclick?.(event);
  for(let node=this;node;node=node.parentElement){for(const listener of node.listeners[type]??[])listener(event);if(event.stopped)break;}
  return event;
 }
 click(){if(!this.disabled)return this.dispatch('click');}
 focus(){this.ownerDocument.activeElement=this;}
 showModal(){this.open=true;}
 close(){this.open=false;}
 querySelector(selector){return walk(this).find(node=>selector.startsWith('#')?node.id===selector.slice(1):node.tagName===selector)??null;}
}
function walk(root){return root.children.flatMap(child=>[child,...walk(child)]);}
function fixture(overrides={}){
 const doc={activeElement:null,createElement:tag=>new Element(tag,doc)};doc.body=doc.createElement('body');globalThis.document=doc;
 const menu=doc.createElement('dialog'),canvas=doc.createElement('canvas'),access=doc.createElement('section'),mods=doc.createElement('section');
 access.id='cadillac-controls';mods.id='cadillac-modifications-entry';menu.append(access,mods);doc.body.append(menu,canvas);
 const state={riding:true,parked:true,active:false,inside:false,blocked:false,reduced:false,hop:false,busy:false,
  targets:{FL:.14,FR:.14,RL:.14,RR:.14},current:{FL:.14,FR:.14,RL:.14,RR:.14},minHeight:0,maxHeight:.24,...overrides};
 const modes=[],requests=[];let modeRejection,commandRejection;
 const ui=new HydraulicControls(menu,canvas,{
  state:()=>({...state,blocked:state.blocked||menu.open}),
  mode:(enabled,event)=>{modes.push({enabled,event,menuOpen:menu.open});if(modeRejection)return{accepted:false,message:modeRejection};state.active=enabled;return{accepted:true};},
  request:(action,event)=>{
   requests.push({action,event});if(commandRejection)return{accepted:false,message:commandRejection};
   if(action.kind==='corner')state.targets={...state.targets,[action.corner]:action.metres};
   if(action.kind==='hop'){state.hop=true;state.busy=true;}else if(action.kind==='pose')state.busy=true;
   return{accepted:true};
  },
 });
 const id=value=>walk(doc.body).find(node=>node.id===value);
 return{ui,state,modes,requests,menu,canvas,doc,id,enter(){id('hydraulic-mode-toggle').click();},rejectMode:value=>{modeRejection=value;},rejectCommand:value=>{commandRejection=value;}};
}

test('inactive mode has no playfield overlay and entry is hidden outside a Cadillac',()=>{
 const f=fixture({riding:false});assert.equal(f.id('hydraulic-controls').hidden,true);assert.equal(f.id('hydraulic-mode-entry').hidden,true);
 f.state.riding=true;f.ui.refresh();assert.equal(f.id('hydraulic-mode-entry').hidden,false);assert.equal(f.id('hydraulic-controls').hidden,true);
 assert.equal(f.modes.length,0);assert.equal(f.requests.length,0);
});

test('both Cadillac access configurations retain a sibling mode entry and close the Ride menu before enabling',()=>{
 const f=fixture();f.id('cadillac-controls').hidden=true;f.id('cadillac-modifications-entry').hidden=true;f.menu.open=true;f.ui.refresh();
 assert.deepEqual(f.menu.children.map(node=>node.id),['cadillac-controls','cadillac-modifications-entry','hydraulic-mode-entry']);
 f.enter();assert.equal(f.menu.open,false);assert.equal(f.modes.length,1);assert.equal(f.modes[0].menuOpen,false);
 assert.equal(f.state.active,true);assert.equal(f.id('hydraulic-controls').hidden,false);assert.equal(f.id('hydraulic-mode-toggle').getAttribute('aria-pressed'),'true');
 assert.equal(f.doc.activeElement.id,'hydraulic-front-up');assert.equal(f.requests.length,0,'entering mode never requests a pose or motion');
});

test('moving prevents mode entry but never traps a player in an already active mode',()=>{
 const f=fixture({parked:false});assert.equal(f.id('hydraulic-mode-toggle').disabled,true);
 f.id('hydraulic-mode-toggle').onclick({});assert.equal(f.modes.length,0);assert.equal(f.id('hydraulic-controls').hidden,true);
 f.state.active=true;f.ui.refresh();assert.equal(f.id('hydraulic-mode-toggle').disabled,false);assert.equal(f.id('hydraulic-front-up').disabled,true);
 f.id('hydraulic-exit').click();assert.equal(f.modes.at(-1).enabled,false);assert.equal(f.doc.activeElement,f.canvas);assert.equal(f.requests.length,0);
});

test('rejected mode transitions restore the original menu and announce the supplied reason',()=>{
 const f=fixture();f.menu.open=true;f.rejectMode('Finish the current activity first.');f.enter();
 assert.equal(f.menu.open,true);assert.equal(f.state.active,false);assert.equal(f.doc.activeElement.id,'hydraulic-mode-toggle');
 assert.equal(f.id('hydraulic-mode-note').textContent,'Finish the current activity first.');assert.equal(f.id('hydraulic-controls').hidden,true);
});

test('dialogs hide the whole overlay; first-person retains only the compact mode hint and exit',()=>{
 const f=fixture();f.enter();f.state.blocked=true;f.ui.refresh();assert.equal(f.id('hydraulic-controls').hidden,true);
 f.state.blocked=false;f.state.inside=true;f.ui.refresh();assert.equal(f.id('hydraulic-controls').hidden,false);
 assert.equal(f.id('hydraulic-outside-controls').hidden,true);assert.equal(f.id('hydraulic-inside-controls').hidden,false);
 assert.equal(f.id('hydraulic-corner-FL').disabled,true);assert.match(f.id('hydraulic-inside-hint').textContent,/third-person/);
 for(const shortcut of ['7 Front up','8 Back up','9 Pancake','H / Escape'])assert.ok(f.id('hydraulic-inside-hint').textContent.includes(shortcut));
 f.id('hydraulic-inside-exit').click();assert.equal(f.state.active,false);assert.equal(f.doc.activeElement,f.canvas);assert.equal(f.requests.length,0);
});

test('the mode class follows active Cadillac ownership even while blocked, then clears on exit or disposal',()=>{
 const f=fixture();assert.equal(f.doc.body.classList.contains('belle-hydraulic-mode'),false);f.enter();assert.equal(f.doc.body.classList.contains('belle-hydraulic-mode'),true);
 f.state.blocked=true;f.ui.refresh();assert.equal(f.id('hydraulic-controls').hidden,true);assert.equal(f.doc.body.classList.contains('belle-hydraulic-mode'),true);
 f.state.riding=false;f.ui.refresh();assert.equal(f.doc.body.classList.contains('belle-hydraulic-mode'),false);
 f.state.riding=true;f.ui.refresh();assert.equal(f.doc.body.classList.contains('belle-hydraulic-mode'),true);
 f.ui.dispose();assert.equal(f.doc.body.classList.contains('belle-hydraulic-mode'),false);
});

test('the compact cabin layout class follows only active inside view and is removed with the component',()=>{
 const f=fixture({inside:true});assert.equal(f.doc.body.classList.contains('belle-hydraulic-inside'),false);f.enter();assert.equal(f.doc.body.classList.contains('belle-hydraulic-inside'),true);
 f.state.inside=false;f.ui.refresh();assert.equal(f.doc.body.classList.contains('belle-hydraulic-inside'),false);
 f.state.inside=true;f.ui.refresh();assert.equal(f.doc.body.classList.contains('belle-hydraulic-inside'),true);
 f.state.active=false;f.ui.refresh();assert.equal(f.doc.body.classList.contains('belle-hydraulic-inside'),false);
 f.state.active=true;f.ui.refresh();f.ui.dispose();assert.equal(f.doc.body.classList.contains('belle-hydraulic-inside'),false);
});

test('Smart Pump pose requests can retarget an unfinished lift and retain keyboard focus',()=>{
 const f=fixture({busy:true});f.enter();
 for(const pose of ['front-up','back-up','pancake']){
  const button=f.id('hydraulic-'+pose);assert.equal(button.disabled,false);button.focus();button.click();
  assert.deepEqual(f.requests.at(-1).action,{kind:'pose',pose});assert.equal(f.doc.activeElement,button);assert.equal(f.state.active,true);
 }
 assert.equal(f.modes.length,1,'pose requests never leave Hydraulic mode');
});

test('external cabin and key results refresh first-person state and announce only changed feedback',()=>{
 const f=fixture({inside:true});f.enter();f.state.busy=true;f.ui.showResult({accepted:true,message:'Front up target selected.'});
 assert.equal(f.id('hydraulic-controls').getAttribute('data-motion'),'moving');assert.equal(f.id('hydraulic-outside-controls').hidden,true);
 const feedback=f.id('hydraulic-controls-feedback'),writes=feedback.textWrites;assert.equal(feedback.textContent,'Front up target selected.');
 f.ui.showResult({accepted:true,message:'Front up target selected.'});assert.equal(feedback.textWrites,writes);
 f.ui.showResult({accepted:false,message:'The switch is out of reach.'});assert.equal(feedback.textContent,'The switch is out of reach.');
 f.ui.showResult({accepted:true});assert.equal(feedback.textContent,'Hydraulic target updated.');
 f.ui.showResult({accepted:false});assert.equal(feedback.textContent,'Hydraulic control is unavailable right now.');
 assert.equal(f.requests.length,0);assert.equal(f.doc.activeElement.id,'hydraulic-inside-exit');
});

test('corner input retargets during a lift, preserves other targets, and deduplicates input/change',()=>{
 const f=fixture({busy:true});f.enter();const input=f.id('hydraulic-corner-FL');assert.equal(input.disabled,false);
 input.focus();input.value='.22';input.dispatch('input');input.dispatch('change');
 assert.equal(f.requests.length,1);assert.deepEqual(f.requests[0].action,{kind:'corner',corner:'FL',metres:.22});
 assert.deepEqual(f.state.targets,{FL:.22,FR:.14,RL:.14,RR:.14});assert.equal(f.doc.activeElement,input);assert.equal(f.id('hydraulic-corner-FL-value').textContent,'14 → 22 cm');
 assert.match(input.getAttribute('aria-valuetext'),/22 cm target; currently 14 cm/);
});

test('a rejected lift restores the actual target, announces clearance, and leaves the control focused',()=>{
 const f=fixture({busy:true});f.enter();f.rejectCommand('The front tire would touch the fender.');
 const input=f.id('hydraulic-corner-FL');input.focus();input.value='.04';input.dispatch('input');
 assert.equal(input.value,'0.14');assert.equal(f.state.targets.FL,.14);assert.equal(f.doc.activeElement,input);
 assert.equal(f.id('hydraulic-controls-feedback').textContent,'The front tire would touch the fender.');
 assert.equal(f.state.active,true);assert.equal(f.state.busy,true);
});

test('invalid or out-of-range heights never reach the ride',()=>{
 const f=fixture();f.enter();const input=f.id('hydraulic-corner-RR');
 for(const value of ['NaN','Infinity','-.01','.25']){input.value=value;input.dispatch('input');assert.equal(input.value,'0.14');}
 assert.equal(f.requests.length,0);assert.match(f.id('hydraulic-controls-feedback').textContent,/slider range/);
});

test('an active hop locks retargets and further hops but Finish & level stays available',()=>{
 const f=fixture();f.enter();f.id('hydraulic-hop-front').click();assert.deepEqual(f.requests[0].action,{kind:'hop',mode:'front'});
 assert.equal(f.id('hydraulic-front-up').disabled,true);assert.equal(f.id('hydraulic-corner-FL').disabled,true);assert.equal(f.id('hydraulic-hop-rear').disabled,true);
 f.id('hydraulic-back-up').onclick({});assert.equal(f.requests.length,1,'stale handlers cannot bypass hop gating');
 assert.equal(f.id('hydraulic-settle').disabled,false);f.id('hydraulic-settle').click();assert.deepEqual(f.requests.at(-1).action,{kind:'settle'});assert.equal(f.state.active,true);
});

test('reduced motion disables every hop while preserving poses and corner editing',()=>{
 const f=fixture({reduced:true});f.enter();
 for(const mode of ['all','front','rear']){assert.equal(f.id('hydraulic-hop-'+mode).disabled,true);f.id('hydraulic-hop-'+mode).onclick({});}
 assert.equal(f.requests.length,0);assert.equal(f.id('hydraulic-front-up').disabled,false);assert.equal(f.id('hydraulic-corner-RL').disabled,false);
 f.id('hydraulic-pancake').click();assert.deepEqual(f.requests.at(-1).action,{kind:'pose',pose:'pancake'});
});

test('hidden, first-person, inactive, and moving controls refuse stale commands',()=>{
 for(const overrides of [{blocked:true},{inside:true},{active:false},{parked:false},{riding:false}]){
  const f=fixture({active:true,...overrides});f.id('hydraulic-front-up').onclick({});f.id('hydraulic-settle').onclick({});
  assert.equal(f.requests.length,0,JSON.stringify(overrides));
 }
});

test('Escape is local to the overlay, exits once, and returns focus to the canvas',()=>{
 const f=fixture();f.enter();const input=f.id('hydraulic-corner-FR');input.focus();
 const unrelated=f.canvas.dispatch('keydown',{key:'Escape'});assert.equal(unrelated.defaultPrevented,false);assert.equal(f.state.active,true);
 const event=input.dispatch('keydown',{key:'Escape'});assert.equal(event.defaultPrevented,true);assert.equal(event.stopped,true);
 assert.equal(f.state.active,false);assert.equal(f.doc.activeElement,f.canvas);assert.equal(f.modes.length,2);assert.equal(f.requests.length,0);
});

test('native overlay click propagation cannot trigger the page-wide canvas focus handler',()=>{
 const f=fixture();f.enter();let documentClicks=0;f.doc.body.addEventListener('click',()=>{documentClicks++;f.canvas.focus();});
 const button=f.id('hydraulic-back-up');button.focus();const event=button.click();assert.equal(event.stopped,true);assert.equal(documentClicks,0);assert.equal(f.doc.activeElement,button);
});

test('refresh preserves an in-progress range gesture until blur, without repeating live motion text',()=>{
 const f=fixture({busy:true});f.enter();const input=f.id('hydraulic-corner-RL'),status=f.id('hydraulic-motion-status');
 input.focus();input.value='.21';const writes=status.textWrites;f.state.current={...f.state.current,RL:.16};f.ui.refresh();
 assert.equal(input.value,'.21');assert.equal(status.textWrites,writes);assert.equal(f.id('hydraulic-corner-RL-value').getAttribute('aria-live'),'off');
 f.doc.activeElement=null;input.dispatch('blur');assert.equal(input.value,'0.14');
});

test('dispose removes both surfaces and retained handlers cannot request a mode or action',()=>{
 const f=fixture();f.enter();const button=f.id('hydraulic-pancake'),toggle=f.id('hydraulic-mode-toggle'),root=f.id('hydraulic-controls');
 f.ui.dispose();f.ui.dispose();button.onclick({});toggle.onclick({});root.dispatch('keydown',{key:'Escape'});f.ui.refresh();
 assert.equal(f.id('hydraulic-controls'),undefined);assert.equal(f.id('hydraulic-mode-entry'),undefined);assert.equal(f.requests.length,0);assert.equal(f.modes.length,1);
 assert.equal(f.state.active,true,'the ride owner, not component disposal, owns mode shutdown');
});
