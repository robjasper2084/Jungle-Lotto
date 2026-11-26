/** Fail-closed diagnostic interpretation. A neutral or slower measurement stays visible. */
import assert from 'node:assert/strict';
import {pins} from './provenance.mjs';
export const PROOF_ORDER=['baseline','candidate','candidate','baseline'];
export const MEASURED_ORDER=[...PROOF_ORDER,'candidate','baseline','baseline','candidate',...PROOF_ORDER,'candidate','baseline','baseline','candidate'];
export const CASE_NAMES=['recorded-software-start','mainland-edge','mainland-near','mainland-far','island-edge','real-road-occlusion'].flatMap(p=>[p+'-day-smooth',p+'-night-smooth']).concat(['recorded-software-start-night-high','real-road-occlusion-day-high']);
const same=(a,b,message)=>assert.deepEqual(a,b,message);
const mean=values=>values.reduce((a,b)=>a+b,0)/values.length;
const summary=values=>({count:values.length,min:Math.min(...values),max:Math.max(...values),mean:mean(values),all:values});
const colorWithoutTargets=(draws,ids)=>draws.filter(d=>d.pass!=='color'||!ids.has(d.object));
export const proofIdentity=c=>c.proof.map(r=>({index:r.index,mode:r.mode,pixelSha256:r.pixelSha256,frameBefore:r.frameBefore,frameAfter:r.frameAfter}));
export function compareDraws(baseline,candidate,targetIds){
 const ids=new Set(targetIds),normalize=d=>({...d,order:ids.has(d.object)&&d.pass==='color'?0:d.order});
 same(colorWithoutTargets(candidate,ids),colorWithoutTargets(baseline,ids),'Non-approach draw sequence changed');
 // Only the target color draw positions/order are permitted to differ. Native
 // geometry, material, range, calls, shadow sequence and all other work remain.
 const byIdentity=rows=>rows.map(normalize).sort((a,b)=>JSON.stringify(a).localeCompare(JSON.stringify(b)));
 same(byIdentity(candidate),byIdentity(baseline),'Draw multiset changed');
 for(const d of candidate.filter(d=>ids.has(d.object)&&d.pass==='color'))assert.equal(d.order,-103,'Candidate approach order');
 for(const d of baseline.filter(d=>ids.has(d.object)&&d.pass==='color'))assert.equal(d.order,0,'Baseline approach order');
 assert(baseline.some(d=>ids.has(d.object)&&d.pass==='color'&&d.calls>0),'No approach color draw in this view');
}
function checkCaseProof(result,c,index){
 assert.equal(c.index,index);assert.equal(c.name,CASE_NAMES[index]);assert.equal(c.night,index<12?index%2===1:index===12);assert.equal(c.timing,index<12);assert.equal(c.quality,index<12?'smooth':'high');same(c.settings.viewport,[1280,800,1]);
 if(index===0||index===1||index===12){same(c.camera.world,pins.observation.camera.matrixWorld,'Recorded start camera changed');same(c.camera.projection,pins.observation.camera.projectionMatrix,'Recorded projection changed');}
 assert.equal(c.settings.quality,c.quality);assert.equal(c.settings.effectiveQuality,c.quality);assert.equal(c.settings.scale,1);
 const sourceRatio=c.quality==='high'&&/SwiftShader/.test(result.gpu)?.7:1;
 assert.equal(c.settings.sourceQualityPixelRatio,sourceRatio);assert.equal(c.settings.fixturePixelRatio,1);assert.equal(c.settings.fixedResolutionOverride,sourceRatio!==1);assert.equal(c.settings.simulationTime,12+index);
 assert.equal(c.settings.hour,c.night?22:13);assert.equal(c.settings.artStyle,'authentic');
 for(const [key,value]of Object.entries({alpha:true,antialias:true,depth:true,stencil:false,preserveDrawingBuffer:false}))assert.equal(c.settings.context[key],value,'Original context '+key);
 assert.equal(c.settings.shadow.enabled,c.quality==='high');assert.equal(c.settings.shadow.type,1);assert.equal(c.settings.outputColorSpace,'srgb');assert.equal(c.settings.toneMapping,4);assert.equal(c.settings.exposure,1.02);
 assert.equal(c.context.sky.order,-100);assert(c.context.mainland.length>0&&c.context.mainland.every(m=>m.order===0),'Real mainland context missing');
 assert.equal(c.owners.length,2);for(const o of c.owners){assert.equal(o.vertices,1353);assert.equal(o.indices,7680);assert.equal(o.renderOrder,0);assert.equal(o.castShadow,false);assert.equal(o.receiveShadow,true);}
 const ids=c.owners.map(o=>o.id);same(ids,c.context.targets.map(o=>o.id));same(c.proof.map(r=>r.mode),PROOF_ORDER,'Missing or reordered image');
 const prepared=c.nativePreparation;assert(prepared,'Original preparation render was omitted');assert.equal(prepared.mode,'baseline');assert.equal(prepared.frameAfter,prepared.frameBefore+1);
 same(prepared.camera,c.camera);same(prepared.settings,c.settings);
 if(c.quality==='high'){
  assert(prepared.draws.some(d=>d.pass==='shadow'&&d.calls>0&&d.triangles>0),'High native caster pass missing');
  assert(prepared.shadowMaps.some(s=>s.castShadow&&s.intensity>0&&s.allocatedSize?.[0]>0&&s.allocatedSize?.[1]>0&&s.allocatedSize[0]===s.requestedSize[0]&&s.allocatedSize[1]===s.requestedSize[1]),'High native map allocation missing');
 }
 const reference=c.proof[0];assert.equal(reference.frameAfter,reference.frameBefore+1,'Extra renderer pass');let previousFrame=prepared.frameAfter;
 same(prepared.draws.filter(d=>d.pass==='color'),reference.draws.filter(d=>d.pass==='color'),'Preparation color work changed');
 for(const [i,r]of c.proof.entries()){
  assert.equal(r.index,i);same(r.camera,c.camera,'Proof camera changed');same(r.settings,c.settings,'Proof settings changed');
  same(r.difference,{pixels:0,maxChannelDelta:0},'RGBA difference or baseline drift');assert.match(r.pixelSha256,/^[0-9a-f]{64}$/);assert.equal(r.pixelSha256,reference.pixelSha256,'RGBA digest changed');
  assert(r.content?.nonzeroRgbPixels>1280*800*.01&&r.content?.distinctColorsAtLeast>=8&&r.content?.readback==='same-task before compositor yield','Blank or discarded framebuffer evidence');
  assert.equal(r.frameAfter,r.frameBefore+1,'Extra renderer pass');
  assert.equal(r.frameBefore,previousFrame,'Unrecorded proof render');previousFrame=r.frameAfter;
  if(r.mode==='candidate')compareDraws(reference.draws,r.draws,ids);else same(r.draws,reference.draws,'Baseline draw sequence changed');
 }
 if(c.pose.name==='real-road-occlusion'){const o=c.pose.occlusion;assert(o&&ids.includes(o.approach.id)&&!ids.includes(o.front.id)&&o.front.distance+.001<o.approach.distance,'Actual road occlusion missing');
  assert(['Joined island pavement · asphalt','Greater Detroit pavement','Joined ground · Island asphalt','Dequindre Cut greenway'].includes(o.front.name));
  assert(o.front.ownerKind==='source-asphalt-road'&&o.front.effectiveVisible===true&&o.front.materials?.length>0&&o.front.materials.every(m=>m.name==='Island asphalt'&&m.surface==='asphalt'&&m.visible===true),'Occluder is not an effectively visible source road');
  for(const r of [prepared,...c.proof,...c.samples])assert(r.draws.some(d=>d.pass==='color'&&d.object===o.front.id&&d.calls>0),'Selected occluder did not render');
 }
 return {ids,reference,previousFrame};
}
/** Called by the Node driver after all four original PNG/raw pairs have been
 * independently decoded. A failed case must never allocate an elapsed query. */
export function validateCorrectnessCase(result,index,captures){
 const verdict={passed:false,caseIndex:index,caseName:null,queriesBefore:null,independentPngRgba:false,
  drawConserved:false,baselineRestored:false,proofIdentity:null,error:null};
 try{
  assert(Number.isInteger(index)&&index>=0&&index<14);same(result.errors,[]);assert.equal(result.applicationSource,pins.applicationSource);same(result.viewport,[1280,800,1]);
  assert.equal(result.cases.length,index+1,'Only the current completed proof may authorize timing');
  const c=result.cases[index];assert(c);verdict.caseName=c.name;checkCaseProof(result,c,index);same(c.samples,[],'No timing may precede the proof verdict');
  const expectedQueries=Math.min(index,12)*20,q=result.queries;assert(q);assert.equal(q.live,0);assert.equal(q.disjoint,false);
  for(const key of ['created','resolved','deleted'])assert.equal(q[key],expectedQueries,'No elapsed query before current-case proof');assert.equal(q.rows.length,expectedQueries);
  const rows=captures.filter(r=>r.case===c.name);assert.equal(rows.length,4,'Four independently decoded images required');
  same(rows.map(r=>r.index),[0,1,2,3]);same(rows.map(r=>r.mode),PROOF_ORDER);
  assert.equal(new Set(rows.map(r=>r.file)).size,4);assert.equal(new Set(rows.map(r=>r.rawFile)).size,4);
  for(let i=0;i<4;i++){
   const r=rows[i],proof=c.proof[i],encoding=r.encoding;assert(encoding,'Independent PNG/raw decoding did not finish');
   assert.equal(r.pixelSha256,proof.pixelSha256);assert.equal(encoding.rawSha256,proof.pixelSha256);assert.equal(encoding.pngSha256,r.pngSha256);
   assert.match(r.pngSha256,/^[0-9a-f]{64}$/);assert.match(encoding.decodedRgbaSha256,/^[0-9a-f]{64}$/);
   assert.equal(encoding.decodedRgbaSha256,rows[0].encoding.decodedRgbaSha256,'Decoded PNG channels differ across ABBA');assert.equal(encoding.width,1280);assert.equal(encoding.height,800);
   same(r.independentDifference,{pixels:0,maxChannelDelta:0},'Independent raw RGBA difference or restoration drift');same(r.difference,proof.difference);
  }
  Object.assign(verdict,{passed:true,queriesBefore:expectedQueries,independentPngRgba:true,drawConserved:true,baselineRestored:true,proofIdentity:proofIdentity(c)});
 }catch(error){verdict.error=error.message;}
 return verdict;
}
function checkTimingAuthorization(c,index){
 const gate=c.correctnessGate;assert(gate?.authorized===true&&gate.passed===true,'No independent correctness authorization');
 assert.equal(gate.caseIndex,index);assert.equal(gate.caseName,c.name);assert.equal(gate.queriesBefore,index*20);
 for(const key of ['independentPngRgba','drawConserved','baselineRestored'])assert.equal(gate[key],true);
 same(gate.proofIdentity,proofIdentity(c),'Authorization belongs to different proof images');assert.equal(gate.error,null);
}
export function analyze(result){
 const output={diagnosticOnly:true,releaseAcceptance:false,complete:false,losslessAcrossRecordedCases:false,errors:[],cases:[],
  limitation:'Fixed-pose authored-world experiment with no avatar or controls sequence. GPU timers include diagnostic overhead. No original failure or release gate is cleared.'};
 try{
  same(result.errors,[],'Browser errors');assert.equal(result.applicationSource,pins.applicationSource);same(result.viewport,[1280,800,1]);
  assert.equal(result.cases.length,14,'Incomplete case set');assert.equal(result.queries.available,true);assert.equal(result.queries.disjoint,false);assert.equal(result.queries.live,0);
  for(const key of ['created','resolved','deleted'])assert.equal(result.queries[key],240,'Every query including warmups must complete');
  assert.equal(result.queries.rows.length,240);same(result.queries.rows.map(r=>r.id),Array.from({length:240},(_,i)=>i));
  const used=new Set();
  for(const [index,c]of result.cases.entries()){
   let {ids,reference,previousFrame}=checkCaseProof(result,c,index);
   const entry={name:c.name,quality:c.quality,pixelDifferences:0,timing:c.timing};output.cases.push(entry);
   if(!c.timing){same(c.samples,[]);continue;}
   checkTimingAuthorization(c,index);
   assert.equal(c.samples.length,20);same(c.samples.slice(0,4).map(s=>s.mode),PROOF_ORDER);same(c.samples.slice(4).map(s=>s.mode),MEASURED_ORDER);
   for(const [i,s]of c.samples.entries()){
    same(s.camera,c.camera,'Timing camera changed');same(s.settings,c.settings,'Timing settings changed');assert.equal(s.frameAfter,s.frameBefore+1);
    assert.equal(s.frameBefore,previousFrame,'Unrecorded measured render');previousFrame=s.frameAfter;
    if(s.mode==='candidate')compareDraws(reference.draws,s.draws,ids);else same(s.draws,reference.draws,'Timing draw sequence changed');
    const q=s.query;assert(!used.has(q.id),'Query reused');used.add(q.id);same(q,result.queries.rows[q.id],'Elapsed attribution changed');
    assert.equal(q.case,c.name);assert.equal(q.mode,s.mode);assert.equal(q.phase,i<4?'warmup':'measured');assert.equal(q.index,i<4?i:i-4);assert.equal(q.status,'resolved');assert(Number.isFinite(q.nanoseconds)&&q.nanoseconds>0);
   }
   const rows=c.samples.slice(4),baseline=rows.filter(s=>s.mode==='baseline').map(s=>s.query.nanoseconds/1e6),candidate=rows.filter(s=>s.mode==='candidate').map(s=>s.query.nanoseconds/1e6),paired=[];
   for(let i=0;i<rows.length;i+=2){const pair=rows.slice(i,i+2),a=pair.find(s=>s.mode==='baseline'),b=pair.find(s=>s.mode==='candidate');assert(a&&b);paired.push((b.query.nanoseconds/a.query.nanoseconds-1)*100);}
   entry.baselineMs=summary(baseline);entry.candidateMs=summary(candidate);entry.pairedDeltaPercent=summary(paired);
   entry.interpretation=entry.pairedDeltaPercent.mean<0?'candidate faster in this isolated sample':'candidate neutral or slower in this isolated sample';
  }
  assert.equal(used.size,240);output.complete=true;output.losslessAcrossRecordedCases=true;
 }catch(error){output.errors.push(error.message);}
 return output;
}
