import test from 'node:test';
import assert from 'node:assert/strict';
import {CinematicTerrain} from './cinematicTerrain.ts';
import {LAWN_DETAIL} from './cinematicPolicy.ts';

// Render-contract fixtures, not a GPU compilation or full-world performance test.
function fixture(material) {
  const listeners=new Set();
  const root={traverse:visit=>visit({isMesh:true,material})};
  const scene={...root,addEventListener:(_type,fn)=>listeners.add(fn),removeEventListener:(_type,fn)=>listeners.delete(fn)};
  return {root,scene,listeners};
}
function original(){return {name:'Park lawn',onBeforeCompile:shader=>{shader.fragmentShader='varying vec2 terrainXZ;\n'+shader.fragmentShader;},customProgramCacheKey:()=> 'terrain-v1',needsUpdate:false};}
function shader(){return {fragmentShader:'#include <map_fragment>',vertexShader:'',uniforms:{}};}
function apply(material){const s=shader();material.onBeforeCompile(s,{});return s;}
function count(s){return s.fragmentShader.split('float belleLawnFootprint=').length-1;}

test('cloned realistic material carrying an inherited lawn callback composes exactly once',async()=>{
  const material=original(),one=fixture(material),a=new CinematicTerrain(one.scene);await Promise.resolve();
  const inherited=material.onBeforeCompile,inheritedKey=material.customProgramCacheKey;
  const clone={...material,onBeforeCompile:s=>{inherited(s,{});s.fragmentShader+='\n// realistic finish retained';}};
  const two=fixture(clone),b=new CinematicTerrain(two.scene);await Promise.resolve();
  for(let i=0;i<3;i++){const result=apply(clone);assert.equal(count(result),1);assert.ok(result.fragmentShader.includes(LAWN_DETAIL));assert.match(result.fragmentShader,/realistic finish retained/);}
  assert.equal(clone.customProgramCacheKey(),material.customProgramCacheKey());
  b.dispose();a.dispose();assert.equal(one.listeners.size,0);assert.equal(two.listeners.size,0);assert.equal(clone.customProgramCacheKey,inheritedKey);
});
test('multiple inherited copies do not redeclare GLSL variables or multiply the lawn tint',async()=>{
  const materials=[original()],owners=[];
  for(let i=0;i<5;i++){
    const current=materials.at(-1),f=fixture(current),owner=new CinematicTerrain(f.scene);owners.push(owner);await Promise.resolve();
    const result=apply(current);assert.equal(count(result),1);
    assert.equal(result.fragmentShader.split('diffuseColor.rgb*=mix(1.,.94+.12*belleLawnGrain,belleLawnResolved);').length-1,1);
    assert.equal(current.customProgramCacheKey(),'terrain-v1|belle-lawn-detail-v1');
    materials.push({...current,onBeforeCompile:current.onBeforeCompile,customProgramCacheKey:current.customProgramCacheKey});
  }
  for(const owner of owners.reverse())owner.dispose();
});
test('an incompatible shader is preserved and inherited compilation exceptions stay fatal',async()=>{
  const material=original();material.onBeforeCompile=()=>{};
  const f=fixture(material),owner=new CinematicTerrain(f.scene);await Promise.resolve();assert.equal(count(apply(material)),0);owner.dispose();
  const broken=original();broken.onBeforeCompile=()=>{throw Error('original shader failure');};
  const b=new CinematicTerrain(fixture(broken).scene);await Promise.resolve();assert.throws(()=>apply(broken),/original shader failure/);b.dispose();
});
test('material arrays and repeated scene notifications do not install duplicate hooks',async()=>{
  const material=original(),untouched={...original(),name:'Sand'},f=fixture([material,material,untouched]);
  const before=untouched.onBeforeCompile,owner=new CinematicTerrain(f.scene);await Promise.resolve();
  const installed=material.onBeforeCompile;
  for(const fn of f.listeners){fn({child:f.root});fn({child:f.root});}await Promise.resolve();
  assert.equal(material.onBeforeCompile,installed);assert.equal(count(apply(material)),1);assert.equal(untouched.onBeforeCompile,before);owner.dispose();
});
test('renderer argument and shader extensions from inherited callbacks are retained',async()=>{
  const material=original(),renderer={id:'actual-renderer-adapter'},uniform={value:3};
  material.onBeforeCompile=function(s,r){assert.equal(r,renderer);s.vertexShader+='// vertex extension';s.uniforms.existing=uniform;s.fragmentShader='varying vec2 terrainXZ;\n'+s.fragmentShader;};
  const owner=new CinematicTerrain(fixture(material).scene);await Promise.resolve();const s=shader();material.onBeforeCompile(s,renderer);
  assert.equal(s.uniforms.existing,uniform);assert.match(s.vertexShader,/vertex extension/);assert.equal(count(s),1);owner.dispose();
});
test('disposing before queued work leaves the original material unchanged',async()=>{
  const material=original(),before=material.onBeforeCompile,f=fixture(material),owner=new CinematicTerrain(f.scene);
  owner.dispose();await Promise.resolve();assert.equal(material.onBeforeCompile,before);assert.equal(material.needsUpdate,false);assert.equal(f.listeners.size,0);
});
