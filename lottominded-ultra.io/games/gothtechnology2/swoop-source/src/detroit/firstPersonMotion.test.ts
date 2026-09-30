import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createPose} from './controller.ts';
import {firstPersonMotion} from './firstPersonMotion.ts';
test('first-person follows physical lean and landing without idle shake',()=>{const p=createPose();const idle=firstPersonMotion(p);assert.equal(Math.abs(idle.pitch)+Math.abs(idle.roll),0);p.rollAngle=.2;p.riderPitch=.1;p.landingCompression=.5;const m=firstPersonMotion(p);assert.ok(m.roll<-.1);assert.ok(m.pitch<-.08);assert.ok(Math.abs(firstPersonMotion(p,true).roll)<Math.abs(m.roll));});
test('first-person motion remains bounded at extreme poses',()=>{const p=createPose();p.rollAngle=5;p.riderPitch=-4;const m=firstPersonMotion(p);assert.ok(Math.abs(m.roll)<=.28);assert.ok(Math.abs(m.pitch)<=.22);});
