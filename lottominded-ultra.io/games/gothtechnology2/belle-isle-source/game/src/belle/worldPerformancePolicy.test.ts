import test from 'node:test';
import assert from 'node:assert/strict';
import {WorldFrameWork,coopMappedShadows,directionalCasterEligible,directionalShadowResolution,softwareWebGLRenderer,ShadowMapCadence,ScenePreparationQueue,deferredSceneryRadius} from './worldPerformancePolicy.ts';

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

test('a slow view gets a color-only frame between shadow updates',()=>{
 const cadence=new ShadowMapCadence();
 assert.equal(cadence.shouldRefresh(0,310,560),true);
 assert.equal(cadence.shouldRefresh(.15,311,562),false);
 assert.equal(cadence.shouldRefresh(.15,311,562),false,'a second view is the same simulation frame');
 assert.equal(cadence.shouldRefresh(.30,312,564),true);
 assert.equal(cadence.shouldRefresh(.31,433,773),true,'a new location needs its shadow map immediately');
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

test('optional scene preparation serializes texture and shader GPU work without omitting nearby assets',async()=>{
 const lane=new ScenePreparationQueue();let active=0,maximum=0;
 const order:string[]=[];let release!:(value?:void)=>void;
 const hold=new Promise<void>(resolve=>{release=resolve;});
 const first=lane.run(async()=>{active++;maximum=Math.max(maximum,active);order.push('yacht-start');await hold;active--;order.push('yacht-done');return 1;});
 const second=lane.run(async()=>{active++;maximum=Math.max(maximum,active);order.push('golf');active--;return 2;});
 const third=lane.run(async()=>{active++;maximum=Math.max(maximum,active);order.push('playgrounds');active--;return 3;});
 await Promise.resolve();
 assert.deepEqual(order,['yacht-start']);
 release();
 assert.deepEqual(await Promise.all([first,second,third]),[1,2,3]);
 assert.equal(maximum,1);
 assert.deepEqual(order,['yacht-start','yacht-done','golf','playgrounds']);
});

test('failed optional preparation leaves the lane available for subsequent scenery',async()=>{
 const lane=new ScenePreparationQueue();
 await assert.rejects(lane.run(async()=>{throw Error('optional mesh unavailable');}),/optional mesh unavailable/);
 assert.equal(await lane.run(async()=>42),42);
});

test('software prefetch keeps all visible scenery while avoiding unnecessary Covered Bridge warmups',()=>{
 assert.equal(deferredSceneryRadius(700,1000,false,20),1000,'native GPU preserves golf prefetch');
 assert.equal(deferredSceneryRadius(420,760,false,100),760,'native GPU preserves playground prefetch');
 const golf=deferredSceneryRadius(700,1000,true,20);
 const play=deferredSceneryRadius(420,760,true,100);
 assert.equal(golf,720);
 assert.equal(play,520);
 assert.ok(golf>700&&play>420,'software detail is prepared before it becomes visible');
 // Mapped Covered Bridge (2475.1,22.35) must not trigger distant optional
 // golf (3199.19,-67.75) and Oakway playground (3016,-126) shader warmups.
 assert.ok(Math.hypot(3199.191677670181-2475.1,-67.74931744497917-22.35)>golf);
 assert.ok(Math.hypot(3016-2475.1,-126-22.35)>play);
});
