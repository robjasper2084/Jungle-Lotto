import test from 'node:test';
import assert from 'node:assert/strict';
import {WorldFrameWork,coopMappedShadows,directionalCasterEligible,directionalShadowResolution} from './worldPerformancePolicy.ts';

test('high and automatic preserve nearby landmark shadows but reject distant casters',()=>{
 assert.equal(directionalShadowResolution('high'),1536);
 assert.equal(directionalShadowResolution('automatic'),1024);
 assert.equal(directionalShadowResolution('smooth'),1024);
 assert.equal(directionalCasterEligible('high',90,0,true),true);
 assert.equal(directionalCasterEligible('high',111,0,true),false);
 assert.equal(directionalCasterEligible('automatic',95,0,true),false);
 assert.equal(directionalCasterEligible('high',123,15,true),true);
 assert.equal(directionalCasterEligible('high',4,0,false),false);
 assert.equal(directionalCasterEligible('smooth',4,0,true),false);
 assert.equal(directionalCasterEligible('high',Infinity,3,true),false);
});

test('world clock work runs once per simulation frame, not once per co-op view',()=>{
 const gate=new WorldFrameWork();
 assert.equal(gate.begin(10),true);
 assert.equal(gate.begin(10),false);
 assert.equal(gate.begin(10),false);
 assert.equal(gate.begin(10.016),true);
 assert.equal(gate.begin(10.016),false);
 gate.reset();
 assert.equal(gate.begin(10.016),true);
});

test('co-op keeps desktop two-player mapped shadows but uses contact shadows on phones and multi-pane',()=>{
 assert.equal(coopMappedShadows(2,false),true);
 assert.equal(coopMappedShadows(2,true),false);
 assert.equal(coopMappedShadows(3,false),false);
 assert.equal(coopMappedShadows(4,false),false);
});
