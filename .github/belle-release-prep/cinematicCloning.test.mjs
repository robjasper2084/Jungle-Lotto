import test from 'node:test';
import assert from 'node:assert/strict';
import {CinematicTerrain} from './cinematicTerrain.ts';
import {LAWN_DETAIL} from './cinematicPolicy.ts';
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
 const inherited=material.onBeforeCompile, inheritedKey=material.customProgramCacheKey;
 const clone={...material,onBeforeCompile:s=>{inherited(s,{});s.fragmentShader+='\n// realistic finish retained';}};
 const two=fixture(clone),b=new CinematicTerrain(two.scene);await Promise.resolve();
 for(let i=0;i<3;i++){const result=apply(clone);assert.equal(count(result),1);assert.ok(result.fragmentShader.includes(LAWN_DETAIL));assert.match(result.fragmentShader,/realistic finish retained/);}
 b.dispose();a.dispose();assert.equal(one.listeners.size,0);assert.equal(two.listeners.size,0);assert.equal(clone.customProgramCacheKey,inheritedKey);
});
test('multiple inherited copies do not redeclare GLSL variables or multiply the lawn tint',async()=>{
 const materials=[original()],owners=[];
 for(let i=0;i<4;i++){
  const current=materials.at(-1),f=fixture(current),owner=new CinematicTerrain(f.scene);owners.push(owner);await Promise.resolve();
  assert.equal(count(apply(current)),1);
  materials.push({...current,onBeforeCompile:current.onBeforeCompile,customProgramCacheKey:current.customProgramCacheKey});
 }
 for(const owner of owners.reverse())owner.dispose();
});
test('an incompatible shader is preserved and an inherited compilation exception remains fatal',async()=>{
 const material=original();material.onBeforeCompile=()=>{};
 const f=fixture(material),owner=new CinematicTerrain(f.scene);await Promise.resolve();assert.equal(count(apply(material)),0);owner.dispose();
 const broken=original();broken.onBeforeCompile=()=>{throw Error('original shader failure');};
 const b=new CinematicTerrain(fixture(broken).scene);await Promise.resolve();assert.throws(()=>apply(broken),/original shader failure/);b.dispose();
});
