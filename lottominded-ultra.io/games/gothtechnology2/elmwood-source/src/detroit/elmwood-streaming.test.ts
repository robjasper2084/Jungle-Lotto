import test from 'node:test';import assert from 'node:assert/strict';import {SpatialAssetStream} from './spatialAssetStream.ts';
const tick=()=>new Promise<void>(resolve=>setImmediate(resolve));
test('starting area loads without downloading distant art, then follows the player',async()=>{
 const seen:string[]=[],stream=new SpatialAssetStream(1);
 for(const [id,x]of [['start',0],['middle',500],['shop',2000]] as const)stream.add({id,centers:[{x,z:0}],load:async()=>{seen.push(id);}});
 await stream.warm([{x:0,z:0}],150);assert.deepEqual(seen,['start']);assert.equal(stream.status.deferred,2);
 stream.update([{x:1900,z:0}],200);await tick();assert.deepEqual(seen,['start','shop']);assert.equal(stream.status.loaded,2);
});
test('nearest pending work wins and outstanding requests stay bounded after teleporting',async()=>{
 const releases:(()=>void)[]=[],seen:string[]=[],stream=new SpatialAssetStream(1);
 for(const [id,x]of [['far',80],['near',5],['next',2000]] as const)stream.add({id,centers:[{x,z:0}],load:()=>new Promise<void>(resolve=>{seen.push(id);releases.push(resolve);})});
 stream.update([{x:0,z:0}],100);await tick();assert.deepEqual(seen,['near']);assert.equal(stream.status.loading,1);
 stream.update([{x:2000,z:0}],100);releases.shift()!();await tick();assert.deepEqual(seen,['near','next']);releases.shift()!();await tick();assert.equal(stream.status.deferred,1);
});
test('explicit visits share an outstanding request; failures remain retryable',async()=>{
 let attempts=0;const stream=new SpatialAssetStream();stream.add({id:'gallery',centers:[{x:2000,z:0}],load:async()=>{if(++attempts===1)throw Error('offline');}});
 await assert.rejects(stream.ensure('gallery'),/offline/);assert.equal(stream.status.errors,1);
 await Promise.all([stream.ensure('gallery'),stream.ensure('gallery')]);assert.equal(attempts,2);assert.equal(stream.status.loaded,1);
});
test('all split-screen players and multiple sites can request the same asset once',async()=>{
 let count=0;const stream=new SpatialAssetStream();stream.add({id:'trees',centers:[{x:0,z:0},{x:1000,z:0}],load:async()=>{count++;}});
 stream.update([{x:500,z:0},{x:1100,z:0}],150);await tick();assert.equal(count,1);stream.update([{x:0,z:0}],150);await tick();assert.equal(count,1);
});
