import test from 'node:test';
import assert from 'node:assert/strict';
import * as T from 'three';
import {bridgeFinishFragment,finishBridgeMaterial} from './bridgeMaterialFinish.ts';

test('bridge material styles remain muted and use no additional textures or passes',()=>{
 for(const kind of ['aged-concrete','rusted-steel','weathered-red-iron'] as const){
  const finish=bridgeFinishFragment(kind);
  assert(finish.includes('bridgeWorld'));
  assert(finish.includes('fwidth('));
  assert(finish.includes('diffuseColor.rgb'));
  assert(!/sampler2D|texture2D|gl_FragColor|discard/.test(finish));
  const material=new T.MeshStandardMaterial({color:0xa0a090});
  finishBridgeMaterial(material,kind);
  assert(material.customProgramCacheKey().includes(kind));
  assert(material.roughness>=.7);
 }
});

test('bridge weathering GLSL cannot collide with shared PBR fragment locals',()=>{
 for(const kind of ['aged-concrete','rusted-steel','weathered-red-iron'] as const){
  const fragment=bridgeFinishFragment(kind);
  assert(fragment.startsWith('{\n')&&fragment.endsWith('}\n'));
  assert.match(fragment,/float belleBridgeGrain=/);
  assert.match(fragment,/float belleBridgePitted=/);
  assert.doesNotMatch(fragment,/\bfloat (?:grain|pitted|antialias)=/);
 }
});

test('bridge soffit darkening is material-only and keeps geometry unchanged',()=>{
 const code=bridgeFinishFragment('aged-concrete');
 assert.match(code,/smoothstep\(1\.2,5\.8,bridgeWorld\.y\)/);
 assert.doesNotMatch(code,/sampler2D|texture2D/);
});

test('MacArthur mineral streaks add no texture fetches or draw passes',()=>{
 const code=bridgeFinishFragment('aged-concrete');
 assert.match(code,/belleMineralStreak/);
 assert.match(code,/smoothstep\(3\.,9\.,bridgeWorld\.y\)/);
 assert.doesNotMatch(code,/sampler2D|texture2D|gl_FragColor|discard/);
});
