import test from 'node:test';import assert from 'node:assert/strict';
import {createPose} from '../src/controller.ts';import {RideGhostTrack,readGhost,sampleGhost} from '../src/rideGhost.ts';
for(const map of ['swoop-detroit','elmwood-explorer','static-royale-downtown'])test(map+' saved ghost retains riding, walking and parked wheel state',()=>{
 const track=new RideGhostTrack();track.step(.1,{...createPose(),headingY:Math.PI-.1,x:1});track.step(.1,{...createPose(),headingY:-Math.PI+.1,x:3});track.step(.1,{...createPose(),x:4,footMode:2,footBlend:1,parkX:3});
 const run=readGhost(JSON.stringify(track.finish(map,'woman:euc')),map)!;assert(run);assert.equal(readGhost(JSON.stringify(run),'different-map'),undefined);
 const p=sampleGhost(run,.15,createPose());assert(Math.abs(p.x-2)<1e-8);assert(Math.abs(p.headingY-Math.PI)<.0001);
 assert.equal(sampleGhost(run,.3,createPose()).footMode,2);assert.equal(sampleGhost(run,.3,createPose()).parkX,3);
 assert.equal(readGhost(JSON.stringify({...run,frames:[[0,NaN]]}),map),undefined);
});
test('ghost recordings are bounded and do not mutate live poses',()=>{
 const t=new RideGhostTrack(),pose=createPose(),original={...pose};for(let i=0;i<90000;i++)t.step(1/60,pose);assert(t.frames.length<=1202);assert(t.time<=120);assert.deepEqual(pose,original);
});
