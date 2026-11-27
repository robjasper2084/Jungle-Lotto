import assert from 'node:assert/strict';
import {test} from 'node:test';
import vm from 'node:vm';
import {installPolyhavenComparisonObserver} from './polyhaven-native-diagnostic-observer.mjs';

const identity=()=>[1,0,0,0,0,1,0,0,0,0,1,0,0,0,0,1];
function node(id,name,type='Group'){
 return{id,uuid:'node-'+id,name,type,visible:true,children:[],parent:null,position:{x:0,y:0,z:0},matrixWorld:{elements:identity()},layers:{mask:1}};
}
function attach(parent,child){parent.children.push(child);child.parent=parent;return child;}
function camera(id=30){return{...node(id,'Main camera','PerspectiveCamera'),isCamera:true,isPerspectiveCamera:true,
 matrixWorldInverse:{elements:identity()},projectionMatrix:{elements:identity()},projectionMatrixInverse:{elements:identity()},fov:60,aspect:1.6,near:.1,far:12000,zoom:1};}
class CustomEvent extends Event {constructor(type,{detail}){super(type);this.detail=detail;}}

function fixture(options={},behavior={}){
 let clock=0,target=null;const trace=[],directResults=[],canvas={id:'game',width:1280,height:800};
 const scene={...node(1,'Original island','Scene'),isScene:true};
 const pool=(id,shape,detail)=>attach(scene,{...node(id,'Clustered mapped mineral boulders '+shape+' '+detail,'Mesh'),isMesh:true,isInstancedMesh:true,
  count:2,frustumCulled:false,instanceMatrix:{array:new Float32Array([...identity(),...identity()]),itemSize:16,count:2,version:1}});
 const aquarium=pool(2,0,'near'),conservatory=pool(3,1,'near'),child=pool(4,2,'near');
 const others=[pool(5,0,'far'),pool(6,1,'far'),pool(7,2,'far')];
 const inputCamera=camera(),shadowCamera=camera(31),otherCamera=camera(32),shadowTarget={id:90},otherTarget={id:91};
 const renderer={domElement:canvas,xr:{isPresenting:!!behavior.xr},info:{autoReset:true,render:{frame:0,calls:0,triangles:0,lines:0,points:0}},getRenderTarget(){return target;}};
 const color={id:60,uuid:'material60',type:'MeshStandardMaterial',isMaterial:true,version:0,name:'Opaque original',visible:true,opacity:1,transparent:false,colorWrite:true,depthWrite:true,side:0,alphaTest:0,wireframe:false,roughness:.8,metalness:0},depth={id:61,isMeshDepthMaterial:true};
 const geo=id=>({id,uuid:'geometry'+id,name:'actual source',type:'BufferGeometry',attributes:Object.fromEntries([['position',3],['normal',3],['uv',2]].map(([key,itemSize])=>[key,{array:new Float32Array(3*itemSize),itemSize,count:3,version:0,normalized:false}])),index:{array:new Uint16Array([0,1,2]),itemSize:1,count:3,version:0,normalized:false},drawRange:{start:0,count:Infinity},groups:[]});
 const geometry={...geo(62),calls:3,triangles:18},otherGeometry={...geo(63),calls:2,triangles:10},group={start:0,count:54};
 aquarium.geometry=geometry;conservatory.geometry=otherGeometry;for(const p of [aquarium,conservatory,child,...others]){p.geometry??=geo(100+p.id);p.material=color;}
 function nativeDirect(...args){
  trace.push({kind:'direct',receiver:this,args});
  if(behavior.directError)throw behavior.directError;
  const g=args[2];renderer.info.render.calls+=g.calls??1;renderer.info.render.triangles+=g.triangles??6;
  behavior.afterDirect?.(args);return behavior.directReturn;
 }
 function nativeRender(...args){
  trace.push({kind:'render',receiver:this,args});
  if(behavior.renderError)throw behavior.renderError;
  renderer.info.render.frame++;Object.assign(renderer.info.render,{calls:0,triangles:0,lines:0,points:0});
  // Native Three updates the input camera inside render, after observer entry.
  const c=args[1];c.matrixWorld.elements[12]=behavior.x??10.123456789;c.matrixWorldInverse.elements[12]=-c.matrixWorld.elements[12];
  if(behavior.arrayCamera)c.isArrayCamera=true;
  if(behavior.shadow){target=shadowTarget;directResults.push(renderer.renderBufferDirect(shadowCamera,null,{id:64,calls:1,triangles:4},depth,aquarium,group));target=null;}
  if(!behavior.noColor){
   directResults.push(renderer.renderBufferDirect(c,args[0],geometry,color,aquarium,group));
   if(behavior.changeDuring)c.matrixWorldInverse.elements[12]+=.00001;
   if(behavior.extraTarget)target=otherTarget;
   const second=behavior.bypassSecond?nativeDirect:renderer.renderBufferDirect;
   directResults.push(second.call(renderer,behavior.extraCamera?otherCamera:c,args[0],otherGeometry,color,conservatory,null));
   target=null;
  }
  if(behavior.changeAfter)c.matrixWorld.elements[12]+=.00001;
  if(behavior.leaveTarget)target=otherTarget;
  return behavior.renderReturn;
 }
 renderer.render=nativeRender;renderer.renderBufferDirect=nativeDirect;
 const context=vm.createContext({EventTarget,Event,CustomEvent,structuredClone,Float32Array,Uint32Array,
  performance:{now:()=>++clock},document:{getElementById:id=>id==='game'?canvas:null},
  ...(behavior.hook!==undefined?{__THREE_DEVTOOLS__:behavior.hook}:{})});
 vm.runInContext('('+installPolyhavenComparisonObserver.toString()+')('+JSON.stringify(options)+')',context);
 context.__THREE_DEVTOOLS__?.dispatchEvent?.(new CustomEvent('observe',{detail:renderer}));
 return{context,renderer,scene,inputCamera,shadowCamera,otherCamera,canvas,trace,directResults,geometry,color,group,nativeRender,nativeDirect,aquarium,conservatory,child,
  api:context.__polyhavenComparisonObserver,draw:()=>renderer.render(scene,inputCamera),target:value=>{target=value;},clock:()=>clock,behavior};
}

test('the one timing window forwards without clock, camera or geometry receipt work',()=>{
 const expected={native:'result'},f=fixture({}, {renderReturn:expected,directReturn:17});f.draw();f.api.arm();f.draw();
 assert.throws(()=>f.api.resumeReceipts(),/No active timing/);
 const start=f.api.pauseReceipts(),clock=f.clock(),sequence=f.api.frame(),attributes=f.geometry.attributes;
 assert.equal(start.active,true);assert.throws(()=>f.api.pauseReceipts(),/one-shot/);
 Object.defineProperty(f.geometry,'attributes',{configurable:true,get(){throw Error('Timing must not read geometry');}});
 for(let i=0;i<8;i++)assert.equal(f.draw(),expected);
 assert.equal(f.clock(),clock);assert.equal(f.api.frame(),sequence);assert.equal(f.api.ready(),false);
 Object.defineProperty(f.geometry,'attributes',{configurable:true,writable:true,value:attributes});
 const stop=f.api.resumeReceipts();assert.equal(stop.renderInvocations,8);assert.equal(stop.directInvocations,16);
 assert.equal(stop.renderThrows,0);assert.equal(stop.directThrows,0);assert.equal(stop.wrongReceivers,0);
 assert.equal(f.api.ready(),false);f.draw();assert.equal(f.api.ready(),true);
 assert.throws(()=>f.api.pauseReceipts(),/one-shot/);assert.throws(()=>f.api.resumeReceipts(),/No active timing/);
});

test('paused receipt wrappers preserve native exceptions and retain the raw failures',()=>{
 for(const key of ['renderError','directError']){
  const expected=Error('original '+key),f=fixture();f.draw();f.api.arm();f.draw();f.api.pauseReceipts();f.behavior[key]=expected;
  assert.throws(()=>f.draw(),error=>error===expected);const stop=f.api.resumeReceipts();assert.equal(stop.renderThrows,1);
  assert.equal(stop.directThrows,key==='directError'?1:0);f.behavior[key]=null;f.draw();
  assert.equal(f.api.snapshot().timingWindow.renderThrows,1);
 }
});

test('resuming receipt copies detects unversioned source mutation and cannot erase it',()=>{
 const f=fixture();f.draw();f.api.arm();f.draw();f.api.pauseReceipts();f.geometry.attributes.position.array[0]=.25;f.draw();
 const stop=f.api.resumeReceipts();assert.equal(stop.renderInvocations,1);f.draw();
 const receipt=f.api.snapshot();assert.equal(receipt.ready,false);assert(receipt.captureInvalidPasses>0);
 assert(receipt.errors.some(row=>row.message.includes('without a version change')));assert.throws(()=>f.api.arm(),/one-shot/);
});

test('serializable hook captures submitted matrices after native camera update and conserves multi-draw work',()=>{
 const result={original:'return'},f=fixture({}, {shadow:true,renderReturn:result,directReturn:'draw-result'});
 assert.equal(f.api.ready(),false);assert.equal(f.draw(),result);assert.equal(f.api.ready(),true);
 const receipt=f.api.snapshot(),row=receipt.latest;
 assert.equal(row.valid,true);assert.equal(row.colorDirectInvocations,2);assert.equal(row.shadowDirectInvocations,1);
 assert.deepEqual(row.counters,{calls:6,triangles:32,lines:0,points:0});
 assert.deepEqual(row.colorSubmitted,{calls:5,triangles:28,lines:0,points:0});
 assert.deepEqual(row.shadowSubmitted,{calls:1,triangles:4,lines:0,points:0});
 assert.deepEqual(row.nativeEndTotals,row.counters);assert.equal(row.camera.matrixWorld[12],10.123456789);
 assert.equal(row.camera.gpu.cameraPosition[0],Math.fround(10.123456789));
 const bits=new Uint32Array(new Float32Array([-10.123456789]).buffer)[0];assert.equal(row.camera.gpu.viewMatrixBits[12],bits);
 assert.deepEqual(row.camera,row.postCamera);
 assert.equal(f.trace.filter(row=>row.kind==='render').length,1);assert.equal(f.trace.filter(row=>row.kind==='direct').length,3);
 for(const call of f.trace)assert.equal(call.receiver,f.renderer);
 assert.equal(f.trace[0].args[0],f.scene);assert.equal(f.trace[0].args[1],f.inputCamera);
 assert.equal(f.trace[2].args[0],f.inputCamera);assert.equal(f.trace[2].args[4],f.aquarium);
 assert.equal(f.trace[2].args[2],f.geometry);assert.equal(f.trace[2].args[3],f.color);assert.equal(f.trace[2].args[5],f.group);
 assert.deepEqual(f.directResults,['draw-result','draw-result','draw-result']);
 assert.equal(receipt.inventory.nodes.find(node=>node.id===f.child.id).instanced,true);
 assert.equal(row.rockDraws.length,2);assert.equal(row.rockDraws[0].object.uuid,f.aquarium.uuid);assert.equal(row.rockDraws[0].geometry.uuid,f.geometry.uuid);assert.deepEqual(row.rockDraws[0].instanceMatrix,Array.from(f.aquarium.instanceMatrix.array));
 assert.deepEqual(Object.keys(f.api).sort(),['arm','canArm','frame','pauseReceipts','ready','resources','resumeReceipts','snapshot']);
});

test('copied bounded history and scene inventory expose no mutable application objects',()=>{
 const f=fixture({historyLimit:2});for(let i=0;i<5;i++)f.draw();
 const a=f.api.snapshot();assert.deepEqual(a.history.map(row=>row.sequence),[4,5]);assert.equal(f.api.frame(),5);
 a.latest.camera.matrixWorld[12]=999;a.inventory.nodes[0].name='changed copy';a.coverage.direct=false;
 const b=f.api.snapshot();assert.equal(b.latest.camera.matrixWorld[12],10.123456789);assert.equal(b.inventory.nodes[0].name,f.aquarium.name);
 assert.equal(b.coverage.direct,true);assert.equal(f.inputCamera.matrixWorld.elements[12],10.123456789);
});

test('missing and partial native color coverage fail without skipping original rendering',()=>{
 const none=fixture({}, {noColor:true});none.draw();assert.equal(none.api.ready(),false);assert(none.api.snapshot().latest.issues.includes('missing-color-draw-coverage'));
 const partial=fixture({}, {bypassSecond:true});partial.draw();const row=partial.api.snapshot().latest;
 assert.equal(partial.trace.filter(row=>row.kind==='direct').length,2);assert.equal(partial.api.ready(),false);
 assert(row.issues.includes('partial-native-draw-coverage'));assert.equal(row.nativeEndTotals.calls,5);assert.equal(row.counters.calls,3);
});

test('a changed draw-time or post-return raw camera is invalid even for a stationary screenshot',()=>{
 for(const [option,expected] of [['changeDuring','changed-color-draw-camera'],['changeAfter','changed-post-render-camera']]){
  const f=fixture({}, {[option]:true});f.draw();assert.equal(f.api.ready(),false);assert(f.api.snapshot().latest.issues.includes(expected));
 }
});

test('additional cameras, targets, XR and ArrayCamera cannot produce an accepted island receipt',()=>{
 for(const option of ['extraCamera','extraTarget','leaveTarget','xr','arrayCamera']){
  const f=fixture({}, {[option]:true});f.draw();assert.equal(f.api.ready(),false,option);assert.equal(f.api.snapshot().latest.valid,false,option);
 }
});

test('native render and direct exceptions preserve their original identity and are never retried',()=>{
 for(const option of ['renderError','directError']){
  const originalError=Error(option),f=fixture({}, {[option]:originalError});
  assert.throws(()=>f.draw(),error=>error===originalError);assert.equal(f.api.ready(),false);
  assert.equal(f.trace.filter(row=>row.kind==='render').length,1);
  assert.equal(f.trace.filter(row=>row.kind==='direct').length,option==='directError'?1:0);
 }
});

test('missing landmark names, ambiguous island scenes, stale native frames and truncated inventories fail closed',()=>{
 const missing=fixture();missing.conservatory.name='Different building';missing.draw();assert.equal(missing.api.ready(),false);assert.equal(missing.api.frame(),0);
 const truncated=fixture({maxInventoryNodes:3});truncated.draw();assert.equal(truncated.api.ready(),false);assert(truncated.api.snapshot().errors.length>0);
 const rows=fixture({maxPoolNodes:2});rows.draw();assert.equal(rows.api.ready(),false);
 const stale=fixture();stale.draw();assert.equal(stale.api.ready(),true);stale.nativeRender.call(stale.renderer,stale.scene,stale.inputCamera);assert.equal(stale.api.ready(),false);assert.equal(stale.api.snapshot().fresh,false);
 const ambiguous=fixture();ambiguous.draw();const other={...node(80,'Another island','Scene'),isScene:true};
 for(let shape=0;shape<3;shape++)for(const detail of ['near','far'])attach(other,node(81+shape*2+(detail==='far'?1:0),'Clustered mapped mineral boulders '+shape+' '+detail));
 ambiguous.renderer.render(other,ambiguous.inputCamera);assert.equal(ambiguous.api.ready(),false);assert(ambiguous.api.snapshot().errors.some(error=>error.where==='scene selection'));
});

test('Float32 equality is exact while distinct original doubles remain available',()=>{
 const f=fixture({}, {x:1.00000001});f.draw();const first=f.api.snapshot().latest.camera;
 f.behavior.x=1.00000002;f.draw();const second=f.api.snapshot().latest.camera;
 assert.notEqual(first.position[0],second.position[0]);assert.deepEqual(first.gpu.cameraPositionBits,second.gpu.cameraPositionBits);
 assert.equal(f.api.ready(),true);
 f.behavior.x=-0;f.draw();const zero=f.api.snapshot().latest.camera;
 assert(Object.is(zero.position[0],-0));assert.equal(zero.gpu.cameraPositionBits[0],0x80000000);
});

test('existing devtools event ownership is retained and incompatible hooks are not replaced',()=>{
 const hook=new EventTarget(),f=fixture({}, {hook});f.draw();assert.equal(f.context.__THREE_DEVTOOLS__,hook);assert.equal(f.api.ready(),true);
 const incompatible={existing:true},g=fixture({}, {hook:incompatible});assert.equal(g.context.__THREE_DEVTOOLS__,incompatible);assert.equal(g.api.ready(),false);assert(g.api.snapshot().errors.length>0);
});

test('ordinary auxiliary preparation renders cannot be mistaken for fresh island evidence',()=>{
 const f=fixture();f.draw();assert.equal(f.api.ready(),true);
 const auxiliary={...node(100,'Invisible geometry registration','Scene'),isScene:true};
 f.renderer.render(auxiliary,f.otherCamera);assert.equal(f.api.ready(),false);assert.equal(f.api.snapshot().fresh,false);
 assert.equal(f.api.frame(),1);f.draw();assert.equal(f.api.ready(),true);assert.equal(f.api.frame(),2);
 assert.equal(f.api.snapshot().ignoredOtherSceneRenders,1);
});

test('later forwarding renderer wrappers preserve observed coverage without assuming wrapper identity',()=>{
 const f=fixture({}, {shadow:true}),beforeRender=f.renderer.render,beforeDirect=f.renderer.renderBufferDirect;
 let renders=0,directs=0;
 f.renderer.render=function(...args){renders++;return Reflect.apply(beforeRender,this,args);};
 f.renderer.renderBufferDirect=function(...args){directs++;return Reflect.apply(beforeDirect,this,args);};
 f.draw();assert.equal(renders,1);assert.equal(directs,3);assert.equal(f.api.ready(),true);
 assert.deepEqual(f.api.snapshot().latest.counters,f.api.snapshot().latest.nativeEndTotals);
});

test('all six exact original pool names are required without renaming any runtime object',()=>{
 const f=fixture();f.draw();assert.equal(f.api.ready(),true);const inventory=f.api.snapshot().inventory;
 assert.equal(inventory.requiredNames.length,6);assert.equal(inventory.nodes.length,6);
 assert.equal(inventory.actualRequiredNames[0].actual,f.aquarium.name);
 const wrong=fixture();wrong.aquarium.name=wrong.aquarium.name.replaceAll(' ','_');wrong.draw();assert.equal(wrong.api.ready(),false);
 const duplicate=fixture();attach(duplicate.scene,node(88,duplicate.aquarium.name));duplicate.draw();assert.equal(duplicate.api.ready(),false);
});

test('replacing either previously attested public renderer method immediately fails coverage',()=>{
 for(const method of ['render','renderBufferDirect']){
  const f=fixture();f.draw();assert.equal(f.api.ready(),true);
  f.renderer[method]=()=>undefined;assert.equal(f.api.ready(),false);
  const field=method==='render'?'currentRenderHook':'currentDirectHook';assert.equal(f.api.snapshot().coverage[field],false);
 }
});

test('one-shot capture boundary retains preparation failures and requires a new complete pass',()=>{
 const f=fixture({}, {noColor:true});
 assert.throws(()=>f.api.arm(),/current complete/);f.draw();assert.equal(f.api.canArm(),false);
 f.behavior.noColor=false;f.draw();assert.equal(f.api.ready(),false,'Lifetime failure remains visible before the capture boundary');
 assert.equal(f.api.canArm(),true);const renders=f.trace.length,before=structuredClone(f.inputCamera),arm=f.api.arm();
 assert.equal(f.trace.length,renders);assert.deepEqual(f.inputCamera,before);assert.equal(arm.afterSequence,2);assert.equal(arm.preparationInvalidPasses,1);
 assert.equal(f.api.ready(),false,'The pre-boundary valid pass cannot count as capture evidence');
 arm.afterSequence=-1;assert.equal(f.api.snapshot().captureWindow.afterSequence,2);
 for(let i=0;i<12;i++)f.draw();const result=f.api.snapshot();
 assert.equal(result.ready,true);assert.equal(result.invalidPasses,1);assert.equal(result.captureInvalidPasses,0);
 assert.equal(result.firstInvalidPasses[0].sequence,1);assert.equal(result.firstInvalidPasses[0].observationPhase,'preparation');
 assert.equal(result.history.some(row=>!row.valid),false);assert.equal(result.firstCaptureInvalidPasses.length,0);
 assert.throws(()=>f.api.arm(),/one-shot/);assert.equal(f.api.snapshot().captureWindow.afterSequence,2);
});

test('any invalid capture-window pass stays fatal after later valid passes and cannot be reset',()=>{
 const f=fixture();f.draw();f.api.arm();f.draw();assert.equal(f.api.ready(),true);
 f.behavior.bypassSecond=true;f.draw();f.behavior.bypassSecond=false;for(let i=0;i<12;i++)f.draw();
 const result=f.api.snapshot();assert.equal(result.latest.valid,true);assert.equal(result.ready,false);
 assert.equal(result.captureInvalidPasses,1);assert.equal(result.invalidPasses,1);
 assert.equal(result.firstCaptureInvalidPasses[0].observationPhase,'capture');
 assert(result.firstCaptureInvalidPasses[0].issues.includes('partial-native-draw-coverage'));
 assert.throws(()=>f.api.arm(),/one-shot/);assert.equal(f.api.snapshot().captureInvalidPasses,1);
});

test('arming requires fresh attested hooks and never clears setup errors or bounded first failures',()=>{
 for(const key of ['render','renderBufferDirect']){
  const f=fixture();f.draw();f.renderer[key]=()=>{};assert.equal(f.api.canArm(),false);assert.throws(()=>f.api.arm(),/current complete/);
 }
 const stale=fixture();stale.draw();stale.nativeRender.call(stale.renderer,stale.scene,stale.inputCamera);
 assert.equal(stale.api.canArm(),false);assert.throws(()=>stale.api.arm(),/current complete/);
 const bounded=fixture({}, {noColor:true});for(let i=0;i<12;i++)bounded.draw();bounded.behavior.noColor=false;bounded.draw();bounded.api.arm();
 bounded.behavior.noColor=true;bounded.draw();const result=bounded.api.snapshot();
 assert.equal(result.invalidPasses,13);assert.equal(result.firstInvalidPasses.length,8);
 assert.deepEqual(result.firstInvalidPasses.map(row=>row.sequence),[1,2,3,4,5,6,7,8]);
 assert.equal(result.firstCaptureInvalidPasses.length,1);assert.equal(result.firstCaptureInvalidPasses[0].sequence,14);
 const missing=fixture({maxInventoryNodes:3});missing.draw();const errors=missing.api.snapshot().errors;
 assert.throws(()=>missing.api.arm(),/current complete/);assert.deepEqual(missing.api.snapshot().errors,errors);
});

test('actual color-draw geometry bytes and instance matrices are copied once per native version state',()=>{
 const f=fixture();f.geometry.attributes.position.array[1]=1.25;f.aquarium.instanceMatrix.array[12]=42.5;f.draw();
 const first=f.api.snapshot().latest.rockDraws[0],resources=f.api.resources();assert.equal(resources.length,2);
 assert.equal(first.instanceMatrix[12],42.5);assert.equal(first.instanceMatrixBits[12],new Uint32Array(new Float32Array([42.5]).buffer)[0]);
 const position=resources[0].attributes.find(a=>a.name==='position');assert.deepEqual(position.bytes,Array.from(new Uint8Array(f.geometry.attributes.position.array.buffer)));
 resources[0].attributes[0].bytes[0]=255;assert.notEqual(f.api.resources()[0].attributes[0].bytes[0],255);
 f.draw();assert.equal(f.api.resources().length,2);f.geometry.attributes.position.array[1]=3.5;f.geometry.attributes.position.version++;f.draw();
 assert.equal(f.api.resources().length,3);assert.notEqual(f.api.snapshot().latest.rockDraws[0].geometryResource,first.geometryResource);
 assert.equal(f.aquarium.instanceMatrix.array[12],42.5,'observer never rewrites actual source placements');
});

test('unknown pool owners and malformed active instance buffers fail while forwarding the original draw once',()=>{
 for(const mutate of [f=>{f.aquarium.geometry={...f.geometry};},f=>{f.aquarium.material={...f.color};},f=>{f.aquarium.count=91;},f=>{f.aquarium.count=3;},f=>{f.aquarium.instanceMatrix.array[0]=NaN;},f=>{f.aquarium.instanceMatrix.itemSize=4;}]){
  const f=fixture();mutate(f);f.draw();assert.equal(f.api.ready(),false);
  assert.equal(f.trace.filter(r=>r.kind==='render').length,1);assert.equal(f.trace.filter(r=>r.kind==='direct').length,2);
  assert(f.api.snapshot().errors.some(e=>e.where==='begin direct observation'));
 }
});

test('a native color callback cannot change the attributed pool owner or version undetected',()=>{
 for(const mutate of [f=>{f.aquarium.geometry={...f.geometry};},f=>{f.aquarium.material={...f.color};},f=>{f.aquarium.count=1;},f=>{f.aquarium.instanceMatrix.version++;},
  f=>{const array=new Float32Array(f.aquarium.instanceMatrix.array);array[12]=999;f.aquarium.instanceMatrix={...f.aquarium.instanceMatrix,array};},
  f=>{f.aquarium.instanceMatrix.array[12]=999;},f=>{f.aquarium.matrixWorld.elements[12]=999;},f=>{f.geometry.index.version++;},
  f=>{f.geometry.attributes.position.array[0]=9;},f=>{f.geometry.index={...f.geometry.index};},f=>{f.geometry.groups.push({start:0,count:3,materialIndex:0});},
  f=>{f.geometry.drawRange.count=0;},f=>{f.color.opacity=.5;}]){
  const f=fixture();f.behavior.afterDirect=args=>{if(args[4]===f.aquarium)mutate(f);};f.draw();
  assert.equal(f.api.ready(),false);assert(f.api.snapshot().latest.issues.includes('rock-owner-changed-during-native-draw'));
 }
});

test('cached geometry receipts retain current groups and ranges and reject unversioned byte changes',()=>{
 const f=fixture();f.draw();const first=f.api.snapshot().latest.rockDraws[0].geometryResource;
 f.geometry.groups.push({start:0,count:3,materialIndex:0});f.geometry.drawRange.count=3;f.draw();
 const second=f.api.snapshot().latest.rockDraws[0].geometryResource;assert.notEqual(first,second);
 const resource=f.api.resources().find(r=>r.key===second);assert.deepEqual(resource.groups,f.geometry.groups);assert.equal(resource.drawRange.count,3);
 f.geometry.attributes.position.array[0]=7;f.draw();assert.equal(f.api.ready(),false);assert(f.api.snapshot().errors.some(e=>e.message.includes('without a version change')));
});

test('an empty native submission retains zero triangles for the separate capture contract to reject',()=>{
 const f=fixture();f.geometry.triangles=0;f.draw();const draw=f.api.snapshot().latest.rockDraws[0];
 assert.equal(f.api.ready(),true);assert.equal(draw.submitted.calls,3);assert.equal(draw.submitted.triangles,0);
});

test('a zero-native-call pool invocation cannot count as a submitted rock draw',()=>{
 const f=fixture();f.geometry.calls=0;f.geometry.triangles=0;f.draw();assert.equal(f.api.ready(),true);
 const row=f.api.snapshot().latest;assert.equal(row.colorDirectInvocations,2);assert.equal(row.rockDraws.length,1);assert.equal(row.rockDraws[0].object.id,f.conservatory.id);
});

test('oversized source-buffer receipts fail without allocating unbounded archives or suppressing rendering',()=>{
 const f=fixture();f.geometry.attributes.position.array=new Float32Array(300000);f.draw();
 assert.equal(f.api.ready(),false);assert(f.api.snapshot().errors.some(e=>e.message.includes('byte limit')));
 assert.equal(f.trace.filter(r=>r.kind==='direct').length,2);
});
