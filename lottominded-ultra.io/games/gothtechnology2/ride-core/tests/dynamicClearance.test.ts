import test from 'node:test';import assert from 'node:assert/strict';
import {yieldToTraffic} from '../src/dynamicClearance.ts';
const body={x:0,y:0,z:0,heading:0,speed:0};
test('approaching and reversing wheels cause a lateral yield before contact',()=>{for(const sign of [-1,1]){const r=yieldToTraffic(body,[{x:0,y:0,z:-4*sign,radius:.6,vz:10*sign}],.05,()=>true);assert.ok(r);assert.ok(Math.abs(r.x)>.01);assert.ok(Math.hypot(r.x,r.z)<=.151);}});
test('moving away and different ground levels do not interrupt normal following',()=>{assert.equal(yieldToTraffic(body,[{x:0,y:0,z:3,radius:.6,vz:10}],.05,()=>true),undefined);assert.equal(yieldToTraffic(body,[{x:0,y:5,z:0,radius:.6}],.05,()=>true),undefined);});
test('coincident capsules escape continuously and never enter blocked wall space',()=>{let dog={...body};for(let i=0;i<100;i++){const r=yieldToTraffic(dog,[{x:0,y:0,z:0,radius:.6}],.02,(x,z)=>x<=.01&&z>=-.01);if(r){assert.ok(r.x<=.01&&r.z>=-.01);assert.ok(Math.hypot(r.x-dog.x,r.z-dog.z)<=.061);dog={...dog,...r};}}assert.ok(Math.hypot(dog.x,dog.z)>.95);});
test('a fully enclosed dog remains finite and does not teleport through geometry',()=>{const r=yieldToTraffic(body,[{x:0,z:0,radius:.6}],.05,()=>false);assert.deepEqual(r,{x:0,z:0,speed:0,heading:0});});
