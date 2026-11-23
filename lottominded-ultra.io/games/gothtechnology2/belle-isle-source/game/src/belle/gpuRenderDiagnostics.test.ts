import test from 'node:test';
import assert from 'node:assert/strict';
import {ManualGpuProbe,gpuDiagnosticRequested,GPU_DIAGNOSTIC_LIMITS} from './gpuRenderDiagnostics.ts';

class FakeGL {
 CURRENT_QUERY=1;QUERY_RESULT_AVAILABLE=2;QUERY_RESULT=3;
 extension={TIME_ELAPSED_EXT:4,GPU_DISJOINT_EXT:5};
 available=true;lost=false;disjoint=false;foreign=false;failBegin=false;
 duration=2_000_000;active:object|null=null;next=0;resultReads=0;
 records=new Map<object,{ready:boolean;ns:number}>();events:string[]=[];
 getExtension(){return this.available?this.extension:null;}
 isContextLost(){return this.lost;}
 getParameter(){return this.disjoint;}
 getQuery(){return this.foreign?{}:this.active;}
 createQuery(){const query={id:++this.next};this.records.set(query,{ready:false,ns:this.duration});return query;}
 deleteQuery(query:object){this.events.push('delete');this.records.delete(query);}
 beginQuery(_target:number,query:object){if(this.failBegin)throw Error('driver begin failed');assert.equal(this.active,null,'timer queries never nest');this.active=query;this.events.push('begin');}
 endQuery(){assert.ok(this.active);this.active=null;this.events.push('end');}
 getQueryParameter(query:object,parameter:number){
  const record=this.records.get(query);assert.ok(record);
  if(parameter===this.QUERY_RESULT_AVAILABLE){this.events.push('available');return record.ready;}
  assert.equal(parameter,this.QUERY_RESULT);assert.equal(record.ready,true,'never read an unavailable query');this.resultReads++;this.events.push('result');return record.ns;
 }
 resolve(){for(const item of this.records.values())item.ready=true;}
}
function fixture(){
 const gl=new FakeGL();let nativeDraws=0,nativeRenders=0,nativeShadows=0;
 const scene={id:1,name:'World'},camera={},light={id:2,name:'Sun'};
 const geometry={id:3,attributes:{position:{count:180}},index:{count:300}};
 const material={id:4,name:'Water',type:'MeshPhysicalMaterial'},depth={id:5,name:'Depth',type:'MeshDepthMaterial'};
 const mesh={id:6,name:'River',parent:scene,isInstancedMesh:true,count:7};
 const result={unchanged:true};
 const renderer={
  domElement:{width:1440,height:900},getContext(){return gl;},getRenderTarget(){return null;},
  renderBufferDirect(_camera:unknown,_scene:unknown,_geometry:unknown,_material:unknown,_mesh:unknown,_group:unknown){nativeDraws++;gl.events.push('native-draw');return result;},
  shadowMap:{enabled:true,autoUpdate:true,needsUpdate:true,render(_lights:unknown,_scene:unknown,_camera:unknown){nativeShadows++;renderer.renderBufferDirect(camera,scene,geometry,depth,mesh,null);}},
  render(_scene:unknown,_camera:unknown){nativeRenders++;renderer.shadowMap.render([light],scene,camera);for(let i=0;i<400;i++)renderer.renderBufferDirect(camera,scene,geometry,material,{...mesh,id:i+6,name:'Object '+i},{start:0,count:300});return result;},
 };
 return {gl,renderer,scene,camera,result,geometry,material,mesh,counts:()=>({nativeDraws,nativeRenders,nativeShadows})};
}

test('native GPU diagnosis requires an explicit local manual opt in',()=>{
 assert.equal(gpuDiagnosticRequested({hostname:'127.0.0.1',search:'?profile=manual&gpuProbe=1'}),true);
 for(const hostname of ['robjasper2084.github.io','localhost.evil.test','example.com'])
  assert.equal(gpuDiagnosticRequested({hostname,search:'?profile=manual&gpuProbe=1'}),false);
 for(const search of ['','?profile=1','?profile=1&gpuProbe=1','?profile=manual','?profile=manual&gpuProbe=0'])
  assert.equal(gpuDiagnosticRequested({hostname:'localhost',search}),false);
});

test('unsupported timer extension leaves all native methods unchanged',()=>{
 const f=fixture();f.gl.available=false;const original=f.renderer.render;
 const probe=new ManualGpuProbe(f.renderer);probe.startCapture();
 assert.equal(f.renderer.render,original);
 assert.equal(probe.runFrame(()=>f.renderer.render(f.scene,f.camera),true),f.result);
 const report=probe.stopCapture();assert.equal(report.supported,false);assert.equal(report.status,'unavailable');assert.equal(report.counts.issued,0);
});

test('whole callback query ends before the existing caller fence and reads only later available results',()=>{
 const f=fixture(),original=f.renderer.render;let clock=100;
 const probe=new ManualGpuProbe(f.renderer,()=>clock++);probe.startCapture();
 assert.equal(probe.runFrame(()=>f.renderer.render(f.scene,f.camera),true),f.result);
 f.gl.events.push('existing-fence');
 assert.ok(f.gl.events.indexOf('end')<f.gl.events.indexOf('existing-fence'));
 assert.equal(probe.snapshot().counts.issued,1);assert.equal(f.gl.resultReads,0);
 f.gl.resolve();clock+=100;
 const report=probe.snapshot();assert.equal(report.counts.resolved,1);assert.equal(report.groups[0].meanGpuMs,2);
 assert.equal(report.groups[0].lane,'frame');assert.ok(report.largestSamples[0].observedAvailabilityDelayMs!>99);
 assert.equal(report.largestSamples[0].queryCpuWindowMs,1);
 probe.dispose();assert.equal(f.renderer.render,original);assert.equal(f.gl.records.size,0);
});

test('rotating lanes preserve every draw while sampling frame, scene, shadow, and bounded native draws without nested queries',()=>{
 const f=fixture(),probe=new ManualGpuProbe(f.renderer);probe.startCapture();
 for(let frame=0;frame<64;frame++){f.gl.resolve();assert.equal(probe.runFrame(()=>f.renderer.render(f.scene,f.camera),true),f.result);}
 f.gl.resolve();const report=probe.stopCapture();
 assert.deepEqual(f.counts(),{nativeDraws:64*401,nativeRenders:64,nativeShadows:64});
 assert.deepEqual(new Set(report.groups.map(x=>x.lane)),new Set(['frame','scene','shadow','draw']));
 assert.equal(report.counts.queryErrors,0);assert.equal(report.counts.nestedSkipped,0);
 assert.ok(report.counts.issued<=64*GPU_DIAGNOSTIC_LIMITS.queriesPerFrame);
 assert.equal(report.activeQuery,false);assert.equal(report.pendingQueries,0);
 const draw=report.groups.find(x=>x.lane==='draw'&&x.pass==='color-draw');assert.ok(draw);
 assert.equal(draw.vertices,180);assert.equal(draw.indices,300);assert.equal(draw.instances,7);assert.equal(draw.materialType,'MeshPhysicalMaterial');
 assert.equal(draw.groupCount,300);assert.equal(draw.targetWidth,1440);assert.equal(draw.targetHeight,900);
});

test('a disjoint GPU clock rejects pending observations instead of reporting their durations',()=>{
 const f=fixture(),probe=new ManualGpuProbe(f.renderer);probe.startCapture();
 probe.runFrame(()=>f.renderer.render(f.scene,f.camera),true);f.gl.resolve();f.gl.disjoint=true;
 const invalid=probe.snapshot();assert.equal(invalid.counts.resolved,0);assert.equal(invalid.counts.disjointDiscarded,1);assert.deepEqual(invalid.groups,[]);
 f.gl.disjoint=false;probe.runFrame(()=>f.renderer.render(f.scene,f.camera),true);f.gl.resolve();
 assert.ok(probe.snapshot().counts.resolved>0);
});

test('sparse draws cover late shadow and color submissions independently in a large frame',()=>{
 const f=fixture();
 f.renderer.shadowMap.render=()=>{for(let i=0;i<1000;i++)f.renderer.renderBufferDirect(f.camera,f.scene,f.geometry,f.material,{...f.mesh,id:i,name:'Shadow '+i},null);};
 f.renderer.render=()=>{
  f.renderer.shadowMap.render([{id:2,name:'Sun'}],f.scene,f.camera);
  for(let i=0;i<1000;i++)f.renderer.renderBufferDirect(f.camera,f.scene,f.geometry,f.material,{...f.mesh,id:1000+i,name:'Color '+i},null);
  return f.result;
 };
 const probe=new ManualGpuProbe(f.renderer);probe.startCapture();
 for(let frame=0;frame<64;frame++){f.gl.resolve();probe.runFrame(()=>f.renderer.render(f.scene,f.camera),true);}
 f.gl.resolve();const report=probe.stopCapture();
 assert.ok(report.groups.some(x=>x.pass==='shadow-draw'&&x.objectId!==null&&x.objectId>900),'the end of a large shadow pass must be reachable');
 assert.ok(report.groups.some(x=>x.pass==='color-draw'&&x.objectId!==null&&x.objectId>1900),'late color draws must not be starved by shadow samples');
 for(const phase of ['shadow','color'] as const){
  const coverage=report.drawSampling[phase];assert.equal(coverage.observedCalls,64000);assert.equal(coverage.lastNonemptyCalls,1000);
  assert.equal(coverage.targetMisses,0);assert.equal(coverage.targetEncounters,coverage.targets);assert.ok(coverage.targetEncounters>16);
 }
 assert.equal(report.counts.queryErrors,0);assert.ok(report.counts.issued<=64*GPU_DIAGNOSTIC_LIMITS.queriesPerFrame);
});

test('foreign timer queries and driver query errors never change original return values or rendering',()=>{
 const f=fixture(),probe=new ManualGpuProbe(f.renderer);probe.startCapture();f.gl.foreign=true;
 assert.equal(probe.runFrame(()=>f.renderer.render(f.scene,f.camera),true),f.result);
 assert.equal(probe.snapshot().counts.foreignQuerySkipped,1);assert.equal(probe.snapshot().counts.issued,0);
 f.gl.foreign=false;f.gl.failBegin=true;
 assert.equal(probe.runFrame(()=>f.renderer.render(f.scene,f.camera),true),f.result);
 assert.ok(probe.snapshot().counts.queryErrors>0);assert.equal(f.counts().nativeRenders,2);
});

test('native exceptions still propagate and close the query exactly once',()=>{
 const f=fixture(),probe=new ManualGpuProbe(f.renderer);probe.startCapture();const error=new Error('native render failed');
 assert.throws(()=>probe.runFrame(()=>{throw error;},true),value=>value===error);
 assert.equal(f.gl.active,null);assert.equal(probe.snapshot().pendingQueries,1);
 assert.equal(f.gl.events.filter(x=>x==='end').length,1);
});

test('unavailable results stay bounded and inactive captures issue no more queries',()=>{
 const f=fixture(),probe=new ManualGpuProbe(f.renderer);probe.startCapture();
 for(let frame=0;frame<700;frame++)probe.runFrame(()=>{},true);
 let report=probe.snapshot();assert.ok(report.pendingQueries<=GPU_DIAGNOSTIC_LIMITS.pending);assert.ok(report.counts.pendingPeak<=GPU_DIAGNOSTIC_LIMITS.pending);
 assert.ok(report.counts.budgetSkipped>0);assert.ok(report.counts.expired>0);assert.equal(f.gl.resultReads,0);
 const issued=report.counts.issued;probe.stopCapture();for(let frame=0;frame<20;frame++)probe.runFrame(()=>f.renderer.render(f.scene,f.camera),true);
 report=probe.snapshot();assert.equal(report.counts.issued,issued);assert.equal(report.status,'stopped');probe.dispose();assert.equal(f.gl.records.size,0);
});

test('context loss discards pending samples and does not read invalid query objects',()=>{
 const f=fixture(),probe=new ManualGpuProbe(f.renderer);probe.startCapture();probe.runFrame(()=>{},true);f.gl.lost=true;
 const report=probe.snapshot();assert.equal(report.counts.contextLostDiscarded,1);assert.equal(report.pendingQueries,0);assert.equal(f.gl.resultReads,0);
});

test('valid measured zero is retained but negative and nonfinite durations are rejected',()=>{
 const f=fixture(),probe=new ManualGpuProbe(f.renderer);probe.startCapture();f.gl.duration=0;
 probe.runFrame(()=>{},true);f.gl.resolve();let report=probe.snapshot();assert.equal(report.groups[0].meanGpuMs,0);assert.equal(report.groups[0].samples,1);
 f.gl.duration=-1;probe.runFrame(()=>f.renderer.render(f.scene,f.camera),true);f.gl.resolve();report=probe.snapshot();assert.equal(report.counts.invalidResults,1);
});
