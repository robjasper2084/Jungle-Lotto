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
