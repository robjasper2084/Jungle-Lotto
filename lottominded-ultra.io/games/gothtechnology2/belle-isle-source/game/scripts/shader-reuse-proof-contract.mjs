import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {SHADER_PROOF_CASES,SHADER_PROOF_SIZE} from './shader-reuse-cases.ts';
export const sha256=bytes=>createHash('sha256').update(bytes).digest('hex');
const digest=value=>assert.match(value,/^[a-f0-9]{64}$/);
export function compareRgba(a,b){
 assert.equal(a.length,b.length);assert.equal(a.length%4,0);let changedPixels=0,maxChannelDelta=0;
 for(let i=0;i<a.length;i+=4){let changed=false;for(let j=0;j<4;j++){const difference=Math.abs(a[i+j]-b[i+j]);maxChannelDelta=Math.max(maxChannelDelta,difference);changed ||= difference!==0;}if(changed)changedPixels++;}
 return{changedPixels,maxChannelDelta};
}
export function verifyCapturedPixels(decoded,receipt){
 assert.equal(decoded.width,SHADER_PROOF_SIZE.width);assert.equal(decoded.height,SHADER_PROOF_SIZE.height);
 assert.equal(receipt.width,decoded.width);assert.equal(receipt.height,decoded.height);assert.equal(decoded.data.length,decoded.width*decoded.height*4);
 // Native readPixels starts at the lower left; PNG rows start at the top.
 const bottomUp=Buffer.alloc(decoded.data.length),stride=decoded.width*4;
 for(let y=0;y<decoded.height;y++)bottomUp.set(decoded.data.subarray(y*stride,(y+1)*stride),(decoded.height-y-1)*stride);
 assert.equal(sha256(bottomUp),receipt.rgbaSha256,'Saved PNG does not contain the reported native readPixels bytes');
 return{pngRgbaSha256:sha256(decoded.data),readPixelsSha256:sha256(bottomUp)};
}
export function assertShaderReuseResult(result,{backend,sourceSha,sourceTree}){
 assert.equal(result.scope,'Targeted shipped-asset shader equivalence; not full-scene performance or controls acceptance.');
 assert.equal(result.sourceSha,sourceSha);assert.equal(result.sourceTree,sourceTree);assert.match(sourceSha,/^[a-f0-9]{40}$/);assert.match(sourceTree,/^[a-f0-9]{40}$/);
 assert.equal(result.threeRevision,'185');assert.deepEqual(result.size,SHADER_PROOF_SIZE);assert.equal(result.devicePixelRatio,1);
 assert(backend==='metal'||backend==='swiftshader');assert.match(result.gpu,backend==='metal'?/Metal/:/SwiftShader/);
 if(backend==='metal')assert(!/SwiftShader|llvmpipe/i.test(result.gpu));
 assert.deepEqual(result.errors,[]);assert.equal(result.contextLost,false);assert.equal(result.finished,true);
 assert.equal(result.rows.length,SHADER_PROOF_CASES.length);assert.equal(new Set(result.rows.map(row=>row.id)).size,SHADER_PROOF_CASES.length);
 for(const spec of SHADER_PROOF_CASES){
  const row=result.rows.find(row=>row.id===spec.id);assert(row,'Missing '+spec.id);assert.equal(row.kind,spec.kind);
  assert.equal(row.changedPixels,0,spec.id+' changed pixels');assert.equal(row.maxChannelDelta,0,spec.id+' changed a channel');
  digest(row.baseline.rgbaSha256);assert.equal(row.candidate.rgbaSha256,row.baseline.rgbaSha256);
  assert(row.baseline.calls>0&&row.baseline.triangles>0);assert.equal(row.candidate.calls,row.baseline.calls);assert.equal(row.candidate.triangles,row.baseline.triangles);
  assert.deepEqual(row.candidate.camera,row.baseline.camera);assert.deepEqual(row.candidate.geometry,row.baseline.geometry);
  for(const read of [row.baseline,row.candidate]){assert(read.targetSubmission?.calls>0&&read.targetSubmission.triangles>0);assert.equal(read.targetSubmission.currentProgramMatches,true);}
  assert.equal(row.candidate.targetSubmission.objectUuid,row.baseline.targetSubmission.objectUuid);
  assert.match(row.baseline.targetSubmission.objectName,spec.kind==='asphalt'?/^Joined island pavement · asphalt$/:/^MacArthur/);
  assert(row.targetMaskPixels>0&&row.visibleTargetPixels>0,spec.id+' has no visible target');
  if(spec.effectRequired)assert(row.effectPixels>0,spec.id+' has a vacuous effect control');
  if(spec.shadowRequired)assert(row.targetShadowPixels>0,spec.id+' has no shadow change on the actual target');
  assert.equal(row.restored,true);assert.equal(row.baseline.shader.hasReuseGuard,false,'Baseline must be the untouched native bump path');
  digest(row.baseline.shader.fragmentSha256);digest(row.candidate.shader.fragmentSha256);
  if(spec.kind==='asphalt'){
   assert.equal(row.baseline.shader.originalRepairs,true);assert.equal(row.candidate.shader.gatedRepairs,true);
   assert.equal(row.baseline.profile,'asphalt|triplanar');assert.equal(row.candidate.profile,row.baseline.profile);
  }else{
   assert.equal(row.baseline.profile,'brick|triplanar');assert.equal(row.candidate.profile,row.baseline.profile);
   assert.equal(row.candidate.shader.programSafe,spec.nativeSafe);assert.equal(row.candidate.shader.guardUniform,spec.guard);
   if(spec.nativeSafe){assert.equal(row.candidate.shader.mapUv,row.candidate.shader.bumpMapUv);assert.equal(row.candidate.shader.decodeVideo,false);}
   if(spec.guard===true){assert.equal(row.candidate.shader.nativeSamplerAlias,true);assert.equal(row.candidate.shader.tableGuard,true);}
   if(spec.mode==='uv1')assert.equal(row.candidate.shader.mapUv,'uv1');
   if(spec.mode?.startsWith('uv2'))assert.equal(row.candidate.shader.mapUv,'uv2');
   if(spec.mode==='unequal-uv-alias'||spec.mode==='cached-unsafe-return'){
    assert.equal(row.candidate.shader.mapUv,'uv');assert.equal(row.candidate.shader.bumpMapUv,'uv1');assert.equal(row.candidate.shader.nativeSamplerAlias,true);
   }
   if(spec.mode==='video-alias')assert.equal(row.candidate.shader.decodeVideo,true);
  }
  assert.equal(row.captures.length,5);assert.deepEqual(row.captures.map(c=>c.role).sort(),['baseline','candidate','effect-off','shadow-off','target-hidden']);
  for(const capture of row.captures){assert.equal(capture.width,SHADER_PROOF_SIZE.width);assert.equal(capture.height,SHADER_PROOF_SIZE.height);digest(capture.rgbaSha256);}
 }
 // Near/far views and two small UV scales retain actual source mipmapped
 // samplers. Derivative-footprint estimates are identified separately from a
 // claim about hardware-selected anisotropic mip levels.
 for(const id of ['limestone-mip-middle','limestone-mip-far','limestone-uv2-mip-below','limestone-uv2-mip-above']){
  const row=result.rows.find(row=>row.id===id);assert([9984,9985,9986,9987].includes(row.candidate.shader.mapMinFilter),id+' lost mipmapped sampling');
  assert(row.uvFootprint?.samples>0);assert.equal(row.uvFootprint.kind,'projected-source-triangle estimate; not a hardware LOD query');
 }
 const middle=result.rows.find(r=>r.id==='limestone-mip-middle').uvFootprint,far=result.rows.find(r=>r.id==='limestone-mip-far').uvFootprint;
 assert(far.maximum>middle.minimum+1,'Near/far coverage did not span a mip interval');
 const below=result.rows.find(r=>r.id==='limestone-uv2-mip-below'),above=result.rows.find(r=>r.id==='limestone-uv2-mip-above');
 assert.equal(below.mipCalibration?.kind,'projected-triangle isotropic estimate; not hardware-selected anisotropic LOD');
 assert.equal(above.mipCalibration?.kind,below.mipCalibration.kind);assert.equal(above.mipCalibration.boundary,below.mipCalibration.boundary);
 assert(Number.isInteger(below.mipCalibration.boundary));assert(below.uvFootprint.median<below.mipCalibration.boundary&&above.uvFootprint.median>above.mipCalibration.boundary);
 assert(Math.abs(below.uvFootprint.median-below.mipCalibration.desired)<1e-6&&Math.abs(above.uvFootprint.median-above.mipCalibration.desired)<1e-6,'Native UV controls did not flank the documented projected footprint boundary');
 for(const name of ['belle/landmarks.glb','belle/pavement.json','belle/pavement.bin','belle/skins/asphalt-color.webp','belle/skins/asphalt-detail.webp','belle/skins/brick-color.webp','belle/skins/brick-detail.webp']){
  const asset=result.assets.find(a=>a.file===name);assert(asset&&asset.bytes>0,name);digest(asset.sha256);
  assert.match(asset.gitBlob,/^[a-f0-9]{40}$/);assert.equal(asset.baselineGitBlob,asset.gitBlob,name+' changed from the original shipped asset');
  assert.equal(asset.served,true);assert.equal(asset.received,true);
 }
 return true;
}
