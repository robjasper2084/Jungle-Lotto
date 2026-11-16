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
