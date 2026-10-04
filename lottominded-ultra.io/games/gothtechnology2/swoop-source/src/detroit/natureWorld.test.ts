import {test} from 'node:test';
import assert from 'node:assert/strict';
import {birdFlight} from './natureWorld.ts';
import {zoneLevel} from './natureAudio.ts';
import {fallPosture} from './fallPosture.ts';
test('songbird flight closes at its perch and eases takeoff and landing',()=>{
 const first=birdFlight(12.0001,0),last=birdFlight(24.9999,0);
 for(const p of [first,last])assert.ok(Math.hypot(p.x,p.z,p.lift)<.001);
 let previous=birdFlight(0,1);
 for(let i=1;i<9000;i++){const p=birdFlight(i/120,1);assert.ok(Object.values(p).every(v=>typeof v==='boolean'||Number.isFinite(v)));assert.ok(Math.hypot(p.x-previous.x,p.z-previous.z,p.lift-previous.lift)<.07);previous=p;}
});
test('fleeing bird lifts from the perch and returns without a position jump',()=>{
 for(const t of [0,7]){const p=birdFlight(t,0,7);assert.ok(Math.hypot(p.x,p.z,p.lift)<1e-7);}
 const away=birdFlight(3.5,0,7);assert.ok(away.lift>2.9);assert.ok(away.z>7.9);
});
test('water and birdsong gains are bounded, fade to zero outside the zone and use nearest source',()=>{
 const z={file:'creek.mp3',points:[{x:0,z:0},{x:100,z:0}],radius:24,volume:.4};
 assert.equal(zoneLevel(z,{x:0,z:0}),.4);assert.equal(zoneLevel(z,{x:12,z:0}),.1);assert.equal(zoneLevel(z,{x:24,z:0}),0);assert.equal(zoneLevel(z,{x:100,z:0}),.4);
 assert.equal(zoneLevel({...z,points:[]},{x:0,z:0}),0);
});
test('Blender reach and impact channels are continuous rather than binary switches',()=>{
 let previous=fallPosture(0,.5);
 for(let frame=1;frame<300;frame++){
  const p=fallPosture(frame/120,.5);
  for(const k of ['reach','absorb','curl','headTuck','stagger'] as const){assert.ok(p[k]>=0&&p[k]<=1);assert.ok(Math.abs(p[k]-previous[k])<.15,`${k} snaps at ${frame}`);}
  previous=p;
 }
 assert.ok(fallPosture(.12,.5).reach>.5&&fallPosture(.12,.5).reach<1);
 assert.ok(fallPosture(.5,.5).absorb>.5&&fallPosture(.5,.5).absorb<1);
});
