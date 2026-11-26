import assert from 'node:assert/strict';

const names=['original-software-start-day','original-software-start-night','island-landing-day','island-landing-night',
 'island-far-road-day','island-far-road-night','quantized-near-day','quantized-far-day'];
const positive=value=>Number.isFinite(value)&&value>0;
/** Independently reconstruct the strict gate from raw draw receipts. The
 * browser's convenience booleans are never sufficient to authorize success. */
export function validatePavementDepthProof(result){
 assert.equal(result.threeRevision,'185');assert.equal(result.width,1280);assert.equal(result.height,800);
 assert.deepEqual(result.rows.map(row=>row.name),names,'all required native depth cases');
 for(const row of result.rows){
  assert.equal(row.changedPixels,0,row.name+' zero RGBA');assert.equal(row.maxChannelDelta,0);
  assert.match(row.baselineRgbaSha256,/^[0-9a-f]{64}$/);assert.equal(row.candidateRgbaSha256,row.baselineRgbaSha256);
  for(const key of ['visibleAsphaltPixels','visibleShaderPixels','rejectedBiasedDepthPixels'])assert(positive(row[key]),row.name+' '+key);
  if(!row.name.startsWith('quantized-'))assert(positive(row.visibleShadowPixels),row.name+' visible shadow receiver');
  assert.equal(row.cameraUnchanged,true);assert.equal(row.ownersUnchanged,true);assert.equal(row.depthStats.supported,true);assert.equal(row.depthStats.disposed,false);
  const depthOwners=new Map(row.depthStats.entries.map(entry=>[entry.depthId,entry.sourceId]));assert(depthOwners.size>0);
  const originalBaseline=row.baselineDraws.filter(draw=>!depthOwners.has(draw.id)),originalCandidate=row.candidateDraws.filter(draw=>!depthOwners.has(draw.id));
  assert.deepEqual(originalCandidate,originalBaseline,row.name+' exact original order, material, geometry, range and GPU camera inputs');
  const depth=row.candidateDraws.filter(draw=>depthOwners.has(draw.id)&&draw.calls>0);assert(depth.length>0,row.name+' depth pass actually submits');
  for(const draw of depth){
   assert.equal(draw.pass,'color','no depth proxy shadow submissions');assert(positive(draw.triangles));
   const source=originalCandidate.find(value=>value.id===depthOwners.get(draw.id)&&value.pass==='color');assert(source,'the original color source is still submitted');
   for(const key of ['world','view','projection','positionId','indexId','start','count'])assert.deepEqual(draw[key],source[key],row.name+' native depth '+key);
   for(const key of ['world','view','projection'])assert.equal(draw[key].length,16);
  }
  const sum=(draws,key)=>draws.reduce((n,draw)=>n+draw[key],0),extraCalls=sum(depth,'calls'),extraTriangles=sum(depth,'triangles');
  assert.equal(row.baselineCalls,sum(row.baselineDraws,'calls'));assert.equal(row.candidateCalls,sum(row.candidateDraws,'calls'));
  assert.equal(row.baselineTriangles,sum(row.baselineDraws,'triangles'));assert.equal(row.candidateTriangles,sum(row.candidateDraws,'triangles'));
  assert.equal(row.extraDepthCalls,extraCalls);assert.equal(row.extraDepthTriangles,extraTriangles);
  assert.equal(row.candidateCalls,row.baselineCalls+extraCalls);assert.equal(row.candidateTriangles,row.baselineTriangles+extraTriangles);
 }
 assert(positive(result.quantizedEqualPixels),'distinct Float32 planes produce actual equal-depth samples');
 assert.equal(result.unsupportedFallback.changedPixels,0);assert.equal(result.unsupportedFallback.depthCalls,0);
 return true;
}
