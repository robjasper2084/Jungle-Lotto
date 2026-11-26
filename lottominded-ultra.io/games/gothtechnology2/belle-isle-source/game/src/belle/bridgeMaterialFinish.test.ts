import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
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

test('unaccepted bridge candidate leaves the default shader byte-identical to d4f4baa8',()=>{
 // Source-level safety only: these receipts do not replace rendered RGBA
 // comparisons of the opt-in shader on SwiftShader and native hardware.
 const baseline={
  'aged-concrete':'7926d950a8bad1185e149dbab21b2210aedcbe527a599ecac9130a047c417e4e',
  'rusted-steel':'c59fae7380b63ab08121e88167cf3c7e1ac478d504374cca214d930444b15d3a',
  'weathered-red-iron':'dd460eaf7adc520dfa8bc692ee83e67696fe7e25684881284eba3bcdab449319'
 };
 for(const kind of ['aged-concrete','rusted-steel','weathered-red-iron'] as const){
  const shader=bridgeFinishFragment(kind);
  assert.equal(createHash('sha256').update(shader).digest('hex'),baseline[kind]);
  assert.equal(bridgeFinishFragment(kind,{skipInvisibleGrain:false}),shader);
 }
});

test('bridge candidate evaluates derivatives before its exact-zero grain branch',()=>{
 const code=bridgeFinishFragment('aged-concrete',{skipInvisibleGrain:true});
 const derivative=code.indexOf('fwidth(bridgeWorld.xz)');
 const branch=code.indexOf('if(belleBridgeAA>0.){');
 assert(derivative>=0&&branch>derivative);
 assert.match(code,/float belleBridgeGrain=\.5;/);
 assert.equal((code.match(/fwidth\(/g)||[]).length,1);
 assert.match(code,/belleBridgeGrain=fract\(sin\(dot\(floor\(bridgeWorld\.xz\*9\.\),vec2\(12\.9898,78\.233\)\)\)\*43758\.5453\);}/);
 // The material products and their order remain identical after the common
 // prefix, including the original nonzero grain contribution.
 const body='float waterStain=';
 assert.equal(code.slice(code.indexOf(body)),bridgeFinishFragment('aged-concrete').slice(bridgeFinishFragment('aged-concrete').indexOf(body)));
});

test('bridge candidate keeps maps and parent hooks and uses a separate immutable cache key',()=>{
 const map=new T.Texture(),normalMap=new T.Texture(),bumpMap=new T.Texture();
 const parentUniform={value:.37};
 const material=new T.MeshStandardMaterial({map,normalMap,bumpMap,bumpScale:.018,side:T.DoubleSide});
 material.onBeforeCompile=shader=>{shader.uniforms.parentUniform=parentUniform;shader.fragmentShader+='\n// parent hook';};
 material.customProgramCacheKey=()=>'parent-material';
 const options={skipInvisibleGrain:true};
 assert.equal(finishBridgeMaterial(material,'aged-concrete',options),material);
 options.skipInvisibleGrain=false;
 const key=material.customProgramCacheKey();
 assert.equal(key,'parent-material-belle-bridge-weather-v2-aged-concrete-masked-grain-candidate-v1');
 const shader={uniforms:{},vertexShader:'#include <worldpos_vertex>',fragmentShader:'#include <map_fragment>'} as unknown as Parameters<T.MeshStandardMaterial['onBeforeCompile']>[0];
 material.onBeforeCompile(shader,{} as T.WebGLRenderer);
 assert.equal(shader.uniforms.parentUniform,parentUniform);
 assert(shader.fragmentShader.endsWith('// parent hook'));
 assert(shader.fragmentShader.includes('if(belleBridgeAA>0.){'));
 assert.equal(material.customProgramCacheKey(),key);
 assert.equal(material.map,map);assert.equal(material.normalMap,normalMap);assert.equal(material.bumpMap,bumpMap);
 assert.equal(material.bumpScale,.018);assert.equal(material.side,T.DoubleSide);
 const baseline=finishBridgeMaterial(new T.MeshStandardMaterial(),'aged-concrete');
 assert(!baseline.customProgramCacheKey().includes('masked-grain'));
});
