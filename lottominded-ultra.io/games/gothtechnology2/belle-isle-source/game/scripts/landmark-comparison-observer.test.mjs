import assert from 'node:assert/strict';
import {test} from 'node:test';
import vm from 'node:vm';
import {installLandmarkComparisonObserver} from './landmark-comparison-observer.mjs';

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
 const aquarium=attach(scene,{...node(2,'107227742_Aquarium illuminated habitat','Mesh'),isMesh:true,
  geometry:{id:50,index:{count:18}},material:{id:51}});
 const conservatory=attach(scene,node(3,'107310050_Conservatory concrete paving','Mesh'));conservatory.isMesh=true;
 const root=attach(scene,node(4,'Anna Scripps Whitcomb Conservatory (STAGED)'));
 const child=attach(root,node(5,'West_Vestibule_SideGlass','Mesh'));child.isMesh=true;
 const inputCamera=camera(),shadowCamera=camera(31),otherCamera=camera(32),shadowTarget={id:90},otherTarget={id:91};
 const renderer={domElement:canvas,xr:{isPresenting:!!behavior.xr},info:{autoReset:true,render:{frame:0,calls:0,triangles:0,lines:0,points:0}},getRenderTarget(){return target;}};
 const color={id:60,name:'Opaque original'},depth={id:61,isMeshDepthMaterial:true};
 const geometry={id:62,calls:3,triangles:18},group={start:0,count:54};
 function nativeDirect(...args){
  trace.push({kind:'direct',receiver:this,args});
  if(behavior.directError)throw behavior.directError;
  const g=args[2];renderer.info.render.calls+=g.calls??1;renderer.info.render.triangles+=g.triangles??6;
  return behavior.directReturn;
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
   directResults.push(second.call(renderer,behavior.extraCamera?otherCamera:c,args[0],{id:63,calls:2,triangles:10},color,conservatory,null));
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
 vm.runInContext('('+installLandmarkComparisonObserver.toString()+')('+JSON.stringify(options)+')',context);
 context.__THREE_DEVTOOLS__?.dispatchEvent?.(new CustomEvent('observe',{detail:renderer}));
 return{context,renderer,scene,inputCamera,shadowCamera,otherCamera,canvas,trace,directResults,geometry,color,group,nativeRender,nativeDirect,aquarium,conservatory,child,
  api:context.__landmarkComparisonObserver,draw:()=>renderer.render(scene,inputCamera),target:value=>{target=value;},behavior};
}

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
 assert.equal(receipt.inventory.nodes.find(node=>node.id===f.child.id).landmark,'conservatory');
 assert.deepEqual(Object.keys(f.api).sort(),['frame','ready','snapshot']);
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
 const rows=fixture({maxLandmarkNodes:2});rows.draw();assert.equal(rows.api.ready(),false);
 const stale=fixture();stale.draw();assert.equal(stale.api.ready(),true);stale.nativeRender.call(stale.renderer,stale.scene,stale.inputCamera);assert.equal(stale.api.ready(),false);assert.equal(stale.api.snapshot().fresh,false);
 const ambiguous=fixture();ambiguous.draw();const other={...node(80,'Another island','Scene'),isScene:true};
 attach(other,node(81,'107227742_Aquarium illuminated habitat'));attach(other,node(82,'107310050_Conservatory concrete paving'));
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

test('the actual GLTFLoader underscore names select the same retained island without rewriting inventory',()=>{
 const f=fixture();f.aquarium.name=f.aquarium.name.replaceAll(' ','_');f.conservatory.name=f.conservatory.name.replaceAll(' ','_');
 attach(f.scene,node(88,'107310050_Timber','Mesh'));
 f.draw();assert.equal(f.api.ready(),true);const inventory=f.api.snapshot().inventory;
 assert.deepEqual(inventory.requiredNames,['107227742_Aquarium illuminated habitat','107310050_Conservatory concrete paving']);
 assert.equal(inventory.nodes[0].name,'107227742_Aquarium_illuminated_habitat');
 assert.equal(inventory.actualRequiredNames[0].actual,inventory.nodes[0].name);
 assert.equal(inventory.nodes.find(node=>node.id===88).landmark,'conservatory');
 const wrongId=fixture();wrongId.aquarium.name='x107227742_Aquarium_illuminated_habitat';wrongId.draw();assert.equal(wrongId.api.ready(),false);
});

test('replacing either previously attested public renderer method immediately fails coverage',()=>{
 for(const method of ['render','renderBufferDirect']){
  const f=fixture();f.draw();assert.equal(f.api.ready(),true);
  f.renderer[method]=()=>undefined;assert.equal(f.api.ready(),false);
  const field=method==='render'?'currentRenderHook':'currentDirectHook';assert.equal(f.api.snapshot().coverage[field],false);
 }
});
