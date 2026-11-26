import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {pauseSoftwareStartupScene} from './startupRenderPolicy.ts';
import {createOpenDialogProbe} from './renderDomQueries.ts';

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

test('the actual frame startup guard never queries the picker on ineligible frames',()=>{
 const main=readFileSync(new URL('./main.ts',import.meta.url),'utf8');
 const line=main.split('\n').find(line=>line.includes('if(softwareStartup&&prepared&&!active&&!vr?.active&&pauseSoftwareStartupScene('));
 assert.ok(line);
 const expression=line.trim().slice(3,-2).replace('<HTMLDetailsElement>','');
 const run=Function('softwareStartup','prepared','active','vr','document','pauseSoftwareStartupScene','return '+expression);
 for(let mask=0;mask<32;mask++){
  const [software,ready,active,open,vrActive]=[0,1,2,3,4].map(bit=>Boolean(mask&(1<<bit)));
  let reads=0;
  const document={querySelector(selector:string){assert.equal(selector,'.cinema-ride-picker');reads++;return {open};}};
  assert.equal(run(software,ready,active,vrActive?{active:true}:undefined,document,pauseSoftwareStartupScene),pauseSoftwareStartupScene(software,ready,active,open,vrActive));
  assert.equal(reads,Number(software&&ready&&!active&&!vrActive));
 }
});

test('open-dialog probe reads live presence synchronously, never a cached boolean',()=>{
 const entries:{hasAttribute:(name:string)=>boolean}[]=[];let collections=0;
 const doc={getElementsByTagName(name:string){assert.equal(name,'dialog');collections++;return entries;}} as unknown as Document;
 const hasOpen=createOpenDialogProbe(doc);
 let flag=false;
 const dialog={hasAttribute(name:string){assert.equal(name,'open');return flag;}};
 assert.equal(hasOpen(),false);entries.push(dialog);assert.equal(hasOpen(),false);
 flag=true;assert.equal(hasOpen(),true);entries.length=0;assert.equal(hasOpen(),false);
 entries.push(dialog);assert.equal(hasOpen(),true);flag=false;assert.equal(hasOpen(),false);
 entries.push({hasAttribute:()=>true});assert.equal(hasOpen(),true);
 assert.equal(collections,1);
});
