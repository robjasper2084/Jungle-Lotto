import {test} from 'node:test';
import assert from 'node:assert/strict';
import {BicycleAdapter} from './bicycleAdapter.ts';
import {NEUTRAL_ACTIONS} from './controller.ts';
import type {TerrainSampler} from './terrain.ts';
const flat:TerrainSampler={sampleGround(_x,_z,out){Object.assign(out,{height:0,surface:'pavement',offCourse:false,normal:{x:0,y:1,z:0}});return out;},raycast:()=>null,raycastObstacle:()=>null};
test('bicycle recovery uses current bike location and preserves distance',()=>{const b=new BicycleAdapter(flat);b.cycling=true;b.reset({position:{x:0,y:0,z:0},headingY:0});for(let i=0;i<1200;i++)b.step(1/120,{...NEUTRAL_ACTIONS,throttle:1});const before={...b.bicycle.cycle},distance=b.bicycle.travel;assert.ok(before.z>20);assert.equal(b.recover(),true);assert.ok(Math.hypot(b.bicycle.cycle.x-before.x,b.bicycle.cycle.z-before.z)<.01);assert.equal(b.bicycle.cycle.speed,0);assert.equal(b.bicycle.travel,distance);});
test('occupied recovery does not move the bicycle',()=>{const b=new BicycleAdapter({...flat,mountedClear:()=>false});b.cycling=true;const before={...b.bicycle.cycle};assert.equal(b.recover(),false);assert.deepEqual(b.bicycle.cycle,before);});
