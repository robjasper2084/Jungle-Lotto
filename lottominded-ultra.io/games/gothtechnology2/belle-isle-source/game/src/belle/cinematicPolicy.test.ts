import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {hudPreset, cockpitScale, clearanceWarning, BELLE_SUNSET, LAWN_DETAIL} from './cinematicPolicy.ts';
import {cockpitTelemetry} from './cockpitTelemetry.ts';
test('HUD presets reject corrupt storage and preserve explicit choices', () => {
  for (const value of [null, undefined, {}, 'bad', 42]) assert.equal(hudPreset(value), 'exploration');
  for (const value of ['racing', 'cinematic'] as const) assert.equal(hudPreset(value), value);
});
test('compact cockpit keeps full-size opt-out and phone legibility', () => {
  for (const width of [320,390,844,1440,NaN,Infinity]) assert.equal(cockpitScale(false,width),1);
  assert.equal(cockpitScale(true,390),.90); assert.equal(cockpitScale(true,1440),.82);
  for (const width of [NaN,Infinity,-1,320]) assert.ok(Number.isFinite(cockpitScale(true,width)));
});
test('clearance advice only uses finite moving airborne telemetry', () => {
  assert.equal(clearanceWarning(.5,15,false),true); assert.equal(clearanceWarning(2,15,false),false);
  assert.equal(clearanceWarning(.5,0,false),false); assert.equal(clearanceWarning(.5,15,true),false);
  for (const height of [-1,NaN,Infinity]) assert.equal(clearanceWarning(height,15,false),false);
});
test('collision warning wins and input telemetry is never changed', () => {
  const input={speed:15,height:.5,heading:0,landed:false,landing:false,boost:false,collision:true,lights:true};
  const original={...input}; assert.equal(cockpitTelemetry(input).warning,'OBSTACLE');assert.deepEqual(input,original);
  assert.equal(cockpitTelemetry({...input,collision:false}).warning,'LOW CLEARANCE');
});
test('sunset is an opt-in slow cycle, not an initialization override', () => {
  assert.deepEqual(BELLE_SUNSET,{hour:17.55,cycle:true,dayMinutes:60,clouds:'wispy'});assert.ok(Object.isFrozen(BELLE_SUNSET));
});
test('lawn detail is stable, filtered and has no extra sampled textures or time input', () => {
  assert.match(LAWN_DETAIL,/fwidth/);assert.match(LAWN_DETAIL,/terrainXZ/);
  assert.doesNotMatch(LAWN_DETAIL,/sampler|texture2D|time|discard/);
});
test('cinematic layout does not hide race guidance or critical controls', () => {
  const css=readFileSync(new URL('./visualPolish.css',import.meta.url),'utf8');
  assert.match(css,/data-hud-preset=cinematic.*:not\(\.island-trial\)/);
  const hideRules=css.match(/[^{}]+\{[^{}]*display:none[^{}]*\}/g)||[];
  for (const rule of hideRules.filter(r=>r.includes('data-hud-preset'))) assert.doesNotMatch(rule,/#trial-hud|#hover-boost|hover-actions|hover-touch|#pause|#settings-open/);
});

test('health page and its modules are explicitly included in production asset copying', () => {
  const config=readFileSync(new URL('../../vite.config.ts',import.meta.url),'utf8');
  for(const name of ['deployment-health.html','deployment-health.mjs','release-health-model.mjs']) assert.ok(config.includes("'"+name+"'"));
  assert.match(config,/for\(const item of assets\)await copyAsset\(item\)/);
});


// Lightweight render-contract fixtures; no claim that these compile on a GPU.
import {CinematicTerrain} from './cinematicTerrain.ts';
import type * as T from 'three';
function lawnFixture(name='Park lawn') {
  let visits=0;
  const compile:T.Material['onBeforeCompile']=shader=>{visits++;shader.fragmentShader='varying vec2 terrainXZ;\n'+shader.fragmentShader;};
  const key=()=>name+'-original';
  const material={name,onBeforeCompile:compile,customProgramCacheKey:key,needsUpdate:false} as unknown as T.Material;
  const listeners=new Set<(event:{child:T.Object3D})=>void>();
  const mesh={isMesh:true,material} as unknown as T.Object3D;
  const root={traverse:(visit:(o:T.Object3D)=>void)=>visit(mesh)} as unknown as T.Object3D;
  const scene={
    addEventListener:(_name:string,fn:(event:{child:T.Object3D})=>void)=>listeners.add(fn),
    removeEventListener:(_name:string,fn:(event:{child:T.Object3D})=>void)=>listeners.delete(fn),
    traverse:(visit:(o:T.Object3D)=>void)=>root.traverse(visit)
  } as unknown as T.Scene;
  const shader=()=>({vertexShader:'',fragmentShader:'#include <map_fragment>',uniforms:{}} as Parameters<T.Material['onBeforeCompile']>[0]);
  return {scene,root,material,listeners,compile,key,shader,visits:()=>visits};
}
test('lawn detail composes once and caches a stable original program identity',async()=>{
  const f=lawnFixture(),detail=new CinematicTerrain(f.scene);await Promise.resolve();
  for(const added of f.listeners)added({child:f.root});await Promise.resolve();
  const shader=f.shader();f.material.onBeforeCompile(shader,{} as T.WebGLRenderer);
  assert.equal(f.visits(),1);assert.equal((shader.fragmentShader.match(/belleLawnFootprint=/g)||[]).length,1);
  assert.equal(f.material.customProgramCacheKey(),'Park lawn-original|belle-lawn-detail-v1');
  detail.dispose();assert.equal(f.material.onBeforeCompile,f.compile);assert.equal(f.material.customProgramCacheKey,f.key);assert.equal(f.listeners.size,0);
});
test('non-lawn materials are not decorated',async()=>{
  const f=lawnFixture('Conservatory glass'),detail=new CinematicTerrain(f.scene);await Promise.resolve();
  assert.equal(f.material.onBeforeCompile,f.compile);assert.equal(f.material.needsUpdate,false);detail.dispose();
});
test('disposing before queued scene work prevents late mutation',async()=>{
  const f=lawnFixture(),detail=new CinematicTerrain(f.scene);detail.dispose();await Promise.resolve();
  assert.equal(f.material.onBeforeCompile,f.compile);assert.equal(f.material.needsUpdate,false);assert.equal(f.listeners.size,0);
});
