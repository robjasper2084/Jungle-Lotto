import test from 'node:test';import assert from 'node:assert/strict';
import {presentationBudget,tracedSkyEnabled,fogColumn,reflectionRequired,aircraftFrame,RIDER_CLIPS,sampleRiderClip,articulateEuc,windMask,type EucMotion} from './presentationPolicy.ts';
import {atmosphereShader,windVertex,HEIGHT_FOG} from './atmosphereShaders.ts';
const motion=():EucMotion=>({pitch:.12,drop:.1,shift:0,lateral:0,hipTilt:0,hipYaw:0,chestRoll:0,chestYaw:0,headRoll:0,headYaw:0,neck:0,shoulders:[0,0],hands:[{x:.05,y:.1,z:.1,wrist:0},{x:-.05,y:.1,z:.1,wrist:0}]});
test('Smooth and XR bound optional rendering',()=>{for(const budget of [presentationBudget('smooth'),presentationBudget('high',true)]){assert.equal(budget.aircraft,false);assert.equal(budget.reflectionSize,32);assert.ok(budget.cloudStrength<=.1);}assert.ok(presentationBudget('high').reflectionSize<=128);});
test('sea-level fog retains original density',()=>assert.equal(fogColumn(0,0),1));
test('elevated view rays have less haze but retain distant air',()=>{assert.ok(fogColumn(500,500)<fogColumn(20,20));assert.ok(fogColumn(10000,10000)>=.24);});
test('fog is symmetric along a ray and finite for bad heights',()=>{assert.equal(fogColumn(20,400),fogColumn(400,20));for(const a of [NaN,Infinity,-50,0,500])assert.ok(Number.isFinite(fogColumn(a,200)));});
test('reflections avoid startup and frame-by-frame rebuilds',()=>{assert.equal(reflectionRequired(1,-Infinity,12,0,.5,0,45),false);assert.equal(reflectionRequired(2,-Infinity,12,0,.5,0,45),true);for(let i=3;i<47;i++)assert.equal(reflectionRequired(i,2,14,12,.9,.5,45),false);});
test('reflections react to time and cloud changes at bounded cadence',()=>{assert.equal(reflectionRequired(48,2,12.3,12,.5,.5,45),true);assert.equal(reflectionRequired(48,2,12,12,.6,.5,45),true);assert.equal(reflectionRequired(48,2,12,12,.5,.5,45),false);assert.equal(reflectionRequired(138,2,12,12,.5,.5,45),true);});
test('clock wrap does not force repeated reflection captures',()=>assert.equal(reflectionRequired(48,2,.01,23.99,.5,.5,45),false));
test('aircraft has an invisible loop transition and bounded route',()=>{for(const t of [0,44,45,135,239,240,NaN])assert.equal(aircraftFrame(t).visible,false);for(let t=46;t<135;t++){const f=aircraftFrame(t);assert.ok(f.y>=1800&&f.fade>=0&&f.fade<=1);assert.ok(Number.isFinite(f.x)&&Number.isFinite(f.z));}});
test('aircraft paths are independent of render rate',()=>assert.deepEqual(aircraftFrame(70),aircraftFrame(70)));
test('idle response clip loops continuously',()=>{assert.ok(Math.abs(sampleRiderClip('idle',0,true)-sampleRiderClip('idle',RIDER_CLIPS.idle.duration,true))<1e-10);});
for(const name of ['acceleration','braking','landing'] as const)test(name+' response is bounded and settled at both ends',()=>{assert.equal(sampleRiderClip(name,0),0);assert.equal(sampleRiderClip(name,10),0);for(let i=0;i<100;i++)assert.ok(Math.abs(sampleRiderClip(name,i/100))<=1);});
test('cruising tuck and knee compression are more readable',()=>{const a=motion();articulateEuc(a,{speed:20},0,false);assert.ok(a.pitch>.16);assert.ok(a.drop>.11);});
test('EUC hand balance is asymmetric in a carve',()=>{const a=motion();articulateEuc(a,{speed:12,rollAngle:.35,turnIntent:1},0,false);assert.ok(Math.abs(a.hands[1].x+.05)>Math.abs(a.hands[0].x-.05));assert.ok(a.chestYaw<0&&a.headYaw<a.chestYaw);});
test('left and right turn responses mirror',()=>{const a=motion(),b=motion();articulateEuc(a,{speed:12,rollAngle:.3,turnIntent:1},0,false);articulateEuc(b,{speed:12,rollAngle:-.3,turnIntent:-1},0,false);assert.equal(a.chestYaw,-b.chestYaw);assert.equal(a.lateral,-b.lateral);});
test('landing adds bounded knee absorption',()=>{const a=motion();articulateEuc(a,{speed:5,landingCompression:1},0,false);assert.ok(a.drop>.12&&a.drop<=.15);});
for(const state of [{footMode:2},{footBlend:.5},{crashBlend:.1},{stopFoot:.1},{seated:.2}])test('on-foot/crash/foot-plant stance is not overridden '+JSON.stringify(state),()=>{const a=motion(),before=structuredClone(a);articulateEuc(a,{speed:20,...state},2,false);assert.deepEqual(a,before);});
test('reduced motion removes all added rider detail',()=>{const a=motion(),before=structuredClone(a);articulateEuc(a,{speed:20},2,true);assert.deepEqual(a,before);});
test('paused same-clock poses match exactly',()=>{const a=motion(),b=motion();articulateEuc(a,{speed:0},2,false);articulateEuc(b,{speed:0},2,false);assert.deepEqual(a,b);});
test('measured pose is never mutated',()=>{const p=Object.freeze({speed:12,turnIntent:1,rollAngle:.3});articulateEuc(motion(),p,1,false);assert.deepEqual(p,{speed:12,turnIntent:1,rollAngle:.3});});
test('invalid speed makes no invented motion',()=>{const a=motion(),before=structuredClone(a);articulateEuc(a,{speed:NaN},0,false);assert.deepEqual(a,before);});
test('wind anchors the garment top and frees only its lower region',()=>{assert.equal(windMask(1,0,1),0);assert.equal(windMask(2,0,1),0);assert.equal(windMask(0,0,1),1);assert.ok(windMask(.5,0,1)>0&&windMask(.5,0,1)<1);});
test('cloud shader affects directional light without dimming emission or point lights',()=>{const begin='getPointLightInfo( pointLight, geometryPosition, directLight );\ngetDirectionalLightInfo( directionalLight, directLight );';const result=atmosphereShader('#include <worldpos_vertex>','#include <lights_fragment_begin>\n#include <fog_fragment>',begin);assert.ok(result.applied);assert.match(result.fragment,/getDirectionalLightInfo[\s\S]*directLight.color\*=belleCloudShade/);assert.match(result.fragment,/getPointLightInfo\( pointLight, geometryPosition, directLight \);\ngetDirectional/);assert.ok(!result.fragment.includes('totalEmissiveRadiance*='));});
test('height fog retains the normal linear-fog fallback',()=>{assert.match(HEIGHT_FOG,/FOG_EXP2/);assert.match(HEIGHT_FOG,/smoothstep\(fogNear,fogFar,vFogDepth\)/);});
test('world projection supports instanced and batched meshes',()=>{const s=atmosphereShader('#include <worldpos_vertex>','#include <fog_fragment>');assert.match(s.vertex,/instanceMatrix\*belleWorld/);assert.match(s.vertex,/batchingMatrix\*belleWorld/);});
test('unknown custom shaders are not rewritten',()=>{const s=atmosphereShader('void main(){}','void main(){}');assert.equal(s.applied,false);assert.equal(s.fragment,'void main(){}');});
test('wind happens before skinning and is available to depth passes',()=>{const s=windVertex('#include <begin_vertex>\n#include <skinning_vertex>');assert.ok(s.indexOf('transformed.x+=')<s.indexOf('#include <skinning_vertex>'));assert.ok(!s.includes('objectNormal'));});

test('Smooth renders the layered sky without submitting GPU-heavy traced panoramas',()=>{
 assert.equal(tracedSkyEnabled(true,'smooth'),false);
 assert.equal(tracedSkyEnabled(false,'smooth'),false);
 for(const mode of ['automatic','high']){
  assert.equal(tracedSkyEnabled(true,mode),true);
  assert.equal(tracedSkyEnabled(false,mode),false);
 }
});
