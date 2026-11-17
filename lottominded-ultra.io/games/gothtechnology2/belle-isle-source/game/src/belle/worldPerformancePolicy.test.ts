import test from 'node:test';
import assert from 'node:assert/strict';
import {WorldFrameWork,coopMappedShadows,directionalCasterEligible,directionalShadowResolution,softwareWebGLRenderer,ShadowMapCadence} from './worldPerformancePolicy.ts';

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

test('shadow cadence preserves full-resolution first refresh and skips redundant GPU submissions',()=>{
 const cadence=new ShadowMapCadence();
 assert.equal(cadence.shouldRefresh(0),true,'first render must populate the full shadow map');
 assert.equal(cadence.shouldRefresh(.016),false);
 assert.equal(cadence.shouldRefresh(.090),false);
 assert.equal(cadence.shouldRefresh(.11),true,'unchanged shadows refresh after a bounded interval');
 assert.equal(cadence.shouldRefresh(.17),false);
 assert.equal(cadence.shouldRefresh(.25),true);
 cadence.reset();
 assert.equal(cadence.shouldRefresh(.26),true,'quality or sky changes refresh immediately');
 assert.equal(cadence.shouldRefresh(.01),true,'clock rewinds must also refresh');
 assert.equal(cadence.shouldRefresh(NaN),true,'invalid frame time must never hide shadows');
});


test('software WebGL retains real mapped shadows with smaller GPU submissions, while physical hardware keeps quality maps',()=>{
 assert.equal(softwareWebGLRenderer('ANGLE (Google, Vulkan SwiftShader Device (Subzero))'),true);
 assert.equal(softwareWebGLRenderer('Mesa llvmpipe (LLVM 19)'),true);
 assert.equal(softwareWebGLRenderer('NVIDIA GeForce RTX 4070'),false);
 for(const mode of ['high','automatic'] as const){
  assert.equal(directionalShadowResolution(mode,true),768);
  assert.equal(directionalShadowResolution(mode,false),mode==='high'?1536:1024);
 }
 assert.equal(directionalShadowResolution('smooth',true),1024);
});
