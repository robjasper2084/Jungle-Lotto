import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {belleRoot,previewRoot} from '../scripts/paths.mjs';
import {readPreviewReadinessState} from '../scripts/browser-dom-state.mjs';
import {previewReadiness} from '../scripts/browser-readiness.mjs';

const [html,baseCss,hudCss]=await Promise.all(['index.html','src/belle/style.css','src/belle/mobileHud.css'].map(path=>readFile(resolve(belleRoot,path),'utf8')));
function fixture(){
 const elements=new Map();
 const element=(selector,extra={})=>{const value={hidden:false,disabled:false,dataset:{},style:{display:'block',visibility:'visible'},getBoundingClientRect:()=>({x:0,y:0,width:62,height:62}),...extra};elements.set(selector,value);return value;};
 element('#ridehud',{getBoundingClientRect:()=>({x:10,y:544,width:300,height:0})});
 for(const id of ['speed','recover','mount','brake','hop'])element('#ridehud #'+id);
 element('#welcome',{hidden:true,dataset:{state:'leaving',vehicle:'onewheel',camera:'tpp'}});
 element('#start',{disabled:true});element('#start-label',{textContent:'Preparing one wheel…'});
 element('#loading',{textContent:'Preparing handheld camera shaders'});
 element('#dequindre-preview-banner[data-dequindre-preview]',{dataset:{ready:'true'}});
 element('#profile',{dataset:{activeFrames:'392'}});
 element('input[name="startup-vehicle"]:checked',{value:'onewheel'});
 const doc={querySelector:selector=>elements.get(selector)??null,querySelectorAll:selector=>selector==='[data-preview-stop]'?Array.from({length:4},()=>({disabled:false})):[],body:{classList:{contains:()=>false}}};
 const preview={snapshot:()=>({ready:true,error:null,diagnostics:{}})};
 return {elements,doc,read:(options={})=>readPreviewReadinessState(options,doc,element=>element.style,preview)};
}

test('actual native HUD contract supports a zero-height footer with visible absolute children',()=>{
 assert.match(html,/<footer id="ridehud" hidden>/);
 for(const id of ['speed','recover','mount','brake','hop'])assert.match(html,new RegExp('id="'+id+'"'));
 assert.match(baseCss,/#ridehud\{[^}]*position:absolute/);
 assert.match(baseCss,/\.actions\{[^}]*position:absolute/);
 assert.match(hudCss,/\.speed-readout\{[^}]*position:absolute/);
 assert.match(hudCss,/\.touch-controls #hint\{display:none\}/);
 const state=fixture().read();
 assert.equal(state.rideHud.containerBounds.height,0);
 assert.equal(state.rideHud.speedVisible,true);
 assert.ok(state.rideHud.controls.every(control=>control.visible));
 assert.equal(state.rideHudVisible,true);
 assert.equal(previewReadiness(state,{ride:true}).ready,true,'stale hidden loading text does not block actual active gameplay');
});

test('hidden native HUD, absent speed or missing actual control still blocks readiness',()=>{
 for(const mutate of [
  f=>{f.elements.get('#ridehud').hidden=true;},
  f=>{f.elements.get('#ridehud').style.display='none';},
  f=>{f.elements.get('#ridehud #speed').getBoundingClientRect=()=>({width:0,height:0});},
  f=>{f.elements.get('#ridehud #brake').style.visibility='hidden';},
  f=>{f.elements.delete('#ridehud #hop');},
 ]){const f=fixture();mutate(f);assert.equal(f.read().rideHudVisible,false);assert.equal(previewReadiness(f.read(),{ride:true}).ready,false);}
});

test('passive identity capture cannot create a WebGL context before the original renderer exists',()=>{
 const f=fixture();let contextCalls=0;
 f.elements.set('#game',{getContext(){contextCalls++;throw Error('Must not create a game context');}});
 assert.equal(f.read({captureRenderer:true}).browser,undefined);
 assert.equal(contextCalls,0);
});

test('picture mode preserves real four-stop checks and leaves the default full profile available',async()=>{
 const smoke=await readFile(resolve(previewRoot,'scripts/browser-smoke.mjs'),'utf8');
 assert.match(smoke,/captureOnly=process\.argv\.includes\('--capture-only'\),profile=!captureOnly&&process\.argv\.includes\('--profile'\)/);
 assert.match(smoke,/captureOnly\?'-pictures'/);
 assert.match(smoke,/if\(!captureOnly\)\{\s+await activate\(page\.locator\('#welcome-friends'\)/);
 const fourStops=smoke.indexOf("for(const stop of ['atwater','freight','mack','island'])");
 assert.ok(fourStops>smoke.indexOf("check('connector verified in both directions'"));
 assert.match(smoke.slice(fourStops),/await choose\(stop\);[\s\S]*await holdForward\(2500\)/);
 assert.match(smoke.slice(fourStops),/if\(profile\)\{/);
 assert.ok(smoke.indexOf("backendSession.send('SystemInfo.getInfo')")<smoke.indexOf('await page.goto('));
 assert.match(smoke,/getByRole\('button',\{name:'Skip first ride objective',exact:true\}\)/);
});
