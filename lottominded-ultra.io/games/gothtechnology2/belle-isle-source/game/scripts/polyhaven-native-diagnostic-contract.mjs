/** Evidence checks for a separate, observed near-rock rendering diagnostic.
 * These never replace or change the original ninety-second performance gate. */
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';

export const ORIGINAL_HARNESS_BLOB='c722b5810a7693e5ece72ed00b4401e7cde7267a';
export const WINDOW_SECONDS=20;
export const VIEWPORT={width:1440,height:900};
export const PROTOTYPES=[
 ['namaqualand_boulder_03','boulder-automatic.glb'],
 ['rock_moss_set_01','moss-1-automatic.glb'],
 ['rock_moss_set_01','moss-2-automatic.glb'],
];
export const sha256=bytes=>createHash('sha256').update(bytes).digest('hex');
export const gitBlob=bytes=>createHash('sha1').update('blob '+bytes.length+'\0').update(bytes).digest('hex');
const finite=value=>typeof value==='number'&&Number.isFinite(value);
export const limitations=[
 'Candidate-only full-scene rendering diagnostic with observation overhead; releaseAcceptance is always false.',
 'The original ninety-second High/Smooth performance jobs remain separate and unmodified. This twenty-second stationary window does not clear any historical performance failure.',
 'Guide travel and native pointer look are real public inputs. This diagnostic does not establish walking, rock contact, unchanged collision behavior, or any appearance approval.',
 'Actual camera, geometry, instance and material receipts identify native submissions; a projected point or submitted instance does not prove an unoccluded visible pixel.',
 'CPU profiling, manual GL wrappers and two forwarding counters add overhead. Direct-draw CPU scopes include nested GL calls; overlapping operation times must not be added.',
 'GPU fences establish completion for screenshots, not GPU execution time. GPU execution and presentation latency are unmeasured.',
 'Browser CPU samples retain original signed time deltas and sampling gaps. Clock brackets are recorded, not replaced by interpolated samples.',
];

export function sourceArtifactContract({head,tree,expectedHead,artifact,runId,harness,assets,manifest}){
 assert.match(head,/^[0-9a-f]{40}$/);assert.match(tree,/^[0-9a-f]{40}$/);
 assert.equal(head,expectedHead,'Checkout differs from requested PR head');
 assert.equal(artifact.head,head,'Source-art head mismatch');assert.equal(artifact.tree,tree,'Source-art tree mismatch');
 assert.equal(String(artifact.runId),String(runId),'Source-art artifact belongs to another workflow run');
 assert.equal(gitBlob(harness),ORIGINAL_HARNESS_BLOB,'Original ninety-second driver changed');
 assert.equal(assets.length,3,'Exactly three original prototypes are required');
 for(const [index,[folder,file]] of PROTOTYPES.entries()){
  const row=assets[index];assert.equal(row.file,file);assert.equal(row.folder,folder);
  assert(row.source.equals(row.staged),'Staged prototype bytes changed: '+file);
  assert(row.source.equals(row.built),'Built prototype bytes changed: '+file);
  assert(manifest.includes('belle/polyhaven-review/'+file),'Preview manifest is missing '+file);
 }
 return {head,tree,harness:{gitBlob:gitBlob(harness),sha256:sha256(harness)},sourceArtifact:artifact,
  assets:assets.map(row=>({folder:row.folder,file:row.file,bytes:row.source.length,sha256:sha256(row.source)}))};
}

export function generatedTimingContract(before,after){
 const a=JSON.parse(before),b=JSON.parse(after);
 assert(finite(a.buildMs)&&a.buildMs>=0&&finite(b.buildMs)&&b.buildMs>=0,'Missing generated build timing');
 const {buildMs:oldMs,...oldData}=a,{buildMs:newMs,...newData}=b;
 assert.deepEqual(newData,oldData,'Generated source changed beyond the known buildMs field');
 return {beforeSha256:sha256(before),afterSha256:sha256(after),beforeText:before.toString(),afterText:after.toString(),onlyBuildMsChanged:true};
}

function transform(matrix,point){
 assert(Array.isArray(matrix)&&matrix.length===16&&matrix.every(finite),'Invalid original transform');
 const [x,y,z,w=1]=point;
 return [0,1,2,3].map(r=>matrix[r]*x+matrix[r+4]*y+matrix[r+8]*z+matrix[r+12]*w);
}
export function projectPoint(camera,point){
 const clip=transform(camera.projectionMatrix,transform(camera.matrixWorldInverse,point));
 assert(clip.every(finite)&&clip[3]>0,'Target is behind the actual camera');
 return clip.slice(0,3).map(v=>v/clip[3]);
}
export function chooseRockTarget(snapshot,resources,shape){
 assert([0,1,2].includes(shape),'Unknown prototype shape');
 const camera=snapshot.latest?.camera;
 assert(camera?.position?.length===3&&camera.position.every(finite),'Missing native camera');
 const pool='Clustered mapped mineral boulders '+shape+' near';
 const draw=snapshot.latest.rockDraws.find(row=>row.object.name===pool&&row.submitted?.calls>0);
 assert(draw&&draw.count>0,'No actual near-pool color submission for '+pool);
 const resource=resources.find(row=>row.key===draw.geometryResource),attribute=resource?.attributes.find(a=>a.name==='position');
 assert(attribute&&attribute.arrayType==='Float32Array'&&attribute.itemSize===3,'Unsupported original position buffer');
 const bytes=Buffer.from(attribute.bytes),stride=attribute.interleaved?attribute.stride:3,first=attribute.interleaved?attribute.offset:0;
 assert(Number.isSafeInteger(attribute.count)&&attribute.count>0&&Number.isSafeInteger(stride)&&stride>=3&&Number.isSafeInteger(first)&&first>=0&&first+3<=stride,'Invalid original position layout');
 assert(bytes.length%4===0&&((attribute.count-1)*stride+first+3)*4<=bytes.length,'Incomplete native position bytes');
 const low=[Infinity,Infinity,Infinity],high=[-Infinity,-Infinity,-Infinity];
 for(let i=0;i<attribute.count;i++)for(let j=0;j<3;j++){
  const v=bytes.readFloatLE((i*stride+first+j)*4);assert(finite(v),'Nonfinite native position');low[j]=Math.min(low[j],v);high[j]=Math.max(high[j],v);
 }
 const center=low.map((v,j)=>(v+high[j])/2),base=[center[0],low[1],center[2]],targets=[];
 for(let i=0;i<draw.count;i++){
  const instance=draw.instanceMatrix.slice(i*16,i*16+16);
  const world=point=>transform(draw.matrixWorld,transform(instance,point)).slice(0,3);
  const position=world(center),basePosition=world(base),distance=Math.hypot(...position.map((v,j)=>v-camera.position[j]));
  targets.push({shape,pool,geometryResource:draw.geometryResource,objectId:draw.object.id,instanceIndex:i,instanceMatrix:instance,position,basePosition,distance});
 }
 targets.sort((a,b)=>a.distance-b.distance);assert(targets[0]?.distance<140,'No nearby native target');return targets[0];
}
export function nativeLookPlan(camera,target){
 const direction=[-camera.matrixWorld[8],-camera.matrixWorld[9],-camera.matrixWorld[10]],delta=target.position.map((v,j)=>v-camera.position[j]);
 const yaw=Math.atan2(direction[0],direction[2]),desiredYaw=Math.atan2(delta[0],delta[2]);
 const difference=Math.atan2(Math.sin(desiredYaw-yaw),Math.cos(desiredYaw-yaw));
 const pitch=Math.atan2(-direction[1],Math.hypot(direction[0],direction[2])),desiredPitch=Math.atan2(-delta[1],Math.hypot(delta[0],delta[2]));
 const dx=Math.max(-1060,Math.min(1060,-difference/.003)),dy=Math.max(-280,Math.min(280,(desiredPitch-pitch)/.002));
 const from={x:dx>=0?180:1260,y:450},to={x:from.x+dx,y:from.y+dy};
 assert([from,to].every(p=>p.x>=100&&p.x<=1340&&p.y>=150&&p.y<=750),'Pointer plan escapes the actual canvas');
 return {from,to,steps:16,dx,dy,basis:'Original default sensitivity; native pointer drag only. Observed framing must be checked afterward.'};
}
export function targetFraming(camera,target){
 const center=projectPoint(camera,target.position),base=projectPoint(camera,target.basePosition);
 const inside=p=>Math.abs(p[0])<=.92&&Math.abs(p[1])<=.92&&p[2]>=-1&&p[2]<=1;
 return {center,base,projectedInside:inside(center)&&inside(base),occlusionAccepted:null,appearanceAccepted:null};
}

export function cpuCoverage(cpu,window,clockStart,clockEnd){
 const errors=[],check=(ok,why)=>{if(!ok)errors.push(why);};
 const probes=[clockStart,clockEnd];
 for(const p of probes)check(p&&finite(p.beforeMs)&&finite(p.afterMs)&&p.afterMs>=p.beforeMs&&finite(p.timestampSeconds),'Missing bracketed native clock');
 if(errors.length)return {errors};
 const lowerUs=Math.max(...probes.map(p=>p.timestampSeconds*1e6-p.afterMs*1000));
 const upperUs=Math.min(...probes.map(p=>p.timestampSeconds*1e6-p.beforeMs*1000));
 check(lowerUs<=upperUs,'Page/native clock brackets do not intersect');
 check(window&&finite(window.startMs)&&finite(window.endMs)&&window.endMs-window.startMs>=WINDOW_SECONDS*1000,'Fixed diagnostic window incomplete');
 const startUs=window?.startMs*1000+lowerUs,endUs=window?.endMs*1000+upperUs;
 const guaranteedStartUs=window?.startMs*1000+upperUs,guaranteedEndUs=window?.endMs*1000+lowerUs;
 check(finite(guaranteedStartUs)&&finite(guaranteedEndUs)&&guaranteedStartUs<guaranteedEndUs,'No guaranteed native-clock observation interior');
 const result={errors,clockOffsetBracketUs:[lowerUs,upperUs],windowBoundsUs:[startUs,endUs],samples:cpu?.samples?.length??0,
  guaranteedWindowBoundsUs:[guaranteedStartUs,guaranteedEndUs],samplesWithinOuterBounds:0,
  samplesDuringWindow:0,firstSampleUs:null,lastSampleUs:null,firstWindowSampleUs:null,lastWindowSampleUs:null,
  negativeDeltas:0,minimumRawDeltaUs:null,maximumRawDeltaUs:null,unknownNodes:0,invalidDeltas:0,outsideHeader:0,
  note:'Native profile startTime plus cumulative original signed timeDeltas. samplesDuringWindow counts only the guaranteed clock interior; the uncertainty envelope is counted separately. Full raw samples remain archived; brackets do not interpolate gaps.'};
 check(Array.isArray(cpu?.nodes)&&cpu.nodes.length>0&&Array.isArray(cpu?.samples)&&cpu.samples.length>0&&Array.isArray(cpu?.timeDeltas)&&cpu.samples.length===cpu.timeDeltas.length&&finite(cpu?.startTime)&&finite(cpu?.endTime),'Missing or malformed renderer CPU samples');
 if(errors.length)return result;
 const ids=new Set(cpu.nodes.map(n=>n.id));check(ids.size===cpu.nodes.length&&cpu.nodes.every(n=>Number.isSafeInteger(n.id)),'Invalid CPU node identities');
 let at=cpu.startTime;
 for(let i=0;i<cpu.samples.length;i++){
  const delta=cpu.timeDeltas[i];if(!finite(delta)){result.invalidDeltas++;at=NaN;}else{
   at+=delta;if(delta<0)result.negativeDeltas++;
   result.minimumRawDeltaUs=result.minimumRawDeltaUs===null?delta:Math.min(result.minimumRawDeltaUs,delta);
   result.maximumRawDeltaUs=result.maximumRawDeltaUs===null?delta:Math.max(result.maximumRawDeltaUs,delta);
  }
  if(i===0)result.firstSampleUs=at;result.lastSampleUs=at;
  if(!ids.has(cpu.samples[i]))result.unknownNodes++;
  if(finite(at)&&(at<cpu.startTime||at>cpu.endTime))result.outsideHeader++;
  if(finite(at)&&at>=startUs&&at<=endUs)result.samplesWithinOuterBounds++;
  if(finite(at)&&at>=guaranteedStartUs&&at<=guaranteedEndUs){result.samplesDuringWindow++;result.firstWindowSampleUs=result.firstWindowSampleUs===null?at:Math.min(result.firstWindowSampleUs,at);result.lastWindowSampleUs=result.lastWindowSampleUs===null?at:Math.max(result.lastWindowSampleUs,at);}
 }
 check(!result.invalidDeltas&&!result.unknownNodes&&!result.outsideHeader,'Invalid actual CPU sample timestamps or node IDs');
 check(cpu.startTime<=startUs&&cpu.endTime>=endUs&&result.firstSampleUs<=startUs&&result.lastSampleUs>=endUs&&result.samplesDuringWindow>0,'Actual CPU samples do not span the diagnostic window');
 return result;
}

export function diagnosticVerdict(report){
 const errors=[...(report.errors||[]),...(report.failedRequests||[])],check=(ok,why)=>{if(!ok)errors.push(why);};
 check(report.diagnosticOnly===true&&report.releaseAcceptance===false,'Diagnostic scope changed');
 check(report.hostPlatform==='darwin'&&/Metal/i.test(report.renderer||'')&&!/SwiftShader|llvmpipe|software rasterizer/i.test(report.renderer||''),'Real native Mac Metal required');
 check(report.source?.harness?.gitBlob===ORIGINAL_HARNESS_BLOB&&/^[0-9a-f]{40}$/.test(report.source?.head||'')&&/^[0-9a-f]{40}$/.test(report.source?.tree||''),'Exact source/harness identity missing');
 check(report.guide?.destination==='Nashua Canal'&&report.guide?.trusted===true,'Native public Nashua Guide input missing');
 check(report.looks?.length===3&&report.looks.every((row,i)=>row.shape===i&&row.trusted===true&&row.capture?.framing?.projectedInside),'Three bounded native look captures incomplete');
 for(const row of [...(report.looks||[]).map(row=>row.capture),report.afterCapture]){
  check(row?.fence?.gpuFence===true&&row?.observer?.ready===true&&row?.observer?.captureInvalidPasses===0,'Missing complete original native draw/fence evidence');
  check(row?.png?.bytes>=15000&&/^[0-9a-f]{64}$/.test(row?.png?.sha256||'')&&row?.png?.width===1440&&row?.png?.height===900,'Missing actual PNG receipt');
 }
 const p=report.manualProfile;
 for(const build of [p?.buildAtStart,p?.build])check(build?.status==='available'&&build?.source==='same-origin build marker'&&
  build?.marker?.commit===report.source?.head&&build?.marker?.indexSha256===report.buildMarker?.indexSha256&&
  build?.marker?.buildId===report.buildMarker?.buildId&&build?.marker?.profileQuery==='manual','Actual manual profiler build identity missing');
 check(p?.stopReason==='manual'&&p?.frames>=30&&p?.activeSeconds>=WINDOW_SECONDS-1&&p?.hiddenSeconds===0&&p?.droppedFrameSamples===0,'Manual rendering sample incomplete');
 check(JSON.stringify(p?.viewport)===JSON.stringify([1440,900,1]),'Actual viewport/DPR changed');
 for(const s of [p?.settingsAtStart,p?.settings])check(s?.quality==='high'&&s?.effectiveQuality==='high'&&s?.cap===60&&s?.pixelRatio===1&&s?.adaptiveScale===1&&s?.world?.performanceDiagnostic===false,'Full-scene High/60/scale selection changed');
 for(const c of [p?.submissionInstrumentation?.atStart,p?.submissionInstrumentation?.atFinish])check(c?.status==='complete','Native render operation hooks incomplete');
 check(p?.submissionDiagnostics?.profiledCallbacks>0&&p?.submissionDiagnostics?.invalidDiagnosticSamples===0,'Missing valid native rendering breakdown');
 check(report.receiptWindow?.active===false&&report.receiptWindow?.renderInvocations>0&&report.receiptWindow?.directInvocations>0&&report.receiptWindow?.wrongReceivers===0&&report.receiptWindow?.renderThrows===0&&report.receiptWindow?.directThrows===0,'Receipt-free forwarding interval incomplete');
 check(finite(report.window?.startMs)&&finite(report.window?.endMs)&&report.window.endMs-report.window.startMs>=WINDOW_SECONDS*1000&&
  report.receiptWindow?.startedAtMs<=report.window.startMs&&report.receiptWindow?.finishedAtMs>=report.window.endMs,'Expensive receipt work was not paused across the complete fixed window');
 for(const s of [report.settingsAtStart,report.settingsAtEnd])check(s?.quality==='high'&&s?.cap===60&&s?.hour===12&&s?.clouds==='clear'&&s?.cycle===false&&s?.lookSensitivity===1&&
  s?.focused===true&&s?.visibility==='visible'&&s?.reducedMotion===true&&JSON.stringify(s?.viewport)===JSON.stringify([1440,900,1])&&s?.url===report.url,'Actual native observation settings changed');
 check(report.cpu?.coverage?.errors?.length===0&&report.cpu?.coverage?.samplesDuringWindow>0,'Native CPU coverage incomplete');
 check(report.consumedScripts?.length>0&&report.consumedScripts.every(row=>row.verified===true),'Consumed application script bytes unbound');
 check(report.consumedAssets?.length===3&&PROTOTYPES.every(([,file])=>report.consumedAssets.some(row=>row.file===file&&row.verified===true)),'Consumed original prototypes unbound');
 check(report.inputs?.untrusted===0&&report.inputs?.dropped===0&&report.inputs?.errors?.length===0,'Native input receipts incomplete');
 for(const label of ['Start 10-minute capture','Stop and show report'])check(report.inputs?.rows?.some(row=>row.type==='click'&&row.trusted&&row.text===label),'Missing trusted manual profiler input: '+label);
 return {diagnosticOnly:true,releaseAcceptance:false,collectionComplete:errors.length===0,errors,
  observedManualP95Ms:p?.metrics?.frameMs?.p95??null,observedManualIntervalsOver250ms:p?.over250ms??null,
  performanceAccepted:null,appearanceAccepted:null,collisionAccepted:null,limitations};
}
