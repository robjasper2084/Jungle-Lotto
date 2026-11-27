import assert from 'node:assert/strict';
import {pins} from './provenance.mjs';

const equal=(a,b,label)=>assert.deepEqual(a,b,label);
const without=(o,keys)=>Object.fromEntries(Object.entries(o).filter(([k])=>!keys.includes(k)));
const roofPath=p=>/107227742_STAGED_LOD[012](?:%|\/|#)/.test(p)&&p.includes('PatinatedCopperPanels');

export function assertScenePair(before,candidate){
 equal(before.scene,candidate.scene,'Non-roof scene environment/fog/light state changed');
 assert.equal(before.objects.length,candidate.objects.length,'World object membership changed');let roofs=0;
 for(let i=0;i<before.objects.length;i++){
  const a=before.objects[i],b=candidate.objects[i];equal(a.path,b.path,'World hierarchy/order changed');
  if(!a.isRoof){equal(a,b,'Non-roof geometry/material/transform/shadow changed: '+a.path);continue;}
  roofs++;assert(roofPath(a.path));equal(without(a,['geometry']),without(b,['geometry']),'Roof material/transform/shadow changed');
  const x=a.geometry,y=b.geometry;equal(without(x,['attributes','index','boundingBox','boundingSphere']),without(y,['attributes','index','boundingBox','boundingSphere']),'Roof groups/draw policy changed');
  equal(Object.keys(x.attributes),Object.keys(y.attributes),'Roof attribute set changed');assert(!x.attributes.normal&&!y.attributes.normal,'Original flat roof gained normals');
  for(const name of Object.keys(x.attributes)){
   const aa=x.attributes[name],bb=y.attributes[name];assert.equal(aa.count,96);assert.equal(bb.count,150);
   equal(without(aa,['sha256','prefixSha256','count','bytes']),without(bb,['sha256','prefixSha256','count','bytes']),'Roof attribute storage changed');
   equal(aa.sha256,aa.prefixSha256,'Original roof prefix is incomplete');equal(bb.prefixSha256,aa.sha256,'An existing roof vertex/attribute changed');
  }
  assert.equal(x.index.count,144);assert.equal(y.index.count,294);
  equal(without(x.index,['sha256','prefixSha256','count','bytes']),without(y.index,['sha256','prefixSha256','count','bytes']),'Roof index representation changed');
  equal(x.index.sha256,y.index.prefixSha256,'An existing roof triangle changed');
 }
 assert.equal(roofs,3,'Expected three sole geometry exceptions');return {objects:before.objects.length,roofExceptions:roofs};
}
export function assertCamera(receipt,reference){
 equal(receipt.gpu.view.bits,reference.gpu.viewMatrixBits,'Actual submitted view Float32 bits changed');
 equal(receipt.gpu.projection.bits,reference.gpu.projectionMatrixBits,'Actual submitted projection Float32 bits changed');
 equal(receipt.gpu.position.bits,reference.gpu.cameraPositionBits,'Actual submitted camera position Float32 bits changed');
 equal(receipt.projection,reference.projection,'Projection parameters changed');
}
export function assertFence(completion){
 assert(Number.isFinite(completion?.submittedAt)&&Number.isFinite(completion?.completedAt)&&completion.completedAt>=completion.submittedAt,'Native GPU fence completion is missing or invalid');
 assert(['ALREADY_SIGNALED','CONDITION_SATISFIED'].includes(completion.result),'Native GPU fence did not signal');
}
export function assertDrawPair(a,b){
 assert.equal(a.length,b.length,'Actual native direct-submission count changed');let roofColor=0,roofShadow=0;
 for(let i=0;i<a.length;i++){
  const x=a[i],y=b[i];equal(x.path,y.path,'Native direct draw order changed');
  if(!roofPath(x.path)){equal(x,y,'Non-roof actual native submission changed: '+x.path);continue;}
  equal(without(x,['triangles','submittedGeometry']),without(y,['triangles','submittedGeometry']),'Roof draw/material/camera/shadow policy changed');
  assert.equal(x.calls,y.calls);assert.equal(y.triangles-x.triangles,50*x.calls,'Roof submission must add exactly 50 triangles per native draw');
  equal(without(x.submittedGeometry,['positionCount','indexCount']),without(y.submittedGeometry,['positionCount','indexCount']),'Roof draw range changed');
  assert.equal(x.submittedGeometry.positionCount,96);assert.equal(y.submittedGeometry.positionCount,150);
  assert.equal(x.submittedGeometry.indexCount,144);assert.equal(y.submittedGeometry.indexCount,294);
  if(x.pass==='color')roofColor+=x.calls;if(x.pass==='shadow')roofShadow+=x.calls;
 }
 assert(roofColor>0,'No actual full-detail color roof draw');return {roofColor,roofShadow};
}
function checkFrame(frame,view,mode){
 assertCamera(frame.camera,view.camera);const o=frame.observer;
 assert(o.latest?.valid&&o.fresh&&o.ready&&o.captureInvalidPasses===0&&!o.errors.length,'Original submission coverage is incomplete');
 assert(o.coverage.renderer&&o.coverage.render&&o.coverage.direct&&o.coverage.currentRenderHook&&o.coverage.currentDirectHook);
 equal(o.latest.camera.gpu.viewMatrixBits,view.camera.gpu.viewMatrixBits,'Independent actual native view bits differ');
 equal(o.latest.camera.gpu.projectionMatrixBits,view.camera.gpu.projectionMatrixBits,'Independent actual native projection bits differ');
 equal(o.latest.camera.gpu.cameraPositionBits,view.camera.gpu.cameraPositionBits,'Independent native camera position bits differ');
 const s=frame.settings;equal(s.viewport,{width:1280,height:800,pixelRatio:1,devicePixelRatio:1});
 assert(s.quality==='high'&&s.effectiveQuality==='high'&&s.scale===1&&s.hour===12&&s.reducedMotion&&s.focused&&s.visible);
 assert(s.skySettings?.cycle===false&&s.skySettings.clouds==='clear'&&s.artStyle==='authentic');
 assert(frame.preparationActivity?.loads===0&&frame.preparationActivity.compiles===0&&!frame.preparationActivity.errors.length,'Late original scenery work during capture');
 assertFence(frame.completion);
 assert(s.shadow.enabled&&s.shadow.type===1&&s.actualContext?.preserveDrawingBuffer===false,'Original context/shadow policy changed');
 const r=frame.draws.filter(d=>d.pass==='color'&&roofPath(d.path)&&d.calls>0);
 assert.equal(r.length,1);assert(r[0].path.includes('107227742_STAGED_LOD0#'));assert.equal(r[0].triangles,mode==='before'?48:98);
}
export function analyze(raw){
 const result={diagnosticOnly:true,releaseAcceptance:false,complete:false,manualAppearanceReviewRequired:true,pixelEquivalent:false,errors:[],cases:[]};
 try{
  assert(raw.before&&raw.candidate,'Both native variants required');
  for(const mode of ['before','candidate']){
   const e=raw[mode];equal(e.source,pins.sources[mode]);assert.equal(e.mode,mode);assert(/Metal/.test(e.gpu)&&!/SwiftShader|llvmpipe/i.test(e.gpu));
   assert.equal(e.errors.length,0,'Native fixture recorded an error');assert.equal(e.cases.length,4);equal(e.construction,pins.construction);
  }
  equal(raw.before.gpu,raw.candidate.gpu,'GPU changed across native variants');
  for(let i=0;i<4;i++){
   const view=pins.nativeBeforeEvidence.views[i],a=raw.before.cases[i],b=raw.candidate.cases[i];
   try{
    equal(a.name,view.name);equal(b.name,view.name);equal(a.time,b.time);equal(a.roofRegion,b.roofRegion,'Roof crop differs across pair');
    assert.equal(a.captures.length,2);assert.equal(b.captures.length,2);
    equal(a.scene,a.sceneAfter,'Before world changed between frozen captures');equal(b.scene,b.sceneAfter,'Candidate world changed between frozen captures');
    const conservation=assertScenePair(a.scene,b.scene);equal(a.stats,b.stats,'World preparation/culling statistics changed');
    equal(a.preparationQuiet.publishedDetroitProps,b.preparationQuiet.publishedDetroitProps,'Original Detroit prop publication changed');
    assert(a.preparationQuiet.publishedDetroitProps.categories.length>0&&a.preparationQuiet.publishedDetroitProps.categories.every(r=>r.actual===r.instances),'Original Detroit props not published');
    for(const [e,mode] of [[a,'before'],[b,'candidate']]){
     equal(e.captures[0].pixelSha256,e.captures[1].pixelSha256,'Frozen repeated framebuffer is not stable');
     equal(e.captures[0].preparationActivity,e.captures[1].preparationActivity,'Original scenery work continued between frozen captures');
     for(const frame of e.captures)checkFrame(frame,view,mode);
     assert(e.preparationPasses[0].draws.some(d=>d.pass==='shadow'&&d.calls>0&&d.triangles>0),'Missing original native shadow preparation');
     assert(e.preparationPasses[0].shadowMaps.some(s=>s.castShadow&&s.intensity>0&&s.allocated?.every(x=>x>0)),'Missing native High shadow allocation');
    }
    equal(a.captures[0].settings,b.captures[0].settings,'Original native settings differ');
    equal(a.preparationPasses[0].shadowMaps,b.preparationPasses[0].shadowMaps,'Shadow maps/camera/allocation changed');
    const prep=assertDrawPair(a.preparationPasses[0].draws,b.preparationPasses[0].draws);
    assert(prep.roofShadow>0,'Native roof shadow submission was not observed');
    for(let n=0;n<2;n++)assertDrawPair(a.captures[n].draws,b.captures[n].draws);
    result.cases.push({name:view.name,conservation,nativeRoofPreparation:prep,repeatedFramesExact:true,controlledCameraOnly:true});
   }catch(error){result.errors.push(view.name+': '+error.message);}
  }
 }catch(error){result.errors.push(error.message);}
 result.complete=result.errors.length===0&&result.cases.length===4;return result;
}
export function assertSourcePair(a,b){
 equal(a.source,pins.sources.before);equal(b.source,pins.sources.candidate);
 const aa=a.inputs,bb=b.inputs;equal(aa.map(r=>r.path),bb.map(r=>r.path),'Compiled module graph changed');
 const differences=[];
 for(let i=0;i<aa.length;i++)if(aa[i].sha256!==bb[i].sha256)differences.push(aa[i].path);
 equal(differences,[pins.gamePath+'/src/belle/stagedLandmarkStudies.ts'],'Unexpected bundled application source delta');
 for(const source of [a,b]){const props=source.inputs.find(r=>r.path===pins.gamePath+'/'+pins.detroitProps.path);
  assert(props,'The inlined original Detroit prop asset was omitted from source provenance');equal(props.sha256,pins.detroitProps.sha256);equal(props.gitBlob,pins.detroitProps.gitBlob);equal(props.bytes,pins.detroitProps.bytes);}
}
