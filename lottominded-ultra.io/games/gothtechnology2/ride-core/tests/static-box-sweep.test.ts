import {test} from 'node:test';import assert from 'node:assert/strict';import {staticBoxSweep} from '../src/staticBoxSweep.ts';
const box={x:0,y:0,z:0,hx:1,hy:1,hz:1,yaw:0,kind:'test'};
test('props stop a whole projectile segment and preserve sphere corner clearance',()=>{assert.equal(staticBoxSweep({x:-5,y:0,z:0},{x:10,y:0,z:0},0,box),.4);assert.equal(staticBoxSweep({x:-5,y:0,z:0},{x:10,y:0,z:0},.5,box),.35);assert.equal(staticBoxSweep({x:-5,y:1.49,z:1.49},{x:10,y:0,z:0},.5,box),null);assert.equal(staticBoxSweep({x:0,y:0,z:0},{x:10,y:0,z:0},.5,box),0);});
test('rotated truck/contact queries retain world metre scale',()=>{const b={...box,x:100,z:200,hx:1,hz:3,yaw:Math.PI/2};assert.ok(Math.abs(staticBoxSweep({x:90,y:0,z:200},{x:20,y:0,z:0},.2,b)!-.34)<1e-8);});
test('a body can separate from an initial prop contact while inward movement and shots stay blocked',()=>{
 const p={x:1.2,y:0,z:0},out={x:2,y:0,z:0},inside={x:-2,y:0,z:0};
 assert.equal(staticBoxSweep(p,out,.3,box,true),null);
 assert.equal(staticBoxSweep(p,inside,.3,box,true),0);
 assert.equal(staticBoxSweep(p,out,.3,box),0);
 assert.equal(staticBoxSweep({x:.99,y:0,z:0},out,.3,box,true),null);
 assert.equal(staticBoxSweep({x:.99,y:0,z:0},inside,.3,box,true),0);
 const corner={x:1.2,y:0,z:1.2};
 assert.equal(staticBoxSweep(corner,{x:1,y:0,z:1},.3,box,true),null);
 assert.equal(staticBoxSweep(corner,{x:-1,y:0,z:-1},.3,box,true),0);
 const rotated={...box,yaw:Math.PI/2,hx:2};
 assert.equal(staticBoxSweep({x:1.2,y:0,z:0},out,.3,rotated,true),null);
 assert.equal(staticBoxSweep({x:1.2,y:0,z:0},inside,.3,rotated,true),0);
});
