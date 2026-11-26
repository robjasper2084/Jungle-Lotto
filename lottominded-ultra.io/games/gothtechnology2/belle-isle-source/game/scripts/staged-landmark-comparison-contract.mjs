import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {readFile} from 'node:fs/promises';
import {resolve} from 'node:path';

export const sites=Object.freeze([
 {id:'107227742',key:'aquarium',name:'Belle Isle Aquarium',travel:'Travel to entrance',explore:'Explore aquarium on foot'},
 {id:'107310050',key:'conservatory',name:'Anna Scripps Whitcomb Conservatory',travel:'Travel to path',explore:'Explore Palm House on foot'},
]);
export const views=Object.freeze(sites.flatMap(site=>[
 {id:site.key+'-exterior',site:site.id,firstPerson:false,rideMode:'EUC',action:site.travel},
 {id:site.key+'-entrance',site:site.id,firstPerson:true,rideMode:'ON FOOT',action:site.travel+'; native F and V'},
 {id:site.key+'-interior',site:site.id,firstPerson:true,rideMode:'ON FOOT',action:site.explore},
]));
export const retainedNames=Object.freeze([
 '107227742_Aquarium illuminated habitat','107227742_Aquarium aged handrails','107227742_Aquarium worn step nosings',
 '107310050_Conservatory concrete paving','107310050_Timber','107310050_Water lily golden heart',
]);
export const legacyExteriorNames=Object.freeze([
 '107227742_Aquarium aged limestone','107227742_Aquarium exterior copper roof',
 '107310050_Conservatory clear panes','107310050_Conservatory restored gray steel',
]);
export const cameraContract=Object.freeze({
 rule:'Exact equality of the Float32 view matrix, projection matrix and world camera-position bit patterns submitted by the original game renderer.',
 raw:'All four raw camera matrices, raw world position, projection parameters and within-run scene/camera identity are retained. Identity values are not compared across builds.',
 settling:'At least six consecutive completely observed island color passes strictly after the one-shot native Start/settings boundary, with identical GPU camera inputs; every invalid pass after that boundary is fatal, including between views.',
 scope:'Camera equivalence is not actor-path, collision, image-equivalence, architectural fidelity or visual-overlap approval. Original native walk/contact and ninety-second gates remain separate.',
});
export const sha256=bytes=>createHash('sha256').update(bytes).digest('hex');
export const viewportFor=layout=>{assert(['desktop','phone'].includes(layout));return layout==='phone'?{width:390,height:844}:{width:1280,height:800};};
const normalized=name=>name.replace(/^(\d+)_/,(_,id)=>id+'|').replaceAll('_',' ').replace('|','_');
const matrices=['matrixWorld','matrixWorldInverse','projectionMatrix','projectionMatrixInverse'];
const cameraInputs=[['viewMatrix',16],['projectionMatrix',16],['cameraPosition',3]];
const finiteArray=(value,length)=>Array.isArray(value)&&value.length===length&&value.every(Number.isFinite);
const counterKeys=['calls','triangles','lines','points'];

export function assertObservedCamera(observation){
 assert(observation?.ready,'The observation is not ready');
 assert.deepEqual(observation.errors,[],'The observer recorded an error');
 const window=observation.captureWindow;
 assert.equal(window?.kind,'one-shot-native-pass-boundary','Missing the one-shot capture boundary');
 assert(Number.isFinite(window.atMs)&&window.atMs>=0&&Number.isSafeInteger(window.afterSequence)&&window.afterSequence>0,'Invalid capture boundary');
 assert(Number.isSafeInteger(window.afterRendererFrame)&&window.afterRendererFrame>=window.afterSequence,'Invalid native frame boundary');
 assert(Number.isSafeInteger(window.preparationInvalidPasses)&&window.preparationInvalidPasses>=0,'Missing preserved preparation count');
 assert.equal(observation.captureInvalidPasses,0,'The observer missed or invalidated a capture-window island pass');
 assert.equal(observation.invalidPasses,window.preparationInvalidPasses,'Lifetime invalid passes do not reconcile with the preserved preparation count');
 assert(Array.isArray(observation.firstInvalidPasses)&&observation.firstInvalidPasses.length===Math.min(observation.invalidPasses,8),'First invalid-pass receipts were lost');
 assert.deepEqual(observation.firstCaptureInvalidPasses,[],'A capture-window failure was retained');
 for(const row of observation.firstInvalidPasses){
  assert.equal(row.valid,false);assert.equal(row.observationPhase,'preparation');
  assert(Number.isSafeInteger(row.sequence)&&row.sequence>0&&row.sequence<=window.afterSequence,'A purported preparation failure occurred after arming');
  assert(row.issues?.length>0||row.threw===true,'A failed preparation receipt has no failure evidence');
 }
 assert.equal(observation.fresh,true,'The observed pass is stale');
 for(const key of ['renderer','render','direct','currentRenderHook','currentDirectHook'])assert.equal(observation.coverage?.[key],true,'Both current original renderer methods must be observed');
 assert.equal(observation.inventory?.overflow,false,'The scene inventory is incomplete');
 const row=observation.latest;
 assert(row?.valid&&Number.isSafeInteger(row.sequence)&&row.sequence>0,'The actual onscreen pass is invalid');
 assert.deepEqual(row.issues,[],'The actual onscreen pass has incomplete coverage');
 assert(row.colorDirectInvocations>0&&row.colorSubmitted?.calls>0,'No real color submission was observed');
 for(const key of counterKeys){
  assert(Number.isFinite(row.counters?.[key])&&row.counters[key]>=0,'Missing native draw counters');
  assert.equal(row.counters[key],row.nativeEndTotals?.[key],'Native renderer counters are not completely covered');
  assert.equal(row.counters[key],row.colorSubmitted[key]+row.shadowSubmitted[key]+row.otherSubmitted[key],'Submitted counters do not reconcile');
 }
 for(const camera of [row.camera,row.postCamera]){
  assert(camera?.type==='PerspectiveCamera','Expected the real island perspective camera');
  for(const key of matrices)assert(finiteArray(camera[key],16),'Missing raw '+key);
  assert(finiteArray(camera.position,3),'Missing raw camera position');
  for(const [key,length] of cameraInputs){
   assert(finiteArray(camera.gpu?.[key],length),'Missing Float32 '+key);
   const bits=camera.gpu[key+'Bits'];
   assert(Array.isArray(bits)&&bits.length===length&&bits.every(v=>Number.isSafeInteger(v)&&v>=0&&v<=0xffffffff),'Invalid camera bit pattern');
   const floats=new Float32Array(camera.gpu[key]);
   assert.deepEqual(Array.from(floats),camera.gpu[key],'Camera GPU values are not Float32 representable');
   assert.deepEqual(Array.from(new Uint32Array(floats.buffer)),bits,'Camera GPU values and bit patterns disagree');
   const raw=key==='viewMatrix'?camera.matrixWorldInverse:key==='projectionMatrix'?camera.projectionMatrix:camera.position;
   assert.deepEqual(Array.from(new Float32Array(raw)),camera.gpu[key],'GPU receipt does not represent the actual raw camera input');
  }
  for(const key of ['fov','aspect','near','far','zoom'])assert(Number.isFinite(camera.projection?.[key]),'Missing actual projection parameter');
 }
 assert.equal(row.camera.uuid,row.postCamera.uuid);
 assert.equal(row.camera.id,row.postCamera.id);
 for(const key of [...matrices,'position','projection'])assert.deepEqual(row.camera[key],row.postCamera[key],'Camera changed after its color submissions');
 const tail=observation.history?.slice(-6);
 assert(tail?.length===6,'Six complete post-boundary passes are required');
 assert.equal(tail.at(-1).sequence,row.sequence,'The settling history is not current');
 for(const [index,pass] of tail.entries()){
  assert(pass.valid===true&&pass.observationPhase==='capture'&&pass.sequence>window.afterSequence,'A settling pass predates the capture boundary or is invalid');
  assert.equal(pass.sequence,tail[0].sequence+index,'The settling history has a missing pass');
  assert.deepEqual(pass.issues,[]);assert.equal(pass.scene.uuid,row.scene.uuid);assert.equal(pass.camera.uuid,row.camera.uuid);
  for(const [key] of cameraInputs)assert.deepEqual(pass.camera.gpu[key+'Bits'],row.camera.gpu[key+'Bits'],'The camera did not settle for six complete passes');
 }
 return row.camera;
}

export function assertCameraMatch(before,after){
 const a=assertObservedCamera(before),b=assertObservedCamera(after);
 for(const [key] of cameraInputs)assert.deepEqual(a.gpu[key+'Bits'],b.gpu[key+'Bits'],'Actual submitted '+key+' differs');
 assert.deepEqual(a.projection,b.projection,'Projection metadata differs');
 return{matched:true,rule:cameraContract.rule,beforeRaw:a,afterRaw:b};
}

export function assertModeInventory(observation,mode){
 assert(['default','staged'].includes(mode));assertObservedCamera(observation);
 const nodes=observation.inventory.nodes,names=new Set(nodes.map(n=>normalized(n.name)));
 for(const name of retainedNames)assert(names.has(name),'Retained interior detail is missing: '+name);
 const staged=nodes.filter(n=>/^\d+_STAGED_LODS$/.test(n.name));
 if(mode==='default'){
  assert.equal(staged.length,0,'Default mode installed staged roots');
  for(const name of legacyExteriorNames)assert(names.has(name),'Default original facade is absent: '+name);
 }else{
  assert.equal(staged.length,2,'Both staged buildings must be installed');
  for(const name of legacyExteriorNames)assert(!names.has(name),'A replaced original facade is still attached: '+name);
  for(const site of sites){
   const lod=staged.find(n=>n.name===site.id+'_STAGED_LODS');
   assert(lod?.worldVisible,'The staged LOD root is not visible');
   for(let level=0;level<3;level++){
    const root=nodes.find(n=>n.name===site.id+'_STAGED_LOD'+level&&n.parentId===lod.id);
    assert(root,'A staged model level is missing');
    assert.equal(root.worldVisible,level===0,'Near-site comparison must select only full-detail LOD0');
   }
  }
 }
}

export function assertNativeRoute(evidence,layout='desktop'){
 assert(evidence?.events?.length>0,'No native input receipts');
 assert.equal(evidence.overflow,false);assert.deepEqual(evidence.held,[]);assert.deepEqual(evidence.focusLossDuringInput,[]);
 assert(evidence.events.every(e=>e.trusted===true),'Untrusted input was observed');
 assert(evidence.events.some(e=>e.type==='click'&&e.target==='#start'),'Missing native Start click');
 for(const site of sites)for(const action of [site.travel,site.explore]){
  assert(evidence.events.some(e=>e.type==='click'&&e.text===action&&e.landmark===site.name),'Missing exact public Guide action for '+site.name+': '+action);
 }
 for(const code of ['KeyF','KeyV'])for(const type of ['keydown','keyup'])assert(evidence.events.some(e=>e.type===type&&e.code===code),'Missing native '+code+' '+type);
 for(const [target,value] of [['#sky-preset','12'],['#sky-clouds','clear'],['#quality',layout==='phone'?'smooth':'high'],['#fps',layout==='phone'?'30':'60']]){
  for(const type of ['input','change'])assert(evidence.events.some(e=>e.type===type&&e.target===target&&e.value===value),'Missing trusted final settings '+type+' for '+target);
 }
 assert(!evidence.events.some(e=>['KeyW','KeyA','KeyS','KeyD'].includes(e.code)),'Canonical comparison anchors must not acquire a movement-key offset');
}

export function assertCapture(capture,{mode,layout}){
 const expected=views.find(view=>view.id===capture.id);assert(expected,'Unexpected comparison view');
 const viewport=viewportFor(layout);assert.deepEqual(capture.viewport,viewport);assert.equal(capture.site,expected.site);
 assert.equal(capture.firstPerson,expected.firstPerson);assert.equal(capture.rideMode,expected.rideMode);
 const settings=capture.settings;
 assert.equal(settings?.focused,true);assert.equal(settings.visible,true);assert.equal(settings.reducedMotion,true);assert.equal(settings.startupMotion,true);
 assert.equal(settings.skyCycle,false);assert.equal(settings.skyHour,12);assert.equal(settings.clouds,'clear');
 assert.equal(settings.quality,layout==='phone'?'smooth':'high');assert.equal(settings.effectiveQuality,settings.quality);
 assert.equal(settings.fps,layout==='phone'?'30':'60');assert.equal(settings.devicePixelRatio,1);
 assert.equal(settings.effectiveFrameCap,Number(settings.fps));assert.equal(settings.renderPixelRatio,1);
 assert.equal(settings.adaptiveScale,1,'Fixed High/Smooth comparison must retain the full rendering scale');
 assert.equal(settings.innerWidth,viewport.width);assert.equal(settings.innerHeight,viewport.height);
 assert(settings.contextAttributes&&typeof settings.contextAttributes.antialias==='boolean','Missing actual WebGL context attributes');
 assert.equal(capture.gpu?.gpuFence,true);assert.equal(capture.gpu.paintOpportunities,2);
 assert.equal(capture.gpu.width,viewport.width);assert.equal(capture.gpu.height,viewport.height);
 assert.match(capture.gpu.renderer,/Metal/i);assert.doesNotMatch(capture.gpu.renderer,/SwiftShader|llvmpipe|software rasterizer/i);
 for(const observed of [capture.before,capture.after])assertModeInventory(observed,mode);
 assertCameraMatch(capture.before,capture.after);
 assert.equal(capture.before.latest.camera.uuid,capture.after.latest.camera.uuid,'The camera object changed during capture');
 assert.equal(capture.before.latest.scene.uuid,capture.after.latest.scene.uuid,'The scene changed during capture');
 assert(capture.after.latest.sequence>capture.before.latest.sequence,'No actual rendered frame advanced across capture');
 assert.equal(capture.file,capture.id+'.png');assert.match(capture.sha256,/^[a-f0-9]{64}$/);assert(capture.bytes>15000);
 return capture;
}

export async function verifyCapturePng(capture,directory,viewport){
 const bytes=await readFile(resolve(directory,capture.file));
 assert.equal(bytes.length,capture.bytes);assert.equal(sha256(bytes),capture.sha256);
 assert.equal(bytes.subarray(0,8).toString('hex'),'89504e470d0a1a0a');assert.equal(bytes.toString('ascii',12,16),'IHDR');
 assert.equal(bytes.readUInt32BE(16),viewport.width);assert.equal(bytes.readUInt32BE(20),viewport.height);
}

export function assertSourceAssets(assets){
 assert(Array.isArray(assets)&&assets.length===12,'All twelve source assets must be bound to both builds');
 assert.equal(new Set(assets.map(a=>a.file)).size,12);
 for(const asset of assets){
  assert.match(asset.file,/^[a-zA-Z0-9_.-]+\.glb$/);assert.match(asset.sha256,/^[a-f0-9]{64}$/);
  assert(Number.isSafeInteger(asset.bytes)&&asset.bytes>0);assert(Number.isInteger(asset.lod)&&asset.lod>=0&&asset.lod<=2);
 }
 for(const site of sites)assert.equal(assets.filter(a=>a.site===site.id).length,3,'Missing active-site source LODs');
}

export function assertModeReport(report){
 assert.equal(report.passed,true,'A capture mode did not complete successfully');assert.match(report.sourceSha,/^[a-f0-9]{40}$/);
 assert.match(report.sourceTree,/^[a-f0-9]{40}$/);assert(['default','staged'].includes(report.mode));viewportFor(report.layout);
 assert.deepEqual(report.errors,[]);assert.deepEqual(report.failedRequests,[]);assertNativeRoute(report.nativeEvidence,report.layout);
 const boundary=report.captureWindow;
 assert.equal(boundary?.kind,'one-shot-native-pass-boundary','Missing mode capture boundary');
 const setup=report.nativeEvidence.events.filter(event=>event.type==='click'&&event.target==='#start'||
  ['input','change'].includes(event.type)&&['#sky-preset','#sky-clouds','#quality','#fps'].includes(event.target));
 assert(setup.length>0&&setup.every(event=>Number.isFinite(event.at)&&event.at<=boundary.atMs),'The capture boundary predates trusted native startup/settings');
 const travel=report.nativeEvidence.events.filter(event=>event.type==='click'&&sites.some(site=>event.landmark===site.name&&[site.travel,site.explore].includes(event.text)));
 assert(travel.every(event=>Number.isFinite(event.at)&&event.at>=boundary.atMs),'Guide traversal occurred before the capture boundary');
 assertSourceAssets(report.sourceAssets);const build=report.build;
 assert.equal(build?.sourceSha,report.sourceSha);assert.equal(build.sourceTree,report.sourceTree);assert.equal(build.mode,report.mode);
 assert.equal(build.flag,report.mode==='staged'?'1':'0');assert.deepEqual(build.sourceAssets,report.sourceAssets);
 assert.match(build.indexSha256,/^[a-f0-9]{64}$/);assert.match(build.assetManifestSha256,/^[a-f0-9]{64}$/);
 assert.equal(build.generatedTiming?.onlyBuildMsChanged,true);assert.equal(build.generatedTiming.restoredOriginalBytes,true);
 assert(build.compiled?.length>0&&build.compiled.every(f=>/^[a-f0-9]{64}$/.test(f.sha256)&&f.bytes>0),'Missing compiled application byte receipts');
 if(report.mode==='default'){
  assert.deepEqual(build.builtStagedAssets,[]);assert.equal(build.stagedManifestPresent,false);
  assert.deepEqual(report.stagedRequests,[],'Default runtime requested staged assets');
 }else{
  assert.deepEqual(build.builtStagedAssets,report.sourceAssets);assert.equal(build.stagedManifestPresent,true);
  const expected=report.sourceAssets.filter(a=>sites.some(site=>site.id===a.site)).sort((a,b)=>a.file.localeCompare(b.file));
  assert(report.stagedRequests.every(request=>request.status===200),'A staged model request did not succeed');
  const loaded=report.stagedRequests.map(({file,sha256,bytes})=>({file,sha256,bytes})).sort((a,b)=>a.file.localeCompare(b.file));
  assert.deepEqual(loaded,expected.map(({file,sha256,bytes})=>({file,sha256,bytes})),'Actual staged network bytes do not match all six active model levels');
 }
 assert.equal(report.captures.length,6);assert.equal(new Set(report.captures.map(c=>c.id)).size,6);
 for(const view of views){
  const capture=report.captures.find(c=>c.id===view.id);assertCapture(capture,report);
  for(const observation of [capture.before,capture.after])assert.deepEqual(observation.captureWindow,boundary,'The capture window was changed or reset between views');
 }
}

/** Normal npm builds rewrite one tracked diagnostic's buildMs. Verify the
 * complete parsed payload before allowing only its exact prebuild bytes back. */
export function assertGeneratedTimingChange(beforeBytes,afterBytes){
 const before=JSON.parse(beforeBytes),after=JSON.parse(afterBytes);
 assert(Number.isFinite(before.buildMs)&&before.buildMs>=0&&Number.isFinite(after.buildMs)&&after.buildMs>=0,'Missing generated build timing');
 const beforeMs=before.buildMs,afterMs=after.buildMs;delete before.buildMs;delete after.buildMs;
 assert.deepEqual(after,before,'Generated street metadata changed beyond buildMs; do not restore or exempt it');
 return{onlyBuildMsChanged:true,beforeBuildMs:beforeMs,afterBuildMs:afterMs,beforeSha256:sha256(beforeBytes),afterSha256:sha256(afterBytes)};
}

export function compareReports(baseline,candidate){
 assertModeReport(baseline);assertModeReport(candidate);assert.equal(baseline.mode,'default');assert.equal(candidate.mode,'staged');
 for(const key of ['sourceSha','sourceTree','layout','browser'])assert.equal(baseline[key],candidate[key],'The two modes differ in '+key);
 assert.deepEqual(baseline.sourceAssets,candidate.sourceAssets,'The modes do not bind the same source assets');
 const pairs=views.map(view=>{
  const a=baseline.captures.find(c=>c.id===view.id),b=candidate.captures.find(c=>c.id===view.id);
  assert.deepEqual(a.settings,b.settings,'The view settings differ');assert.equal(a.gpu.renderer,b.gpu.renderer,'The native renderer differs');
  return{id:view.id,baseline:a.file,candidate:b.file,camera:assertCameraMatch(a.before,b.before)};
 });
 return{automatedEvidencePassed:true,sourceSha:baseline.sourceSha,sourceTree:baseline.sourceTree,layout:baseline.layout,pairs,
  cameraContract,manualVisualReviewRequired:true,visualOverlapAccepted:null,appearanceAccepted:null,collisionAccepted:null,performanceAccepted:null};
}
