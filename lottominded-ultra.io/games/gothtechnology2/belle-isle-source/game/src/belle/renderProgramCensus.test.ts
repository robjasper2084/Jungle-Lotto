import test from 'node:test';
import assert from 'node:assert/strict';
import * as T from 'three';
import {installRenderSubmissionProbe,type RenderSubmissionProbe} from './renderSubmissionDiagnostics.ts';
import {ProgramCensusSummary,copyProgramCensusFrame,programCensusBarriers,programCensusLimits,textureCensusMethods,uniformCensusMethods} from './renderProgramCensus.ts';
import {RideProfileStats,type RideProfileFrame} from './rideProfileStats.ts';

type Native=(this:unknown,...args:unknown[])=>unknown;
function fixture(){
 const events:unknown[][]=[],plans=new Map<object,()=>unknown>();let time=0,clockCalls=0,targetReads=0,target:unknown=null;
 const programs=[{native:'P1'},{native:'P2'},{native:'P3'}],scene=new T.Scene(),camera=new T.PerspectiveCamera();
 const gl:Record<string,Native>={};
 for(const method of ['bufferData','bufferSubData','compileShader','linkProgram','getProgramParameter','getShaderParameter','getProgramInfoLog','getShaderInfoLog',
  'getUniformLocation','getAttribLocation','getActiveUniform','getActiveAttrib','getUniformBlockIndex','getActiveUniformBlockParameter','getUniformIndices','getActiveUniforms',
  'useProgram','drawArrays','drawElements','drawRangeElements','drawArraysInstanced','drawElementsInstanced',...textureCensusMethods,...uniformCensusMethods]){
  gl[method]=function(...args){events.push([method,this,...args]);time++;return args[0];};
 }
 // No observation may add an error/state read, timer, fence, flush or draw.
 for(const method of ['getError','getParameter','beginQuery','endQuery','fenceSync','clientWaitSync','flush','finish'])gl[method]=()=>{throw Error('Unexpected native call: '+method);};
 let renderPlan=()=>{};
 const shadowMap={render(this:unknown,...args:unknown[]){events.push(['shadow',this,...args]);return (args[0] as ()=>unknown)();}};
 const renderer={
  shadowMap,xr:{isPresenting:false},getContext(){return gl;},
  getRenderTarget(){targetReads++;return target;},
  setRenderTarget(this:unknown,...args:unknown[]){events.push(['target',this,...args]);target=args[0];return args[0];},
  render(this:unknown,...args:unknown[]){events.push(['render',this,...args]);renderPlan();return args[0];},
  renderBufferDirect(this:unknown,...args:unknown[]){events.push(['direct',this,...args]);return plans.get(args[4] as object)?.();},
 };
 function mesh(material:T.Material=new T.MeshStandardMaterial(),parent:T.Object3D=scene){const object=new T.Mesh(new T.BufferGeometry(),material);object.name='source';parent.add(object);return object;}
 function direct(object:T.Mesh,material:T.Material=object.material as T.Material,renderScene:unknown=scene,renderCamera:unknown=camera){return renderer.renderBufferDirect(renderCamera,renderScene,object.geometry,material,object,null);}
 const clock=()=>{clockCalls++;return time;};
 return {gl,renderer,scene,camera,programs,events,plans,mesh,direct,clock,setPlan(plan:()=>void){renderPlan=plan;},
  get clockCalls(){return clockCalls;},get targetReads(){return targetReads;}};
}
const capture=(f:ReturnType<typeof fixture>,probe:RenderSubmissionProbe)=>{probe.beginFrame(true);f.renderer.render(f.scene,f.camera);return probe.finishFrame()!;};

test('census preserves original native/render calls, receivers, argument identities, return values and clock sequence',()=>{
 const f=fixture(),object=f.mesh(),payload=new Float32Array([1,2,3]),result={original:true},receiver={borrowed:true};
 f.gl.uniform3fv=function(...args){f.events.push(['uniform3fv',this,...args]);return result;};
 f.plans.set(object,()=>{f.gl.useProgram(f.programs[0]);assert.equal(f.gl.uniform3fv.call(receiver,'location',payload,0,3),result);f.gl.texSubImage2D(1,0,0,0,8,4,1,2,payload);return f.gl.drawElements(4,6,2,0);});
 f.setPlan(()=>{assert.equal(f.direct(object),4);});
 f.renderer.render(f.scene,f.camera);const expected=f.events.slice();f.events.length=0;
 const probe=installRenderSubmissionProbe(f.renderer,f.scene,f.clock),beforeReads=f.targetReads;
 assert.equal(probe.coverage().status,'complete');
 const frame=capture(f,probe);
 assert.deepEqual(f.events,expected);assert.equal(f.targetReads,beforeReads+1);
 assert.equal(f.clockCalls,2*Object.values(frame.operations).reduce((sum,v)=>sum+v.calls,0),'new count-only and phase hooks add no clocks');
 const census=frame.programCensus!;assert.equal(census.observerErrors,0);assert.equal(census.phases.opaque.directDraws,1);
 assert.equal(census.phases.opaque.uniformCalls,1);assert.equal(census.phases.opaque.foreignReceiverCalls,1);
 assert.equal(census.uniformMethods.uniform3fv.calls,1);assert.equal(census.draws[0].groupOrder,0);
 assert.equal(census.draws[0].renderOrder,0);assert.equal(census.draws[0].barrierMask,0);
 assert.equal(census.textureEvents[0].width,8);assert.equal(census.textureEvents[0].height,4);
 assert.equal(census.textureEvents[0].objectId,object.id);assert.equal(census.textureEvents[0].materialId,(object.material as T.Material&{id:number}).id);
 assert.equal(census.programEvents[0].requested,1);assert.equal(census.programEvents[0].previous,null);assert.equal(census.programEvents[0].returned,true);
 probe.dispose();
});

test('inactive, disabled and disposed hooks perform no metadata reads, program observations or clock calls',()=>{
 const f=fixture(),object=f.mesh();let metadataReads=0;
 Object.defineProperty(object,'renderOrder',{get(){metadataReads++;throw Error('metadata');},configurable:true});
 f.plans.set(object,()=>{f.gl.useProgram(f.programs[0]);f.gl.uniform1f('location',1);f.gl.drawElements(4,6,2,0);});f.setPlan(()=>f.direct(object));
 const probe=installRenderSubmissionProbe(f.renderer,f.scene,f.clock);
 f.renderer.render(f.scene,f.camera);probe.beginFrame(false);f.renderer.render(f.scene,f.camera);
 assert.equal(f.clockCalls,0);assert.equal(f.targetReads,0);assert.equal(metadataReads,0);assert.equal(probe.finishFrame(),undefined);
 probe.dispose();f.renderer.render(f.scene,f.camera);assert.equal(f.clockCalls,0);assert.equal(f.targetReads,0);assert.equal(metadataReads,0);
});

test('actual shadow nesting, target changes, nested color renders and nearest Group orders retain separate phases',()=>{
 const f=fixture(),outer=new T.Group(),inner=new T.Group();outer.renderOrder=7;inner.renderOrder=3;f.scene.add(outer);outer.add(inner);
 const opaque=f.mesh(undefined,inner);opaque.renderOrder=9;
 const transparent=f.mesh(new T.MeshStandardMaterial({transparent:true,opacity:.5}));
 const transmissive=f.mesh(new T.MeshPhysicalMaterial({transmission:.4}));
 const offScene=new T.Scene(),offCamera=new T.PerspectiveCamera(),off=f.mesh(undefined,offScene),xr=f.mesh();
 const depth=new T.MeshDepthMaterial(),target={offscreen:true},xrTarget={isXRRenderTarget:true};
 for(const object of [opaque,transparent,transmissive,off,xr])f.plans.set(object,()=>{f.gl.useProgram(f.programs[object===off?2:object===opaque?0:1]);f.gl.drawArrays(4,0,3);});
 let nested=false;
 f.setPlan(()=>{
  if(nested){f.direct(off,off.material as T.Material,offScene,offCamera);return;}
  f.renderer.shadowMap.render(()=>{f.renderer.setRenderTarget(target);f.direct(opaque,depth,null);f.renderer.setRenderTarget(null);},f.scene,f.camera);
  f.direct(opaque);f.direct(transparent);f.direct(transmissive);
  f.renderer.setRenderTarget(target);nested=true;f.renderer.render(offScene,offCamera);nested=false;f.renderer.setRenderTarget(null);
  f.renderer.setRenderTarget(xrTarget);f.direct(xr);f.renderer.setRenderTarget(null);
 });
 const probe=installRenderSubmissionProbe(f.renderer,f.scene,f.clock),frame=capture(f,probe),c=frame.programCensus!;
 assert.deepEqual(c.draws.map(row=>row.phase),['shadow','opaque','transparent','transmissive','offscreen','xr']);
 assert.deepEqual(c.draws.map(row=>row.target),['offscreen','default','default','default','offscreen','xr']);
 assert.equal(c.draws[1].groupOrder,3);assert.equal(c.draws[1].renderOrder,9);
 assert.equal(c.draws[4].cameraId,offCamera.id);assert.equal(c.draws[4].sceneId,offScene.id);assert.equal(c.draws[4].renderPass,2);
 assert.equal(c.draws[5].renderPass,1);assert.equal(c.shadowCalls,1);assert.equal(c.renderCalls,2);assert.equal(c.targetChanges,6);
 assert.equal(c.observerErrors,0);for(const phase of ['shadow','opaque','transparent','transmissive','offscreen','xr'] as const)assert.equal(c.phases[phase].coreDrawCalls,1);
 probe.dispose();
});

test('unknown identity stays unknown until a returning observed request; new windows do not guess prior bindings',()=>{
 const f=fixture(),object=f.mesh();let use=false;
 f.plans.set(object,()=>{if(use)f.gl.useProgram(f.programs[0]);f.gl.drawArrays(4,0,3);});f.setPlan(()=>f.direct(object));
 const probe=installRenderSubmissionProbe(f.renderer,f.scene,f.clock);let c=capture(f,probe).programCensus!;
 assert.equal(c.phases.opaque.unknownProgramDraws,1);assert.equal(c.draws[0].firstCoreProgram,null);
 assert(c.draws[0].barrierMask&programCensusBarriers.unknownProgram);
 use=true;c=capture(f,probe).programCensus!;assert.equal(c.phases.opaque.knownProgramDraws,1);assert.equal(c.phases.opaque.unknownPreviousProgram,1);
 use=false;c=capture(f,probe).programCensus!;assert.equal(c.phases.opaque.unknownProgramDraws,1);
 // A borrowed call cannot establish this observed context's identity.
 f.plans.set(object,()=>{f.gl.useProgram.call({},f.programs[0]);f.gl.drawArrays(4,0,3);});
 c=capture(f,probe).programCensus!;assert.equal(c.phases.opaque.unknownProgramDraws,1);assert.equal(c.phases.opaque.foreignReceiverCalls,1);
 probe.dispose();
});

test('a nested color render during a shadow callback has its own pass instead of inheriting shadow classification',()=>{
 const f=fixture(),object=f.mesh();let nested=false;
 f.plans.set(object,()=>{f.gl.useProgram(f.programs[0]);f.gl.drawArrays(4,0,3);});
 f.setPlan(()=>{
  if(nested){f.direct(object);return;}
  f.renderer.shadowMap.render(()=>{nested=true;f.renderer.render(f.scene,f.camera);nested=false;f.direct(object,new T.MeshDepthMaterial(),null);});
 });
 const probe=installRenderSubmissionProbe(f.renderer,f.scene,f.clock),c=capture(f,probe).programCensus!;
 assert.deepEqual(c.draws.map(row=>[row.phase,row.renderPass]),[['opaque',2],['shadow',1]]);assert.equal(c.observerErrors,0);probe.dispose();
});

test('nested direct calls retain entry order and innermost ownership without double-counting native operations',()=>{
 const f=fixture(),outer=f.mesh(),inner=f.mesh();
 f.plans.set(inner,()=>{f.gl.useProgram(f.programs[1]);f.gl.uniform1f('inner',1);f.gl.drawArrays(4,0,3);});
 f.plans.set(outer,()=>{f.gl.useProgram(f.programs[0]);f.gl.drawArrays(4,0,3);f.direct(inner);f.gl.uniform1f('outer',2);f.gl.drawArrays(4,0,3);});
 f.setPlan(()=>f.direct(outer));const probe=installRenderSubmissionProbe(f.renderer,f.scene,f.clock),c=capture(f,probe).programCensus!;
 assert.deepEqual(c.draws.map(row=>[row.index,row.parentIndex,row.objectId,row.coreDrawCalls,row.uniformCalls]),[[1,null,outer.id,2,1],[2,1,inner.id,1,1]]);
 assert.deepEqual(c.programEvents.map(event=>event.directIndex),[1,2]);assert.equal(c.phases.opaque.coreDrawCalls,3);
 assert(c.draws[0].barrierMask&programCensusBarriers.multipleObservedPrograms);assert(c.draws[1].barrierMask&programCensusBarriers.nestedDirectDraw);
 assert.equal(c.observerErrors,0);probe.dispose();
});

test('throwing original program/uniform/draw calls preserve exact exceptions and restore observer scopes',()=>{
 const f=fixture(),object=f.mesh(),failure={nativeFailure:true};let fail=true;
 f.gl.useProgram=function(...args){f.events.push(['useProgram',this,...args]);if(fail)throw failure;return args[0];};
 f.plans.set(object,()=>{f.gl.useProgram(f.programs[0]);f.gl.uniform1f('location',1);return f.gl.drawArrays(4,0,3);});f.setPlan(()=>f.direct(object));
 const probe=installRenderSubmissionProbe(f.renderer,f.scene,f.clock);probe.beginFrame(true);
 assert.throws(()=>f.renderer.render(f.scene,f.camera),error=>error===failure);fail=false;f.renderer.render(f.scene,f.camera);
 const c=probe.finishFrame()!.programCensus!;
 assert.equal(c.phases.opaque.useProgramThrew,1);assert.equal(c.phases.opaque.useProgramReturned,1);assert.equal(c.phases.opaque.directDrawThrows,1);
 assert.deepEqual(c.programEvents.map(event=>event.returned),[false,true]);assert.equal(c.programEvents[1].previous,null);
 assert.equal(c.draws[1].parentIndex,null);assert.equal(c.draws[1].renderPass,2);assert.equal(c.observerErrors,0);probe.dispose();
 for(const method of ['uniform1f','drawArrays'] as const){
  const f=fixture(),object=f.mesh();f.gl[method]=()=>{throw failure;};f.plans.set(object,()=>{f.gl.useProgram(f.programs[0]);return f.gl[method](1,2,3);});f.setPlan(()=>f.direct(object));
  const probe=installRenderSubmissionProbe(f.renderer,f.scene,f.clock);probe.beginFrame(true);assert.throws(()=>f.renderer.render(f.scene,f.camera),e=>e===failure);
  const c=probe.finishFrame()!.programCensus!;assert.equal(c.phases.opaque[method==='uniform1f'?'uniformThrows':'coreDrawThrows'],1);assert.equal(c.observerErrors,0);probe.dispose();
 }
});

test('hostile metadata accessors and private program caches are never executed; unsupported ancestry remains unknown',()=>{
 const f=fixture(),object=f.mesh(),orphan=new T.Mesh(new T.BufferGeometry(),new T.MeshStandardMaterial());let getters=0;
 Object.defineProperty(object,'name',{get(){getters++;throw Error('name getter');}});
 Object.defineProperty(object,'renderOrder',{get(){getters++;throw Error('order getter');}});
 Object.defineProperty(f.renderer,'properties',{get(){getters++;throw Error('private program cache');}});
 f.plans.set(object,()=>{f.gl.useProgram(f.programs[0]);f.gl.drawArrays(4,0,3);});f.plans.set(orphan,()=>f.gl.drawArrays(4,0,3));f.setPlan(()=>{f.direct(object);f.direct(orphan);});
 const probe=installRenderSubmissionProbe(f.renderer,f.scene,f.clock),c=capture(f,probe).programCensus!;
 assert.equal(getters,0);assert.equal(c.observerErrors,0);assert(c.metadataUnavailable>=2);assert.equal(c.draws[0].renderOrder,null);assert.equal(c.draws[1].groupOrder,null);
 assert(c.draws.every(row=>row.barrierMask&programCensusBarriers.unknownMetadata));probe.dispose();
});

test('retention caps detail without truncating totals, mutating source objects, or dropping native calls',()=>{
 const f=fixture(),object=f.mesh();let calls=0;const total=programCensusLimits.maxDrawsPerSample+7;
 f.plans.set(object,()=>{calls++;f.gl.useProgram(f.programs[0]);f.gl.useProgram(f.programs[1]);f.gl.useProgram(f.programs[2]);f.gl.texImage2D(1,0,1,8,4,0,1,2,null);f.gl.uniform1f('u',1);f.gl.drawArrays(4,0,3);});
 f.setPlan(()=>{for(let i=0;i<total;i++)f.direct(object);});const probe=installRenderSubmissionProbe(f.renderer,f.scene,f.clock),frame=capture(f,probe),c=frame.programCensus!;
 assert.equal(calls,total);assert.equal(c.phases.opaque.directDraws,total);assert.equal(c.phases.opaque.useProgramCalls,total*3);assert.equal(c.phases.opaque.uniformCalls,total);
 assert.equal(c.draws.length,programCensusLimits.maxDrawsPerSample);assert.equal(c.droppedDraws,7);
 assert.equal(c.programEvents.length,programCensusLimits.maxProgramEventsPerSample);assert.equal(c.droppedProgramEvents,total*3-programCensusLimits.maxProgramEventsPerSample);
 assert.equal(c.textureEvents.length,programCensusLimits.maxTextureEventsPerSample);assert.equal(c.droppedTextureEvents,total-programCensusLimits.maxTextureEventsPerSample);
 assert.equal(c.textureMethods.texImage2D.calls,total);assert.equal(c.observerErrors,0);
 const summary=new ProgramCensusSummary(2);summary.add(c,1);summary.add(c,2);summary.add(c,3);let report=summary.report();
 assert.equal(report.observedCallbacks,3);assert.equal(report.retainedSamples,2);assert.equal(report.droppedSamples,1);assert.equal(report.truncatedSamples,3);assert.equal(report.phases.opaque.directDraws,total*3);
 c.draws[0].object='mutated source';report.samples[0].draws[0].object='mutated report';report=summary.report();assert.equal(report.samples[0].draws[0].object,'source');
 assert.deepEqual(report.samples.map(sample=>sample.sample),[2,3]);probe.dispose();
});

test('sampling is periodic while phase/method totals include every accepted callback and large lists live only in census summary',()=>{
 const f=fixture(),object=f.mesh(),stats=new RideProfileStats({frames:2,slowFrames:1});
 f.plans.set(object,()=>{f.gl.useProgram(f.programs[0]);f.gl.uniform1f('u',1);f.gl.generateMipmap(1);f.gl.drawArrays(4,0,3);});f.setPlan(()=>f.direct(object));
 const probe=installRenderSubmissionProbe(f.renderer,f.scene,f.clock);
 for(let i=1;i<=34;i++){
  const submission=capture(f,probe);const frame:RideProfileFrame={dt:.2,times:[1,2,3,4,5],draws:1,triangles:1,textures:1,geometries:1,x:i/10,z:0,speed:2,place:'Source',eligible:true,hidden:false,submission};stats.sample(frame);
 }
 const report=stats.report(),summary=report.submissionDiagnostics!.programCensus!;
 assert.equal(summary.version,1);assert.equal(summary.observedCallbacks,34);assert.equal(summary.phases.opaque.directDraws,34);assert.equal(summary.uniformMethods.uniform1f.calls,34);
 assert.deepEqual(summary.samples.map(sample=>sample.sample),[1,17,33]);assert.equal(summary.textureMethods.generateMipmap.calls,34);assert.equal(summary.truncatedSamples,0);
 assert.equal(report.slowFrames[0].submission!.programCensus,undefined);assert.equal(report.frames,34);assert.equal(report.over100ms,34);assert.equal(report.metrics.frameMs!.mean,200);
 assert(summary.notes.some(note=>note.includes('not independently verified')));assert(summary.notes.some(note=>note.includes('zero mask')));probe.dispose();
});

test('cancel/restart in an original call discards stale scopes and preserves current-window observations',()=>{
 const f=fixture(),object=f.mesh();let restart=true;let probe:RenderSubmissionProbe;
 f.plans.set(object,()=>{if(restart){restart=false;probe.cancelFrame();probe.beginFrame(true);}f.gl.useProgram(f.programs[0]);return f.gl.drawArrays(4,0,3);});f.setPlan(()=>f.direct(object));
 probe=installRenderSubmissionProbe(f.renderer,f.scene,f.clock);const c=capture(f,probe).programCensus!;
 assert.equal(c.phases.opaque.directDraws,0);assert.equal(c.phases.unknown.useProgramCalls,1);assert.equal(c.phases.unknown.coreDrawCalls,1);assert.equal(c.observerErrors,0);
 const next=capture(f,probe).programCensus!;assert.equal(next.phases.opaque.directDraws,1);assert.equal(next.observerErrors,0);probe.dispose();
});

test('numeric texture dimensions never inspect pixel/DOM sources and method failures remain observed calls',()=>{
 const f=fixture(),object=f.mesh(),failure={texture:true};let getters=0;
 const source={get width(){getters++;throw Error('source width');},get height(){getters++;throw Error('source height');}};
 f.gl.copyTexImage2D=()=>{throw failure;};
 f.plans.set(object,()=>{f.gl.texImage2D(1,0,1,1,2,source);f.gl.texStorage3D(1,2,3,16,8,4);assert.throws(()=>f.gl.copyTexImage2D(1,0,1,2,3,64,32,0),e=>e===failure);});f.setPlan(()=>f.direct(object));
 const probe=installRenderSubmissionProbe(f.renderer,f.scene,f.clock),c=capture(f,probe).programCensus!;
 assert.equal(getters,0);assert.deepEqual(c.textureEvents.map(e=>[e.method,e.width,e.height,e.depth,e.returned]),[['texImage2D',null,null,null,true],['texStorage3D',16,8,4,true],['copyTexImage2D',64,32,null,false]]);
 assert.equal(c.textureMethods.copyTexImage2D.calls,1);assert.equal(c.textureMethods.copyTexImage2D.threw,1);assert.equal(c.phases.opaque.textureThrows,1);probe.dispose();
});

test('copied census validates bounded scalars and excludes extra source references',()=>{
 const f=fixture(),object=f.mesh();f.plans.set(object,()=>{f.gl.useProgram(f.programs[0]);f.gl.drawArrays(4,0,3);});f.setPlan(()=>f.direct(object));
 const probe=installRenderSubmissionProbe(f.renderer,f.scene,f.clock),c=capture(f,probe).programCensus!;
 (c.draws[0] as unknown as Record<string,unknown>).secretReference=object;
 (c.phases.opaque as unknown as Record<string,unknown>).secretReference=object;
 const copied=copyProgramCensusFrame(c)!;assert(!('secretReference' in copied.draws[0]));assert(!('secretReference' in copied.phases.opaque));assert.doesNotThrow(()=>JSON.stringify(copied));
 c.draws[0].groupOrder=NaN;assert.equal(copyProgramCensusFrame(c),null);c.draws[0].groupOrder=0;c.phases.opaque.uniformCalls=-1;assert.equal(copyProgramCensusFrame(c),null);
 assert.throws(()=>new ProgramCensusSummary(programCensusLimits.maxSamples+1));probe.dispose();
});

test('program identity allocation is bounded and unbound requests remain distinct from unknown',()=>{
 const f=fixture(),probe=installRenderSubmissionProbe(f.renderer,f.scene,f.clock);probe.beginFrame(true);
 f.gl.useProgram(null);f.gl.drawArrays(4,0,3);
 for(let i=0;i<programCensusLimits.maxProgramIdentities+2;i++)f.gl.useProgram({program:i});
 f.gl.drawArrays(4,0,3);const c=probe.finishFrame()!.programCensus!;
 assert.equal(c.phases.unknown.unboundProgramDraws,1);assert.equal(c.phases.unknown.unknownProgramDraws,1);assert.equal(c.identityLimitHits,2);
 assert.equal(c.programEvents[0].requested,0);assert.equal(c.observerErrors,0);probe.dispose();
});
