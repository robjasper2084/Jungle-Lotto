/** Browser-only diagnostic instrumentation. Install before the unchanged app.
 * Existing native calls retain their receiver, arguments, order and result.
 * No scene/camera setter, extra render, extra fence or blocking wait is used. */
export function installCadillacSoftwareGpuObserver(options={}){
 const root=globalThis,framesWanted=options.frames??3,maxObjects=options.maxObjects??2048,maxCalls=options.maxCalls??6000;
 if(framesWanted!==3||!Number.isSafeInteger(maxObjects)||maxObjects<1||maxObjects>4096||!Number.isSafeInteger(maxCalls)||maxCalls<1||maxCalls>12000)throw Error('Invalid bounded GPU diagnostic configuration');
 if(root.__cadillacSoftwareGpu)throw Error('Software GPU observer already installed');
 const now=()=>performance.now(),copy=value=>JSON.parse(JSON.stringify(value));
 const data={version:1,scope:'DIAGNOSTIC ONLY. Native renderer submission counters and optional asynchronous GL elapsed queries; not controls acceptance, hardware FPS or physical GPU certification.',
  limits:{frames:framesWanted,maxObjects,maxCalls},armed:false,frames:[],completedFrames:0,overflow:false,errors:[],
  coverage:{renderer:false,render:false,direct:false,fenceSync:false,clientWaitSync:false,deleteSync:false},
  timer:{requested:options.timers!==false,status:'unavailable',reason:'Renderer not observed',queries:0,resolved:0,disjoint:false},
  nativeRenderer:null,nestedRenders:0,nestedDirectCalls:0,recordedCalls:0};
 let renderer,gl,timerExtension,activeFrame,renderDepth=0,directDepth=0,everArmed=false;
 const awaitingFence=[],fenceFrames=new Map(),queries=[];
 const error=(where,value)=>{if(data.errors.length<32)data.errors.push({where,message:String(value)});};
 const own=(value,key)=>{try{const property=value&&Object.getOwnPropertyDescriptor(value,key);return property&&'value'in property?property.value:undefined;}catch{return undefined;}};
 const id=value=>Number.isSafeInteger(own(value,'id'))?own(value,'id'):null;
 const label=(value,key='name')=>typeof own(value,key)==='string'?own(value,key).slice(0,96):'';
 const counters=()=>{const info=renderer.info.render;return{calls:info.calls,triangles:info.triangles,lines:info.lines,points:info.points};};
 const zero=()=>({calls:0,triangles:0,lines:0,points:0});
 const sum=(target,delta)=>{for(const key of Object.keys(target))target[key]+=delta[key];};
 const delta=(before,after)=>Object.fromEntries(Object.keys(before).map(key=>[key,after[key]-before[key]]));
 const valid=value=>Object.values(value).every(number=>Number.isFinite(number)&&number>=0);
 const cameraReceipt=camera=>({id:id(camera),type:label(camera,'type'),name:label(camera),
  matrixWorld:camera?.matrixWorld?.elements?Array.from(camera.matrixWorld.elements):null,
  projectionMatrix:camera?.projectionMatrix?.elements?Array.from(camera.projectionMatrix.elements):null});
 function wrap(target,key,factory,coverage){
  try{
   const original=target?.[key];if(typeof original!=='function')throw Error('Method unavailable');
   const descriptor=Object.getOwnPropertyDescriptor(target,key);
   if(descriptor&&!('value'in descriptor))throw Error('Accessor method is unsupported');
   const wrapped=factory(original);
   if(descriptor)Object.defineProperty(target,key,{...descriptor,value:wrapped});
   else Object.defineProperty(target,key,{value:wrapped,writable:true,configurable:true});
   if(target[key]!==wrapped)throw Error('Wrapper was not installed');
   data.coverage[coverage]=true;
  }catch(e){error('install '+key,e);}
 }
 function metadata(object,geometry,material,camera){
  const parents=[];let parent=own(object,'parent');
  for(let count=0;parent&&count<8;count++,parent=own(parent,'parent'))parents.push({id:id(parent),name:label(parent),type:label(parent,'type')});
  return{objectId:id(object),object:label(object),objectType:label(object,'type'),parents,
   sourceGeometryId:id(own(object,'geometry')),submittedGeometryId:id(geometry),materialId:id(material),material:label(material),materialType:label(material,'type'),
   cameraId:id(camera),cameraType:label(camera,'type'),shadow:own(material,'isMeshDepthMaterial')===true||own(material,'isMeshDistanceMaterial')===true,
   instanced:own(object,'isInstancedMesh')===true,batched:own(object,'isBatchedMesh')===true,skinned:own(object,'isSkinnedMesh')===true};
 }
 function rowFor(frame,args){
  const [, ,geometry,material,object]=args,camera=args[0],meta=metadata(object,geometry,material,camera);
  const key=[meta.objectId,meta.submittedGeometryId,meta.materialId,meta.cameraId,meta.shadow].join(':');
  let row=frame.rows.get(key);
  if(!row){
   if(frame.rows.size>=maxObjects){data.overflow=true;return;}
   row={...meta,invocations:0,submitted:zero(),cpuMs:0,gpu:{status:timerExtension?'pending':'unavailable',queries:0,resolved:0,nanoseconds:null}};
   frame.rows.set(key,row);frame.public.objects.push(row);
  }
  return row;
 }
 function beginTimer(frame,row){
  if(!timerExtension||!row||directDepth>1)return;
  try{
   if(gl.getQuery(timerExtension.TIME_ELAPSED_EXT,gl.CURRENT_QUERY)!==null){error('GPU timer','Another elapsed query is active; no nested query was started');row.gpu.status='unavailable';return;}
   const query=gl.createQuery();if(!query)throw Error('Query allocation unavailable');
   try{gl.beginQuery(timerExtension.TIME_ELAPSED_EXT,query);}catch(e){gl.deleteQuery(query);throw e;}
   const record={query,frame:frame.public,row,done:false};queries.push(record);data.timer.queries++;row.gpu.queries++;return record;
  }catch(e){error('begin GPU timer',e);row.gpu.status='unavailable';}
 }
 function observeRenderer(value){
  if(renderer||typeof value?.renderBufferDirect!=='function'||typeof value?.render!=='function'||typeof value?.getContext!=='function'||!value.info?.render)return;
  renderer=value;gl=value.getContext();data.coverage.renderer=true;
  try{const debug=gl.getExtension('WEBGL_debug_renderer_info');data.nativeRenderer=String(gl.getParameter(debug?.UNMASKED_RENDERER_WEBGL??gl.RENDERER));}catch(e){error('renderer identity',e);}
  if(options.timers!==false){
   try{
    timerExtension=gl.getExtension('EXT_disjoint_timer_query_webgl2');
    if(timerExtension&&['createQuery','beginQuery','endQuery','getQuery','getQueryParameter','deleteQuery'].every(key=>typeof gl[key]==='function'))data.timer={...data.timer,status:'available',reason:null};
    else{timerExtension=null;data.timer.reason='EXT_disjoint_timer_query_webgl2 is unavailable';}
   }catch(e){timerExtension=null;data.timer.reason=String(e);}
  }else data.timer.reason='Not requested';
  wrap(renderer,'render',(original)=>function(...args){
   const nested=renderDepth++>0;let frame;
   if(data.armed&&data.frames.length<framesWanted&&!nested){
    try{
     if(renderer.domElement!==root.document?.getElementById('game'))throw Error('Observed renderer is not the original game canvas');
     if(renderer.getRenderTarget()!==null)throw Error('Requested capture encountered an offscreen outer render');
     if(own(args[0],'isScene')!==true)throw Error('Requested capture is not the original world scene');
     const record={sequence:data.frames.length+1,startedAtMs:now(),submittedAtMs:null,rendererFrameBefore:renderer.info.render.frame,rendererFrameAfter:null,
      camera:cameraReceipt(args[1]),objects:[],observedTotals:zero(),observedColorTotals:zero(),observedShadowTotals:zero(),nativeEndTotals:null,
      completion:{status:'awaiting-native-fence',fenceObservedAtMs:null,completedAtMs:null,polls:0},threw:false};
     frame={public:record,rows:new Map()};data.frames.push(record);activeFrame=frame;
    }catch(e){error('begin frame',e);}
   }else if(activeFrame&&nested){data.nestedRenders++;error('render scope','Nested renderer.render is unsupported by this diagnostic');}
   try{return Reflect.apply(original,this,args);}
   catch(e){if(frame)frame.public.threw=true;throw e;}
   finally{
    if(frame){
     try{frame.public.submittedAtMs=now();frame.public.rendererFrameAfter=renderer.info.render.frame;frame.public.nativeEndTotals=counters();awaitingFence.push(frame.public);}
     catch(e){error('end frame',e);}
     activeFrame=undefined;
    }
    renderDepth--;
   }
  },'render');
  wrap(renderer,'renderBufferDirect',(original)=>function(...args){
   const frame=activeFrame;
   if(!frame)return Reflect.apply(original,this,args);
   let before,row,started,timer;directDepth++;
   if(directDepth>1){data.nestedDirectCalls++;error('direct scope','Nested renderBufferDirect is unsupported');}
   try{
    data.recordedCalls++;
    if(data.recordedCalls>maxCalls)data.overflow=true;
    else row=rowFor(frame,args);
    before=counters();started=now();if(row)row.invocations++;
    timer=beginTimer(frame,row);
   }catch(e){error('before direct draw',e);}
   try{return Reflect.apply(original,this,args);}
   finally{
    if(timer)try{gl.endQuery(timerExtension.TIME_ELAPSED_EXT);}catch(e){error('end GPU timer',e);timer.row.gpu.status='unavailable';}
    try{
     if(before){const observed=delta(before,counters());
      if(!valid(observed))throw Error('Native submission counters reset within a direct invocation');
      sum(frame.public.observedTotals,observed);sum(own(args[3],'isMeshDepthMaterial')===true||own(args[3],'isMeshDistanceMaterial')===true?frame.public.observedShadowTotals:frame.public.observedColorTotals,observed);
      if(row){sum(row.submitted,observed);row.cpuMs+=now()-started;}
     }
    }catch(e){error('after direct draw',e);}
    directDepth--;
   }
  },'direct');
  // Observe only the application's existing fence protocol. No sync is added,
  // flushed, waited on, deleted or otherwise taken over by this diagnostic.
  wrap(gl,'fenceSync',(original)=>function(...args){
   const result=Reflect.apply(original,this,args);
   if(result&&awaitingFence.length&&args[0]===gl.SYNC_GPU_COMMANDS_COMPLETE&&args[1]===0){
    try{const frames=awaitingFence.splice(0);for(const frame of frames){frame.completion.status='pending';frame.completion.fenceObservedAtMs=now();}fenceFrames.set(result,frames);}catch(e){error('observe native fence',e);}
   }
   return result;
  },'fenceSync');
  wrap(gl,'clientWaitSync',(original)=>function(...args){
   const result=Reflect.apply(original,this,args),frames=fenceFrames.get(args[0]);
   if(frames)try{
    for(const frame of frames)frame.completion.polls++;
    if(result===gl.ALREADY_SIGNALED||result===gl.CONDITION_SATISFIED){
     for(const frame of frames){frame.completion.status='complete';frame.completion.completedAtMs=now();data.completedFrames++;}
     fenceFrames.delete(args[0]);
    }else if(result===gl.WAIT_FAILED){for(const frame of frames)frame.completion.status='failed';fenceFrames.delete(args[0]);error('native completion','The original clientWaitSync reported WAIT_FAILED');}
   }catch(e){error('observe native completion',e);}
   return result;
  },'clientWaitSync');
  wrap(gl,'deleteSync',(original)=>function(...args){
   const result=Reflect.apply(original,this,args),frames=fenceFrames.get(args[0]);
   if(frames){for(const frame of frames)frame.completion.status='deleted-before-observed-completion';fenceFrames.delete(args[0]);error('native completion','The original fence was deleted before an observed completion');}
   return result;
  },'deleteSync');
 }
 function poll(){
  if(!timerExtension||data.completedFrames!==framesWanted)return read();
  try{
   if(gl.getParameter(timerExtension.GPU_DISJOINT_EXT))data.timer.disjoint=true;
   for(const item of queries){
    if(item.done)continue;
    if(!data.timer.disjoint&&!gl.getQueryParameter(item.query,gl.QUERY_RESULT_AVAILABLE))continue;
    if(data.timer.disjoint){item.row.gpu.status='disjoint';item.row.gpu.nanoseconds=null;}
    else{
     const elapsed=gl.getQueryParameter(item.query,gl.QUERY_RESULT);
     if(!Number.isFinite(elapsed)||elapsed<0)throw Error('Invalid asynchronous GPU elapsed result');
     item.row.gpu.nanoseconds=(item.row.gpu.nanoseconds??0)+elapsed;
    }
    item.done=true;item.row.gpu.resolved++;data.timer.resolved++;gl.deleteQuery(item.query);
   }
   for(const frame of data.frames)for(const row of frame.objects){
    if(data.timer.disjoint){row.gpu.status='disjoint';row.gpu.nanoseconds=null;}
    else if(row.gpu.status==='pending'&&row.gpu.queries>0&&row.gpu.resolved===row.gpu.queries)row.gpu.status='available';
   }
   if(data.timer.disjoint)data.timer.status='disjoint';
  }catch(e){error('read GPU elapsed result',e);data.timer.status='failed';}
  return read();
 }
 function read(){return copy({...data,ready:Object.values(data.coverage).every(Boolean),pendingQueries:queries.length-data.timer.resolved});}
 function arm(){
  if(everArmed)throw Error('This diagnostic capture is single use');
  if(!Object.values(data.coverage).every(Boolean))throw Error('Native renderer/fence observation coverage is incomplete');
  if(!/SwiftShader/i.test(data.nativeRenderer??''))throw Error('This sample requires the original SwiftShader renderer');
  if(renderer.domElement!==root.document?.getElementById('game'))throw Error('The original game canvas was not observed');
  everArmed=true;data.armed=true;data.armedAtMs=now();return read();
 }
 Object.defineProperty(root,'__cadillacSoftwareGpu',{value:Object.freeze({arm,read,poll}),configurable:false});
 const existing=root.__THREE_DEVTOOLS__;
 if(existing!==undefined&&typeof existing.addEventListener!=='function'){error('devtools hook','An incompatible pre-existing devtools hook was retained');return;}
 const events=existing??new EventTarget();if(existing===undefined)root.__THREE_DEVTOOLS__=events;
 events.addEventListener('observe',event=>{try{observeRenderer(event.detail);}catch(e){error('observe renderer',e);}});
}
