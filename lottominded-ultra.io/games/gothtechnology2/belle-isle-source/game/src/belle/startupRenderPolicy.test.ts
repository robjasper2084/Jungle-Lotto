import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {pauseSoftwareStartupScene} from './startupRenderPolicy.ts';

test('software rendering pauses only after an authentic first frame with an open ride chooser',()=>{
 assert.equal(pauseSoftwareStartupScene(true,true,false,true,false),true);
 for(const [software,ready,active,open,vr] of [
  [false,true,false,true,false],
  [true,false,false,true,false],
  [true,true,true,true,false],
  [true,true,false,false,false],
  [true,true,false,true,true],
 ] as const)assert.equal(pauseSoftwareStartupScene(software,ready,active,open,vr),false);
});

test('the real game still owns initial GPU readiness, hover choice, and resumed frame loop',()=>{
 const main=readFileSync(new URL('./main.ts',import.meta.url),'utf8');
 const startup=readFileSync(new URL('./startup.ts',import.meta.url),'utf8');
 assert(main.includes("gpuDebug?.UNMASKED_RENDERER_WEBGL??gameGl.RENDERER"));
 assert(main.includes("pauseSoftwareStartupScene(softwareStartup,prepared,active,document.querySelector"));
 assert(main.includes("if(!prepared){prepared=true;startup.ready(destinations.length);"));
 assert(main.includes("renderer.setAnimationLoop(frame)"));
 assert(startup.includes("setSoftwarePreview(value:boolean){softwarePreview=value;refreshPreview();}"));
 assert(startup.includes("rideSetup.classList.add('preview-static')"));
 assert(startup.includes("done.onclick=()=>{picker.open=false"));
 assert(startup.includes("if(!ready||leaving)return;leaving=true;preview?.dispose();"));
});

test('real frame condition avoids picker DOM work unless software startup can actually pause',()=>{
 const main=readFileSync(new URL('./main.ts',import.meta.url),'utf8');
 const line=main.split('\n').find(value=>value.includes('if(softwareStartup&&prepared&&!active&&!vr?.active&&pauseSoftwareStartupScene('));
 assert.ok(line,'The actual render loop must guard the otherwise redundant DOM lookup');
 const condition=line.trim().slice(3,-2).replace('<HTMLDetailsElement>','');
 const evaluate=Function('softwareStartup','prepared','active','vr','document','pauseSoftwareStartupScene','return '+condition) as (
  software:boolean,ready:boolean,active:boolean,vr:{active:boolean}|undefined,document:{querySelector:(selector:string)=>{open:boolean}|null},policy:typeof pauseSoftwareStartupScene
 )=>boolean;
 for(const software of [false,true])for(const ready of [false,true])for(const active of [false,true])for(const vrActive of [false,true])for(const open of [false,true]){
  for(const present of [false,true]){
   let reads=0;
   const doc={querySelector(selector:string){reads++;assert.equal(selector,'.cinema-ride-picker');return present?{open}:null;}};
   const vr=vrActive?{active:true}:undefined;
   assert.equal(evaluate(software,ready,active,vr,doc,pauseSoftwareStartupScene),pauseSoftwareStartupScene(software,ready,active,present&&open,vrActive));
   assert.equal(reads,software&&ready&&!active&&!vrActive?1:0);
  }
 }
});
