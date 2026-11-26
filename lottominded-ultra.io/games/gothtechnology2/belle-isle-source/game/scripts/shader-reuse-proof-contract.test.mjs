import test from 'node:test';
import assert from 'node:assert/strict';
import {SHADER_PROOF_CASES,SHADER_PROOF_SIZE} from './shader-reuse-cases.ts';
import {assertShaderReuseResult,compareRgba,verifyCapturedPixels,sha256} from './shader-reuse-proof-contract.mjs';

const hash='a'.repeat(64),git='b'.repeat(40),sourceTree='c'.repeat(40);
const options={backend:'metal',sourceSha:git,sourceTree};
// Synthetic contract inputs test rejection behavior only; these are never
// emitted as browser, visual, asset or performance evidence.
function valid(){
 const shader={hasReuseGuard:false,fragmentSha256:hash,vertexSha256:hash,programSafe:false,guardUniform:null,tableGuard:false,
  mapUv:'uv',bumpMapUv:'uv',decodeVideo:false,nativeSamplerAlias:false,mapMinFilter:9987,originalRepairs:true,gatedRepairs:true};
 const sample={rgbaSha256:hash,calls:5,triangles:500,camera:{matrix:[1,2,3]},geometry:{position:hash},profile:'asphalt|triplanar',shader,
  targetSubmission:{objectUuid:'fixture-target',objectName:'Joined island pavement · asphalt',calls:1,triangles:499,currentProgramMatches:true}};
 const rows=SHADER_PROOF_CASES.map(spec=>{
  const baseline=structuredClone(sample),candidate=structuredClone(sample);if(spec.kind==='limestone'){
   baseline.profile=candidate.profile='brick|triplanar';baseline.targetSubmission.objectName=candidate.targetSubmission.objectName='MacArthur_Higgsfield_•_warm_limestone';Object.assign(candidate.shader,{hasReuseGuard:true,programSafe:spec.nativeSafe,guardUniform:spec.guard,tableGuard:spec.guard===true,nativeSamplerAlias:spec.guard===true});
   if(spec.mode==='uv1')candidate.shader.mapUv=candidate.shader.bumpMapUv='uv1';
   if(spec.mode?.startsWith('uv2'))candidate.shader.mapUv=candidate.shader.bumpMapUv='uv2';
   if(spec.mode==='unequal-uv-alias'||spec.mode==='cached-unsafe-return')Object.assign(candidate.shader,{bumpMapUv:'uv1',nativeSamplerAlias:true});
   if(spec.mode==='video-alias')candidate.shader.decodeVideo=true;
  }
  const median=spec.mode==='uv2-low'?1.998:spec.mode==='uv2-high'?2.002:2;
  return{id:spec.id,kind:spec.kind,changedPixels:0,maxChannelDelta:0,baseline,candidate,targetMaskPixels:20,visibleTargetPixels:19,targetShadowPixels:7,effectPixels:9,restored:true,
   uvFootprint:{kind:'projected-source-triangle estimate; not a hardware LOD query',samples:12,minimum:1,median,maximum:spec.id==='limestone-mip-far'?4:2},
   mipCalibration:spec.mode?.startsWith('uv2')?{kind:'projected-triangle isotropic estimate; not hardware-selected anisotropic LOD',boundary:2,desired:median}:null,
   captures:['baseline','candidate','effect-off','shadow-off','target-hidden'].map(role=>({role,...SHADER_PROOF_SIZE,rgbaSha256:hash}))};
 });
 return{scope:'Targeted shipped-asset shader equivalence; not full-scene performance or controls acceptance.',sourceSha:git,sourceTree,size:SHADER_PROOF_SIZE,
  devicePixelRatio:1,threeRevision:'185',gpu:'ANGLE Apple Metal',errors:[],contextLost:false,finished:true,rows,
  assets:['belle/landmarks.glb','belle/pavement.json','belle/pavement.bin','belle/skins/asphalt-color.webp','belle/skins/asphalt-detail.webp','belle/skins/brick-color.webp','belle/skins/brick-detail.webp']
   .map(file=>({file,bytes:100,sha256:hash,gitBlob:git,baselineGitBlob:git,served:true,received:true}))};
}
const row=(result,id)=>result.rows.find(r=>r.id===id);
const reject=(mutate,config=options)=>{const result=valid();mutate(result);assert.throws(()=>assertShaderReuseResult(result,config));};
test('complete targeted contract accepts both explicitly verified backends',()=>{
 assert.equal(assertShaderReuseResult(valid(),options),true);const result=valid();result.gpu='ANGLE Vulkan SwiftShader';assert.equal(assertShaderReuseResult(result,{...options,backend:'swiftshader'}),true);
});
test('one changed RGBA pixel or a single channel unit always fails',()=>{
 reject(r=>r.rows[0].changedPixels=1);reject(r=>r.rows[0].maxChannelDelta=1);reject(r=>r.rows[0].candidate.rgbaSha256='d'.repeat(64));
});
test('missing, duplicate, partial and context-lost evidence fails',()=>{
 reject(r=>r.rows.pop());reject(r=>r.rows[1]=r.rows[0]);reject(r=>r.finished=false);reject(r=>r.contextLost=true);reject(r=>r.errors.push('shader error'));
});
test('software rendering cannot pass the native Metal contract',()=>{
 reject(r=>r.gpu='ANGLE Vulkan SwiftShader');reject(r=>r.gpu='Metal SwiftShader');reject(r=>r.gpu='llvmpipe Metal');reject(r=>r.gpu='ANGLE OpenGL');
});
test('source, camera, geometry, draw and actual material profile drift fails',()=>{
 reject(r=>r.sourceSha='d'.repeat(40));reject(r=>r.sourceTree='d'.repeat(40));reject(r=>r.rows[0].candidate.camera.matrix[0]=2);
 reject(r=>r.rows[0].candidate.geometry.position='d'.repeat(64));reject(r=>r.rows[0].candidate.calls++);reject(r=>r.rows[0].candidate.triangles--);
 reject(r=>r.rows[0].candidate.profile='asphalt|planar');reject(r=>row(r,'limestone-near-day').candidate.profile='limestone|triplanar');
});
test('blank target or ineffective surface and native shadow positive controls fail',()=>{
 reject(r=>r.rows[0].targetMaskPixels=0);reject(r=>r.rows[0].visibleTargetPixels=0);reject(r=>r.rows[0].effectPixels=0);
 reject(r=>row(r,'limestone-near-day').effectPixels=0);reject(r=>row(r,'limestone-near-dusk').targetShadowPixels=0);reject(r=>r.rows[0].restored=false);
});
test('both alternatives using the new path cannot masquerade as the original baseline',()=>{
 reject(r=>row(r,'limestone-near-day').baseline.shader.hasReuseGuard=true);reject(r=>r.rows[0].baseline.shader.originalRepairs=false);reject(r=>r.rows[0].candidate.shader.gatedRepairs=false);
});
test('claimed reuse requires the actual compiled guard, uploaded flag and GPU sampler alias',()=>{
 reject(r=>row(r,'limestone-near-day').candidate.shader.programSafe=false);reject(r=>row(r,'limestone-near-day').candidate.shader.guardUniform=false);
 reject(r=>row(r,'limestone-near-day').candidate.shader.tableGuard=false);reject(r=>row(r,'limestone-near-day').candidate.shader.nativeSamplerAlias=false);
});
test('the inspected native program must be a successful draw of the exact target',()=>{
 reject(r=>r.rows[0].candidate.targetSubmission.calls=0);reject(r=>r.rows[0].candidate.targetSubmission.currentProgramMatches=false);
 reject(r=>r.rows[0].candidate.targetSubmission.objectUuid='floor');reject(r=>r.rows[0].baseline.targetSubmission.objectName='Shared caster');
});
test('native nonzero UV channel and updated transform cases cannot fall back to UV0 evidence',()=>{
 reject(r=>row(r,'limestone-uv1-transform').candidate.shader.mapUv='uv');reject(r=>row(r,'limestone-uv2-mip-below').candidate.shader.mapUv='uv');
 reject(r=>row(r,'limestone-uv2-mip-above').candidate.shader.bumpMapUv='uv1');
});
test('cached unsafe UV and video variants must remain compile-time disabled',()=>{
 reject(r=>row(r,'limestone-unequal-uv-to-alias').candidate.shader.programSafe=true);reject(r=>row(r,'limestone-cached-unsafe-return').candidate.shader.bumpMapUv='uv');
 reject(r=>row(r,'limestone-video-to-ordinary').candidate.shader.decodeVideo=false);reject(r=>row(r,'limestone-video-to-ordinary').candidate.shader.guardUniform=true);
});
test('non-alias samplers and lost owner variants must retain their native center fetch',()=>{
 for(const id of ['limestone-map-replaced','limestone-render-replaced','limestone-frozen-defines','limestone-owner-rewrapped'])reject(r=>row(r,id).candidate.shader.guardUniform=true);
});
test('mipmapped native samplers and genuine near/far footprint coverage are required',()=>{
 reject(r=>row(r,'limestone-mip-middle').candidate.shader.mapMinFilter=9729);reject(r=>row(r,'limestone-uv2-mip-above').uvFootprint.samples=0);
 reject(r=>row(r,'limestone-mip-far').uvFootprint.maximum=2);reject(r=>row(r,'limestone-mip-middle').uvFootprint.kind='hardware LOD');
 reject(r=>row(r,'limestone-uv2-mip-below').uvFootprint.median=2.003);reject(r=>row(r,'limestone-uv2-mip-above').mipCalibration.boundary=3);
});
test('all control PNG receipts and original shipped asset bodies are required',()=>{
 reject(r=>r.rows[0].captures.pop());reject(r=>r.rows[0].captures[0].width=1);reject(r=>r.assets.pop());reject(r=>r.assets[0].received=false);
 reject(r=>r.assets[0].served=false);reject(r=>r.assets[0].baselineGitBlob='d'.repeat(40));
});
test('independent decoded PNG comparison includes alpha and counts whole changed pixels',()=>{
 const a=Buffer.from([1,2,3,255,4,5,6,255]),b=Buffer.from(a);assert.deepEqual(compareRgba(a,b),{changedPixels:0,maxChannelDelta:0});
 b[0]++;b[1]+=2;b[7]--;assert.deepEqual(compareRgba(a,b),{changedPixels:2,maxChannelDelta:2});assert.throws(()=>compareRgba(a,Buffer.alloc(3)));
});
test('saved PNG content must exactly equal the GPU readback after only the documented row reversal',()=>{
 const {width,height}=SHADER_PROOF_SIZE,topDown=Buffer.alloc(width*height*4),bottomUp=Buffer.alloc(topDown.length),stride=width*4;
 for(let y=0;y<height;y++){topDown.fill(y%251,y*stride,(y+1)*stride);bottomUp.fill(y%251,(height-y-1)*stride,(height-y)*stride);}
 const decoded={width,height,data:topDown},receipt={width,height,rgbaSha256:sha256(bottomUp)};
 assert.equal(verifyCapturedPixels(decoded,receipt).pngRgbaSha256,sha256(topDown));assert.throws(()=>verifyCapturedPixels(decoded,{...receipt,rgbaSha256:sha256(topDown)}));
 topDown[0]++;assert.throws(()=>verifyCapturedPixels(decoded,receipt));assert.throws(()=>verifyCapturedPixels({...decoded,width:width-1},receipt));
});
