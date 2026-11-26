import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import * as T from 'three';
import {finishAsphalt} from './surfaceFinish.ts';
import {ART_ROAD_WETNESS} from './artDirection.ts';
import {ASPHALT_PATCH_DETAIL,ASPHALT_PATCH_DETAIL_MASKED} from './asphaltPolish.ts';

type Shader=Parameters<T.Material['onBeforeCompile']>[0];
function compile(material:T.Material){
 const shader={vertexShader:T.ShaderLib.standard.vertexShader,fragmentShader:T.ShaderLib.standard.fragmentShader,uniforms:{}} as Shader;
 material.onBeforeCompile(shader,{} as T.WebGLRenderer);return shader;
}

test('default asphalt repair shader retains the pinned d4f4baa8 source',()=>{
 assert.equal(createHash('sha256').update(ASPHALT_PATCH_DETAIL).digest('hex'),'9ff53ea16d13019ea828a1b0136307ad5133921b5312de89de73215614e78614');
 const original=new T.MeshStandardMaterial(),explicitOff=new T.MeshStandardMaterial();
 finishAsphalt(original);finishAsphalt(explicitOff,{skipInvisiblePatches:false});
 assert.equal(original.customProgramCacheKey(),'world-asphalt-weather-v6-art-mood');
 assert.deepEqual(compile(original),compile(explicitOff));
 assert(compile(original).fragmentShader.includes(ASPHALT_PATCH_DETAIL));
});

test('candidate skips only zero-weight repair work and computes derivatives unconditionally',()=>{
 const derivative=ASPHALT_PATCH_DETAIL_MASKED.indexOf('fwidth(repairGrid)');
 const branch=ASPHALT_PATCH_DETAIL_MASKED.indexOf('if(repairResolved>0.)');
 assert(derivative>=0&&derivative<branch);
 assert(!/fwidth|dFdx|dFdy/.test(ASPHALT_PATCH_DETAIL_MASKED.slice(branch)));
 assert(ASPHALT_PATCH_DETAIL_MASKED.includes('if(repairSeed>=.77)'));
 // Fade, hash, footprint/shape and final multiplication retain authored bytes.
 for(const expression of [
  'fract(sin(dot(repairCell,vec2(127.1,311.7)))*43758.5453)',
  '1.-smoothstep(.035,.12,max(repairAa.x,repairAa.y))',
  'smoothstep(0.,repairAa.x*1.5,repairEdge.x)*smoothstep(0.,repairAa.y*1.5,repairEdge.y)',
  'step(.77,repairSeed)*repairShape*repairResolved',
  'diffuseColor.rgb*=1.-repairAmount*(.045+.055*repairSeed);',
 ])assert(ASPHALT_PATCH_DETAIL.includes(expression)&&ASPHALT_PATCH_DETAIL_MASKED.includes(expression));
});

test('candidate keeps original wetness binding, PBR maps and roughness variation',()=>{
 const map=new T.Texture(),normalMap=new T.Texture(),roughnessMap=new T.Texture();
 const material=new T.MeshStandardMaterial({map,normalMap,roughnessMap,color:0x979b99});
 const options={skipInvisiblePatches:true};finishAsphalt(material,options);options.skipInvisiblePatches=false;
 const shader=compile(material),original=new T.MeshStandardMaterial();finishAsphalt(original);
 assert.equal(shader.uniforms.belleArtRoadWetness,ART_ROAD_WETNESS);
 assert.equal(shader.vertexShader,compile(original).vertexShader);
 assert.equal(shader.fragmentShader.replace(ASPHALT_PATCH_DETAIL_MASKED,ASPHALT_PATCH_DETAIL),compile(original).fragmentShader);
 assert.equal(material.map,map);assert.equal(material.normalMap,normalMap);assert.equal(material.roughnessMap,roughnessMap);
 assert.equal(material.roughness,.92);
 assert.equal(material.customProgramCacheKey(),'world-asphalt-weather-v6-art-mood-masked-patches-candidate-v1');
 map.dispose();normalMap.dispose();roughnessMap.dispose();material.dispose();original.dispose();
});
