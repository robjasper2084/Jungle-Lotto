import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {stripTypeScriptTypes} from 'node:module';
import {PREVIEW_CUT_TRAVEL_BODY} from '../scripts/source-transforms.mjs';

const code=stripTypeScriptTypes('(async()=>{'+PREVIEW_CUT_TRAVEL_BODY+'})()');
function fixture(prepare){
 const calls=[];
 const status={dataset:{},hidden:true,textContent:'',setAttribute(){}};
 const guide={open:false,close(){this.open=false;calls.push('close');},showModal(){this.open=true;calls.push('show');}};
 const environment={
  scenePreparing:false,resetFrameClock:false,active:false,first:true,cameraPitch:0,destination:null,
  travel:{disabled:false,textContent:'Travel to path',dataset:{},setAttribute(){},removeAttribute(){}},
  lm:{x:10,z:20,yaw:.3,id:'preview-cut-test'},
  c:{querySelector:()=>null,append:()=>{}},document:{createElement:()=>status},
  el:()=>guide,console:{warn:()=>calls.push('warning')},
  start:{click:()=>calls.push('start')},clear:()=>calls.push('clear'),
  jump:(x,z,yaw)=>calls.push(['jump',x,z,yaw]),preparePreviewTravel:prepare,
 };
 return {environment,calls,status,guide,run:()=>vm.runInNewContext(code,environment)};
}

test('native preview travel waits for actual preparation and restores the frame lock',async()=>{
 let ready;const preparation=new Promise(resolve=>{ready=resolve;});
 const f=fixture(()=>preparation);const traveling=f.run();
 assert.equal(f.environment.scenePreparing,true);assert.equal(f.environment.travel.disabled,true);
 assert.equal(f.environment.travel.dataset.previewTravelState,'preparing');
 assert.equal(f.calls.some(call=>Array.isArray(call)&&call[0]==='jump'),false);
 ready();await traveling;
 assert.deepEqual(f.calls,['clear',['jump',10,20,.3],'close','start']);
 assert.equal(f.environment.scenePreparing,false);assert.equal(f.environment.resetFrameClock,true);
 assert.equal(f.environment.travel.disabled,false);assert.equal(f.environment.travel.dataset.previewTravelState,'ready');
 assert.equal(f.status.hidden,true);assert.equal(f.environment.destination,f.environment.lm);
});

test('failed native preparation keeps rider in place and exposes a retry without rejection',async()=>{
 const f=fixture(()=>Promise.reject(Error('Missing original model')));
 await assert.doesNotReject(f.run());
 assert.equal(f.environment.scenePreparing,false);assert.equal(f.environment.travel.disabled,false);
 assert.equal(f.environment.travel.dataset.previewTravelState,'failed');assert.equal(f.environment.travel.textContent,'Retry travel');
 assert.equal(f.environment.destination,null);assert.equal(f.guide.open,true);
 assert.match(f.status.textContent,/could not load.*Retry travel/);
 assert.equal(f.calls.some(call=>Array.isArray(call)&&call[0]==='jump'),false);
});

test('native travel cannot replace another active preparation lock',async()=>{
 const f=fixture(()=>{throw Error('Second preparation started');});f.environment.scenePreparing=true;
 await f.run();assert.equal(f.environment.scenePreparing,true);assert.equal(f.environment.travel.disabled,false);
 assert.deepEqual(f.calls,[]);
});
