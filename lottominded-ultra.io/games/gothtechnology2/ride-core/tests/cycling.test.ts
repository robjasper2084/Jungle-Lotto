import {test} from 'node:test';
import assert from 'node:assert/strict';
import {BicycleController,BICYCLE} from '../src/bicycle.ts';
import {NEUTRAL_ACTIONS} from '../src/controller.ts';
import {CommunityRide,LaneRoute} from '../src/communityRide.ts';
import type {TerrainSampler} from '../src/terrain.ts';
const flat:TerrainSampler={sampleGround(_x,_z,out){Object.assign(out,{height:0,surface:'pavement',offCourse:false,normal:{x:0,y:1,z:0}});return out;},raycast:()=>null,raycastObstacle:()=>null};
const step=(b:BicycleController,seconds:number,input={})=>{for(let i=0;i<seconds*120;i++)b.step(1/120,{...NEUTRAL_ACTIONS,...input});};
test('bicycle pedals, coasts without crank motion and brakes to a full stop before reverse',()=>{const b=new BicycleController(flat);step(b,3,{throttle:1});assert.ok(b.cycle.speed>4);const speed=b.cycle.speed,phase=b.pedalPhase,wheel=b.cycle.wheelSpin;step(b,1);assert.ok(b.cycle.speed>0&&b.cycle.speed<speed);assert.equal(b.pedalPhase,phase);assert.ok(b.cycle.wheelSpin>wheel);while(b.cycle.speed>0)b.step(1/120,{...NEUTRAL_ACTIONS,throttle:-1});step(b,.15,{throttle:-1});assert.equal(b.cycle.speed,0);assert.equal(b.snapshot().hops,0);});
test('holding back walks a bicycle in reverse, steering and checking the rear wheel',()=>{
 const b=new BicycleController(flat);step(b,2,{throttle:-1,steer:1});assert.ok(b.cycle.speed<-.9&&b.cycle.speed>=-BICYCLE.reverseSpeed);assert.ok(b.cycle.z<-.7&&b.cycle.headingY>0);assert.equal(b.pedalPhase,0);assert.ok(b.cycle.stopFoot>.95);assert.equal(b.snapshot().state,'reversing');step(b,1);assert.equal(b.cycle.speed,0);step(b,2,{throttle:1});assert.ok(b.cycle.speed>1);
 const c=new BicycleController({...flat,raycastObstacle:(_o,d)=>d.z<0?.2:null});step(c,2,{throttle:-1});assert.equal(c.cycle.z,0);assert.ok(c.blocked);
 const d=new BicycleController({...flat,navigationObstacles:()=>[{id:'crowd',x:0,y:0,z:.5,radius:.4,height:1.8,kind:'cyclist',vx:0,vz:0}]});step(d,2,{throttle:-1});assert.ok(d.cycle.z<-.7,'can back out of an existing overlap');
});
test('two ground contacts set pitch and right input steers right without EUC hops',()=>{const b=new BicycleController({...flat,sampleGround(x,z,out){flat.sampleGround(x,z,out);out.height=z*.1;return out;}});assert.ok(Math.abs(b.cycle.groundPitch+Math.atan(.1))<.001);step(b,2,{throttle:1,steer:1,hop:true,trick:1});assert.ok(b.cycle.headingY<0);assert.equal(b.cycle.airHeight,0);assert.equal(b.tricks.active,false);});
test('front sweep and people stop the bicycle; invalid input stays finite',()=>{const b=new BicycleController({...flat,raycastObstacle:()=>.25});step(b,2,{throttle:1});assert.equal(b.cycle.z,0);assert.equal(b.blocked,true);b.step(1/120,{...NEUTRAL_ACTIONS,steer:NaN,throttle:NaN});assert.ok(Number.isFinite(b.cycle.headingY));const c=new BicycleController({...flat,navigationObstacles:()=>[{id:'dog',x:0,y:0,z:1,radius:.35,height:1,kind:'dog',vx:0,vz:0}]});step(c,2,{throttle:1});assert.equal(c.cycle.z,0);});
test('wheel rotation tracks distance, recovery clears velocity',()=>{const b=new BicycleController(flat);step(b,2,{throttle:1});assert.ok(Math.abs(b.cycle.wheelSpin*BICYCLE.radius-b.travel)<1e-8);b.recoverBike();assert.equal(b.cycle.speed,0);assert.equal(b.travel,0);});
test('roadside geometry uses its physical sweep instead of a broad circular navigation margin',()=>{
 const wall={id:'long-wall',x:4,y:0,z:8,radius:10,height:3,kind:'wall',vx:0,vz:0,raycastSolid:true};
 const terrain={...flat,navigationObstacles:()=>[wall]};const b=new BicycleController(terrain);step(b,4,{throttle:1});assert.ok(b.travel>12,'clear pavement remains rideable beside a long wall');
 const c=new BicycleController({...terrain,raycastObstacle:()=>.2});step(c,1,{throttle:1});assert.equal(c.travel,0,'the same wall remains solid when its physical shape intersects the sweep');
});
test('a stopped bicycle holds on a hill until the rider pedals',()=>{const b=new BicycleController({...flat,sampleGround(x,z,out){flat.sampleGround(x,z,out);out.height=-z*.15;return out;}});step(b,12);assert.equal(b.cycle.speed,0);assert.equal(b.cycle.z,0);step(b,2,{throttle:1});assert.ok(b.cycle.speed>0);assert.ok(b.cycle.z>0);});
test('clipped routes keep original corners and offsets remain in corridor',()=>{const r=new LaneRoute([{x:0,z:0,width:3},{x:0,z:10,width:3},{x:10,z:10,width:3}]).section(3,16);assert.deepEqual(r.points[1],{x:0,z:10,width:3});assert.equal(r.length,13);assert.equal(r.at(2,100).x,1);});
const lane=()=>new LaneRoute([{x:0,z:0,width:4},{x:0,z:150,width:4}]);
test('join distance, pause, leave, rejoin and cancel preserve lifecycle',()=>{const r=new CommunityRide(lane(),flat);assert.equal(r.join({x:50,z:50}),false);assert.equal(r.join({x:-.8,z:0}),true);r.step(1,{x:-.8,y:0,z:0,speed:0},[],true);assert.equal(r.timer,5);r.continue();r.step(.05,{x:-.8,y:0,z:0,speed:0});assert.equal(r.stage,'riding');r.leave();assert.equal(r.joined,false);assert.equal(r.join({x:-.8,z:0}),true);assert.equal(r.eligible,false);r.cancel();const s=r.riders[0].s;r.step(1,{x:0,y:0,z:0,speed:0});assert.equal(r.riders[0].s,s);r.restart();assert.equal(r.stage,'assembling');});
test('full ordered ride completes once; a teleport cannot earn completion',()=>{for(const teleport of [false,true]){const r=new CommunityRide(lane(),flat),p={x:-.85,y:0,z:0,speed:3.3};r.join(p);r.continue();for(let i=0;i<14000&&r.stage!=='complete';i++){if(r.stage==='regroup')r.continue();p.z=Math.min(149,p.z+3.3/60);if(teleport&&i===10)p.z=90;r.step(1/60,p);}assert.equal(r.stage,'complete');assert.equal(r.completed,!teleport);const elapsed=r.elapsed;r.step(1,p);assert.equal(r.elapsed,elapsed);}});
test('pack brakes for the player and does not advance through solid obstacles',()=>{const r=new CommunityRide(lane(),{...flat,raycastObstacle:()=>0});r.join({x:-.85,z:0});r.continue();const start=r.riders.map(r=>r.s);for(let i=0;i<200;i++)r.step(1/60,{x:-.85,y:0,z:0,speed:0});assert.deepEqual(r.riders.map(r=>r.s),start);assert.ok(r.riders.every(r=>r.blocked));});

test('pack chooses a safe passing corridor around a stationary person',()=>{
 const r=new CommunityRide(lane(),flat),person={id:'walker',x:.55,y:0,z:25,radius:.4,height:1.8,kind:'person',vx:0,vz:0};r.join({x:-.85,z:0});r.continue();
 for(let i=0;i<1800;i++){r.step(1/60,{x:-.85,y:0,z:0,speed:0},[person]);for(const cyclist of r.riders)assert.ok(Math.hypot(cyclist.x-person.x,cyclist.z-person.z)>=.99);}
 assert.ok(r.riders.at(-1)!.s>30,'whole pack passes the person');
});
test('pack waits when every passing corridor is occupied',()=>{
 const r=new CommunityRide(lane(),flat),wall={id:'crowd',x:0,y:0,z:25,radius:2,height:1.8,kind:'person',vx:0,vz:0};r.join({x:-.85,z:0});r.continue();for(let i=0;i<1800;i++)r.step(1/60,{x:-.85,y:0,z:0,speed:0},[wall]);assert.ok(r.riders[0].s<23);
});
