import test from 'node:test';
import assert from 'node:assert/strict';
import {
  installRenderSubmissionProbe,createEmptyRenderSubmissionFrame,copyRenderSubmissionFrame,
  renderSubmissionOperationNames,type RenderSubmissionProbe,
} from './renderSubmissionDiagnostics.ts';

function fixture(){
  let time=0,clockCalls=0;
  const events:unknown[][]=[];
  const gl={
    bufferData(this:unknown,...args:unknown[]){events.push(['bufferData',this,...args]);time+=2;return args[1];},
    bufferSubData(this:unknown,...args:unknown[]){events.push(['bufferSubData',this,...args]);time+=3;return args[2];},
    texImage2D(this:unknown,...args:unknown[]){events.push(['texImage2D',this,...args]);time+=5;return 'texture';},
    compileShader(this:unknown,...args:unknown[]){events.push(['compileShader',this,...args]);time+=7;},
    linkProgram(this:unknown,...args:unknown[]){events.push(['linkProgram',this,...args]);time+=11;},
    getProgramParameter(this:unknown,...args:unknown[]){events.push(['getProgramParameter',this,...args]);time+=13;return true;},
    useProgram(this:unknown,...args:unknown[]){events.push(['useProgram',this,...args]);time+=17;},
    drawElements(this:unknown,...args:unknown[]){events.push(['drawElements',this,...args]);time+=19;return 'draw';},
  };
  const scene={updateMatrixWorld(this:unknown,...args:unknown[]){events.push(['matrix',this,...args]);time+=23;return 'matrix';}};
  const renderer={getContext(){return gl;},renderBufferDirect(this:unknown,...args:unknown[]){
    events.push(['direct',this,...args]);gl.bufferSubData(1,2,args);gl.useProgram('p');gl.drawElements(1,2,3,4);return 'direct';
  }};
  const clock=()=>{clockCalls++;return time;};
  return {gl,scene,renderer,events,clock,get time(){return time;},advance(value:number){time+=value;},get clockCalls(){return clockCalls;}};
}

test('inactive and disabled observations forward exact receiver, argument identity and result with zero clock calls',()=>{
  const f=fixture(),probe=installRenderSubmissionProbe(f.renderer,f.scene,f.clock),array=new Float32Array([1,2]);
  assert.equal(f.gl.bufferData(1,array,3),array);
  const receiver={borrowed:true};
  assert.equal(f.gl.bufferSubData.call(receiver,1,2,array,1,1),array);
  assert.deepEqual(f.events,[['bufferData',f.gl,1,array,3],['bufferSubData',receiver,1,2,array,1,1]]);
  assert.equal(f.clockCalls,0);assert.equal(probe.finishFrame(),undefined);
  probe.beginFrame(false);f.renderer.renderBufferDirect('camera','scene','geometry','material','object');
  assert.equal(f.clockCalls,0);assert.equal(probe.finishFrame(),undefined);probe.dispose();
});

test('active CPU scopes preserve original operations and distinguish nested GL work from outside-direct work',()=>{
  const f=fixture(),probe=installRenderSubmissionProbe(f.renderer,f.scene,f.clock);
  probe.beginFrame(true);
  assert.equal(f.scene.updateMatrixWorld(true),'matrix');
  f.gl.bufferData(1,new Uint8Array(4),3);f.gl.texImage2D(1,2,3,4);
  f.gl.compileShader('shader');f.gl.linkProgram('program');assert.equal(f.gl.getProgramParameter('program',1),true);
  const parent={id:7,name:'Shelter'},object={id:8,name:'Bench',parent},material={id:9,name:'Wood',type:'MeshStandardMaterial'},geometry={id:10};
  assert.equal(f.renderer.renderBufferDirect({},f.scene,geometry,material,object,null),'direct');
  const frame=probe.finishFrame()!;
  assert.equal(frame.invalidObservations,0);assert.equal(frame.operations.matrix.cpuMs,23);
  assert.equal(frame.operations.matrix.outsideDirectCpuMs,23);
  assert.equal(frame.operations.bufferData.cpuMs,2);assert.equal(frame.operations.bufferData.outsideDirectCpuMs,2);
  assert.equal(frame.operations.textureUpload.cpuMs,5);assert.equal(frame.operations.programCompile.cpuMs,7);
  assert.equal(frame.operations.programLink.cpuMs,11);assert.equal(frame.operations.programStatus.cpuMs,13);
  assert.deepEqual(frame.operations.directDraw,{calls:1,cpuMs:39,maxCpuMs:39,outsideDirectCalls:0,outsideDirectCpuMs:0});
  assert.equal(frame.operations.bufferSubData.cpuMs,3);assert.equal(frame.operations.programUse.cpuMs,17);
  assert.equal(frame.operations.draw.cpuMs,19);
  for(const name of ['bufferSubData','programUse','draw'] as const){assert.equal(frame.operations[name].outsideDirectCalls,0);assert.equal(frame.operations[name].outsideDirectCpuMs,0);}
  assert.deepEqual(frame.topDirectDraws,[{cpuMs:39,objectId:8,object:'Bench',parentId:7,parent:'Shelter',geometryId:10,materialId:9,material:'Wood',materialType:'MeshStandardMaterial'}]);
  assert.equal(f.events.length,10);assert.equal(probe.finishFrame(),undefined);probe.dispose();
});

test('same-category recursion counts calls once each and times their union while partitioning outside-direct intervals',()=>{
  let time=0,depth=0;
  const gl={bufferData(){time+=1;if(depth++===0){renderer.renderBufferDirect();time+=2;}depth--;time+=1;}};
  const renderer={getContext:()=>gl,renderBufferDirect(){time+=3;gl.bufferData();time+=4;}};
  const probe=installRenderSubmissionProbe(renderer,{},()=>time);probe.beginFrame(true);gl.bufferData();
  const frame=probe.finishFrame()!;
  assert.deepEqual(frame.operations.bufferData,{calls:2,cpuMs:13,maxCpuMs:13,outsideDirectCalls:1,outsideDirectCpuMs:4});
  assert.deepEqual(frame.operations.directDraw,{calls:1,cpuMs:9,maxCpuMs:9,outsideDirectCalls:0,outsideDirectCpuMs:0});
  probe.dispose();
});

test('nested direct draws retain top individual durations without double-counting direct CPU',()=>{
  let time=0;
  const renderer={renderBufferDirect(level:number){time+=2;if(level)renderer.renderBufferDirect(level-1);time+=3;}};
  const probe=installRenderSubmissionProbe(renderer,{},()=>time);probe.beginFrame(true);renderer.renderBufferDirect(2);
  const frame=probe.finishFrame()!;
  assert.equal(frame.operations.directDraw.calls,3);assert.equal(frame.operations.directDraw.cpuMs,15);
  assert.equal(frame.operations.directDraw.maxCpuMs,15);assert.deepEqual(frame.topDirectDraws.map(row=>row.cpuMs),[15,10,5]);
  probe.dispose();
});

test('original exceptions propagate unchanged and later calls recover clean timing state',()=>{
  let time=0,fail=true;const failure={original:true};
  const gl={bufferData(){time+=2;if(fail)throw failure;return 42;}};
  const renderer={getContext:()=>gl,renderBufferDirect(){time+=3;gl.bufferData();time+=4;}};
  const probe=installRenderSubmissionProbe(renderer,{},()=>time);probe.beginFrame(true);
  assert.throws(()=>renderer.renderBufferDirect(),error=>error===failure);fail=false;
  assert.equal(gl.bufferData(),42);
  const frame=probe.finishFrame()!;assert.equal(frame.operations.directDraw.cpuMs,5);
  assert.equal(frame.operations.bufferData.calls,2);assert.equal(frame.operations.bufferData.cpuMs,4);
  assert.equal(frame.operations.bufferData.outsideDirectCalls,1);assert.equal(frame.operations.bufferData.outsideDirectCpuMs,2);
  probe.dispose();
});

test('clock throws and invalid timestamps cannot suppress results or replace an original exception',()=>{
  const failure={original:true};let call=0,throwOriginal=false;
  const renderer={renderBufferDirect(){call++;if(throwOriginal)throw failure;return 24;}};
  const readings:unknown[]=[1,NaN,5,4,Infinity,8,()=>{throw Error('clock');},9,10,11];
  const clock=()=>{const value=readings.shift();return typeof value==='function'?value():value as number;};
  const probe=installRenderSubmissionProbe(renderer,{},clock);probe.beginFrame(true);
  for(let i=0;i<4;i++)assert.equal(renderer.renderBufferDirect(),24);
  throwOriginal=true;assert.throws(()=>renderer.renderBufferDirect(),error=>error===failure);
  const frame=probe.finishFrame()!;assert.equal(call,5);assert.equal(frame.operations.directDraw.calls,5);
  assert(frame.invalidObservations>=4);assert.equal(frame.operations.directDraw.cpuMs,1);
  assert.equal(frame.operations.directDraw.maxCpuMs,1);probe.dispose();
});

test('finite fake-clock accumulation overflow is flagged without emitting nonfinite totals',()=>{
  const readings=[0,Number.MAX_VALUE,0,Number.MAX_VALUE];let calls=0;
  const renderer={renderBufferDirect(){calls++;return 42;}};
  const probe=installRenderSubmissionProbe(renderer,{},()=>readings.shift()!);probe.beginFrame(true);
  assert.equal(renderer.renderBufferDirect(),42);assert.equal(renderer.renderBufferDirect(),42);
  const frame=probe.finishFrame()!;assert.equal(calls,2);assert(frame.invalidObservations>=2);
  assert.equal(frame.operations.directDraw.cpuMs,Number.MAX_VALUE);
  for(const stats of Object.values(frame.operations))for(const value of Object.values(stats))assert(Number.isFinite(value));
  probe.dispose();
});

test('cancel/reset during a wrapped call does not leak old scopes into the next frame',()=>{
  let time=0,reset=true;let probe:RenderSubmissionProbe;
  const gl={bufferData(){time+=5;}};
  const renderer={getContext:()=>gl,renderBufferDirect(){time+=2;if(reset){probe.cancelFrame();probe.beginFrame(true);reset=false;}gl.bufferData();time+=3;}};
  probe=installRenderSubmissionProbe(renderer,{},()=>time);probe.beginFrame(true);renderer.renderBufferDirect();
  let frame=probe.finishFrame()!;assert.equal(frame.operations.directDraw.calls,0);
  assert.equal(frame.operations.bufferData.calls,1);assert.equal(frame.operations.bufferData.cpuMs,5);
  assert.equal(frame.operations.bufferData.outsideDirectCpuMs,5);
  probe.beginFrame(true);renderer.renderBufferDirect();frame=probe.finishFrame()!;
  assert.equal(frame.operations.directDraw.calls,1);assert.equal(frame.operations.directDraw.cpuMs,10);
  assert.equal(frame.operations.bufferData.outsideDirectCpuMs,0);probe.dispose();
});

test('metadata is bounded, detached from objects, and hostile getters cannot affect original calls',()=>{
  let time=0,getterCalls=0;const failure={original:true};let throwing=false;
  const renderer={renderBufferDirect(..._args:unknown[]){time+=2;if(throwing)throw failure;return 'ok';}};
  const probe=installRenderSubmissionProbe(renderer,{},()=>time);probe.beginFrame(true);
  const hostile={get name(){getterCalls++;throw Error('label');},get id(){getterCalls++;throw Error('id');},get parent(){getterCalls++;throw Error('parent');}};
  assert.equal(renderer.renderBufferDirect(null,null,{},hostile,hostile),'ok');
  throwing=true;assert.throws(()=>renderer.renderBufferDirect(null,null,{},hostile,hostile),error=>error===failure);
  let frame=probe.finishFrame()!;assert.equal(getterCalls,0);assert(frame.invalidObservations>=6);assert.equal(frame.topDirectDraws[0].objectId,null);
  throwing=false;probe.beginFrame(true);
  for(let i=0;i<10;i++){const object={id:i,name:'a'.repeat(200),parent:{id:i+100,name:'p'.repeat(200)}};renderer.renderBufferDirect(null,null,{id:3},{id:4,name:'m'.repeat(200),type:'t'.repeat(200)},object);object.name='changed';}
  frame=probe.finishFrame()!;assert.equal(frame.topDirectDraws.length,3);
  for(const row of frame.topDirectDraws){assert.equal(row.object.length,96);assert.equal(row.parent.length,96);assert.equal(row.material.length,96);assert.equal(row.materialType.length,96);}
  assert.doesNotThrow(()=>JSON.stringify(frame));probe.dispose();
});

test('finishing a frame inside an original call flags incomplete scopes and disposal remains safe',()=>{
  let time=0;let probe:RenderSubmissionProbe;
  let early:ReturnType<RenderSubmissionProbe['finishFrame']>;
  const renderer={renderBufferDirect(){time+=2;early=probe.finishFrame();time+=3;probe.dispose();return 'original';}};
  probe=installRenderSubmissionProbe(renderer,{},()=>time);probe.beginFrame(true);
  assert.equal(renderer.renderBufferDirect(),'original');assert.equal(early?.invalidObservations,1);
  assert.equal(early?.operations.directDraw.calls,1);assert.equal(probe.finishFrame(),undefined);
  assert.equal(probe.coverage().status,'disposed');
});

test('missing, readonly, accessor and nonextensible hooks have explicit partial coverage',()=>{
  let getterCalls=0;
  const inherited={bufferData(){return 1;}};const gl=Object.create(inherited) as {bufferData:()=>number;bufferSubData:()=>number;texImage2D:()=>number};
  Object.defineProperty(gl,'bufferSubData',{value:()=>2,writable:false,configurable:true});
  Object.defineProperty(gl,'texImage2D',{get(){getterCalls++;return ()=>3;},configurable:true});
  const renderer={getContext:()=>gl},scene=Object.preventExtensions(Object.create({updateMatrixWorld(){return 4;}})) as object;
  const probe=installRenderSubmissionProbe(renderer,scene,()=>0),coverage=probe.coverage();
  assert.equal(coverage.status,'partial');assert.equal(coverage.context,'available');assert.equal(getterCalls,0);
  assert.equal(coverage.hooks.find(h=>h.name==='gl.bufferData')?.status,'installed');
  for(const name of ['gl.bufferSubData','gl.texImage2D','scene.updateMatrixWorld'])assert.equal(coverage.hooks.find(h=>h.name===name)?.status,'failed');
  assert.equal(coverage.hooks.find(h=>h.name==='renderer.renderBufferDirect')?.status,'missing');
  assert.equal(gl.bufferSubData(),2);assert.equal(gl.bufferData(),1);
  coverage.hooks[0].status='installed';coverage.notes.length=0;
  assert.notEqual(probe.coverage().hooks[0].status,'installed');assert(probe.coverage().notes.length>0);
  probe.dispose();assert.equal(Object.hasOwn(gl,'bufferData'),false);
  assert.equal(Object.getOwnPropertyDescriptor(gl,'bufferSubData')?.writable,false);
});

test('context lookup failure is covered without touching GL and unavailable probes remain safe',()=>{
  const renderer={getContext(){throw Error('unavailable');}};
  const probe=installRenderSubmissionProbe(renderer,{},()=>{throw Error('must not clock');});
  assert.equal(probe.coverage().status,'unavailable');assert.equal(probe.coverage().context,'failed');
  probe.beginFrame(true);assert.deepEqual(probe.finishFrame(),createEmptyRenderSubmissionFrame());probe.dispose();
});

test('disposal restores exact owned descriptors while preserving a later owner',()=>{
  const f=fixture(),original=f.renderer.renderBufferDirect,descriptor=Object.getOwnPropertyDescriptor(f.renderer,'renderBufferDirect');
  const originalBuffer=f.gl.bufferData,probe=installRenderSubmissionProbe(f.renderer,f.scene,f.clock);
  const later=()=>new Uint8Array(1);f.gl.bufferData=later;
  const changed=probe.coverage().hooks.find(h=>h.name==='gl.bufferData');
  assert.equal(changed?.status,'failed');assert.equal(changed?.reason,'hook-binding-changed');
  probe.beginFrame(true);probe.dispose();probe.dispose();
  assert.equal(probe.finishFrame(),undefined);assert.equal(probe.coverage().status,'disposed');assert.equal(probe.coverage().installed,false);
  assert.equal(f.renderer.renderBufferDirect,original);assert.deepEqual(Object.getOwnPropertyDescriptor(f.renderer,'renderBufferDirect'),descriptor);
  assert.equal(f.gl.bufferData,later);assert.notEqual(f.gl.bufferData,originalBuffer);
  assert.equal(probe.coverage().hooks.some(h=>h.status==='installed'),false);
  probe.beginFrame(true);f.renderer.renderBufferDirect();assert.equal(f.clockCalls,0);
});

test('snapshots and resets are isolated; malformed values are rejected without retaining references',()=>{
  const f=fixture(),probe=installRenderSubmissionProbe(f.renderer,f.scene,f.clock);probe.beginFrame(true);f.gl.bufferData();
  const first=probe.finishFrame()!,copy=copyRenderSubmissionFrame(first)!;
  assert.deepEqual(Object.keys(first.operations),[...renderSubmissionOperationNames]);copy.operations.bufferData.calls=99;
  assert.equal(first.operations.bufferData.calls,1);probe.beginFrame(true);const second=probe.finishFrame()!;
  assert.equal(second.operations.bufferData.calls,0);assert.equal(first.operations.bufferData.calls,1);
  const malformed=createEmptyRenderSubmissionFrame();malformed.operations.draw.cpuMs=NaN;assert.equal(copyRenderSubmissionFrame(malformed),null);
  assert.equal(copyRenderSubmissionFrame({get operations(){throw Error('bad');}}),null);
  assert.equal(copyRenderSubmissionFrame(null),null);probe.dispose();
});
