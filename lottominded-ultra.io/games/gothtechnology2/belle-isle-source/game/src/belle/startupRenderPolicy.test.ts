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
