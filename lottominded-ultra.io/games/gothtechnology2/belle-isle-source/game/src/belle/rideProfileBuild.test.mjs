import test from 'node:test';
import assert from 'node:assert/strict';
import {setImmediate} from 'node:timers/promises';
import {createRideProfileBuildReader,parseRideProfileBuildMarker} from './rideProfileBuild.ts';
const marker={version:3,repository:'robjasper2084/Jungle-Lotto',pullRequest:184,commit:'813e3bd019c15920b5d450ad08c0d83ebce852b7',baseCommit:'813e3bd019c15920b5d450ad08c0d83ebce852b7',candidate:'ipad-perf-1',sourceState:'base-plus-verified-patch',patchSha256:'a'.repeat(64),buildId:'test-build',builtAt:'2026-11-19T20:00:00.000Z',indexSha256:'b'.repeat(64),profileQuery:'manual'};
test('candidate provenance retains base plus patch identity and only known fields',()=>{
 assert.deepEqual(parseRideProfileBuildMarker({...marker,localPath:'not a report field',unrelated:{secret:'not a report field'}}),marker);
 for(const field of ['baseCommit','candidate','sourceState','patchSha256']){const partial={...marker};delete partial[field];assert.equal(parseRideProfileBuildMarker(partial),null,field);}
 assert.equal(parseRideProfileBuildMarker({...marker,baseCommit:'0'.repeat(40)}),null);
 assert.equal(parseRideProfileBuildMarker({...marker,patchSha256:'missing'}),null);
 assert.equal(parseRideProfileBuildMarker({}),null);
});
test('a prior unpatched launcher marker is attributed without inventing a candidate',()=>{
 const prior={version:2,repository:marker.repository,commit:marker.commit,buildId:'previous',builtAt:marker.builtAt};
 assert.deepEqual(parseRideProfileBuildMarker(prior),prior);
});
test('build metadata is fetched once, same-origin, with explicit pending and available states',async()=>{
 let resolve,calls=0;const response=new Promise(r=>{resolve=r;});
 const read=createRideProfileBuildReader('manual',async(url,options)=>{
  calls++;assert.equal(url,'/__belle_test_build.json');assert.equal(options.credentials,'same-origin');assert.equal(options.cache,'no-store');assert.equal(options.redirect,'error');assert.ok(options.signal);return response;
 });
 assert.equal(read().status,'pending');assert.equal(read().status,'pending');assert.equal(calls,1);
 resolve(new Response(JSON.stringify(marker),{headers:{'content-type':'application/json'}}));await setImmediate();
 assert.deepEqual(read(),{status:'available',source:'same-origin build marker',marker});assert.equal(calls,1);
});
test('missing, malformed and incomplete markers remain explicitly unattributed',async()=>{
 for(const fetcher of [async()=>new Response('missing',{status:404}),async()=>new Response('<html>ordinary preview</html>'),async()=>new Response(JSON.stringify({...marker,patchSha256:''})),async()=>{throw new Error('offline');}]){
  const read=createRideProfileBuildReader('manual',fetcher);await setImmediate();assert.equal(read().status,'unavailable');assert.equal('marker' in read(),false);
 }
});

test('ordinary automated profiles never request a launcher marker',()=>{
 let calls=0;
 for(const mode of [null,'','1']){
  const read=createRideProfileBuildReader(mode,()=>{calls++;throw Error('Unexpected marker request');});
  assert.equal(read().status,'unavailable');
 }
 assert.equal(calls,0);
});
