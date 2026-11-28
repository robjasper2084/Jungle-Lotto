import test from 'node:test';
import assert from 'node:assert/strict';
import {preparePreviewTravel,registerPreviewTravel} from '../src/previewTravel.ts';
import {previewState} from '../src/previewState.ts';

test('failed destination preparation releases the input/loading state so a retry can succeed',async()=>{
  let attempt=0;
  const remove=registerPreviewTravel(()=>{if(++attempt===1)throw Error('asset unavailable');return Promise.resolve();});
  try{
    await assert.rejects(preparePreviewTravel({x:1,z:2}),/asset unavailable/);
    assert.equal(previewState.travelPending,false);
    await preparePreviewTravel({x:1,z:2});
    assert.equal(attempt,2);assert.equal(previewState.travelPending,false);
  }finally{remove();}
});

test('concurrent travel cannot replace an active destination preparation',async()=>{
  let finish!:()=>void,calls=0;
  const remove=registerPreviewTravel(()=>{calls++;return new Promise<void>(resolve=>{finish=resolve;});});
  try{
    const first=preparePreviewTravel({x:1,z:2});
    await assert.rejects(preparePreviewTravel({x:10,z:20}),/already preparing/);
    assert.equal(previewState.travelPending,true);assert.equal(calls,1);
    finish();await first;assert.equal(previewState.travelPending,false);
  }finally{remove();}
  await assert.rejects(preparePreviewTravel({x:1,z:2}),/still preparing/);
});
