import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {canopyProfile} from './habitatPolicy.ts';
import {RIVER_BROAD_NORMALS,riverPhotoGlintGLSL} from './riverSurfaceDetail.ts';
test('fuller tree crowns remain bounded, deterministic and compatible with existing LOD budgets',()=>{
 for(const id of ['willow','maple','birch','pine']){
  const site={id,x:345,z:119,scale:1},a=canopyProfile(site);
  assert.deepEqual(a,canopyProfile(site));
  assert(a.width>=.85&&a.width<1.3);
  assert(a.density>=.48&&a.density<=1.12);
  assert(a.height>.65&&a.height<1.40);
 }
 assert(canopyProfile({id:'maple',x:10,z:30,scale:1}).width>1.04);
});
test('filtered river sun reflection has no new sampler or render pass',()=>{
 for(const reference of [false,true]){
  const source=riverPhotoGlintGLSL(reference);
  assert.match(source,/fwidth\(belleGlintPhase\)/);
  assert.match(source,/riverSunGlint/);
  assert.doesNotMatch(source,/sampler2D|texture2D|uniform|gl_FragColor|discard/);
 }
 assert.match(RIVER_BROAD_NORMALS,/riverBroad/);
});
test('source integrates tree-only crown scaling, river filtering and photo bridge deck',()=>{
 const read=(f:string)=>readFileSync(new URL('./'+f,import.meta.url),'utf8');
 assert(read('nature.ts').includes('matrix(p,false,!!mesh.userData.seasonalLeaf)'));
 assert(read('seasonalMaterial.ts').includes('alphaToCoverage=leaf'));
 assert(read('water.ts').includes('riverPhotoGlintGLSL(REFERENCE_STYLE)'));
 assert(read('world.ts').includes("finishBridgeMaterial(bridgeConcrete,'aged-concrete')"));
});
