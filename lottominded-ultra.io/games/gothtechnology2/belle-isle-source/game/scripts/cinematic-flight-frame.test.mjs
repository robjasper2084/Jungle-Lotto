import test from 'node:test';
import assert from 'node:assert/strict';
import {waitForCinematicFlightFrame} from './cinematic-review-evidence.mjs';
function fixture({mounted=true,failed=false,lost=false}={}){
 const keys=['document','requestAnimationFrame','cancelAnimationFrame'];
 const saved=keys.map(k=>globalThis[k]);
 let paints=0,deleted=0;
 globalThis.document={visibilityState:'visible',body:{classList:{contains:n=>n==='on-hoverbike'?mounted:false}},getElementById:id=>id==='hover-hud'?{hidden:false}:null,querySelector:()=>null};
 globalThis.requestAnimationFrame=fn=>setImmediate(()=>{paints++;fn();});
 globalThis.cancelAnimationFrame=id=>clearImmediate(id);
 const gl={SYNC_GPU_COMMANDS_COMPLETE:1,CONDITION_SATISFIED:2,WAIT_FAILED:3,TIMEOUT_EXPIRED:4,ALREADY_SIGNALED:5,isContextLost:()=>lost,clientWaitSync:()=>failed?3:2,fenceSync:()=>({}),deleteSync:()=>deleted++,flush:()=>{}};
 return {canvas:{width:1440,height:960,getContext:()=>gl},result:()=>({paints,deleted}),restore:()=>keys.forEach((k,i)=>{if(saved[i]===undefined)delete globalThis[k];else globalThis[k]=saved[i];})};
}
test('live game GPU fence completion and two paint opportunities are mandatory',async()=>{
 const f=fixture();try{const result=await waitForCinematicFlightFrame(f.canvas);assert.equal(result.paintOpportunities,2);assert.equal(result.hoverMounted,true);assert.ok(result.gpuCompletedAt>=result.gpuSubmittedAt);assert.deepEqual(f.result(),{paints:2,deleted:1});}finally{f.restore();}
});
test('GPU failure remains terminal',async()=>{
 const f=fixture({failed:true});try{await assert.rejects(waitForCinematicFlightFrame(f.canvas),/GPU fence failed/);assert.equal(f.result().deleted,1);}finally{f.restore();}
});
test('cannot pass with a stale title-screen or missing mounted rider',()=>{
 const f=fixture({mounted:false});try{assert.throws(()=>waitForCinematicFlightFrame(f.canvas),/requires visible riding hoverbike/);}finally{f.restore();}
});
test('context loss fails before fence submission',()=>{
 const f=fixture({lost:true});try{assert.throws(()=>waitForCinematicFlightFrame(f.canvas),/live nonempty WebGL2/);}finally{f.restore();}
});
