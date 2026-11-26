import test from 'node:test';
import assert from 'node:assert/strict';
import {runInNewContext} from 'node:vm';
import {installCadillacSoftwareGpuObserver} from './observer.mjs';

function fixture({timers=false,disjoint=false,maxCalls=6000,existing,throwDirect=false}={}){
 const canvas={},native={renders:0,direct:[],fences:0,waits:0,deletes:0,queries:0,queryDeletes:0,queryEnds:0},failure=Error('Original draw failure');
 let clock=0,activeQuery=null;
 const extension={TIME_ELAPSED_EXT:0x88bf,GPU_DISJOINT_EXT:0x8fbb};
 const gl={RENDERER:0x1f01,SYNC_GPU_COMMANDS_COMPLETE:0x9117,TIMEOUT_EXPIRED:0x911b,ALREADY_SIGNALED:0x911a,CONDITION_SATISFIED:0x911c,WAIT_FAILED:0x911d,CURRENT_QUERY:0x8865,QUERY_RESULT_AVAILABLE:0x8867,QUERY_RESULT:0x8866,
  getExtension(name){return name==='EXT_disjoint_timer_query_webgl2'&&timers?extension:null;},
  getParameter(name){return name===extension.GPU_DISJOINT_EXT?disjoint:'ANGLE Vulkan SwiftShader Device (Subzero)';},
  fenceSync(...args){assert.equal(this,gl);assert.deepEqual(args,[gl.SYNC_GPU_COMMANDS_COMPLETE,0]);native.fences++;return{complete:false};},
  clientWaitSync(fence,flags,timeout){assert.equal(this,gl);assert.equal(flags,0);assert.equal(timeout,0);native.waits++;return fence.complete?gl.CONDITION_SATISFIED:gl.TIMEOUT_EXPIRED;},
  deleteSync(){assert.equal(this,gl);native.deletes++;},
  getQuery(target,pname){assert.equal(this,gl);assert.equal(target,extension.TIME_ELAPSED_EXT);assert.equal(pname,gl.CURRENT_QUERY);return activeQuery;},
  createQuery(){assert.equal(this,gl);return{id:++native.queries};},
  beginQuery(target,query){assert.equal(this,gl);assert.equal(activeQuery,null);assert.equal(target,extension.TIME_ELAPSED_EXT);activeQuery=query;},
  endQuery(target){assert.equal(this,gl);assert.equal(target,extension.TIME_ELAPSED_EXT);assert(activeQuery);activeQuery=null;native.queryEnds++;},
  getQueryParameter(query,pname){return pname===gl.QUERY_RESULT_AVAILABLE?true:query.id*1_000_000;},
  deleteQuery(){native.queryDeletes++;},
 };
 const parent={id:10,name:'Original parent',type:'Group',parent:null};
 const camera={id:20,name:'Actual camera',type:'PerspectiveCamera',matrixWorld:{elements:[1,0,0,0,0,1,0,0,0,0,1,0,1,2,3,1]},projectionMatrix:{elements:Array(16).fill(1)}};
 const shadowCamera={...camera,id:21,type:'OrthographicCamera'};
 const material={id:30,name:'Original paint',type:'MeshStandardMaterial'};
 const depth={id:31,name:'Original shadow depth',type:'MeshDepthMaterial',isMeshDepthMaterial:true};
 const sourceGeometry={id:40},sharedGeometry={id:41,calls:1,triangles:12},batchGeometry={id:42,calls:2,triangles:150},shadowGeometry={id:43,calls:1,triangles:8};
 const object={id:50,name:'Original body',type:'Mesh',geometry:sourceGeometry,parent};
 const batch={id:51,name:'Existing native batch',type:'Mesh',geometry:batchGeometry,parent,isBatchedMesh:true};
 const scene={id:1,name:'Actual full scene',isScene:true};
 const invocations=[[camera,scene,sharedGeometry,material,object,null],[camera,scene,batchGeometry,material,batch,null],[shadowCamera,scene,shadowGeometry,depth,object,null]];
 const renderer={domElement:canvas,info:{render:{frame:0,calls:0,triangles:0,lines:0,points:0}},getContext:()=>gl,getRenderTarget:()=>null,
  render(s,c){assert.equal(this,renderer);assert.equal(s,scene);assert.equal(c,camera);native.renders++;this.info.render.frame++;Object.assign(this.info.render,{calls:0,triangles:0,lines:0,points:0});
   for(const args of invocations)this.renderBufferDirect(...args);return 'original render result';},
  renderBufferDirect(...args){assert.equal(this,renderer);native.direct.push(args);if(throwDirect)throw failure;
   this.info.render.calls+=args[2].calls;this.info.render.triangles+=args[2].triangles;return 'original direct result';},
 };
 const context={EventTarget,CustomEvent,performance:{now:()=>++clock},document:{getElementById:id=>id==='game'?canvas:null},...(existing!==undefined?{__THREE_DEVTOOLS__:existing}:{})};
 runInNewContext('('+installCadillacSoftwareGpuObserver.toString()+')('+JSON.stringify({frames:3,maxCalls,timers:true})+')',context);
 context.__THREE_DEVTOOLS__.dispatchEvent?.(new CustomEvent('observe',{detail:renderer}));
 const api=context.__cadillacSoftwareGpu,read=()=>JSON.parse(JSON.stringify(api.read()));
 function frame(){
  assert.equal(renderer.render(scene,camera),'original render result');
  const fence=gl.fenceSync(gl.SYNC_GPU_COMMANDS_COMPLETE,0);
  assert.equal(gl.clientWaitSync(fence,0,0),gl.TIMEOUT_EXPIRED);fence.complete=true;
  assert.equal(gl.clientWaitSync(fence,0,0),gl.CONDITION_SATISFIED);gl.deleteSync(fence);
 }
 return{context,renderer,scene,camera,gl,api,read,native,frame,invocations,failure};
}

test('three completed native frames retain receivers, arguments, order and exact submitted work',()=>{
 const f=fixture();f.frame();assert.equal(f.read().frames.length,0,'Inactive observation must not start capture');
 f.api.arm();for(let i=0;i<3;i++)f.frame();
 const receipt=f.read();assert.equal(receipt.completedFrames,3);assert.equal(receipt.errors.length,0);assert.equal(receipt.overflow,false);
 assert.equal(f.native.renders,4);assert.equal(f.native.direct.length,12);assert.equal(f.native.fences,4);assert.equal(f.native.waits,8);assert.equal(f.native.deletes,4);
 for(let i=0;i<f.native.direct.length;i++)assert.deepEqual(f.native.direct[i],f.invocations[i%3]);
 for(const frame of receipt.frames){
  assert.deepEqual(frame.observedTotals,{calls:4,triangles:170,lines:0,points:0});assert.deepEqual(frame.observedTotals,frame.nativeEndTotals);
  assert.equal(frame.observedColorTotals.triangles,162);assert.equal(frame.observedShadowTotals.triangles,8);
  assert.equal(frame.objects[0].sourceGeometryId,40);assert.equal(frame.objects[0].submittedGeometryId,41);
  assert.equal(frame.objects[1].invocations,1);assert.equal(frame.objects[1].submitted.calls,2,'Native multi-draw totals are retained');
  assert.equal(frame.completion.status,'complete');assert.equal(frame.completion.polls,2);
 }
 assert.throws(()=>f.api.arm(),/single use/);assert.equal(f.renderer.info.render.frame,4);
});

test('unavailable GPU timing stays unavailable without adding fences, queries or rendering',()=>{
 const f=fixture();f.api.arm();for(let i=0;i<3;i++)f.frame();f.api.poll();
 const receipt=f.read();assert.equal(receipt.timer.status,'unavailable');assert.match(receipt.timer.reason,/unavailable/);
 assert.equal(receipt.timer.queries,0);assert.equal(f.native.queries,0);assert.equal(f.native.fences,3);assert.equal(f.native.renders,3);
 assert(receipt.frames.flatMap(frame=>frame.objects).every(row=>row.gpu.status==='unavailable'&&row.gpu.nanoseconds===null));
});

test('supported GPU queries are bounded and read only after original frame completion',()=>{
 const f=fixture({timers:true});f.api.arm();f.frame();f.api.poll();assert.equal(f.native.queryDeletes,0);
 f.frame();f.frame();f.api.poll();const receipt=f.read();
 assert.equal(receipt.timer.status,'available');assert.equal(receipt.timer.queries,9);assert.equal(receipt.timer.resolved,9);assert.equal(receipt.pendingQueries,0);
 assert.equal(f.native.queryEnds,9);assert.equal(f.native.queryDeletes,9);assert.equal(f.native.fences,3);
 assert(receipt.frames.flatMap(frame=>frame.objects).every(row=>row.gpu.status==='available'&&row.gpu.nanoseconds>0));
 assert.equal(receipt.frames[0].objects[0].gpu.nanoseconds,1_000_000);
});

test('disjoint timing never becomes a zero-cost or valid GPU result',()=>{
 const f=fixture({timers:true,disjoint:true});f.api.arm();for(let i=0;i<3;i++)f.frame();f.api.poll();const receipt=f.read();
 assert.equal(receipt.timer.status,'disjoint');assert.equal(receipt.timer.disjoint,true);assert.equal(receipt.timer.resolved,9);
 assert(receipt.frames.flatMap(frame=>frame.objects).every(row=>row.gpu.status==='disjoint'&&row.gpu.nanoseconds===null));
 assert.equal(receipt.completedFrames,3);assert.equal(receipt.frames[0].observedTotals.triangles,170);
});

test('recording bounds do not skip any original draw',()=>{
 const f=fixture({maxCalls:2});f.api.arm();for(let i=0;i<3;i++)f.frame();const receipt=f.read();
 assert.equal(receipt.overflow,true);assert.equal(f.native.direct.length,9);assert.equal(receipt.recordedCalls,9);
 assert.equal(receipt.frames.reduce((total,frame)=>total+frame.observedTotals.triangles,0),510);
});

test('original draw errors propagate unchanged while a diagnostic query is closed',()=>{
 const f=fixture({timers:true,throwDirect:true});f.api.arm();assert.throws(()=>f.renderer.render(f.scene,f.camera),error=>error===f.failure);
 assert.equal(f.native.direct.length,1);assert.equal(f.native.queryEnds,1);assert.equal(f.read().frames[0].threw,true);assert.equal(f.read().completedFrames,0);
});

test('incompatible existing devtools hooks remain intact and fail observation closed',()=>{
 const original={dispatchEvent(){}};const f=fixture({existing:original});assert.equal(f.context.__THREE_DEVTOOLS__,original);
 assert.equal(f.read().ready,false);assert.throws(()=>f.api.arm(),/incomplete/);assert.equal(f.native.renders,0);
});

test('an existing EventTarget devtools hook is retained',()=>{
 const original=new EventTarget(),f=fixture({existing:original});assert.equal(f.context.__THREE_DEVTOOLS__,original);assert.equal(f.read().ready,true);
});
