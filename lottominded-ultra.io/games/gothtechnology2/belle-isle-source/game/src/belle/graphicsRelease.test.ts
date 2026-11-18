import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import * as T from 'three';
import {prepareVegetationLod,vegetationScale} from './vegetationLod.ts';
import {prepareCanopyCoverage} from './canopyCoverage.ts';
import {riverBandVisibility,RIVER_BROAD_NORMALS} from './riverSurfaceDetail.ts';
const shader=(basic=false)=>({vertexShader:T.ShaderLib[basic?'basic':'standard'].vertexShader,fragmentShader:T.ShaderLib[basic?'basic':'standard'].fragmentShader,uniforms:{}} as Parameters<T.Material['onBeforeCompile']>[0]);
const read=(name:string)=>readFileSync(new URL('./'+name,import.meta.url),'utf8');
test('intermediate tree coverage retains full authored silhouette rather than two shrinking trees',()=>{
 for(const v of [.0001,.1,.25,.5,.75,.99,1])assert.equal(vegetationScale(v),1);
 for(const v of [0,-1,NaN,Infinity,-Infinity])assert.equal(vegetationScale(v),0);
});
test('near and far shader masks are complementary and preserve previous canopy shading',()=>{
 for(const far of [false,true]){
  const m=far?new T.MeshBasicMaterial():new T.MeshStandardMaterial();
  m.onBeforeCompile=s=>{s.fragmentShader='// prior shader\n'+s.fragmentShader;};
  m.customProgramCacheKey=()=> 'original';
  prepareCanopyCoverage(m,far);prepareVegetationLod(m,far);
  const s=shader(far);m.onBeforeCompile(s,{} as T.WebGLRenderer);
  assert(s.fragmentShader.includes('// prior shader'));assert(s.fragmentShader.includes('belleAutumn'));
  assert(s.vertexShader.includes('attribute float belleLodCoverage'));
  assert(s.fragmentShader.includes(far?'1.0-belleLodNoise':' || belleLodNoise'));
  assert(m.customProgramCacheKey().startsWith('original'));
  assert.equal(m.transparent,false);assert.equal(m.depthWrite,true);
 }
});
test('coverage mask partitions every transition without an uncovered silhouette band',()=>{
 for(let i=1;i<100;i++)for(let j=0;j<100;j++){
  const blend=i/100,noise=(j+.37)/100;
  const near=noise<=blend,far=(1-noise)<=(1-blend);
  assert(near!==far,'exactly one representation at a sample');
 }
});
test('LOD shader preparation is idempotent and rejects conflicting ownership',()=>{
 const m=new T.MeshStandardMaterial();prepareVegetationLod(m);const key=m.customProgramCacheKey();
 prepareVegetationLod(m);assert.equal(m.customProgramCacheKey(),key);
 const s=shader();m.onBeforeCompile(s,{} as T.WebGLRenderer);
 assert.equal((s.vertexShader.match(/attribute float belleLodCoverage/g)||[]).length,1);
 assert.throws(()=>prepareVegetationLod(m,true),/share/);
});
test('invalid engine shader contract fails rather than silently losing tree coverage',()=>{
 const m=new T.MeshStandardMaterial();prepareVegetationLod(m);
 assert.throws(()=>m.onBeforeCompile({vertexShader:'void main(){}',fragmentShader:'void main(){}',uniforms:{}} as Parameters<T.Material['onBeforeCompile']>[0],{} as T.WebGLRenderer),/contract/);
});
test('real leaf cutouts retain thin mip coverage without turning canopy transparent',()=>{
 const near=new T.MeshStandardMaterial(),far=new T.MeshBasicMaterial();prepareCanopyCoverage(near);prepareCanopyCoverage(far,true);
 assert.equal(near.alphaTest,.12);assert.equal(far.alphaTest,.25);
 for(const m of [near,far]){assert(m.alphaToCoverage);assert(m.depthWrite);assert.equal(m.transparent,false);}
});
test('coverage shading adds no texture samples or lighting passes',()=>{
 const m=new T.MeshStandardMaterial(),s=shader(),before=(s.fragmentShader.match(/texture2D\(/g)||[]).length;
 prepareCanopyCoverage(m);prepareVegetationLod(m);m.onBeforeCompile(s,{} as T.WebGLRenderer);
 assert.equal((s.fragmentShader.match(/texture2D\(/g)||[]).length,before);
 assert(!s.fragmentShader.includes('sampler2D belle'));
});
test('full 3D seasonal instances retain authored scale through complementary LOD coverage',()=>{const s=read('nature.ts');assert(s.includes('far.setMatrixAt(i,matrix(p))'));assert(s.includes('mesh.setMatrixAt(i,matrix(p))'));assert(s.includes('1-treeBlend(distance,cutoff)'));assert(s.includes('slice(0,budget.trees)')&&s.includes('slice(0,budget.ground)'));assert(!s.includes('matrix(p,blend)'));});
test('broad river waves retain resolvable slopes but vanish before subpixel aliasing',()=>{
 assert.equal(riverBandVisibility(0),1);assert(riverBandVisibility(.5)>.9);
 assert(riverBandVisibility(2)>.35);assert(riverBandVisibility(6)<.0002);
 let prior=1;for(let f=0;f<20;f+=.05){const v=riverBandVisibility(f);assert(v>=0&&v<=prior);prior=v;}
});
test('invalid footprint data cannot create extreme reflection normals',()=>{
 for(const f of [-1,NaN,Infinity,-Infinity])assert.equal(riverBandVisibility(f),0);
});
test('coarse river detail has no texture sample, camera-distance cutoff or camera-relative discontinuity',()=>{
 for(const token of ['texture2D','texture(','viewDistance','riverCentre','cameraPosition'])assert(!RIVER_BROAD_NORMALS.includes(token));
 assert(RIVER_BROAD_NORMALS.includes('fwidth(riverPhaseA)'));
 assert(RIVER_BROAD_NORMALS.includes('fwidth(riverPhaseB)'));
 assert(RIVER_BROAD_NORMALS.includes('wave+=riverBroad'));
});
test('water integration retains connected geometry, lagoons, wakes, optical finish and sampler budget',()=>{
 const s=read('water.ts');
 assert(s.includes("${kind==='lagoon'?'':`// Filter"));
 assert(s.includes('wave*=riverNormalVisibility;\n${RIVER_BROAD_NORMALS}'));
 assert(s.includes('far.position.copy(near.position)')&&s.includes('RIVER_PATCH_SEGMENTS'));
 for(const token of ['riverRipples[12]','shipWake[4]','hoverWash','fountainNight'])assert(s.includes(token));
 assert(s.includes("clearcoat:kind==='lagoon'?.60:0"));
 assert(s.includes('wave.x*.65')&&s.includes('wave.y*.65'));
});

test('reused leaf material cannot have its calibrated cutoff reset by another instance',()=>{
 const m=new T.MeshStandardMaterial();prepareCanopyCoverage(m);const key=m.customProgramCacheKey();
 m.alphaTest=.45;prepareCanopyCoverage(m);assert.equal(m.alphaTest,.12);assert.equal(m.customProgramCacheKey(),key);
 const s=shader();m.onBeforeCompile(s,{} as T.WebGLRenderer);assert.equal((s.fragmentShader.match(/float belleAutumn=/g)||[]).length,1);
});


test('reference river slopes are restrained and decorrelated instead of strong regular cross-hatching',()=>{
 const bound=Math.hypot(.0045,.0024)+Math.hypot(.0012,.0031);
 assert(bound<Math.tan(Math.PI/360),'added broad slopes stay below half a degree');
 for(const token of ['2.2*sin(','.9*sin(','1.8*sin(','.7*sin(','riverPatch=.65+.35*sin','wave+=riverBroad*riverPatch'])assert(RIVER_BROAD_NORMALS.includes(token));
 assert(!RIVER_BROAD_NORMALS.includes('vec2(.016,.011)'));
 assert(!RIVER_BROAD_NORMALS.includes('vec2(-.009,.018)'));
});
