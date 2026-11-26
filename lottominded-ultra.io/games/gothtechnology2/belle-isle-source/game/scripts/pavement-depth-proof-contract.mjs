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
  if(!row.name.startsWith('quantized-')){
   assert(positive(row.visibleShadowPixels),row.name+' visible shadow receiver');
   const anchor=row.shadowAnchor;assert(anchor&&anchor.point.length===3&&anchor.point.every(Number.isFinite));assert(anchor.ndc.length===2&&anchor.ndc.every(x=>Math.abs(x)<1));
   assert(positive(anchor.distance)&&anchor.size>=3&&anchor.size<=12);assert(Number.isInteger(anchor.faceIndex)&&anchor.faceIndex>=0);
   const source=row.baselineDraws.find(draw=>draw.id===anchor.sourceId&&draw.pass==='color'&&positive(draw.triangles));assert(source,'the actual anchor surface is submitted');
   const firstIndex=anchor.faceIndex*3;assert(Number.isInteger(source.start)&&Number.isFinite(source.count)&&firstIndex>=source.start&&firstIndex+3<=source.start+source.count,
    'the chosen anchor triangle survives the actual native submitted drawRange');
  }
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
 const fallback=result.unsupportedFallback;assert.equal(fallback.changedPixels,0);assert.equal(fallback.depthCalls,0);
 assert.deepEqual(fallback.targetMaterial,{transparent:true,opacity:.65});
 const owners=new Map(fallback.depthStats.entries.map(e=>[e.depthId,e.sourceId]));
 assert.equal(owners.get(fallback.targetDepthId),fallback.targetSourceId,'the unsupported owner is identified independently of other entries');
 const target=fallback.depthStats.entries.find(e=>e.depthId===fallback.targetDepthId);assert.equal(target.status,'material-changed');assert.equal(target.selectedIndices,0);
 const originals=draws=>draws.filter(d=>!owners.has(d.id));
 assert.deepEqual(originals(fallback.candidateDraws),originals(fallback.baselineDraws),'fallback preserves all original native color/shadow submissions');
 assert(fallback.baselineDraws.some(d=>d.id===fallback.targetSourceId&&d.pass==='color'&&positive(d.calls)&&positive(d.triangles)),'unsupported source really draws');
 const depth=fallback.candidateDraws.filter(d=>owners.has(d.id)&&d.calls>0);
 assert(depth.every(d=>d.id!==fallback.targetDepthId),'unsupported source submits no depth work');
 for(const draw of depth){
  assert.equal(draw.pass,'color');assert(positive(draw.triangles));
  const source=fallback.candidateDraws.find(d=>d.id===owners.get(draw.id)&&d.pass==='color');assert(source);
  for(const key of ['world','view','projection','positionId','indexId','start','count'])assert.deepEqual(draw[key],source[key],'remaining eligible depth input '+key);
 }
 const sum=(draws,key)=>draws.reduce((n,d)=>n+d[key],0);
 for(const key of ['Calls','Triangles']){
  const field=key.toLowerCase();assert.equal(fallback['baseline'+key],sum(fallback.baselineDraws,field));assert.equal(fallback['candidate'+key],sum(fallback.candidateDraws,field));
  assert.equal(fallback['candidate'+key],fallback['baseline'+key]+sum(depth,field),'all other eligible extra '+field+' remain counted');
 }
 return true;
}
