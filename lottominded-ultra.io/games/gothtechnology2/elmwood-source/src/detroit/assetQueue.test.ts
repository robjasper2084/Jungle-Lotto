import test from 'node:test';
import assert from 'node:assert/strict';
import {loadAssetQueue} from './assetQueue.ts';

test('a free download slot starts the next asset while another download is still pending',async()=>{
  let releaseSlow!:()=>void;
  const slow=new Promise<void>(resolve=>releaseSlow=resolve),started:number[]=[];
  const result=loadAssetQueue([0,1,2,3],2,async id=>{started.push(id);if(id===0)await slow;return id*2;});
  await new Promise(resolve=>setImmediate(resolve));
  assert.deepEqual(started,[0,1,2,3]);releaseSlow();
  assert.deepEqual(await result,[0,2,4,6]);
});
test('decode concurrency stays within the requested device budget',async()=>{
  let active=0,peak=0;
  await loadAssetQueue(Array.from({length:19},(_,i)=>i),3,async id=>{
    active++;peak=Math.max(peak,active);await new Promise(resolve=>setImmediate(resolve));active--;return id;
  });
  assert.equal(peak,3);assert.equal(active,0);
});
test('failures reach boot recovery and stop scheduling new downloads',async()=>{
  const started:number[]=[];
  await assert.rejects(loadAssetQueue([0,1,2],1,async id=>{started.push(id);throw new Error('missing model');}),/missing model/);
  assert.deepEqual(started,[0]);
  assert.deepEqual(await loadAssetQueue([],2,async id=>id),[]);
});
