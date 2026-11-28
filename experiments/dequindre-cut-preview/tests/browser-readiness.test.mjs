import test from 'node:test';
import assert from 'node:assert/strict';
import {previewReadiness,waitForPreviewReadiness} from '../scripts/browser-readiness.mjs';

test('an enabled retry button with the observed source error fails on the first poll',async()=>{
 let reads=0,waits=0;
 const state={bannerAttached:true,startEnabled:true,preview:{ready:false,error:'Dequindre Cut district could not prepare: [object Event]',stage:'Preview could not finish preparing'},loading:'Island could not load. Dequindre Cut district could not prepare: [object Event]',pageErrors:[]};
 await assert.rejects(waitForPreviewReadiness(async()=>{reads++;return state;},{wait:async()=>{waits++;}}),error=>error.message.includes('Dequindre Cut district could not prepare')&&error.readiness.samples===1);
 assert.equal(reads,1);assert.equal(waits,0);
});

test('fatal browser errors, native loader failure and travel failure are terminal',()=>{
 for(const state of [
  {pageErrors:['Uncaught TypeError: renderer unavailable']},
  {loading:'Island could not load. Missing original model'},
  {travelState:'failed',travelMessage:'This destination could not load. Choose Retry travel to try again.'},
 ]){
  const result=previewReadiness(state,{travel:true});
  assert.equal(result.terminal,true);assert.equal(result.ready,false);assert.ok(result.error);
 }
});

test('healthy startup waits for both world and native rider preparation, with a bounded timeout',async()=>{
 let now=0,index=0;
 const sequence=[{bannerAttached:true,startEnabled:false,preview:{ready:false,stage:'Map'}},{bannerAttached:true,startEnabled:false,preview:{ready:true,stage:'Rider'}},{bannerAttached:true,startEnabled:true,preview:{ready:true}}];
 const ready=await waitForPreviewReadiness(async()=>sequence[index++],{now:()=>now,wait:async ms=>{now+=ms;}});
 assert.equal(ready.samples,3);assert.equal(ready.elapsedMs,200);
 await assert.rejects(waitForPreviewReadiness(async()=>sequence[0],{timeout:250,now:()=>now,wait:async ms=>{now+=ms;}}),error=>error.message.includes('last stage: Map')&&error.readiness.elapsedMs===250);
 assert.equal(previewReadiness({travelState:'ready',preview:{travelPending:true}},{travel:true}).ready,false);
 assert.equal(previewReadiness({travelState:'ready',preview:{travelPending:false}},{travel:true}).ready,true);
});

const riding={preview:{ready:true,stage:'The complete source district is ready to explore.'},startEnabled:false,startLabel:'Preparing One wheel…',loading:'Preparing handheld camera shaders',welcomeHidden:true,welcomeState:'leaving',bodyAtStart:false,rideHudVisible:true,bannerVisible:true,previewUsable:true,selectedVehicle:'onewheel',checkedVehicle:'onewheel',activeFrames:1};

test('world readiness cannot finish selected-ride preparation before the real HUD and a rendered active frame',async()=>{
 let now=0,index=0;
 const preparing={...riding,welcomeHidden:false,welcomeState:'ready',bodyAtStart:true,rideHudVisible:false,bannerVisible:false,previewUsable:false,activeFrames:0};
 const sequence=[preparing,{...riding,activeFrames:0},{...riding,previewUsable:false},riding];
 const ready=await waitForPreviewReadiness(async()=>sequence[index++],{ride:true,now:()=>now,wait:async ms=>{now+=ms;}});
 assert.equal(ready.samples,4);assert.equal(ready.elapsedMs,300);
 assert.equal(ready.state.startEnabled,false,'the original hidden Start button stays disabled after leaving');
 for(const incomplete of [
  {...riding,welcomeHidden:false},{...riding,bodyAtStart:true},{...riding,rideHudVisible:false},
  {...riding,bannerVisible:false},{...riding,previewUsable:false},{...riding,activeFrames:0},
  {...riding,selectedVehicle:'hoverbike'},{...riding,checkedVehicle:'hoverbike'},
 ])assert.equal(previewReadiness(incomplete,{ride:true}).ready,false);
});

test('native ride retry fails immediately and bounded preparation timeout preserves the actual camera stage',async()=>{
 let now=0,waits=0;
 const retry={...riding,welcomeHidden:false,startEnabled:true,startLabel:'Try starting again',loading:'Your ride could not load. Try again, or choose the other vehicle.'};
 await assert.rejects(waitForPreviewReadiness(async()=>retry,{ride:true,wait:async()=>{waits++;}}),error=>error.message.includes('Your ride could not load')&&error.readiness.samples===1);
 assert.equal(waits,0);
 const preparing={...riding,welcomeHidden:false,activeFrames:0};
 await assert.rejects(waitForPreviewReadiness(async()=>preparing,{ride:true,timeout:250,now:()=>now,wait:async ms=>{now+=ms;}}),error=>error.message.includes('Preview ride')&&error.message.includes('last stage: Preparing handheld camera shaders')&&error.readiness.elapsedMs===250&&error.readiness.state.selectedVehicle==='onewheel');
 for(const failure of [{...riding,pageErrors:['Renderer failed']},{...riding,preview:{ready:true,error:'Source preparation failed'}},{...riding,loading:'Island could not load. Missing model'}])assert.equal(previewReadiness(failure,{ride:true}).ready,false);
});
