import test from 'node:test';import assert from 'node:assert/strict';
import {presentationBudget,tracedSkyEnabled,defaultTracedSky,fogColumn,reflectionRequired,aircraftFrame,RIDER_CLIPS,sampleRiderClip,articulateEuc,windMask,type EucMotion} from './presentationPolicy.ts';
import {atmosphereShader,windVertex,HEIGHT_FOG} from './atmosphereShaders.ts';
import {Mesh,MeshStandardMaterial,Scene,ShaderChunk,ShaderLib,UniformsUtils,type WebGLRenderer} from 'three';
import {seasonalMaterial} from './seasonalMaterial.ts';
import {addStreetDetails} from './streetDetails.ts';
import {consumeAnimatedShadowUpdate,invalidateAnimatedShadow} from '../../runtime/ride-core/src/shadowBudget.ts';

test('inactive point lights skip the entire unrolled BRDF while live slots keep their shading',()=>{
 const source=ShaderChunk.lights_fragment_begin;
 const {fragment}=atmosphereShader('#include <worldpos_vertex>','#include <lights_fragment_begin>',source);
 const run=fragment.slice(fragment.indexOf('pointLight = pointLights[ i ];'),fragment.indexOf('#pragma unroll_loop_end',fragment.indexOf('pointLight = pointLights[ i ];')));
 assert.match(run,/if \(pointLight.color != vec3\(0.0\)\) \{[\s\S]*getPointLightInfo[\s\S]*getPointShadow[\s\S]*RE_Direct\([^;]+;\s*\}\s*\}/);
 assert.equal(fragment.split('RE_Direct( directLight,').length,source.split('RE_Direct( directLight,').length);
});

test('inactive spot slots skip attenuation, maps, shadows and BRDF without changing active slots',()=>{
 const source=ShaderChunk.lights_fragment_begin;
 const spotSection=(code:string)=>code.slice(code.indexOf('SpotLight spotLight;'),code.indexOf('DirectionalLight directionalLight;'));
 for(const pointPool of [false,true]){
  const {fragment}=atmosphereShader(ShaderLib.standard.vertexShader,ShaderLib.standard.fragmentShader,source,pointPool);
  const run=spotSection(fragment);
  assert.match(run,/spotLight = spotLights\[ i \];\n if \(spotLight.color != vec3\(0.0\)\) \{\s*getSpotLightInfo/);
  assert.match(run,/getSpotLightInfo[\s\S]*texture2D\( spotLightMap[\s\S]*getShadow\( spotShadowMap[\s\S]*RE_Direct\([^;]+;\n \}\s*\}\s*#pragma unroll_loop_end/);
  // Removing only the exact-zero branch must recover every original statement,
  // including Three's preprocessor branches and static shadow/map indices.
  const active=run.replace('\n if (spotLight.color != vec3(0.0)) {\n','').replace(/(RE_Direct\( directLight,[^;]+;)\n \}/,'$1');
  assert.equal(active,spotSection(source));
  assert.doesNotMatch(fragment,/if \(directionalLight.color/);
 }
 assert.equal(ShaderChunk.lights_fragment_begin,source,'composition must not mutate shared Three chunks');
});


function standardShader(material:MeshStandardMaterial){
 const standard=ShaderLib.standard;
 const shader={vertexShader:standard.vertexShader,fragmentShader:standard.fragmentShader,
  uniforms:UniformsUtils.clone(standard.uniforms)} as Parameters<typeof material.onBeforeCompile>[0];
 material.onBeforeCompile(shader,{} as WebGLRenderer);return shader;
}

test('reference tree species share shader code while retaining their own seasonal uniforms',()=>{
 const base=new MeshStandardMaterial(),month={value:10};
 for(const far of [false,true]){
  const maple=seasonalMaterial(base,true,far,false,month,true),pine=seasonalMaterial(base,true,far,true,month,true);
  const a=standardShader(maple.material),b=standardShader(pine.material);
  assert.equal(maple.material.customProgramCacheKey(),pine.material.customProgramCacheKey());
  assert.equal(a.vertexShader,b.vertexShader);assert.equal(a.fragmentShader,b.fragmentShader);
  assert.notEqual(a.uniforms.autumn,b.uniforms.autumn);maple.update();pine.update();
  assert.ok(a.uniforms.autumn.value>0);assert.equal(b.uniforms.autumn.value,0);
  for(const other of [seasonalMaterial(base,true,!far,false,month,true),seasonalMaterial(base,true,far,false,month,false)]){
   assert.notEqual(maple.material.customProgramCacheKey(),other.material.customProgramCacheKey());
   assert.notEqual(a.fragmentShader,standardShader(other.material).fragmentShader);
  }
 }
});

test('tree distance fades use the same object-space mask for both LODs',()=>{
 const source=new MeshStandardMaterial(),month={value:7};
 const near=standardShader(seasonalMaterial(source,true,false,false,month).material);
 const far=standardShader(seasonalMaterial(source,true,true,false,month).material);
 for(const shader of [near,far]){
  assert.match(shader.vertexShader,/localTreePos=position/);
  assert.match(shader.fragmentShader,/lodCell=floor\(localTreePos\*6\.0\)/);
  assert.doesNotMatch(shader.fragmentShader,/gl_FragCoord/);
 }
 assert.match(near.fragmentShader,/lodSeed>=treeWeight/);
 assert.match(far.fragmentShader,/lodSeed<1\.0-treeWeight/);
});

test('only a visible animated actor dirties its own scene shadow map once',()=>{
 const scene=new Scene(),other=new Scene(),actor=new Mesh();
 scene.add(actor);
 actor.visible=false;invalidateAnimatedShadow(actor);
 assert.equal(consumeAnimatedShadowUpdate(scene),false);
 actor.visible=true;invalidateAnimatedShadow(actor);
 assert.equal(consumeAnimatedShadowUpdate(other),false);
 assert.equal(consumeAnimatedShadowUpdate(scene),true);
 assert.equal(consumeAnimatedShadowUpdate(scene),false);
});

test('street paint and curb materials share only equivalent shaders and keep their surface values',t=>{
 const previous=Object.getOwnPropertyDescriptor(globalThis,'document');
 Object.defineProperty(globalThis,'document',{configurable:true,value:{createElement:()=>({getContext:()=>({fillRect(){}})})}});
 t.after(()=>{if(previous)Object.defineProperty(globalThis,'document',previous);else Reflect.deleteProperty(globalThis,'document');});
 const scene=new Scene(),kinds=['white','yellow','curb','gutter','metal','green','tactile'] as const;
 const boxes=kinds.map((material,x)=>({material,x,y:0,z:0,w:1,h:.1,l:1,yaw:0}));
 addStreetDetails(scene,{boxes,signs:[],stats:{},notes:[]});
 const surfaces=kinds.map(kind=>(scene.getObjectByName('Street detail 0,0,'+kind) as Mesh).material as MeshStandardMaterial);
 const shaders=surfaces.map(standardShader);
 for(const [i,first] of surfaces.entries())for(const [j,second] of surfaces.entries()){
  assert.equal(first.customProgramCacheKey(),second.customProgramCacheKey());
  assert.equal(shaders[i].vertexShader,shaders[j].vertexShader);
  assert.equal(shaders[i].fragmentShader,shaders[j].fragmentShader);
 }
 assert.deepEqual(shaders.map(shader=>shader.uniforms.streetGrime.value),[false,false,true,true,false,false,false]);
 assert.match(shaders[0].fragmentShader,/float grime=\.92\+\.08\*smoothstep\(2\.06,2\.19,detailWorld\.y\);diffuseColor\.rgb\*=streetGrime\?grime:1\.;/);
 assert.doesNotMatch(shaders[0].fragmentShader,/if\s*\(\s*streetGrime\s*\)/);
 assert.equal(new Set(shaders.map(shader=>shader.uniforms.streetGrime)).size,kinds.length);
 assert.equal(new Set(surfaces.map(m=>m.color.getHex())).size,kinds.length);
 assert.equal(surfaces[4].metalness,.5);assert.equal(surfaces[0].metalness,0);
});

test('the local point pool keeps all lights in order and preserves the stock point-shadow path',()=>{
 const chunk=ShaderChunk.lights_fragment_begin;
 const generated=(pool:boolean)=>atmosphereShader('#include <worldpos_vertex>','#include <lights_fragment_begin>',chunk,pool).fragment;
 const pointSection=(code:string)=>code.slice(code.indexOf('PointLight pointLight;'),code.indexOf('SpotLight spotLight;'));
 const pool=pointSection(generated(true)),shadowed=pointSection(generated(false));
 assert.match(pool,/for \(int i = 0; i < NUM_POINT_LIGHTS; \+\+i\)/);
 assert.match(pool,/getPointLightInfo\(pointLights\[i\], geometryPosition, directLight\);/);
 assert.match(pool,/if \(directLight.visible\) \{\s*RE_Direct\(/);
 assert.doesNotMatch(pool,/#pragma unroll_loop_start|getPointShadow\(/);
 assert.match(pool,/if \(pointLights\[i\]\.color == vec3\(0\.0\)\) continue;/);
 // Casting slots retain Three's shadow lookup and skip only black lights.
 assert.equal(shadowed.replace('\n if (pointLight.color != vec3(0.0)) {\n','').replace(/(RE_Direct\( directLight,[^;]+;)\n \}/,'$1'),pointSection(chunk));
 assert.match(generated(true),/getSpotShadow|getShadow\( spotShadowMap/);
});
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

test('nearby crown wind anchors lower foliage and supports matched shadow geometry',()=>{
 const shader=windVertex('#include <beginnormal_vertex>\n#include <begin_vertex>',true);
 assert.match(shader,/bellePin=clamp/);assert.match(shader,/belleNM=clamp/);
 assert.match(shader,/belleDX=belleWindAmount\*\(2\.0\*belleNM/);
});
test('atmospheric light shafts are limited to existing fog shading and optional quality gate',()=>{
 assert.match(HEIGHT_FOG,/belleAirStrength/);
 assert.match(HEIGHT_FOG,/belleForward/);
 assert.match(HEIGHT_FOG,/belleAerialColor/);
});

// Adaptive source policy leaves every GPU-frame/fence and screenshot assertion intact.
test('software WebGL defaults to layered clouds while respecting explicit sky selections',()=>{
 assert.equal(defaultTracedSky('ANGLE (Google, Vulkan SwiftShader Device (Subzero))',null),false);
 assert.equal(defaultTracedSky('Mesa llvmpipe (LLVM 19)',null),false);
 assert.equal(defaultTracedSky('Software Rasterizer',null),false);
 assert.equal(defaultTracedSky('NVIDIA GeForce RTX 4070',null),true);
 assert.equal(defaultTracedSky('ANGLE (Google, SwiftShader)','traced'),true);
 assert.equal(defaultTracedSky('NVIDIA GeForce RTX 4070','layered'),false);
});
