/** Passive attribution only. No rendering, input, context creation/restoration,
 * preventDefault, retry, or acceptance predicate is supplied by this module. */
export function installExteriorRendererLifecycle(options={}){
 const root=globalThis;if(root.__exteriorRendererLifecycle)return;
 const limit=options.limit??512,maxCanvases=options.maxCanvases??32,maxRenderers=options.maxRenderers??16;
 const events=[],errors=[],canvases=[],renderers=[],canvasIds=new WeakMap(),contextIds=new WeakMap(),seenEvents=new WeakSet();
 let sequence=0,droppedEvents=0,droppedCanvases=0,droppedRenderers=0,nextContext=0;
 const now=()=>performance.now();
 const error=(where,value)=>{if(errors.length<32)errors.push({where,message:String(value),atMs:now()});};
 const attempt=(where,fn)=>{try{return fn();}catch(value){error(where,value);return null;}};
 const phase=()=>root.__stagedWalkNativeEvidence?.phase??null;
 const record=(kind,detail={})=>{const row={sequence:++sequence,kind,atMs:now(),phase:phase(),...detail};if(events.length<limit)events.push(row);else droppedEvents++;};
 const canvasState=canvas=>canvas?{identity:canvasIds.get(canvas)??null,id:canvas.id??null,tagName:canvas.tagName??null,
  connected:canvas.isConnected===true,width:canvas.width??null,height:canvas.height??null,
  selectedByGameId:root.document?.getElementById('game')===canvas}:null;
 const contextIdentity=gl=>{if(!gl||(typeof gl!=='object'&&typeof gl!=='function'))return null;if(!contextIds.has(gl))contextIds.set(gl,++nextContext);return contextIds.get(gl);};
 const contextState=gl=>gl?{identity:contextIdentity(gl),isContextLost:attempt('context state',()=>gl.isContextLost()),
  attributes:attempt('context attributes',()=>gl.getContextAttributes())}:null;
 function track(canvas){
  if(!canvas||canvas.tagName!=='CANVAS'||canvasIds.has(canvas))return;
  if(canvases.length>=maxCanvases){droppedCanvases++;return;}
  canvasIds.set(canvas,canvases.length+1);canvases.push(canvas);
  for(const type of ['webglcontextlost','webglcontextrestored','webglcontextcreationerror'])
   canvas.addEventListener(type,contextEvent,{passive:true});
 }
 function contextEvent(event){attempt('context event',()=>{
  if(!event?.target||event.target.tagName!=='CANVAS'||seenEvents.has(event))return;
  seenEvents.add(event);track(event.target);
  record(event.type,{trusted:event.isTrusted===true,statusMessage:event.statusMessage??null,
   defaultPreventedAtObserver:event.defaultPrevented===true,canvas:canvasState(event.target),
   rendererContexts:renderers.filter(row=>row.canvas===event.target).map(row=>({renderer:row.identity,context:contextState(row.gl)}))});
 });}
 function scan(node,kind){
  if(node?.tagName==='CANVAS'){track(node);record(kind,{canvas:canvasState(node)});}
  for(const canvas of node?.querySelectorAll?.('canvas')??[]){track(canvas);record(kind,{canvas:canvasState(canvas)});}
 }
 function observeRenderer(event){attempt('renderer observation',()=>{
  const renderer=event.detail,canvas=renderer?.domElement;
  if(canvas?.tagName!=='CANVAS'||typeof renderer.getContext!=='function'||renderers.some(row=>row.renderer===renderer))return;
  if(renderers.length>=maxRenderers){droppedRenderers++;return;}
  track(canvas);
  // Three's getContext returns its already-owned context. Never call a canvas
  // getContext here, including when the selected DOM element is missing/replaced.
  const gl=renderer.getContext(),row={identity:renderers.length+1,renderer,canvas,gl};renderers.push(row);
  record('renderer-observed',{renderer:row.identity,canvas:canvasState(canvas),context:contextState(gl)});
 });}
 const api={
  captureGuard(canvas,gl,predicates){attempt('capture guard observation',()=>{
   track(canvas);record('capture-guard',{canvas:canvasState(canvas),context:gl?{identity:contextIdentity(gl),isContextLost:predicates.contextLost}:null,
    predicates:{...predicates},rendererMatches:renderers.map(row=>({renderer:row.identity,canvas:row.canvas===canvas,context:row.gl===gl}))});
  });},
  snapshot(){return structuredClone({version:1,events,errors,limits:{events:limit,canvases:maxCanvases,renderers:maxRenderers},
   counts:{events:sequence,droppedEvents,droppedCanvases,droppedRenderers},
   current:{atMs:now(),phase:phase(),url:root.location?.href??null,visible:root.document?.visibilityState??null,
    focused:attempt('focus state',()=>root.document.hasFocus()),selectedCanvas:canvasState(root.document?.getElementById('game')),
    canvases:canvases.map(canvasState),renderers:renderers.map(row=>({identity:row.identity,canvas:canvasState(row.canvas),context:contextState(row.gl)}))},
   scope:'Passive canvas/context lifecycle and existing capture-guard predicates; no frame, GPU-completion, recovery, or acceptance claim.'});}
 };
 Object.defineProperty(root,'__exteriorRendererLifecycle',{value:Object.freeze(api),configurable:false});
 if(!Number.isSafeInteger(limit)||limit<1||limit>8192||!Number.isSafeInteger(maxCanvases)||maxCanvases<1||maxCanvases>128||!Number.isSafeInteger(maxRenderers)||maxRenderers<1||maxRenderers>64){error('configuration','Invalid bounded lifecycle limits');return;}
 attempt('context listeners',()=>{for(const type of ['webglcontextlost','webglcontextrestored','webglcontextcreationerror'])root.document.addEventListener(type,contextEvent,{capture:true,passive:true});});
 attempt('canvas lifecycle',()=>{
  scan(root.document,'canvas-existing');
  const observer=new MutationObserver(records=>attempt('canvas mutations',()=>{for(const row of records){for(const node of row.addedNodes)scan(node,'canvas-added');for(const node of row.removedNodes)scan(node,'canvas-removed');}}));
  observer.observe(root.document,{childList:true,subtree:true});
 });
 attempt('renderer hook',()=>{
  const existing=root.__THREE_DEVTOOLS__;
  if(existing!==undefined&&typeof existing.addEventListener!=='function')throw Error('Incompatible existing Three observation hook retained');
  const hook=existing??new EventTarget();if(existing===undefined)root.__THREE_DEVTOOLS__=hook;
  hook.addEventListener('observe',observeRenderer);
 });
 for(const type of ['focus','blur','pageshow','pagehide'])attempt('window '+type,()=>root.addEventListener(type,event=>attempt(type,()=>record(type,{persisted:event.persisted??null,visible:root.document.visibilityState,focused:root.document.hasFocus()})),{passive:true}));
 attempt('visibility listener',()=>root.document.addEventListener('visibilitychange',()=>attempt('visibilitychange',()=>record('visibilitychange',{visible:root.document.visibilityState,focused:root.document.hasFocus()})),{passive:true}));
 record('installed',{url:root.location?.href??null});
}

/** Node-side signals remain available when a crash prevents page evaluation.
 * Existing error/failure listeners continue to own the original verdict. */
export function observeExteriorPageSignals(page,now=Date.now){
 const report={version:1,events:[],limit:4096,totalEvents:0,droppedEvents:0,observerErrors:[],cleanupStartedAtMs:null};
 const record=(kind,detail={})=>{report.totalEvents++;if(report.events.length>=report.limit){report.droppedEvents++;return;}
  report.events.push({sequence:report.totalEvents,kind,atEpochMs:now(),cleanupStarted:report.cleanupStartedAtMs!==null,...detail});};
 const safe=(where,fn)=>{try{fn();}catch(error){if(report.observerErrors.length<32)report.observerErrors.push({where,error:String(error),atEpochMs:now()});}};
 page.on('console',message=>safe('console',()=>{const type=message.type();if(['log','warning','warn','error'].includes(type))record('console',{type,text:message.text(),location:message.location()});}));
 page.on('pageerror',error=>safe('pageerror',()=>record('pageerror',{name:error.name,message:error.message,stack:error.stack??null})));
 for(const kind of ['crash','close','domcontentloaded','load'])page.on(kind,()=>safe(kind,()=>record(kind)));
 page.on('framenavigated',frame=>safe('navigation',()=>{if(frame===page.mainFrame())record('main-frame-navigation',{url:frame.url()});}));
 page.context().browser()?.on('disconnected',()=>safe('browser disconnected',()=>record('browser-disconnected')));
 return report;
}
