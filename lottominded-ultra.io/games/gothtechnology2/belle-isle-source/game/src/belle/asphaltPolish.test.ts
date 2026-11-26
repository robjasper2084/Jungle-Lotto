import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import * as T from 'three';
import {ASPHALT_PATCH_DETAIL} from './asphaltPolish.ts';
import {finishAsphalt} from './surfaceFinish.ts';
import {ART_ROAD_WETNESS} from './artDirection.ts';
import {SHADER_REUSE_BASELINE} from '../../scripts/shader-reuse-baseline.ts';

test('asphalt baseline text is pinned independently to the original 759 block',()=>{
 assert.equal(SHADER_REUSE_BASELINE.sourceSha,'75906273c0cd414c0d004320fc6f654b4783e5b1');
 assert.equal(createHash('sha256').update(SHADER_REUSE_BASELINE.asphaltBlock).digest('hex'),SHADER_REUSE_BASELINE.asphaltBlockSha256);
 assert(!SHADER_REUSE_BASELINE.asphaltBlock.includes('if('));
});

test('gate keeps derivatives outside control flow and every original active operation in its original relative order',()=>{
 const original=SHADER_REUSE_BASELINE.asphaltBlock.split('\n').map(line=>line.trim()).filter(Boolean);
 const moved=original.filter(line=>line.startsWith('vec2 repairAa=')||line.startsWith('float repairResolved='));
 const gate='if(repairSeed>=.77&&repairResolved>0.){';const branch=ASPHALT_PATCH_DETAIL.indexOf(gate);
 assert(branch>0);assert.equal((ASPHALT_PATCH_DETAIL.match(/fwidth\(/g)||[]).length,1);
 for(const line of moved)assert(ASPHALT_PATCH_DETAIL.indexOf(line)<branch,line);
 const unchanged=original.filter(line=>!moved.includes(line));let last=-1;
 for(const line of unchanged){const index=ASPHALT_PATCH_DETAIL.indexOf(line);assert(index>last,line);last=index;}
 const body=ASPHALT_PATCH_DETAIL.slice(branch+gate.length,ASPHALT_PATCH_DETAIL.lastIndexOf('}'));
 assert(!/dFdx|dFdy|fwidth|texture/.test(body));
 assert.equal(body.split('\n').map(line=>line.trim()).filter(Boolean).join('\n'),
  unchanged.slice(unchanged.findIndex(line=>line.startsWith('vec2 repairCentre='))).join('\n'));
});

test('actual asphalt factory retains its maps, live wetness binding, roughness finish and source-bound gate',()=>{
 const m=new T.MeshStandardMaterial({map:new T.Texture(),normalMap:new T.Texture(),bumpMap:new T.Texture()});
 const maps=[m.map,m.normalMap,m.bumpMap];finishAsphalt(m);
 const shader={vertexShader:T.ShaderLib.standard.vertexShader,fragmentShader:T.ShaderLib.standard.fragmentShader,uniforms:{}} as Parameters<T.Material['onBeforeCompile']>[0];
 m.onBeforeCompile(shader,{} as T.WebGLRenderer);
 assert.equal(shader.uniforms.belleArtRoadWetness,ART_ROAD_WETNESS);assert.deepEqual([m.map,m.normalMap,m.bumpMap],maps);
 assert(shader.fragmentShader.includes(ASPHALT_PATCH_DETAIL));assert(shader.fragmentShader.includes('asphaltRoughnessNoise'));
 assert(shader.vertexShader.includes('asphaltXZ=(modelMatrix*vec4(transformed,1.)).xz;'));assert.equal(m.roughness,.92);
 assert.equal(m.customProgramCacheKey(),'world-asphalt-weather-v6-art-mood|resolved-repairs-v1');
});
