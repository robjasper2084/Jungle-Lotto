import {test} from 'node:test';import assert from 'node:assert/strict';import {staticBoxSweep} from '../src/staticBoxSweep.ts';
const box={x:0,y:0,z:0,hx:1,hy:1,hz:1,yaw:0,kind:'test'};
test('props stop a whole projectile segment and preserve sphere corner clearance',()=>{assert.equal(staticBoxSweep({x:-5,y:0,z:0},{x:10,y:0,z:0},0,box),.4);assert.equal(staticBoxSweep({x:-5,y:0,z:0},{x:10,y:0,z:0},.5,box),.35);assert.equal(staticBoxSweep({x:-5,y:1.49,z:1.49},{x:10,y:0,z:0},.5,box),null);assert.equal(staticBoxSweep({x:0,y:0,z:0},{x:10,y:0,z:0},.5,box),0);});
test('rotated truck/contact queries retain world metre scale',()=>{const b={...box,x:100,z:200,hx:1,hz:3,yaw:Math.PI/2};assert.ok(Math.abs(staticBoxSweep({x:90,y:0,z:200},{x:20,y:0,z:0},.2,b)!-.34)<1e-8);});
