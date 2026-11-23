import test from 'node:test';
import assert from 'node:assert/strict';
import {retrySurfaceTexture} from './surfaceRetry.ts';
test('transient asset failures retry only twice and never invent placeholder bytes',async()=>{
 const attempts:number[]=[];
 const value=await retrySurfaceTexture(async attempt=>{attempts.push(attempt);
  if(attempt<2)throw Error('HTTP 503');return 'exact-original-texture';},new AbortController().signal,async()=>{});
 assert.equal(value,'exact-original-texture');assert.deepEqual(attempts,[0,1,2]);
});
test('persistent failure remains fatal and cannot mark asset boot ready',async()=>{
 const attempts:number[]=[];
 await assert.rejects(retrySurfaceTexture(async a=>{attempts.push(a);throw Error('unavailable');},
  new AbortController().signal,async()=>{}),/unavailable/);
 assert.deepEqual(attempts,[0,1,2]);
});
test('cancelled startup does not retry a failed resource',async()=>{
 const ctl=new AbortController();let attempts=0;
 await assert.rejects(retrySurfaceTexture(async()=>{attempts++;ctl.abort(Error('cancelled'));throw Error('network');},ctl.signal,async()=>{}),/cancelled/);
 assert.equal(attempts,1);
});
