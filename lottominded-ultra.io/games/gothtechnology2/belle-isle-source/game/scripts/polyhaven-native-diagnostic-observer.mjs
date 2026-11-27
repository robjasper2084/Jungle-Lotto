/** Install before the unchanged application. This observer forwards existing
 * renderer methods and exposes copied receipts only; it never renders a scene,
 * changes a camera/material, updates a matrix, or supplies application input. */
export function installPolyhavenComparisonObserver(options={}){
 const root=globalThis,historyLimit=options.historyLimit??8,maxInventoryNodes=options.maxInventoryNodes??20000,maxPoolNodes=options.maxPoolNodes??2048;
 if(!Number.isSafeInteger(historyLimit)||historyLimit<1||historyLimit>32||!Number.isSafeInteger(maxInventoryNodes)||maxInventoryNodes<2||maxInventoryNodes>100000||!Number.isSafeInteger(maxPoolNodes)||maxPoolNodes<2||maxPoolNodes>8192)throw Error('Invalid bounded rock comparison observer configuration');
 if(root.__polyhavenComparisonObserver)throw Error('Rock comparison observer already installed');
 const requiredNames=Array.from({length:3},(_,shape)=>['near','far'].map(detail=>'Clustered mapped mineral boulders '+shape+' '+detail)).flat();
 const coverage={renderer:false,render:false,direct:false},errors=[],history=[],scopes=[],firstInvalidPasses=[],firstCaptureInvalidPasses=[];
 let captureWindow=null,timingWindow=null;
 let renderer,island,latest,attestedRender,attestedDirect,sequence=0,invalidPasses=0,ignoredOffscreenRenders=0,ignoredOtherSceneRenders=0;
 const copy=value=>structuredClone(value),now=()=>performance.now();
 const own=(value,key)=>{try{const descriptor=value&&Object.getOwnPropertyDescriptor(value,key);return descriptor&&'value'in descriptor?descriptor.value:undefined;}catch{return undefined;}};
 const number=(value,fallback=null)=>typeof value==='number'&&Number.isFinite(value)?value:fallback;
 const id=value=>Number.isSafeInteger(own(value,'id'))?own(value,'id'):null;
 const label=(value,key='name')=>typeof own(value,key)==='string'?own(value,key).slice(0,160):'';
 const identity=value=>({id:id(value),uuid:label(value,'uuid'),name:label(value),type:label(value,'type')});
 const error=(where,value)=>{if(errors.length<32)errors.push({where,message:String(value)});};
 const issue=(scope,code)=>{if(!scope.record.issues.includes(code)&&scope.record.issues.length<32)scope.record.issues.push(code);};
 const zero=()=>({calls:0,triangles:0,lines:0,points:0});
 const counts=()=>{const value=renderer.info.render;return{calls:value.calls,triangles:value.triangles,lines:value.lines,points:value.points};};
 const validCounts=value=>Object.values(value).every(n=>Number.isFinite(n)&&n>=0);
 const add=(target,delta)=>{for(const key of Object.keys(target))target[key]+=delta[key];};
 const equalArray=(a,b)=>Array.isArray(a)&&Array.isArray(b)&&a.length===b.length&&a.every((value,index)=>Object.is(value,b[index]));
 const equalCounts=(a,b)=>Object.keys(a).every(key=>a[key]===b?.[key]);
 function matrix(value){
  const elements=value?.elements;if(!elements||elements.length!==16)throw Error('A complete camera matrix is required');
  const result=Array.from(elements);if(!result.every(v=>typeof v==='number'&&Number.isFinite(v)))throw Error('Nonfinite camera matrix');return result;
 }
 function floats(values){const value=new Float32Array(values);if(!Array.from(value).every(Number.isFinite))throw Error('Nonfinite Float32 camera input');return{values:Array.from(value),bits:Array.from(new Uint32Array(value.buffer))};}
 function cameraReceipt(camera){
  const matrixWorld=matrix(camera.matrixWorld),matrixWorldInverse=matrix(camera.matrixWorldInverse),projectionMatrix=matrix(camera.projectionMatrix),projectionMatrixInverse=matrix(camera.projectionMatrixInverse);
  const position=matrixWorld.slice(12,15),view=floats(matrixWorldInverse),projection=floats(projectionMatrix),location=floats(position);
  return{...identity(camera),matrixWorld,matrixWorldInverse,projectionMatrix,projectionMatrixInverse,position,
   projection:{fov:number(camera.fov),aspect:number(camera.aspect),near:number(camera.near),far:number(camera.far),zoom:number(camera.zoom)},
   gpu:{viewMatrix:view.values,projectionMatrix:projection.values,cameraPosition:location.values,
    viewMatrixBits:view.bits,projectionMatrixBits:projection.bits,cameraPositionBits:location.bits}};
 }
 function sameCamera(a,b){
  return a.id===b.id&&a.uuid===b.uuid&&['matrixWorld','matrixWorldInverse','projectionMatrix','projectionMatrixInverse','position'].every(key=>equalArray(a[key],b[key]))&&
   Object.keys(a.projection).every(key=>Object.is(a.projection[key],b.projection[key]));
 }
 function sameInputCamera(receipt,camera){
  // Equal raw inputs imply equal Float32 GPU bits. Avoid allocating a fresh
  // matrix/typed-array receipt for every unchanged draw in the same pass.
  for(const key of ['matrixWorld','matrixWorldInverse','projectionMatrix','projectionMatrixInverse']){
   const actual=camera[key]?.elements,expected=receipt[key];if(!actual||actual.length!==16)return false;
   for(let i=0;i<16;i++)if(!Object.is(actual[i],expected[i]))return false;
  }
  return Object.keys(receipt.projection).every(key=>Object.is(number(camera[key]),receipt.projection[key]));
 }
 // Resource bytes are captured once per native attribute-version state, outside
 // ordinary gameplay. Receipts identify the actual original color-draw inputs.
 // They never substitute a geometry, texture, material, matrix or native draw.
 const resourceRows=[],geometryCache=new WeakMap();let resourceBytes=0;
 function geometryState(geometry){
  const names=Object.keys(geometry.attributes||{}).sort(),attributes=names.map(name=>[name,geometry.attributes[name]]);
  if(geometry.index)attributes.push(['index',geometry.index]);
  const signature=attributes.flatMap(([name,a])=>{const data=a.isInterleavedBufferAttribute?a.data:a;return[name,a,data,data.array,data.array?.buffer,data.array?.byteOffset,data.array?.byteLength,data.version,a.itemSize,a.count,a.normalized,a.offset??0,data.stride??a.itemSize];});
  signature.push('groups',geometry.groups?.length??0,...(geometry.groups||[]).flatMap(g=>[g.start,g.count,g.materialIndex]),'drawRange',geometry.drawRange?.start,geometry.drawRange?.count);
  return{names,attributes,signature};
 }
 const sameSignature=(a,b)=>a.length===b.length&&a.every((value,i)=>Object.is(value,b[i]));
 function geometryResource(geometry){
  const {names,attributes,signature}=geometryState(geometry);
  const cached=geometryCache.get(geometry);
  if(cached&&sameSignature(signature,cached.signature)){
   // These static geometries must not change bytes without a native version
   // change. Otherwise their CPU receipt would no longer identify the uploaded
   // buffer. Fail closed instead of claiming the stale resource is current.
   for(let i=0;i<attributes.length;i++){
    const a=attributes[i][1],array=(a.isInterleavedBufferAttribute?a.data:a).array,actual=new Uint8Array(array.buffer,array.byteOffset,array.byteLength),expected=cached.receipt.attributes[i].bytes;
    if(actual.length!==expected.length||!actual.every((value,j)=>value===expected[j]))throw Error('Native rock geometry bytes changed without a version change');
   }
   return cached.key;
  }
  if(resourceRows.length>=32)throw Error('Rock geometry receipt resource limit exceeded');
  const rows=attributes.map(([name,a])=>{
   const interleaved=a.isInterleavedBufferAttribute===true,data=interleaved?a.data:a,array=data.array;
   if(!ArrayBuffer.isView(array)||array instanceof DataView||!Number.isSafeInteger(a.count)||a.count<0||!Number.isSafeInteger(a.itemSize)||a.itemSize<1||a.itemSize>16)throw Error('Unsupported native rock attribute');
   const bytes=new Uint8Array(array.buffer,array.byteOffset,array.byteLength);
   if(bytes.length>1024*1024||resourceBytes+bytes.length>16*1024*1024)throw Error('Native rock attribute receipt exceeded its byte limit');
   resourceBytes+=bytes.length;
   return{name,arrayType:array.constructor.name,itemSize:a.itemSize,count:a.count,normalized:!!a.normalized,version:data.version,
    interleaved,stride:interleaved?data.stride:a.itemSize,offset:interleaved?a.offset:0,bytes:Array.from(bytes)};
  });
  if(!names.includes('position')||!names.includes('normal')||!names.includes('uv'))throw Error('Incomplete actual rock geometry');
  const key='geometry-'+resourceRows.length;
  const receipt={key,...identity(geometry),attributes:rows,groups:copy(geometry.groups||[]),drawRange:{start:geometry.drawRange?.start??0,count:geometry.drawRange?.count===Infinity?'Infinity':geometry.drawRange?.count??null}};
  geometryCache.set(geometry,{key,signature,receipt});resourceRows.push(receipt);return key;
 }
 function materialReceipt(material){
  if(Array.isArray(material)||!material?.isMaterial)throw Error('Expected one original rock material');
  const texture=value=>value?{id:id(value),uuid:label(value,'uuid'),name:label(value),version:number(value.version),channel:number(value.channel),colorSpace:value.colorSpace,
   sourceUuid:label(value.source,'uuid'),matrix:value.matrix?.elements?Array.from(value.matrix.elements):null,flipY:value.flipY,
   imageSize:[number(value.image?.width),number(value.image?.height)]}:null;
  return{...identity(material),version:number(material.version),visible:material.visible,transparent:material.transparent,opacity:material.opacity,colorWrite:material.colorWrite,depthWrite:material.depthWrite,
   side:material.side,alphaTest:material.alphaTest,wireframe:material.wireframe,roughness:material.roughness,metalness:material.metalness,
   map:texture(material.map),normalMap:texture(material.normalMap),roughnessMap:texture(material.roughnessMap)};
 }
 function rockDraw(args){
  const geometry=args[2],material=args[3],object=args[4],group=args[5],count=object.count,attribute=object.instanceMatrix;
  if(object.isInstancedMesh!==true||object.geometry!==geometry||object.material!==material||!Number.isSafeInteger(count)||count<1||count>90||!attribute||attribute.itemSize!==16||count>attribute.count||!(attribute.array instanceof Float32Array))throw Error('Invalid native rock pool owner or active instance buffer');
  const instanceMatrix=Array.from(attribute.array.slice(0,count*16));if(!instanceMatrix.every(Number.isFinite))throw Error('Nonfinite native rock instance matrix');
  const world=matrix(object.matrixWorld),gpuWorld=floats(world);
  return{object:identity(object),geometry:identity(geometry),geometryResource:geometryResource(geometry),material:materialReceipt(material),count,
   instanceMatrix,instanceMatrixBits:floats(instanceMatrix).bits,instanceMatrixVersion:attribute.version,matrixWorld:world,matrixWorldBits:gpuWorld.bits,
   layers:number(object.layers?.mask),visible:object.visible,frustumCulled:object.frustumCulled,
   group:group?{start:group.start,count:group.count,materialIndex:group.materialIndex??null}:null,
   drawRange:{start:geometry.drawRange?.start??0,count:geometry.drawRange?.count===Infinity?'Infinity':geometry.drawRange?.count??null},submitted:null};
 }
 function nativeRockState(args){
  const object=args[4],attribute=object.instanceMatrix,array=attribute.array;
  return{attribute,array,buffer:array.buffer,byteOffset:array.byteOffset,byteLength:array.byteLength,itemSize:attribute.itemSize,attributeCount:attribute.count,
   world:object.matrixWorld,worldElements:object.matrixWorld.elements,geometry:geometryState(args[2])};
 }
 function unchangedRock(args,receipt,state){
  const object=args[4],attribute=object.instanceMatrix;
  if(object.geometry!==args[2]||object.material!==args[3]||object.count!==receipt.count||attribute!==state.attribute||attribute.array!==state.array||attribute.version!==receipt.instanceMatrixVersion||
   attribute.itemSize!==state.itemSize||attribute.count!==state.attributeCount||attribute.array.buffer!==state.buffer||attribute.array.byteOffset!==state.byteOffset||attribute.array.byteLength!==state.byteLength||
   object.matrixWorld!==state.world||object.matrixWorld.elements!==state.worldElements||!sameSignature(geometryState(args[2]).signature,state.geometry.signature))return false;
  for(let i=0;i<receipt.instanceMatrix.length;i++)if(!Object.is(attribute.array[i],receipt.instanceMatrix[i]))return false;
  for(let i=0;i<16;i++)if(!Object.is(object.matrixWorld.elements[i],receipt.matrixWorld[i]))return false;
  const resource=geometryCache.get(args[2])?.receipt;
  if(!resource)return false;
  for(let i=0;i<state.geometry.attributes.length;i++){
   const a=state.geometry.attributes[i][1],array=(a.isInterleavedBufferAttribute?a.data:a).array,bytes=new Uint8Array(array.buffer,array.byteOffset,array.byteLength),expected=resource.attributes[i].bytes;
   if(bytes.length!==expected.length||!bytes.every((value,j)=>value===expected[j]))return false;
  }
  return JSON.stringify(materialReceipt(args[3]))===JSON.stringify(receipt.material)&&object.layers?.mask===receipt.layers&&object.visible===receipt.visible&&object.frustumCulled===receipt.frustumCulled;
 }
 function inventory(scene){
  const result={scene:identity(scene),scannedNodes:0,overflow:false,requiredNames:[],actualRequiredNames:[],nodes:[],
   note:'Copied actual pool inventory. Visibility is not a frustum, occlusion or pixel-visibility claim.'};
  const found=new Set(),seen=new Set(),stack=[{node:scene,parent:null,worldVisible:true}];
  while(stack.length){
   const item=stack.pop(),node=item.node;
   if(seen.has(node)||++result.scannedNodes>maxInventoryNodes){result.overflow=true;break;}seen.add(node);
   const name=label(node),visible=own(node,'visible')!==false,worldVisible=item.worldVisible&&visible;
   if(requiredNames.includes(name)){
    if(found.has(name)||result.nodes.length>=maxPoolNodes){result.overflow=true;break;}
    found.add(name);result.actualRequiredNames.push({required:name,actual:name,id:id(node)});
    result.nodes.push({...identity(node),parentId:id(item.parent),parentName:label(item.parent),visible,worldVisible,
     layers:number(own(own(node,'layers'),'mask')),mesh:own(node,'isMesh')===true,instanced:own(node,'isInstancedMesh')===true,
     count:number(node.count),geometryId:id(node.geometry),geometryUuid:label(node.geometry,'uuid'),
     materialIds:(Array.isArray(node.material)?node.material:[node.material]).map(id),matrixWorld:matrix(node.matrixWorld)});
   }
   const children=own(node,'children');if(Array.isArray(children)){
    if(children.length+stack.length+result.scannedNodes>maxInventoryNodes){result.overflow=true;break;}
    for(let i=children.length-1;i>=0;i--)stack.push({node:children[i],parent:node,worldVisible});
   }
  }
  result.requiredNames=requiredNames.filter(name=>found.has(name));return result;
 }
 function selectScene(scene){
  if(scene===island)return true;
  if(own(scene,'isScene')!==true)return false;
  const scan=inventory(scene);
  if(scan.overflow){error('scene inventory','Scene inspection exceeded its bounds or found a cycle');return false;}
  if(scan.requiredNames.length!==requiredNames.length)return false;
  if(island&&island!==scene){error('scene selection','More than one Scene contains all six original rock pool names');return false;}
  island=scene;return true;
 }
 function wrap(target,key,factory,flag){
  try{
   const original=target[key];if(typeof original!=='function')throw Error('Native renderer method unavailable');
   const descriptor=Object.getOwnPropertyDescriptor(target,key);if(descriptor&&!('value'in descriptor))throw Error('Accessor renderer methods are unsupported');
   const wrapped=factory(original);
   Object.defineProperty(target,key,descriptor?{...descriptor,value:wrapped}:{value:wrapped,writable:true,configurable:true});
   if(target[key]!==wrapped)throw Error('Renderer wrapper was not installed');coverage[flag]=true;
  }catch(e){error('install '+key,e);}
 }
 function observeRenderer(value){
  if(renderer||value?.domElement!==root.document?.getElementById('game')||typeof value?.render!=='function'||typeof value?.renderBufferDirect!=='function'||typeof value?.getRenderTarget!=='function'||!value.info?.render)return;
  renderer=value;coverage.renderer=true;
  wrap(renderer,'render',original=>function(...args){
   // The geometry/ownership receipts are intentionally outside CPU sampling.
   // During its one fixed timing window, forward without clocks, geometry
   // reads, camera copies or inventory work. Original exceptions still escape.
   if(timingWindow?.active){
    timingWindow.renderInvocations++;if(this!==renderer)timingWindow.wrongReceivers++;
    try{return Reflect.apply(original,this,args);}catch(e){timingWindow.renderThrows++;throw e;}
   }
   let scope;const parent=scopes.at(-1)?.scope;
   if(parent)issue(parent,'nested-render');
   try{
    const target=renderer.getRenderTarget();
    if(target!==null)ignoredOffscreenRenders++;
    else if(selectScene(args[0])){
     const record={sequence:++sequence,valid:false,startedAtMs:now(),finishedAtMs:null,scene:identity(args[0]),camera:null,postCamera:null,
      rendererFrameBefore:renderer.info.render.frame,rendererFrameAfter:null,canvas:{id:'game',width:renderer.domElement.width,height:renderer.domElement.height},
      rockDraws:[],colorDirectInvocations:0,shadowDirectInvocations:0,otherDirectInvocations:0,colorSubmitted:zero(),shadowSubmitted:zero(),otherSubmitted:zero(),
      counters:zero(),nativeEndTotals:null,issues:[],threw:false};
     scope={record,scene:args[0],camera:args[1],directDepth:0,publicRender:renderer.render,publicDirect:renderer.renderBufferDirect};
     if(this!==renderer)issue(scope,'different-renderer-receiver');
     if(renderer.xr?.isPresenting)issue(scope,'xr-camera');
     if(args[1]?.isArrayCamera)issue(scope,'array-camera');
     if(args[1]?.isCamera!==true)issue(scope,'missing-input-camera');
     if(renderer.info.autoReset!==true)issue(scope,'native-counter-auto-reset-disabled');
     if(parent)issue(scope,'nested-island-render');
    }else ignoredOtherSceneRenders++;
   }catch(e){error('begin render observation',e);}
   scopes.push({scope});
   try{return Reflect.apply(original,this,args);}
   catch(e){if(scope){scope.record.threw=true;issue(scope,'original-render-threw');}throw e;}
   finally{
    scopes.pop();
    if(scope){const row=scope.record;try{
     row.finishedAtMs=now();row.rendererFrameAfter=renderer.info.render.frame;row.nativeEndTotals=counts();
     if(row.colorDirectInvocations===0||row.colorSubmitted.calls===0)issue(scope,'missing-color-draw-coverage');
     if(!validCounts(row.counters)||!validCounts(row.nativeEndTotals)||!equalCounts(row.counters,row.nativeEndTotals))issue(scope,'partial-native-draw-coverage');
     if(row.rendererFrameAfter!==row.rendererFrameBefore+1)issue(scope,'unexpected-native-render-count');
     if(renderer.getRenderTarget()!==null)issue(scope,'changed-post-render-target');
     row.postCamera=cameraReceipt(scope.camera);
     if(!row.camera||!sameCamera(row.camera,row.postCamera))issue(scope,'changed-post-render-camera');
     if(renderer.render!==scope.publicRender||renderer.renderBufferDirect!==scope.publicDirect)issue(scope,'changed-render-hooks-during-pass');
    }catch(e){issue(scope,'finish-observation-error');error('finish render observation',e);}
    finally{
     row.valid=row.issues.length===0&&!row.threw;
     row.observationPhase=captureWindow?'capture':'preparation';
     if(!row.valid){
      invalidPasses++;
      // Keep the first failed receipts even after thousands of later valid
      // frames evict them from the short settling history. Never clear these.
      if(firstInvalidPasses.length<8)firstInvalidPasses.push(row);
      if(captureWindow&&firstCaptureInvalidPasses.length<8)firstCaptureInvalidPasses.push(row);
     }
     if(row.valid){attestedRender=scope.publicRender;attestedDirect=scope.publicDirect;}
     latest=row;history.push(row);if(history.length>historyLimit)history.shift();
    }}
   }
  },'render');
  wrap(renderer,'renderBufferDirect',original=>function(...args){
   if(timingWindow?.active){
    timingWindow.directInvocations++;if(this!==renderer)timingWindow.wrongReceivers++;
    try{return Reflect.apply(original,this,args);}catch(e){timingWindow.directThrows++;throw e;}
   }
   const scope=scopes.at(-1)?.scope;
   if(!scope)return Reflect.apply(original,this,args);
   let before,kind='other',rockReceipt,rockState;scope.directDepth++;
   try{
    if(scope.directDepth!==1)issue(scope,'nested-direct-invocation');
    if(this!==renderer)issue(scope,'different-direct-receiver');
    const target=renderer.getRenderTarget(),camera=args[0],scene=args[1],material=args[3];
    const depth=material?.isMeshDepthMaterial===true||material?.isMeshDistanceMaterial===true;
    // Three r185 intentionally passes a null Scene to its shadow submissions.
    if(target!==null&&depth&&scene===null&&camera!==scope.camera)kind='shadow';
    else if(target===null&&!depth&&scene===scope.scene&&camera===scope.camera){
     kind='color';
     if(!scope.record.camera)scope.record.camera=cameraReceipt(camera);
     else if(!sameInputCamera(scope.record.camera,camera))issue(scope,'changed-color-draw-camera');
     if(renderer.xr?.isPresenting||camera.isArrayCamera)issue(scope,'unsupported-color-camera');
    }else issue(scope,target!==null?'unexpected-direct-target':'unexpected-direct-camera-or-scene');
    scope.record[kind+'DirectInvocations']++;
    if(kind==='color'&&requiredNames.includes(label(args[4]))){rockReceipt=rockDraw(args);rockState=nativeRockState(args);}
    before=counts();
   }catch(e){issue(scope,'direct-observation-error');error('begin direct observation',e);}
   try{return Reflect.apply(original,this,args);}
   catch(e){issue(scope,'original-direct-threw');throw e;}
   finally{
    try{if(before){const after=counts(),delta=Object.fromEntries(Object.keys(before).map(key=>[key,after[key]-before[key]]));
     if(!validCounts(delta))issue(scope,'native-counters-reset-during-direct');
     else{add(scope.record.counters,delta);add(scope.record[kind+'Submitted'],delta);
      if(rockReceipt){if(delta.calls>0){rockReceipt.submitted=delta;scope.record.rockDraws.push(rockReceipt);}
       if(!unchangedRock(args,rockReceipt,rockState))issue(scope,'rock-owner-changed-during-native-draw');}
     }
    }}catch(e){issue(scope,'direct-counter-observation-error');error('finish direct observation',e);}
    scope.directDepth--;
   }
  },'direct');
 }
 function state(){
  const fresh=!!latest&&!!renderer&&renderer.info.render.frame===latest.rendererFrameAfter;
  // The application installs legitimate forwarding wrappers after construction.
  // Attest their public identities only through a completely conserved native
  // island pass; any later replacement is unproven until another full pass.
  const currentRenderHook=!!attestedRender&&renderer?.render===attestedRender,currentDirectHook=!!attestedDirect&&renderer?.renderBufferDirect===attestedDirect;
  const currentPassReady=!timingWindow?.active&&Object.values(coverage).every(Boolean)&&currentRenderHook&&currentDirectHook&&!!latest?.valid&&fresh&&errors.length===0;
  const captureInvalidPasses=captureWindow?invalidPasses-captureWindow.preparationInvalidPasses:null;
  return{ready:currentPassReady&&(captureWindow?latest.sequence>captureWindow.afterSequence&&captureInvalidPasses===0:invalidPasses===0),
   canArm:!captureWindow&&currentPassReady&&scopes.length===0,captureWindow:captureWindow?copy(captureWindow):null,captureInvalidPasses,
   fresh,frame:sequence,timingWindow:timingWindow?copy(timingWindow):null,coverage:{...coverage,currentRenderHook,currentDirectHook},errors:copy(errors),invalidPasses,ignoredOffscreenRenders,ignoredOtherSceneRenders,
   limits:{historyLimit,maxInventoryNodes,maxPoolNodes,invalidHistoryLimit:8},scope:'Read-only camera/submission comparison receipts. A completed renderer call is not a GPU fence or presentation proof; the native screenshot workflow supplies that separate evidence.'};
 }
 function arm(){
  if(captureWindow)throw Error('The comparison capture window is one-shot and cannot be reset');
  if(!state().canArm)throw Error('A current complete native island pass with intact hooks is required before arming');
  captureWindow=Object.freeze({kind:'one-shot-native-pass-boundary',atMs:now(),afterSequence:sequence,
   afterRendererFrame:renderer.info.render.frame,preparationInvalidPasses:invalidPasses});
  return copy(captureWindow);
 }
 function snapshot(){
  let scan=null;
  try{if(island){scan=inventory(island);if(scan.overflow||scan.requiredNames.length!==requiredNames.length)error('snapshot inventory','The complete original rock pool inventory is unavailable');}}
  catch(e){error('snapshot inventory',e);}
  return copy({...state(),latest,history,firstInvalidPasses,firstCaptureInvalidPasses,inventory:scan});
 }
 function pauseReceipts(){
  if(timingWindow)throw Error('The timing window is one-shot and cannot be reset');
  if(!captureWindow||!state().ready||scopes.length)throw Error('A complete armed native proof pass is required before timing');
  timingWindow={active:true,startedAtMs:now(),finishedAtMs:null,afterSequence:sequence,
   firstRendererFrame:renderer.info.render.frame,lastRendererFrame:null,
   renderInvocations:0,directInvocations:0,wrongReceivers:0,renderThrows:0,directThrows:0,
   scope:'Receipt copies are paused; only forwarding invocation/exception counters remain. This is not GPU timing.'};
  return copy(timingWindow);
 }
 function resumeReceipts(){
  if(!timingWindow?.active||scopes.length)throw Error('No active timing window to finish');
  timingWindow.active=false;timingWindow.finishedAtMs=now();timingWindow.lastRendererFrame=renderer.info.render.frame;
  return copy(timingWindow);
 }
 Object.defineProperty(root,'__polyhavenComparisonObserver',{value:Object.freeze({ready:()=>state().ready,canArm:()=>state().canArm,arm,frame:()=>sequence,snapshot,resources:()=>copy(resourceRows),pauseReceipts,resumeReceipts}),configurable:false});
 const existing=root.__THREE_DEVTOOLS__;
 if(existing!==undefined&&typeof existing.addEventListener!=='function'){error('devtools hook','An incompatible existing hook was retained');return;}
 const events=existing??new EventTarget();if(existing===undefined)root.__THREE_DEVTOOLS__=events;
 events.addEventListener('observe',event=>{try{observeRenderer(event.detail);}catch(e){error('observe renderer',e);}});
}
