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
 assert(read('nature.ts').includes('if(mesh.userData.seasonalLeaf)mesh.setMatrixAt(i,matrix(p,false,true));else mesh.setMatrixAt(i,matrix(p))'));
 assert(read('nature.ts').includes('if(far.userData.seasonalLeaf)far.setMatrixAt(i,matrix(p,false,true));else far.setMatrixAt(i,matrix(p))'));
 assert(read('nature.ts').includes('const g=crown&&trees.has(p.id)?growth(p):null'));
 assert(read('water.ts').includes('float riverSunSparkle=.78+.22*clamp((r1.x+r2.y)*riverNormalVisibility,-1.,1.)'));
 assert(read('islandSky.ts').includes('scene.environmentIntensity=')&&read('islandSky.ts').includes('photoLook.warmth*.09'));
 assert(read('world.ts').includes('bridgeRailFinish=finishMacArthurRailings(landmarks.scene)'));
 assert(read('main.ts').includes('dataset.macarthurRailMeshes'));
 assert(readFileSync(new URL('../../scripts/environment-gallery.mjs',import.meta.url),'utf8').includes('railFinishAccepted'));
 assert(read('seasonalMaterial.ts').includes('alphaToCoverage=leaf'));
 assert(read('water.ts').includes('riverPhotoGlintGLSL(REFERENCE_STYLE)'));
 assert(read('world.ts').includes("finishBridgeMaterial(bridgeConcrete,'aged-concrete')"));
});

test('photographic guide views map to actual inland canals and a Casino footbridge',()=>{
 const map=JSON.parse(readFileSync(new URL('../../public/belle/map.json',import.meta.url),'utf8'));
 const red=map.roads.find((road:{id:string;bridge?:boolean})=>road.id==='106948146');
 assert(red?.bridge&&red.points.length>1);
 assert(map.pois.some((p:{name:string})=>p.name==='Sylvan Canal'));
 const guide=readFileSync(new URL('./main.ts',import.meta.url),'utf8');
 const gallery=readFileSync(new URL('../../scripts/environment-gallery.mjs',import.meta.url),'utf8');
 for(const key of ['Casino Way Bridge · bank side','Sylvan Canal · wooded banks','scenicRoute('])assert(guide.includes(key));
 assert(gallery.includes('Walk onto the beach')&&gallery.includes('Visit red bridge')&&gallery.includes('Visit canal view'));
 assert(!gallery.includes('Covered Bridge guide destination is provisional'));
});
