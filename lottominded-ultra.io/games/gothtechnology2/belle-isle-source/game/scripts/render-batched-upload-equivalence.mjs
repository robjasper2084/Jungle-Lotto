/** Native WebGL correctness fixture only; never gameplay/performance acceptance. */
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {createRequire} from 'node:module';
import {mkdir,readFile,writeFile} from 'node:fs/promises';
import {dirname,resolve} from 'node:path';
import {createServer} from 'vite';
import {transform} from 'esbuild';

const game=resolve(import.meta.dirname,'..'),httpOnly=process.argv.includes('--check-fixture-http');
const output=resolve(game,process.env.BELLE_BATCH_OUTPUT||'output/batched-upload-equivalence');
assert(!process.env.BELLE_BATCH_ADAPTER_SOURCE||httpOnly,'An adapter source override is allowed only for HTTP transformation checks.');
const adapterPath=resolve(process.env.BELLE_BATCH_ADAPTER_SOURCE||resolve(game,'src/belle/batchedIndirectUpdates.ts'));
const require=createRequire(import.meta.url),threeRoot=resolve(dirname(require.resolve('three')),'..');
const hash=value=>createHash('sha256').update(value).digest('hex');
const sourcePaths={
 fixture:resolve(import.meta.filename),adapter:adapterPath,packageLock:resolve(game,'package-lock.json'),
 threePackage:resolve(threeRoot,'package.json'),nativeBatchedMesh:resolve(threeRoot,'src/objects/BatchedMesh.js'),
 nativeTexture:resolve(threeRoot,'src/textures/Texture.js'),nativeSource:resolve(threeRoot,'src/textures/Source.js'),
 nativeRenderer:resolve(threeRoot,'src/renderers/WebGLRenderer.js'),nativeTextures:resolve(threeRoot,'src/renderers/webgl/WebGLTextures.js'),
};
const sources=Object.fromEntries(await Promise.all(Object.entries(sourcePaths).map(async([name,path])=>[name,{path,sha256:hash(await readFile(path))}])));
const adapterSource=await readFile(adapterPath,'utf8');
assert.equal(JSON.parse(await readFile(sourcePaths.threePackage,'utf8')).version,'0.185.1','This fixture requires the pinned Three implementation.');
const adapterModule=(await transform(adapterSource,{loader:'ts',format:'esm',target:'es2022',sourcefile:'batchedIndirectUpdates.ts'})).code;
await mkdir(output,{recursive:true});
await writeFile(resolve(output,'adapter-source.ts'),adapterSource);
await writeFile(resolve(output,'fixture-source.mjs'),await readFile(import.meta.filename));
const report={
 version:1,scope:'Isolated native WebGL pixel/command equivalence of guarded BatchedMesh indirect dirty marks. Persistent matched scenes; no gameplay, sustained FPS, GPU-time or release claim.',
 candidate:execFileSync('git',['rev-parse','HEAD'],{cwd:game,encoding:'utf8'}).trim(),
 tree:execFileSync('git',['rev-parse','HEAD^{tree}'],{cwd:game,encoding:'utf8'}).trim(),
 baseline:'Same pinned native Three code and matched persistent scenes, with no adapter installed.',
 httpOnly,sources,startedAt:new Date().toISOString(),passed:false,cases:[],errors:[],failedRequests:[],artifacts:[],
};
if(process.env.GITHUB_SHA&&!httpOnly)assert.equal(report.candidate,process.env.GITHUB_SHA,'Native fixture must execute the checked-out workflow head.');

async function fixtureMain(){
 const T=await import('three');
 const {installBatchedIndirectUpdates}=await import('/batch-adapter.mjs');
 const width=384,height=256,counterNames=['attempted','delegated','suppressed','fallback','externalMarks','invalidations'];
 const result=window.__batchedUploadResult={version:1,passed:false,trustedStart:false,width,height,threeRevision:T.REVISION,
  contexts:[],contextLifecycle:[],cases:[],controls:[],errors:[],coverage:{},expectedCaseCount:0,currentStep:null,
  presentation:'Antialiasing requested; actual default samples recorded. preserveDrawingBuffer is confined to this readback fixture. Readback fences and pixel reads are verification work, not performance observations.'};
 const pixelArtifacts=window.__batchedUploadPixels={};
 const check=(condition,message)=>{if(!condition)throw Error(message);};
 const same=(a,b)=>JSON.stringify(a)===JSON.stringify(b);
 const nativeBeforeRender=T.BatchedMesh.prototype.onBeforeRender;
 const stats=side=>side.handle?{...side.handle.read()}:null;
 const delta=(before,after)=>Object.fromEntries(counterNames.map(key=>[key,after[key]-before[key]]));
 const sha=async bytes=>[...new Uint8Array(await crypto.subtle.digest('SHA-256',bytes))].map(v=>v.toString(16).padStart(2,'0')).join('');
 function base64(bytes){let text='';for(let at=0;at<bytes.length;at+=8192)text+=String.fromCharCode(...bytes.subarray(at,at+8192));return btoa(text);}
 function difference(a,b){
  check(a.length===b.length,'Pixel lengths differ');let changedPixels=0,maxChannelDifference=0;
  for(let at=0;at<a.length;at+=4){let changed=false;for(let c=0;c<4;c++){const d=Math.abs(a[at+c]-b[at+c]);if(d)changed=true;maxChannelDifference=Math.max(maxChannelDifference,d);}if(changed)changedPixels++;}
  return {changedPixels,maxChannelDifference};
 }
 function copyArgs(args){
  return args.map(value=>{
   if(ArrayBuffer.isView(value)){check(value.length<=64,'Native draw argument exceeds fixture retention bound');return {type:value.constructor.name,length:value.length,values:Array.from(value)};}
   check(typeof value==='number'&&Number.isFinite(value),'Unrecognized native draw argument');return value;
  });
 }
 function observe(renderer){
  let active=false,batch=null,current=null,shadowDepth=0,commands=[],uploads=[],nativeDraws=[],gl=null,shadowOwner=null,multiOwner=null;
  const restores=[];let shadowRestore=()=>{};
  function hook(target,name,make){
   const own=Object.getOwnPropertyDescriptor(target,name),original=target[name];if(typeof original!=='function')return false;
   const wrapped=make(original);Object.defineProperty(target,name,own?{...own,value:wrapped}:{value:wrapped,writable:true,configurable:true});
   check(target[name]===wrapped,'Observation hook did not install: '+name);
   restores.push(()=>{if(target[name]!==wrapped)return;if(own)Object.defineProperty(target,name,own);else delete target[name];});return true;
  }
  function drawHook(target,name){hook(target,name,original=>function(...args){
   const entry=active&&current?{method:name,phase:current.phase,args:copyArgs(args),returned:false}:null;
   try{const value=Reflect.apply(original,this,args);if(entry)entry.returned=true;return value;}
   finally{if(entry)nativeDraws.push(entry);}
  });}
  function refresh(){
   const next=renderer.getContext();
   if(gl!==next){
    gl=next;multiOwner=null;
    for(const name of ['texSubImage2D','texImage2D'])check(hook(gl,name,original=>function(...args){
     const entry=active?{method:name,phase:current?.phase??'outside-batch',batch:!!current,
      source:current?['_indirectTexture','_matricesTexture','_colorsTexture'].find(key=>batch[key]&&args.includes(batch[key].image.data))??null:null,
      width:args.length>=9?args[name==='texSubImage2D'?4:3]:null,height:args.length>=9?args[name==='texSubImage2D'?5:4]:null,returned:false}:null;
     try{const value=Reflect.apply(original,this,args);if(entry)entry.returned=true;return value;}
     finally{if(entry)uploads.push(entry);}
    }),'Required texture method unavailable: '+name);
    for(const name of ['drawArrays','drawElements','drawRangeElements','drawArraysInstanced','drawElementsInstanced'])drawHook(gl,name);
   }
   const multi=gl.getExtension('WEBGL_multi_draw');
   if(multi&&multi!==multiOwner){
    multiOwner=multi;
    for(const name of ['multiDrawArraysWEBGL','multiDrawElementsWEBGL','multiDrawArraysInstancedWEBGL','multiDrawElementsInstancedWEBGL'])drawHook(multi,name);
   }
   if(shadowOwner!==renderer.shadowMap){
    shadowRestore();shadowOwner=renderer.shadowMap;
    const own=Object.getOwnPropertyDescriptor(shadowOwner,'render'),original=shadowOwner.render,owner=shadowOwner;
    const wrapped=function(...args){if(!active)return Reflect.apply(original,this,args);shadowDepth++;try{return Reflect.apply(original,this,args);}finally{shadowDepth--;}};
    Object.defineProperty(owner,'render',{...own,value:wrapped});
    shadowRestore=()=>{if(owner.render===wrapped)Object.defineProperty(owner,'render',own);};
   }
  }
  hook(renderer,'renderBufferDirect',original=>function(...args){
   if(!active||args[4]!==batch)return Reflect.apply(original,this,args);
   const [camera,,geometry,material]=args,texture=batch._indirectTexture,data=texture.image.data;
   const count=batch._multiDrawCount;
   check(Number.isSafeInteger(count)&&count>=0&&count<=32&&data.length<=64,'Native batch snapshot exceeds fixture bounds');
   const target=renderer.getRenderTarget();
   const entry={phase:shadowDepth?'shadow':target?'offscreen':'color',camera:camera.name||camera.type,
    cameraType:camera.type,projection:Array.from(camera.projectionMatrix.elements),cameraInverse:Array.from(camera.matrixWorldInverse.elements),
    world:Array.from(batch.matrixWorld.elements),materialType:material.type,wireframe:!!material.wireframe,
    count,starts:Array.from(batch._multiDrawStarts.subarray(0,count)),counts:Array.from(batch._multiDrawCounts.subarray(0,count)),
    indirectIds:Array.from(data.subarray(0,count)),indirectFull:Array.from(data),indirectWidth:texture.image.width,indirectHeight:texture.image.height,
    indexType:geometry.index?.array.constructor.name??null};
   commands.push(entry);const previous=current;current=entry;
   try{return Reflect.apply(original,this,args);}finally{current=previous;}
  });
  refresh();
  return {begin(object){refresh();batch=object;commands=[];uploads=[];nativeDraws=[];shadowDepth=0;current=null;active=true;},
   end(){active=false;return {commands,uploads,nativeDraws,texSubImage2D:uploads.filter(v=>v.method==='texSubImage2D').length,
    batchTexSubImage2D:uploads.filter(v=>v.method==='texSubImage2D'&&v.batch).length,
    indirectTexSubImage2D:uploads.filter(v=>v.method==='texSubImage2D'&&v.source==='_indirectTexture').length};},
   dispose(){active=false;shadowRestore();for(const restore of restores.reverse())restore();}};
 }
 function context(label){
  const renderer=new T.WebGLRenderer({antialias:true,alpha:false,preserveDrawingBuffer:true,powerPreference:'high-performance'});
  renderer.setPixelRatio(1);renderer.setSize(width,height);renderer.outputColorSpace=T.SRGBColorSpace;
  renderer.toneMapping=T.ACESFilmicToneMapping;renderer.toneMappingExposure=1;
  renderer.shadowMap.enabled=false;renderer.shadowMap.type=T.PCFShadowMap;renderer.shadowMap.autoUpdate=true;
  const gl=renderer.getContext(),debug=gl.getExtension('WEBGL_debug_renderer_info');
  const receipt={label,renderer:String(gl.getParameter(debug?.UNMASKED_RENDERER_WEBGL??gl.RENDERER)),version:String(gl.getParameter(gl.VERSION)),
   attributes:gl.getContextAttributes(),drawingBuffer:[gl.drawingBufferWidth,gl.drawingBufferHeight],
   defaultFramebufferBound:gl.getParameter(gl.DRAW_FRAMEBUFFER_BINDING)===null,samples:gl.getParameter(gl.SAMPLES),sampleBuffers:gl.getParameter(gl.SAMPLE_BUFFERS),
   maxSamples:gl.getParameter(gl.MAX_SAMPLES),requestedAntialias:true,requestedOffscreenSamples:4};
  result.contexts.push(receipt);
  check(/Metal/i.test(receipt.renderer)&&!/SwiftShader|llvmpipe|softpipe/i.test(receipt.renderer),'Actual native Metal renderer required');
  check(receipt.attributes.antialias===true&&receipt.defaultFramebufferBound&&receipt.samples===4,'Actual antialiased default framebuffer must have four samples');
  check(receipt.maxSamples>=4,'Four-sample offscreen target support is required');
  const target=new T.WebGLRenderTarget(width,height,{samples:4,depthBuffer:true,stencilBuffer:false});
  target.texture.colorSpace=T.SRGBColorSpace;
  const observer=observe(renderer);
  return {label,renderer,target,observer,receipt,dispose(){observer.dispose();target.dispose();renderer.dispose();renderer.forceContextLoss();}};
 }
 function content(candidate){
  const scene=new T.Scene();scene.background=new T.Color(0x17252e);
  const material=new T.MeshStandardMaterial({color:0xffffff,roughness:.65,metalness:.05});
  material.name='Fixture colored batch material';
  const batch=new T.BatchedMesh(12,2048,8192,material);batch.name='Native fixture batch';
  batch.perObjectFrustumCulled=true;batch.sortObjects=false;batch.castShadow=true;batch.receiveShadow=true;
  const geometries=[new T.BoxGeometry(.9,1,.8),new T.SphereGeometry(.55,16,12),new T.ConeGeometry(.55,1.2,16)];
  const geometryIds=geometries.map(geometry=>batch.addGeometry(geometry));
  const positions=[[-1.25,.65,.45],[0,.75,-.35],[1.25,.65,.15],[-.25,.5,1.15],[.6,1.1,-1.15],[6.2,.7,0],[-6.2,.7,0],[0,.45,-1.8]];
  const colors=[0xe44739,0x6fd85f,0x4285ef,0xffcf43,0xbd55d9,0x3dd5dc,0xf28b38,0xe9e9ed];
  const ids=[],matrices=[];
  for(let i=0;i<positions.length;i++){
   const id=batch.addInstance(geometryIds[i%3]),matrix=new T.Matrix4().makeTranslation(...positions[i]);
   ids.push(id);matrices.push(matrix);batch.setMatrixAt(id,matrix);batch.setColorAt(id,new T.Color(colors[i]));
  }
  check(batch._indirectTexture.version===0&&batch._indirectTexture.source.version===0,'Adapter fixture must start from factory-native version-zero indirect data');
  const handle=candidate?installBatchedIndirectUpdates(batch):null;
  if(handle){check(handle.read().supported&&handle.read().active,'Candidate adapter must be active on the supported factory batch');}
  else check(batch.onBeforeRender===nativeBeforeRender,'Baseline batch must retain original native callback');
  scene.add(batch);
  const floorGeometry=new T.PlaneGeometry(18,18),floorMaterial=new T.MeshStandardMaterial({color:0x8b9185,roughness:1});
  const floor=new T.Mesh(floorGeometry,floorMaterial);floor.name='Fixture shadow receiver';floor.rotation.x=-Math.PI/2;floor.position.y=-.05;floor.receiveShadow=true;scene.add(floor);
  scene.add(new T.AmbientLight(0xc4d4eb,.6));
  const sun=new T.DirectionalLight(0xffedcc,2.4);sun.position.set(-2,6,3);sun.target.position.set(0,0,0);sun.castShadow=false;
  sun.shadow.mapSize.set(256,256);Object.assign(sun.shadow.camera,{left:-10,right:10,top:10,bottom:-10,near:.1,far:40});
  sun.shadow.camera.name='native-sun-shadow';sun.shadow.camera.updateProjectionMatrix();sun.shadow.bias=-.001;scene.add(sun,sun.target);
  const perspective=new T.PerspectiveCamera(40,width/height,.1,40);perspective.name='perspective';
  const orthographic=new T.OrthographicCamera(-3.3,3.3,2.2,-2.2,.1,40);orthographic.name='orthographic';
  const place=(camera,x=0,aim=0)=>{camera.position.set(x,3.3,7.4);camera.lookAt(aim,.6,0);camera.updateProjectionMatrix();camera.updateMatrixWorld(true);};
  place(perspective);place(orthographic);
  const left=new T.PerspectiveCamera(40,width/2/height,.1,40),right=left.clone();
  left.name='split-left';right.name='split-right';place(left);place(right,4.5,4.5);
  left.viewport=new T.Vector4(0,0,width/2,height);right.viewport=new T.Vector4(width/2,0,width/2,height);
  const split=new T.ArrayCamera([left,right]);split.name='array-camera';split.updateMatrixWorld(true);
  const retiredTextures=[];
  return {scene,batch,handle,ids,matrices,geometryIds,sun,perspective,orthographic,split,place,camera:perspective,offscreen:false,
   customUploadCallbacks:0,retiredTextures,
   dispose(){handle?.dispose();batch.dispose();material.dispose();for(const geometry of geometries)geometry.dispose();floorGeometry.dispose();floorMaterial.dispose();sun.shadow.dispose();for(const texture of retiredTextures)texture.dispose();}};
 }
 function pair(name){
  result.currentStep={cohort:name,step:null,stage:'initializing-cohort'};
  const baseline=content(false),candidate=content(true);baseline.primary=context(name+'-baseline');candidate.primary=context(name+'-candidate');
  const value={name,baseline,candidate,references:new Map()};
  value.dispose=()=>{for(const side of [baseline,candidate]){side.dispose();side.secondary?.dispose();side.primary.dispose();}};
  return value;
 }
 async function completed(renderer){
  const gl=renderer.getContext();check(!gl.isContextLost(),'Context lost before pixel completion');
  const sync=gl.fenceSync(gl.SYNC_GPU_COMMANDS_COMPLETE,0);check(sync,'Completion fence unavailable');
  const start=performance.now();gl.flush();
  try{for(;;){
   const status=gl.clientWaitSync(sync,0,0);
   if(status===gl.ALREADY_SIGNALED||status===gl.CONDITION_SATISFIED)return {submittedWallMs:start,observedCompleteWallMs:performance.now()};
   check(status!==gl.WAIT_FAILED&&!gl.isContextLost()&&performance.now()-start<45000,'Native readback completion failed');
   await new Promise(resolve=>requestAnimationFrame(resolve));
  }}finally{gl.deleteSync(sync);}
 }
 async function render(side,which){
  const ctx=which==='secondary'?side.secondary:side.primary,{renderer,observer,target}=ctx;
  renderer.setRenderTarget(side.offscreen?target:null);renderer.setViewport(0,0,width,height);renderer.setScissorTest(false);
  observer.begin(side.batch);
  let observations;
  try{renderer.render(side.scene,side.camera);}finally{observations=observer.end();}
  const completion=await completed(renderer),pixels=new Uint8Array(width*height*4),gl=renderer.getContext();
  if(side.offscreen)renderer.readRenderTargetPixels(target,0,0,width,height,pixels);
  else gl.readPixels(0,0,width,height,gl.RGBA,gl.UNSIGNED_BYTE,pixels);
  check(gl.getError()===gl.NO_ERROR,'WebGL error in native render/readback');
  check(observations.commands.length>0&&observations.nativeDraws.length>0,'Native batch commands/draws were not observed');
  return {pixels,sha256:await sha(pixels),observations,completion,adapter:stats(side),customUploadCallbacks:side.customUploadCallbacks};
 }
 function show(name,before,after,passed){
  const article=document.createElement('article');article.id=name;
  const title=document.createElement('h2');title.textContent=name+' — '+(passed?'identical':'FAILED');article.append(title);
  const row=document.createElement('section');article.append(row);document.querySelector('main').append(article);
  for(const [label,pixels]of [['Native baseline',before],['Guarded candidate',after]]){
   const holder=document.createElement('div'),caption=document.createElement('p'),canvas=document.createElement('canvas');
   caption.textContent=label;canvas.width=width;canvas.height=height;
   const flipped=new Uint8ClampedArray(pixels.length);
   for(let y=0;y<height;y++)flipped.set(pixels.subarray(y*width*4,(y+1)*width*4),(height-y-1)*width*4);
   canvas.getContext('2d').putImageData(new ImageData(flipped,width,height),0,0);holder.append(caption,canvas);row.append(holder);
  }
 }
 async function step(cohort,spec){
  result.expectedCaseCount++;
  result.currentStep={cohort:cohort.name,step:spec.name,stage:'preparation'};
  const beforeStats=stats(cohort.candidate);
  if(spec.restoreContext){
   for(const [label,side] of [['baseline',cohort.baseline],['candidate',cohort.candidate]]){
    const renderer=side.primary.renderer,canvas=renderer.domElement,gl=renderer.getContext(),waits=[];
    check(result.contextLifecycle.length<2,'Context lifecycle receipt bound exceeded');
    const receipt={cohort:cohort.name,step:spec.name,side:label,context:side.primary.label,eventDeadlineMs:15000,
     events:[],requests:[],glErrors:[],timeouts:[],subsequentTasks:0,completed:false,error:null};
    result.contextLifecycle.push(receipt);result.currentStep.side=label;
    const stage=name=>{receipt.stage=name;result.currentStep.stage=name;};
    const errorReceipt=(stage,allowed)=>{
     check(receipt.glErrors.length<4,'GL error receipt bound exceeded');
     const code=gl.getError();receipt.glErrors.push({stage,code,wallMs:performance.now()});
     check(allowed.includes(code),label+' '+stage+' unexpected GL error '+code);
    };
    const wait=type=>{
     let cancel=()=>{};
     const promise=new Promise((resolve,reject)=>{
      const cleanup=()=>{clearTimeout(timer);canvas.removeEventListener(type,listener);};
      const listener=event=>{
       if(type==='webglcontextlost')event.preventDefault();
       try{
        check(receipt.events.length<2,'Context event receipt bound exceeded');
        receipt.events.push({type,wallMs:performance.now(),trusted:event.isTrusted,defaultPrevented:event.defaultPrevented,
         contextLost:gl.isContextLost(),statusMessage:String(event.statusMessage||'').slice(0,256)});
        check(event.isTrusted&&(type!=='webglcontextlost'||event.defaultPrevented),'Real canceled loss/native restoration event required');
        resolve();
       }catch(error){reject(error);}finally{cleanup();}
      };
      const timer=setTimeout(()=>{cleanup();receipt.timeouts.push({type,wallMs:performance.now()});reject(Error(label+' '+type+' timeout'));},15000);
      cancel=cleanup;canvas.addEventListener(type,listener,{once:true});
     });
     const handle={promise,cancel:()=>cancel()};waits.push(handle);return promise;
    };
    const request=(kind,invoke)=>{
     check(receipt.requests.length<2,'Context request receipt bound exceeded');
     const row={kind,wallMs:performance.now(),contextLostBefore:gl.isContextLost(),returned:false};receipt.requests.push(row);
     invoke();row.returned=true;row.contextLostAfter=gl.isContextLost();
    };
    try{
     stage('context-loss-preparation');check(gl.getExtension('WEBGL_lose_context'),'Real context-loss extension required');
     errorReceipt('before-loss',[gl.NO_ERROR]);
     const lost=wait('webglcontextlost');stage('waiting-context-loss-event');request('lose',()=>renderer.forceContextLoss());await lost;
     errorReceipt('after-loss-event',[gl.NO_ERROR,gl.CONTEXT_LOST_WEBGL]);
     stage('after-loss-event-task');
     // WEBGL_lose_context forbids restoration until the loss event has finished
     // dispatching. A resolved listener promise alone can resume at its microtask
     // checkpoint. Exactly one subsequent task supplies the required boundary.
     await new Promise(resolve=>setTimeout(resolve,0));receipt.subsequentTasks=1;receipt.afterLossTaskWallMs=performance.now();
     const restored=wait('webglcontextrestored');stage('waiting-context-restored-event');request('restore',()=>renderer.forceContextRestore());
     errorReceipt('after-restore-request',[gl.NO_ERROR,gl.CONTEXT_LOST_WEBGL]);await restored;
     await new Promise(resolve=>requestAnimationFrame(resolve));
     check(!renderer.getContext().isContextLost(),'Native context did not restore');
     errorReceipt('after-restored-event',[gl.NO_ERROR]);receipt.completed=true;stage('context-restored');
    }catch(error){receipt.error=String(error.stack||error);throw error;}
    finally{for(const handle of waits)handle.cancel();receipt.finishedWallMs=performance.now();}
   }
   delete result.currentStep.side;
   result.coverage.nativeContextLossAndRestore=true;
  }
  if(spec.renderer==='secondary')for(const [label,side]of [['baseline',cohort.baseline],['candidate',cohort.candidate]])
   side.secondary??=context(cohort.name+'-'+label+'-second-renderer');
  if(spec.apply)for(const side of [cohort.baseline,cohort.candidate])spec.apply(side);
  result.currentStep.stage='baseline-render';const before=await render(cohort.baseline,spec.renderer);
  result.currentStep.stage='candidate-render';const after=await render(cohort.candidate,spec.renderer);
  result.currentStep.stage='assertions';
  const pixelDifference=difference(before.pixels,after.pixels);
  const commandsEqual=same(before.observations.commands,after.observations.commands);
  const nativeDrawsEqual=same(before.observations.nativeDraws,after.observations.nativeDraws);
  const decisions=delta(beforeStats,after.adapter),name=cohort.name+'-'+spec.name;
  const record={name,cohort:cohort.name,step:spec.name,...pixelDifference,commandsEqual,nativeDrawsEqual,
   baseline:{sha256:before.sha256,completion:before.completion,observations:before.observations,customUploadCallbacks:before.customUploadCallbacks},
   candidate:{sha256:after.sha256,completion:after.completion,observations:after.observations,adapterBefore:beforeStats,adapterAfter:after.adapter,decisionDelta:decisions,customUploadCallbacks:after.customUploadCallbacks},
   conditions:{suppressionRequired:!!spec.suppression,externalMarkRequired:!!spec.externalMark,tailDelegationRequired:!!spec.tail,
    permanentFallbackRequired:!!spec.disabled,customFallbackRequired:!!spec.fallback,contextRestored:!!spec.restoreContext},
   equivalencePassed:pixelDifference.changedPixels===0&&commandsEqual&&nativeDrawsEqual,passed:false};
  result.cases.push(record);pixelArtifacts[name]={baseline:base64(before.pixels),candidate:base64(after.pixels)};
  show(name,before.pixels,after.pixels,record.equivalencePassed);
  check(record.equivalencePassed,'Pixels or native command order differ: '+name);
  check(after.adapter.attempted===after.adapter.delegated+after.adapter.suppressed,'Adapter decision accounting does not balance');
  check(after.adapter.fallback<=after.adapter.delegated,'Fallback accounting exceeds delegated marks');
  if(spec.suppression){
   check(decisions.suppressed>0&&before.observations.indirectTexSubImage2D>after.observations.indirectTexSubImage2D&&
    before.observations.batchTexSubImage2D>after.observations.batchTexSubImage2D,'Actual redundant indirect subimage calls were not reduced: '+name);
   result.coverage.actualSubimageSuppression=true;
  }
  if(spec.externalMark)check(decisions.externalMarks>0&&after.observations.indirectTexSubImage2D>0,'External dirty mark did not reach native indirect upload');
  if(spec.tail)check(decisions.delegated>0&&after.observations.indirectTexSubImage2D>0,'Full-allocation tail change was not delegated');
  if(spec.fallback)check(decisions.fallback>0&&decisions.suppressed===0&&before.observations.batchTexSubImage2D===after.observations.batchTexSubImage2D,'Unsupported custom behavior did not retain native updates');
  if(spec.disabled)check(!after.adapter.active&&after.adapter.disabledReason&&before.observations.batchTexSubImage2D===after.observations.batchTexSubImage2D,'Permanent fallback did not retain native behavior');
  if(spec.restoreContext)check(decisions.invalidations>=2&&decisions.delegated>0&&after.observations.indirectTexSubImage2D>0,'Restored context did not invalidate and delegate');
  if(spec.identicalLists||spec.distinctLists){
   const shadow=before.observations.commands.find(row=>row.phase==='shadow');
   const color=before.observations.commands.find(row=>row.phase==='color');
   check(shadow&&color,'Actual shadow and color submissions are required');
   const equal=same(shadow.indirectIds,color.indirectIds);
   check(spec.identicalLists?equal:!equal,'Fixture did not exercise the intended shadow/color ID lists');
   result.coverage[spec.identicalLists?'identicalShadowColorLists':'distinctShadowColorLists']=true;
  }
  if(spec.split){
   const cameras=new Set(before.observations.commands.filter(row=>row.phase==='color').map(row=>row.camera));
   check(cameras.has('split-left')&&cameras.has('split-right'),'Both native ArrayCamera views must draw');result.coverage.arrayCamera=true;
  }
  if(spec.changeFrom||spec.commandChangeFrom){
   const reference=cohort.references.get(spec.changeFrom||spec.commandChangeFrom);check(reference,'Missing explicit control reference');
   const visible=spec.changeFrom?difference(reference.pixels,before.pixels):null;
   const changedCommands=!same(reference.commands,before.observations.commands);
   if(visible)check(visible.changedPixels>=64,'Visible control did not affect enough pixels: '+name);
   if(spec.commandChangeFrom)check(changedCommands,'Native culling/sort/range control did not change commands: '+name);
   result.controls.push({name,reference:spec.changeFrom||spec.commandChangeFrom,visibleDifference:visible,commandsChanged:changedCommands,passed:true});
  }
  if(spec.equalTo)check(before.sha256===cohort.references.get(spec.equalTo)?.sha256,'Restoration control did not return original baseline pixels');
  cohort.references.set(spec.name,{pixels:before.pixels,sha256:before.sha256,commands:before.observations.commands});
  record.passed=true;result.currentStep.stage='complete';
  return record;
 }
 function shadows(side,enabled){
  side.sun.castShadow=enabled;side.primary.renderer.shadowMap.enabled=enabled;
  side.primary.renderer.shadowMap.needsUpdate=true;side.sun.shadow.needsUpdate=true;
 }
 function replaceTexture(side){
  const previous=side.batch._indirectTexture,image=previous.image;
  const next=new T.DataTexture(image.data.slice(),image.width,image.height,previous.format,previous.type);
  for(const key of ['wrapS','wrapT','magFilter','minFilter','anisotropy','internalFormat','generateMipmaps','premultiplyAlpha','flipY','unpackAlignment','colorSpace'])next[key]=previous[key];
  next.needsUpdate=true;side.batch._indirectTexture=next;side.retiredTextures.push(previous);
 }
 const button=document.querySelector('button');
 button.addEventListener('click',async event=>{
  result.trustedStart=event.isTrusted;button.disabled=true;let current;
  try{
   check(event.isTrusted,'Verification must begin with a trusted button action');
   current=pair('persistent');
   const definitions=[
    {name:'initial'},{name:'repeat-1',suppression:true},{name:'repeat-2',suppression:true},
    {name:'hide-visible',apply:s=>s.batch.setVisibleAt(s.ids[0],false),changeFrom:'initial',commandChangeFrom:'initial'},
    {name:'restore-visible',apply:s=>s.batch.setVisibleAt(s.ids[0],true),equalTo:'initial'},
    {name:'move-instance',apply:s=>s.batch.setMatrixAt(s.ids[1],new T.Matrix4().makeTranslation(-.7,1.2,.9)),changeFrom:'initial'},
    {name:'restore-instance',apply:s=>s.batch.setMatrixAt(s.ids[1],s.matrices[1]),equalTo:'initial'},
    {name:'change-geometry',apply:s=>s.batch.setGeometryIdAt(s.ids[0],s.geometryIds[1]),changeFrom:'initial',commandChangeFrom:'initial'},
    {name:'restore-geometry',apply:s=>s.batch.setGeometryIdAt(s.ids[0],s.geometryIds[0]),equalTo:'initial'},
    {name:'shift-camera',apply:s=>s.place(s.perspective,4.5,4.5),changeFrom:'initial',commandChangeFrom:'initial'},
    {name:'repeat-shifted',suppression:true},
    {name:'restore-camera',apply:s=>s.place(s.perspective),equalTo:'initial'},
    {name:'native-sort',apply:s=>{s.batch.sortObjects=true;},commandChangeFrom:'initial'},
    {name:'repeat-native-sort',suppression:true},
    {name:'restore-native-order',apply:s=>{s.batch.sortObjects=false;},equalTo:'initial'},
    {name:'orthographic',apply:s=>{s.camera=s.orthographic;},changeFrom:'initial'},
    {name:'offscreen',apply:s=>{s.offscreen=true;}},
    {name:'offscreen-repeat',suppression:true},
    {name:'array-camera',apply:s=>{s.offscreen=false;s.camera=s.split;},split:true},
    {name:'shadow-distinct',apply:s=>{s.camera=s.perspective;shadows(s,true);},distinctLists:true,changeFrom:'initial'},
    {name:'shadow-distinct-repeat',distinctLists:true},
    {name:'shadow-identical',apply:s=>{s.perspective.fov=75;s.perspective.updateProjectionMatrix();},identicalLists:true},
    {name:'shadow-identical-repeat',identicalLists:true,suppression:true},
    {name:'no-shadow-wide',apply:s=>shadows(s,false)},
    {name:'external-mark',apply:s=>{s.batch._indirectTexture.needsUpdate=true;},externalMark:true},
    {name:'full-allocation-tail',apply:s=>{const data=s.batch._indirectTexture.image.data;data[data.length-1]=(data[data.length-1]+1)%s.ids.length;},tail:true},
    {name:'custom-sort',apply:s=>{s.batch.sortObjects=true;s.batch.setCustomSort(list=>list.sort((a,b)=>b.index-a.index));},fallback:true},
    {name:'custom-sort-repeat',fallback:true},
    {name:'restore-default-sort',apply:s=>{s.batch.setCustomSort(null);s.batch.sortObjects=false;}},
    {name:'custom-upload-callback',apply:s=>{s.batch._indirectTexture.onUpdate=()=>{s.customUploadCallbacks++;};},fallback:true},
    {name:'custom-upload-callback-repeat',fallback:true},
    {name:'restore-upload-callback',apply:s=>{s.batch._indirectTexture.onUpdate=null;}},
    {name:'context-restored',restoreContext:true},
    {name:'context-restored-repeat',suppression:true},
    {name:'adapter-disposed',apply:s=>s.handle?.dispose(),disabled:true},
    {name:'disposed-repeat',disabled:true},
   ];
   for(const spec of definitions)await step(current,spec);
   result.coverage.persistentFrames=true;result.coverage.orthographicAndOffscreen=true;
   check(current.baseline.customUploadCallbacks===current.candidate.customUploadCallbacks&&current.baseline.customUploadCallbacks>=2,'Custom upload callback side effects changed');
   current.dispose();current=null;
   current=pair('replacement');await step(current,{name:'initial'});await step(current,{name:'repeat',suppression:true});
   await step(current,{name:'new-texture',apply:replaceTexture,disabled:true});await step(current,{name:'native-repeat',disabled:true});
   result.coverage.textureReplacement=true;current.dispose();current=null;
   current=pair('resize');await step(current,{name:'initial'});await step(current,{name:'repeat',suppression:true});
   await step(current,{name:'new-capacity-visible-instance',apply:s=>{
    s.batch.setInstanceCount(24);const id=s.batch.addInstance(s.geometryIds[0]);s.batch.setMatrixAt(id,new T.Matrix4().makeTranslation(.2,.95,1.45));s.batch.setColorAt(id,new T.Color(0xff44cc));
   },disabled:true,changeFrom:'initial',commandChangeFrom:'initial'});
   await step(current,{name:'native-repeat',disabled:true});result.coverage.nativeResize=true;current.dispose();current=null;
   current=pair('second-renderer');await step(current,{name:'initial'});await step(current,{name:'repeat',suppression:true});
   await step(current,{name:'second-context',renderer:'secondary',disabled:true});
   await step(current,{name:'second-context-repeat',renderer:'secondary',disabled:true});
   await step(current,{name:'return-first-context',disabled:true});result.coverage.secondRenderer=true;current.dispose();current=null;
   check(result.cases.length===result.expectedCaseCount&&result.cases.every(row=>row.passed),'All planned steps must complete');
   check(result.controls.length>=7&&result.controls.every(row=>row.passed),'Meaningful visible/native-command controls are required');
   check(Object.values(result.coverage).every(Boolean)&&Object.keys(result.coverage).length>=9,'Required fixture path coverage is incomplete');
   result.passed=true;
  }catch(error){result.errors.push(String(error.stack||error));}
  finally{try{current?.dispose();}catch(error){result.errors.push('Fixture cleanup: '+String(error));result.passed=false;}document.body.dataset.complete='true';}
 });
 document.body.dataset.ready='true';
}

const html='<!doctype html><html><head><meta charset="utf-8"><link rel="icon" href="data:,"><title>Batched upload native equivalence</title><style>body{background:#101a22;color:#edf1ed;font:15px Arial;margin:24px}button{min-height:44px;padding:12px 20px}section{display:flex;flex-wrap:wrap;gap:16px}canvas{width:384px;max-width:100%;height:auto}article{margin:28px 0}h2{font-size:18px}p{max-width:80ch}</style></head><body><h1>Batched upload native equivalence</h1><p>Controlled pixel and native command verification. This is not gameplay or performance acceptance.</p><button type="button">Run native verification</button><main></main><script type="module" src="/batched-upload-fixture.mjs"></script></body></html>';
const fixtureModule='('+fixtureMain.toString()+')();';
const server=await createServer({root:game,configFile:false,publicDir:false,logLevel:'error',cacheDir:resolve(output,'vite-cache'),
 optimizeDeps:{noDiscovery:true,include:['three']},server:{host:'127.0.0.1',port:0,strictPort:false},plugins:[{
  name:'native-batched-upload-fixture',configureServer(server){server.middlewares.use((request,response,next)=>{
   if(new URL(request.url,'http://fixture').pathname==='/'){response.setHeader('Content-Type','text/html');response.end(html);}else next();
  });},
  resolveId(id){if(id==='/batched-upload-fixture.mjs')return '\0batched-upload-fixture.mjs';if(id==='/batch-adapter.mjs')return '\0batch-adapter.mjs';},
  load(id){if(id==='\0batched-upload-fixture.mjs')return fixtureModule;if(id==='\0batch-adapter.mjs')return adapterModule;},
 }]});
function dependency(name){
 try{return require(name);}catch(error){
  try{return createRequire(resolve(game,'../../package.json'))(name);}catch{}
  if(!process.env.CODEX_PRIMARY_RUNTIME_NODE_MODULES)throw error;
  return createRequire(resolve(process.env.CODEX_PRIMARY_RUNTIME_NODE_MODULES,'package.json'))(name);
 }
}
let browser,browserContext,page,transformPassed=false;
const savedArtifacts=new Set();
async function bounded(promise,milliseconds){
 let timer;
 try{return await Promise.race([promise,new Promise((_,reject)=>{timer=setTimeout(()=>reject(Error('Evidence collection deadline exceeded')),milliseconds);})]);}
 finally{clearTimeout(timer);}
}
async function retainNativeEvidence(partial=false){
 const deadline=Date.now()+(partial?20000:90000);
 const remaining=()=>{const value=deadline-Date.now();assert(value>0,'Evidence collection deadline exceeded');return value;};
 const result=await bounded(page.evaluate(()=>window.__batchedUploadResult),Math.min(remaining(),10000));
 assert(result&&Array.isArray(result.cases),'Browser fixture result is unavailable');
 Object.assign(report,{contexts:result.contexts,contextLifecycle:result.contextLifecycle,cases:result.cases,controls:result.controls,coverage:result.coverage,
  trustedStart:result.trustedStart,presentation:result.presentation,expectedCaseCount:result.expectedCaseCount,currentStep:result.currentStep,threeRevision:result.threeRevision});
 for(const error of result.errors)if(!report.errors.includes(error))report.errors.push(error);
 report.collection={partial,completedCases:result.cases.filter(row=>row.passed).length,retainedCases:result.cases.length,finished:false};
 for(const row of result.cases){
  assert.match(row.name,/^[a-z0-9-]+$/);
  const rawFiles=['baseline','candidate'].map(side=>row.name+'-'+side+'.rgba');
  if(rawFiles.some(file=>!savedArtifacts.has(file))){
   const pixels=await bounded(page.evaluate(name=>window.__batchedUploadPixels[name],row.name),Math.min(remaining(),10000));
   for(const side of ['baseline','candidate']){
    const file=row.name+'-'+side+'.rgba';if(savedArtifacts.has(file))continue;
    const bytes=Buffer.from(pixels[side],'base64');
    assert.equal(bytes.length,result.width*result.height*4);assert.equal(hash(bytes),row[side].sha256);
    await writeFile(resolve(output,file),bytes);savedArtifacts.add(file);
    report.artifacts.push({file,bytes:bytes.length,sha256:hash(bytes),format:'RGBA8, bottom row first',width:result.width,height:result.height});
   }
  }
 }
 for(const row of result.cases){
  const file=row.name+'.png';
  if(!savedArtifacts.has(file)){
   const bytes=await page.locator('#'+row.name).screenshot({path:resolve(output,file),timeout:Math.min(remaining(),5000)});
   savedArtifacts.add(file);report.artifacts.push({file,bytes:bytes.length,sha256:hash(bytes),format:'Paired displayed native readbacks'});
  }
 }
 report.collection.finished=true;return result;
}
try{
 await server.listen();const origin='http://127.0.0.1:'+server.httpServer.address().port;
 if(httpOnly){
  report.httpTransforms=[];
  for(const path of ['/batched-upload-fixture.mjs','/batch-adapter.mjs']){
   const response=await fetch(origin+path),source=await response.text();assert.equal(response.status,200,path);
   assert(!/import\(['"]three['"]\)|from\s*['"]three['"]/.test(source),'Browser dependency imports must be resolved: '+path);
   report.httpTransforms.push({path,status:response.status,bytes:Buffer.byteLength(source),sha256:hash(source)});
  }
  transformPassed=true;
 }else{
  assert.equal(process.platform,'darwin','Native execution is restricted to macOS Metal; use --check-fixture-http for local transformation only.');
  let chromium;try{({chromium}=dependency('playwright'));}catch{({chromium}=dependency('@playwright/test'));}
  browser=await chromium.launch({...(process.env.BELLE_BROWSER_PATH?{executablePath:process.env.BELLE_BROWSER_PATH}:{channel:'chrome'}),
   headless:false,args:['--enable-gpu','--use-gl=angle','--use-angle=metal']});
  report.browser=browser.version();
  browserContext=await browser.newContext({viewport:{width:1050,height:850},deviceScaleFactor:1,reducedMotion:'reduce'});
  page=await browserContext.newPage();page.setDefaultTimeout(45000);
  page.on('pageerror',error=>report.errors.push(error.stack||error.message));
  page.on('console',message=>{if(message.type()==='error')report.errors.push(message.text());});
  page.on('requestfailed',request=>report.failedRequests.push({url:request.url(),error:request.failure()?.errorText}));
  page.on('response',response=>{if(response.status()>=400)report.errors.push('HTTP '+response.status()+' '+response.url());});
  await page.goto(origin,{waitUntil:'domcontentloaded'});await page.waitForFunction(()=>document.body.dataset.ready==='true');
  await page.getByRole('button',{name:'Run native verification',exact:true}).click();
  await page.waitForFunction(()=>document.body.dataset.complete==='true',null,{timeout:300000});
  const result=await retainNativeEvidence();
  assert(result.trustedStart&&result.passed&&result.cases.length===result.expectedCaseCount,'Native fixture must pass every pixel, command, lifecycle, suppression and control check.');
  assert(result.contexts.length>=8&&result.contexts.every(value=>/Metal/i.test(value.renderer)&&!/SwiftShader|llvmpipe|softpipe/i.test(value.renderer)&&value.samples===4),'Actual native Metal/MSAA context coverage is required.');
  report.passed=true;
 }
 for(const [name,entry]of Object.entries(sources))assert.equal(hash(await readFile(entry.path)),entry.sha256,'Source changed during verification: '+name);
}catch(error){
 report.errors.push(error.stack||String(error));
 if(page&&!httpOnly){
  try{await retainNativeEvidence(true);}catch(collectionError){report.errors.push('Partial evidence collection: '+(collectionError.stack||String(collectionError)));}
 }
}
finally{
 try{await browserContext?.close();}catch(error){report.errors.push('Browser context cleanup: '+error.message);}
 try{await browser?.close();}catch(error){report.errors.push('Browser cleanup: '+error.message);}
 try{await server.close();}catch(error){report.errors.push('Server cleanup: '+error.message);}
 report.finishedAt=new Date().toISOString();report.passed=report.passed&&!report.errors.length&&!report.failedRequests.length;
 const success=httpOnly?transformPassed&&!report.errors.length:report.passed;
 await writeFile(resolve(output,httpOnly?'http-transform.json':'report.json'),JSON.stringify(report,null,2)+'\n');
 console.log('BELLE_BATCH_EQUIVALENCE '+JSON.stringify({httpOnly,transformPassed,passed:report.passed,candidate:report.candidate,tree:report.tree,
  sources:Object.fromEntries(Object.entries(sources).map(([key,value])=>[key,value.sha256])),cases:report.cases.length,controls:report.controls?.length??0,
  coverage:report.coverage,artifacts:report.artifacts.length,errors:report.errors,failedRequests:report.failedRequests}));
 if(!success)process.exitCode=1;
}
