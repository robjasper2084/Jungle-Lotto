/** Install before the unchanged application. This observer forwards existing
 * renderer methods and exposes copied receipts only; it never renders a scene,
 * changes a camera/material, updates a matrix, or supplies application input. */
export function installLandmarkComparisonObserver(options={}){
 const root=globalThis,historyLimit=options.historyLimit??8,maxInventoryNodes=options.maxInventoryNodes??20000,maxLandmarkNodes=options.maxLandmarkNodes??2048;
 if(!Number.isSafeInteger(historyLimit)||historyLimit<1||historyLimit>32||!Number.isSafeInteger(maxInventoryNodes)||maxInventoryNodes<2||maxInventoryNodes>100000||!Number.isSafeInteger(maxLandmarkNodes)||maxLandmarkNodes<2||maxLandmarkNodes>8192)throw Error('Invalid bounded landmark comparison observer configuration');
 if(root.__landmarkComparisonObserver)throw Error('Landmark comparison observer already installed');
 const requiredNames=['107227742_Aquarium illuminated habitat','107310050_Conservatory concrete paving'];
 const coverage={renderer:false,render:false,direct:false},errors=[],history=[],scopes=[];
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
 function inventory(scene){
  const result={scene:identity(scene),scannedNodes:0,overflow:false,requiredNames:[],actualRequiredNames:[],nodes:[],
   note:'Copied scene inventory at read time. Visibility includes ancestor visibility; it is not a frustum, occlusion, or submitted-triangle claim. triangleCount is the current geometry record count divided by three.'};
  const found=new Set(),seen=new Set(),stack=[{node:scene,parent:null,worldVisible:true,landmark:null}];
  while(stack.length){
   const item=stack.pop(),node=item.node;
   if(seen.has(node)){result.overflow=true;break;}seen.add(node);
   if(++result.scannedNodes>maxInventoryNodes){result.overflow=true;break;}
   const name=label(node),visible=own(node,'visible')!==false,worldVisible=item.worldVisible&&visible;
   // GLTFLoader converts authored spaces to underscores. Only normalize the
   // suffix following one exact site ID; retain the actual loaded name below.
   for(const required of requiredNames){const prefix=required.slice(0,required.indexOf('_')+1);
    if(name.startsWith(prefix)&&name.slice(prefix.length).replaceAll('_',' ')===required.slice(prefix.length)){
     found.add(required);result.actualRequiredNames.push({required,actual:name,id:id(node)});
    }
   }
   const words=name.replaceAll('_',' ');
   const landmark=name.startsWith('107227742_')||/\bAquarium\b/i.test(words)?'aquarium':name.startsWith('107310050_')||/\bConservatory\b/i.test(words)?'conservatory':item.landmark;
   if(landmark){
    if(result.nodes.length>=maxLandmarkNodes){result.overflow=true;break;}
    const geometry=own(node,'geometry'),index=own(geometry,'index'),attributes=own(geometry,'attributes'),position=own(attributes,'position'),material=own(node,'material'),materials=Array.isArray(material)?material:material?[material]:[];
    const local=own(node,'position'),world=own(node,'matrixWorld'),count=number(index?.count,number(position?.count));
    result.nodes.push({...identity(node),parentId:id(item.parent),parentName:label(item.parent),landmark,visible,worldVisible,
     layers:number(own(own(node,'layers'),'mask')),mesh:own(node,'isMesh')===true,geometryId:id(geometry),materialIds:materials.map(id),
     triangleCount:count===null?null:count/3,position:local?[number(local.x),number(local.y),number(local.z)]:null,
     matrixWorld:world?.elements?.length===16?Array.from(world.elements):null});
   }
   const children=own(node,'children');
   if(Array.isArray(children)){
    if(children.length+stack.length+result.scannedNodes>maxInventoryNodes){result.overflow=true;break;}
    for(let i=children.length-1;i>=0;i--)stack.push({node:children[i],parent:node,worldVisible,landmark});
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
  if(island&&island!==scene){error('scene selection','More than one Scene contains both retained landmark names');return false;}
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
   let scope;const parent=scopes.at(-1)?.scope;
   if(parent)issue(parent,'nested-render');
   try{
    const target=renderer.getRenderTarget();
    if(target!==null)ignoredOffscreenRenders++;
    else if(selectScene(args[0])){
     const record={sequence:++sequence,valid:false,startedAtMs:now(),finishedAtMs:null,scene:identity(args[0]),camera:null,postCamera:null,
      rendererFrameBefore:renderer.info.render.frame,rendererFrameAfter:null,canvas:{id:'game',width:renderer.domElement.width,height:renderer.domElement.height},
      colorDirectInvocations:0,shadowDirectInvocations:0,otherDirectInvocations:0,colorSubmitted:zero(),shadowSubmitted:zero(),otherSubmitted:zero(),
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
     row.valid=row.issues.length===0&&!row.threw;if(!row.valid)invalidPasses++;
     if(row.valid){attestedRender=scope.publicRender;attestedDirect=scope.publicDirect;}
     latest=row;history.push(row);if(history.length>historyLimit)history.shift();
    }}
   }
  },'render');
  wrap(renderer,'renderBufferDirect',original=>function(...args){
   const scope=scopes.at(-1)?.scope;
   if(!scope)return Reflect.apply(original,this,args);
   let before,kind='other';scope.directDepth++;
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
    before=counts();
   }catch(e){issue(scope,'direct-observation-error');error('begin direct observation',e);}
   try{return Reflect.apply(original,this,args);}
   catch(e){issue(scope,'original-direct-threw');throw e;}
   finally{
    try{if(before){const after=counts(),delta=Object.fromEntries(Object.keys(before).map(key=>[key,after[key]-before[key]]));
     if(!validCounts(delta))issue(scope,'native-counters-reset-during-direct');
     else{add(scope.record.counters,delta);add(scope.record[kind+'Submitted'],delta);}
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
  return{ready:Object.values(coverage).every(Boolean)&&currentRenderHook&&currentDirectHook&&!!latest?.valid&&fresh&&invalidPasses===0&&errors.length===0,
   fresh,frame:sequence,coverage:{...coverage,currentRenderHook,currentDirectHook},errors:copy(errors),invalidPasses,ignoredOffscreenRenders,ignoredOtherSceneRenders,
   limits:{historyLimit,maxInventoryNodes,maxLandmarkNodes},scope:'Read-only camera/submission comparison receipts. A completed renderer call is not a GPU fence or presentation proof; the native screenshot workflow supplies that separate evidence.'};
 }
 function snapshot(){
  let scan=null;
  try{if(island){scan=inventory(island);if(scan.overflow||scan.requiredNames.length!==requiredNames.length)error('snapshot inventory','The complete retained island inventory is unavailable');}}
  catch(e){error('snapshot inventory',e);}
  return copy({...state(),latest,history,inventory:scan});
 }
 Object.defineProperty(root,'__landmarkComparisonObserver',{value:Object.freeze({ready:()=>state().ready,frame:()=>sequence,snapshot}),configurable:false});
 const existing=root.__THREE_DEVTOOLS__;
 if(existing!==undefined&&typeof existing.addEventListener!=='function'){error('devtools hook','An incompatible existing hook was retained');return;}
 const events=existing??new EventTarget();if(existing===undefined)root.__THREE_DEVTOOLS__=events;
 events.addEventListener('observe',event=>{try{observeRenderer(event.detail);}catch(e){error('observe renderer',e);}});
}
