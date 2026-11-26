import test from 'node:test';
import assert from 'node:assert/strict';
import * as T from 'three';
import {CinematicTerrain} from './cinematicTerrain.ts';
import {finishParkLawn} from './parkLawn.ts';
import {LAWN_DETAIL} from './cinematicPolicy.ts';
import {LAWN_DETAIL_GRAIN_GUARD,LAWN_GRAIN_GUARD_KEY} from './lawnFragmentOptimization.ts';

// Shader-composition contracts only. Actual rendered RGBA equality is a separate gate.
function material(){const m=new T.MeshStandardMaterial({name:'Park lawn',color:0x8f9b7e,roughness:.8});finishParkLawn(m);return m;}
function compile(m){const s={vertexShader:'#include <worldpos_vertex>',fragmentShader:'#include <map_fragment>',uniforms:{}};m.onBeforeCompile(s,{});return s;}
async function owner(m,options){const scene=new T.Scene();scene.add(new T.Mesh(new T.PlaneGeometry(),m));const result=new CinematicTerrain(scene,options);await Promise.resolve();return result;}

test('default lawn path keeps the original shader and material properties',async()=>{
 const a=material(),b=material(),before=a.onBeforeCompile;
 const untouched={color:a.color.clone(),roughness:a.roughness,side:a.side,depthWrite:a.depthWrite,depthTest:a.depthTest};
 const first=await owner(a),second=await owner(b,{skipInvisibleGrain:false});
 assert.deepEqual(compile(a),compile(b));assert.equal(a.customProgramCacheKey(),b.customProgramCacheKey());
 assert.ok(compile(a).fragmentShader.includes(LAWN_DETAIL));assert.ok(!compile(a).fragmentShader.includes(LAWN_DETAIL_GRAIN_GUARD));
 for(const key of ['roughness','side','depthWrite','depthTest'])assert.equal(a[key],untouched[key]);
 assert.ok(a.color.equals(untouched.color));first.dispose();second.dispose();assert.equal(a.onBeforeCompile,before);
});

test('guarded lawn has an independent program key and keeps derivatives unconditional',async()=>{
 const a=material(),b=material(),first=await owner(a),second=await owner(b,{skipInvisibleGrain:true});
 const baseline=compile(a),candidate=compile(b);
 assert.equal(candidate.vertexShader,baseline.vertexShader);
 assert.equal(candidate.fragmentShader.replace(LAWN_DETAIL_GRAIN_GUARD,LAWN_DETAIL),baseline.fragmentShader);
 assert.equal(b.customProgramCacheKey(),a.customProgramCacheKey()+'|'+LAWN_GRAIN_GUARD_KEY);
 const branch=LAWN_DETAIL_GRAIN_GUARD.indexOf('if(belleLawnResolved>0.)');
 assert.ok(branch>LAWN_DETAIL_GRAIN_GUARD.indexOf('fwidth(terrainXZ)'));
 assert.doesNotMatch(LAWN_DETAIL_GRAIN_GUARD.slice(branch,LAWN_DETAIL_GRAIN_GUARD.indexOf('}',branch)),/fwidth|dFdx|dFdy|texture/);
 first.dispose();second.dispose();
});

test('inherited baseline and candidate callbacks compose once and can return to baseline',async()=>{
 let current=material();const owners=[],baseline=current.customProgramCacheKey();
 for(const enabled of [false,true,true,false,true,false]){
  const previous=current,onBeforeCompile=previous.onBeforeCompile,key=previous.customProgramCacheKey;
  current=previous.clone();current.onBeforeCompile=onBeforeCompile;current.customProgramCacheKey=key;
  owners.push(await owner(current,{skipInvisibleGrain:enabled}));
  const s=compile(current);
  assert.equal(s.fragmentShader.split('float belleLawnFootprint=').length-1,1);
  assert.equal(s.fragmentShader.split('float meadowVariation=').length-1,1);
  assert.ok(s.fragmentShader.includes(enabled?LAWN_DETAIL_GRAIN_GUARD:LAWN_DETAIL));
  assert.equal(current.customProgramCacheKey(),baseline+'|belle-lawn-detail-v1'+(enabled?'|'+LAWN_GRAIN_GUARD_KEY:''));
 }
 for(const item of owners.reverse())item.dispose();
});

test('candidate disposal restores the exact inherited callback and cache identity',async()=>{
 const m=material(),first=await owner(m),before=compile(m),callback=m.onBeforeCompile,key=m.customProgramCacheKey;
 const second=await owner(m,{skipInvisibleGrain:true});
 assert.notEqual(compile(m).fragmentShader,before.fragmentShader);
 second.dispose();assert.equal(m.onBeforeCompile,callback);assert.equal(m.customProgramCacheKey,key);assert.deepEqual(compile(m),before);
 first.dispose();
});
