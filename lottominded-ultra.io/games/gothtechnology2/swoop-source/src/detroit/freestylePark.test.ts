import {test} from 'node:test';
import assert from 'node:assert/strict';
import {parkTriangles,parkLift,PARK_SPAWN,parkY} from './freestylePark.ts';
test('all park triangles face up and rideable transitions stay below a 45 degree slope',()=>{const a=parkTriangles();for(let i=0;i<a.length;i+=9){const u=[a[i+3]-a[i],a[i+4]-a[i+1],a[i+5]-a[i+2]],v=[a[i+6]-a[i],a[i+7]-a[i+1],a[i+8]-a[i+2]],n=[u[1]*v[2]-u[2]*v[1],u[2]*v[0]-u[0]*v[2],u[0]*v[1]-u[1]*v[0]];assert.ok(n[1]>0);assert.ok(n[1]/Math.hypot(...n)>.70);}});
test('spawn is on the yard and bowl has a low flat bottom with a higher lip',()=>{assert.ok(Number.isFinite(parkY(PARK_SPAWN.x,PARK_SPAWN.z)));assert.ok(parkLift(20,13)<.01);assert.ok(parkLift(33,13)>3);});

test('park arrival is outside the pump slope so the rider can stop and switch boards',()=>{assert.equal(parkLift(PARK_SPAWN.x-2780,PARK_SPAWN.z+1465),0);});
