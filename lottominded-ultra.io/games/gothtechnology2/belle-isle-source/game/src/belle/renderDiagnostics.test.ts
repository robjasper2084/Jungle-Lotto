import test from 'node:test';
import assert from 'node:assert/strict';
import * as T from 'three';
import {createNatureRenderProbe,NatureRenderProbe,copyNatureRenderFrame,RENDER_DIAGNOSTICS_NOTE} from './renderDiagnostics.ts';
import {FarTreeVisibility} from './farTreeVisibility.ts';

test('only an explicit manual query creates a probe and dormant probes never read the clock',()=>{
 let reads=0;const clock=()=>{reads++;return 1;};
 for(const query of ['', '?profile=1','?profile=automatic','?other=manual'])assert.equal(createNatureRenderProbe(query,clock),undefined);
 const p=createNatureRenderProbe('?profile=manual',clock)!;
 p.beginFrame(false);assert.equal(p.now(),0);p.elapsed('selectionCpuMs',0);p.pass();p.refresh();p.capture();p.pool(2,1);p.compact();p.marked('capture',4);assert.equal(p.finishFrame(),undefined);assert.equal(reads,0);
 p.beginFrame(true);p.now();assert.equal(reads,1);p.cancelFrame();assert.equal(p.finishFrame(),undefined);
});

test('pass timings aggregate selection inclusively, capture as a subset, and culling separately',()=>{
 let now=0;const p=new NatureRenderProbe(()=>now);p.beginFrame(true);
 for(let view=0;view<2;view++){
  p.pass();const select=p.now();now+=1;p.refresh();const capture=p.now();now+=3;p.elapsed('captureCpuMs',capture);p.capture();now+=1;p.elapsed('selectionCpuMs',select);
  const cull=p.now();now+=2;p.elapsed('cullCpuMs',cull);p.pool(100,30);p.compact();p.marked('capture',1600);p.marked('compaction',480);
 }
 const frame=p.finishFrame()!;
 assert.equal(frame.renderPasses,2);assert.equal(frame.selectionCpuMs,10);assert.equal(frame.captureCpuMs,6);assert.equal(frame.cullCpuMs,4);
 assert.equal(frame.farSourceInstancesAcrossViews,200);assert.equal(frame.farSubmittedInstancesAcrossViews,60);assert.equal(frame.captureBytesMarked,3200);assert.equal(frame.compactionBytesMarked,960);
 assert.match(RENDER_DIAGNOSTICS_NOTE,/INCLUDES captureCpuMs/);assert.match(RENDER_DIAGNOSTICS_NOTE,/not actual driver uploads or GPU time/);
 p.beginFrame(true);p.pass();const second=p.finishFrame()!;assert.equal(second.selectionCpuMs,0);assert.equal(frame.renderPasses,2,'finished snapshots cannot change on the next frame');
});

test('nonfinite timing and malformed counts are flagged without corrupting finite observations',()=>{
 const p=new NatureRenderProbe(()=>NaN);p.beginFrame(true);p.elapsed('cullCpuMs',0);p.marked('capture',Infinity);p.pool(2,3);
 const frame=p.finishFrame()!;assert.equal(frame.invalidObservations,3);assert.equal(frame.cullCpuMs,0);assert.equal(frame.captureBytesMarked,0);
 assert.equal(copyNatureRenderFrame({...frame,cullCpuMs:NaN}),null);const copy=copyNatureRenderFrame(frame)!;copy.renderPasses=99;assert.equal(frame.renderPasses,0);
});

function fixture(probe?:NatureRenderProbe){
 const mesh=new T.InstancedMesh(new T.BoxGeometry(1,1,1),new T.MeshBasicMaterial(),2);
 mesh.geometry.setAttribute('lodWeight',new T.InstancedBufferAttribute(new Float32Array([.3,.7]),1));
 mesh.geometry.setAttribute('canopyDensity',new T.InstancedBufferAttribute(new Float32Array([.8,.9]),1));
 mesh.setMatrixAt(0,new T.Matrix4().makeTranslation(0,0,-10));mesh.setMatrixAt(1,new T.Matrix4().makeTranslation(0,0,10));
 mesh.setColorAt(0,new T.Color(.2,.4,.6));mesh.setColorAt(1,new T.Color(.6,.4,.2));mesh.updateMatrixWorld(true);
 const helper=new FarTreeVisibility([mesh],probe),camera=new T.PerspectiveCamera(60,1,.1,100);camera.updateMatrixWorld(true);return {mesh,helper,camera};
}
test('read-only helper counters preserve all visible buffers and account for each actual view',()=>{
 const p=new NatureRenderProbe(()=>0),observed=fixture(p),plain=fixture();p.beginFrame(true);
 observed.helper.capture();plain.helper.capture();p.capture();
 for(const facing of [-1,1]){
  for(const f of [observed,plain]){f.camera.lookAt(0,0,facing*10);f.camera.updateMatrixWorld(true);f.helper.render(f.camera);}
  const a=observed.mesh,b=plain.mesh;assert.equal(a.count,b.count);assert.deepEqual(a.instanceMatrix.array,b.instanceMatrix.array);assert.deepEqual(a.instanceColor!.array,b.instanceColor!.array);
  assert.deepEqual(a.geometry.getAttribute('lodWeight').array,b.geometry.getAttribute('lodWeight').array);assert.deepEqual(a.geometry.getAttribute('canopyDensity').array,b.geometry.getAttribute('canopyDensity').array);
  assert.equal(a.instanceMatrix.version,b.instanceMatrix.version);assert.deepEqual(a.instanceMatrix.updateRanges,b.instanceMatrix.updateRanges);
 }
 const overlay=observed.camera.clone();overlay.layers.set(30);observed.helper.render(overlay);
 const frame=p.finishFrame()!;assert.equal(frame.farPoolViewCalls,2);assert.equal(frame.farSourceInstancesAcrossViews,4);assert.equal(frame.farSubmittedInstancesAcrossViews,2);assert.equal(frame.compactions,2);
 assert.equal(frame.captureAttributeMarks,4);assert.equal(frame.captureBytesMarked,168);assert.equal(frame.compactionAttributeMarks,4);assert.equal(frame.compactionBytesMarked,168);
});
