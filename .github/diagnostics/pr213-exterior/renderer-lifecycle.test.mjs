import assert from 'node:assert/strict';
import {test} from 'node:test';
import vm from 'node:vm';
import {EventEmitter} from 'node:events';
import {readFile,mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {resolve} from 'node:path';
import {installExteriorRendererLifecycle,observeExteriorPageSignals} from './renderer-lifecycle.mjs';
import {buildDriver} from './build-driver.mjs';

const plain=value=>JSON.parse(JSON.stringify(value));
class Surface {
 listeners=new Map();
 addEventListener(type,listener,options){const list=this.listeners.get(type)??[];list.push({listener,options});this.listeners.set(type,list);}
 emit(type,event={}){event.type=type;for(const {listener} of this.listeners.get(type)??[])listener(event);}
}
function fixture(options={}){
 const document=new Surface(),window=new Surface(),mutations=[];let clock=0,current=null,canvasContextCalls=0;
 document.visibilityState='visible';document.hasFocus=()=>true;document.getElementById=id=>id==='game'?current:null;
 document.querySelectorAll=()=>current?[current]:[];
 const context=vm.createContext({document,performance:{now:()=>++clock},structuredClone,EventTarget:Surface,
  location:{href:'http://127.0.0.1/?stagedArchitectureProof=1&profile=1'},
  addEventListener:window.addEventListener.bind(window),
  MutationObserver:class{constructor(fn){mutations.push(fn);}observe(target,options){assert.equal(target,document);assert.deepEqual(plain(options),{childList:true,subtree:true});}},
 });
 vm.runInContext('('+installExteriorRendererLifecycle.toString()+')('+JSON.stringify(options)+')',context);
 const canvas=(id='game')=>{const result=new Surface();Object.assign(result,{tagName:'CANVAS',id,width:844,height:390,isConnected:true,
  getContext(){canvasContextCalls++;throw Error('The observer must not request a canvas context');},querySelectorAll:()=>[]});return result;};
 const add=value=>{current=value;for(const callback of mutations)callback([{addedNodes:[value],removedNodes:[]}]);};
 const observe=(value,gl)=>{let contextReads=0;const renderer={domElement:value,getContext(){contextReads++;return gl;},render(){throw Error('Observer rendered');},setAnimationLoop(){throw Error('Observer changed loop');}};
  context.__THREE_DEVTOOLS__.emit('observe',{detail:renderer});return{renderer,contextReads:()=>contextReads};};
 return{context,document,window,canvas,add,observe,api:context.__exteriorRendererLifecycle,canvasContextCalls:()=>canvasContextCalls,
  select:value=>{current=value;},mutate:(addedNodes,removedNodes)=>{for(const callback of mutations)callback([{addedNodes,removedNodes}]);}};
}
const glFixture=()=>({lost:false,reads:0,isContextLost(){this.reads++;return this.lost;},getContextAttributes(){return{antialias:false};}});

test('lifecycle starts before the canvas and records loss/restoration without creating or controlling a context',()=>{
 const f=fixture(),canvas=f.canvas(),gl=glFixture();f.add(canvas);const observed=f.observe(canvas,gl);
 const nativeRender=observed.renderer.render,nativeLoop=observed.renderer.setAnimationLoop;let prevented=0;
 for(const [type,lost] of [['webglcontextlost',true],['webglcontextrestored',false],['webglcontextcreationerror',false]]){
  gl.lost=lost;const event={target:canvas,isTrusted:true,defaultPrevented:false,statusMessage:type==='webglcontextcreationerror'?'driver unavailable':'',preventDefault(){prevented++;}};
  f.document.emit(type,event);canvas.emit(type,event);
 }
 const result=plain(f.api.snapshot());
 for(const type of ['webglcontextlost','webglcontextrestored','webglcontextcreationerror'])assert.equal(result.events.filter(e=>e.kind===type).length,1);
 assert.equal(result.events.find(e=>e.kind==='webglcontextlost').rendererContexts[0].context.isContextLost,true);
 assert.equal(result.events.find(e=>e.kind==='webglcontextrestored').rendererContexts[0].context.isContextLost,false);
 assert.equal(result.events.find(e=>e.kind==='webglcontextcreationerror').statusMessage,'driver unavailable');
 assert.equal(result.current.selectedCanvas.identity,result.current.renderers[0].canvas.identity);
 assert.deepEqual(result.errors,[]);assert.equal(prevented,0);assert.equal(f.canvasContextCalls(),0);assert.equal(observed.contextReads(),1);
 assert.equal(observed.renderer.render,nativeRender);assert.equal(observed.renderer.setAnimationLoop,nativeLoop);
 assert([...canvas.listeners.values()].flat().every(row=>row.options.passive===true));
});

test('capture journal distinguishes missing context, context loss, zero bitmap and a replaced selected canvas',()=>{
 const f=fixture(),canvas=f.canvas(),gl=glFixture();f.add(canvas);f.observe(canvas,gl);
 const reads=gl.reads;
 f.api.captureGuard(canvas,gl,{missingContext:false,contextLost:true,emptyBitmap:false});
 assert.equal(gl.reads,reads,'The exact guard observation must not reevaluate isContextLost');
 canvas.width=0;f.api.captureGuard(canvas,gl,{missingContext:false,contextLost:false,emptyBitmap:true});
 const replacement=f.canvas();f.select(replacement);f.api.captureGuard(replacement,null,{missingContext:true,contextLost:null,emptyBitmap:false});
 f.api.captureGuard(null,null,{missingContext:true,contextLost:null,emptyBitmap:null});
 const rows=plain(f.api.snapshot()).events.filter(e=>e.kind==='capture-guard');
 assert.deepEqual(rows.map(e=>e.predicates),[
  {missingContext:false,contextLost:true,emptyBitmap:false},{missingContext:false,contextLost:false,emptyBitmap:true},
  {missingContext:true,contextLost:null,emptyBitmap:false},{missingContext:true,contextLost:null,emptyBitmap:null}]);
 assert.equal(rows[1].canvas.width,0);assert.equal(rows[2].rendererMatches[0].canvas,false);assert.equal(rows[2].rendererMatches[0].context,false);
 assert.equal(rows[3].canvas,null);assert.equal(f.canvasContextCalls(),0);
});

test('lifecycle retains detached canvas events, page visibility and explicit bounded overflow',()=>{
 const f=fixture({limit:7}),canvas=f.canvas(),gl=glFixture();f.add(canvas);f.observe(canvas,gl);
 canvas.isConnected=false;f.select(null);f.mutate([], [canvas]);
 canvas.emit('webglcontextlost',{target:canvas,isTrusted:true});
 f.document.visibilityState='hidden';f.document.emit('visibilitychange');f.window.emit('pagehide',{persisted:true});
 for(let i=0;i<20;i++)f.window.emit('blur');
 const result=plain(f.api.snapshot());assert.equal(result.events.length,7);assert.equal(result.counts.events-result.events.length,result.counts.droppedEvents);
 assert(result.counts.droppedEvents>0);assert.equal(result.events.find(e=>e.kind==='canvas-removed').canvas.connected,false);
 assert.equal(result.events.find(e=>e.kind==='webglcontextlost').canvas.connected,false);assert.equal(result.current.visible,'hidden');
 assert.equal(result.current.selectedCanvas,null);assert.equal(f.canvasContextCalls(),0);
});

test('observer read errors are evidence, without throwing into original callbacks',()=>{
 const f=fixture(),canvas=f.canvas(),gl=glFixture();gl.isContextLost=()=>{throw Error('context query unavailable');};f.add(canvas);
 assert.doesNotThrow(()=>f.observe(canvas,gl));assert.doesNotThrow(()=>canvas.emit('webglcontextlost',{target:canvas}));
 const result=plain(f.api.snapshot());assert(result.errors.some(e=>e.message.includes('context query unavailable')));
 assert.equal(result.current.renderers[0].context.isContextLost,null);assert.equal(f.canvasContextCalls(),0);
});

test('Node journal retains log/warn/error and crash signals without replacing original error listeners',()=>{
 const page=new EventEmitter(),browser=new EventEmitter(),frame={url:()=> 'http://127.0.0.1/'},originalErrors=[];let clock=100;
 page.context=()=>({browser:()=>browser});page.mainFrame=()=>frame;
 page.on('console',message=>{if(message.type()==='error')originalErrors.push(message.text());});
 page.on('pageerror',error=>originalErrors.push(String(error)));
 const report=observeExteriorPageSignals(page,()=>++clock);
 for(const type of ['log','warning','error','debug'])page.emit('console',{type:()=>type,text:()=>type+' original message',location:()=>({url:'island.js',lineNumber:10,columnNumber:4})});
 page.emit('pageerror',new Error('original page error'));page.emit('crash');page.emit('framenavigated',frame);
 report.cleanupStartedAtMs=++clock;page.emit('close');browser.emit('disconnected');
 assert.deepEqual(report.events.filter(e=>e.kind==='console').map(e=>e.type),['log','warning','error']);
 assert.deepEqual(originalErrors,['error original message','Error: original page error']);
 assert(report.events.some(e=>e.kind==='crash'&&!e.cleanupStarted));assert(report.events.some(e=>e.kind==='close'&&e.cleanupStarted));
 assert(report.events.some(e=>e.kind==='browser-disconnected'&&e.cleanupStarted));assert.equal(report.observerErrors.length,0);
 assert(report.events.every((e,i)=>e.sequence===i+1));
});

test('Node signal failures and overflow cannot change existing acceptance listeners',()=>{
 const page=new EventEmitter();page.context=()=>({browser:()=>null});page.mainFrame=()=>null;
 const report=observeExteriorPageSignals(page,()=>1);let original=0;page.on('console',()=>original++);
 assert.doesNotThrow(()=>page.emit('console',{type:()=> 'log',text(){throw Error('message unreadable');}}));
 assert.equal(report.observerErrors.length,1);
 for(let i=0;i<4100;i++)page.emit('crash');assert.equal(report.events.length,report.limit);assert.equal(report.droppedEvents,4);
 assert.equal(original,1);
});

function paintedSource(source){const start=source.indexOf(' async function painted(){'),end=source.indexOf('\n async function capture(',start);assert(start>=0&&end>start);return source.slice(start,end);}
async function exercisePainted(source,mode,throwJournal=false){
 let lossReads=0,frames=0,fenceCalls=0,journalCalls=0,clock=0;
 const gl={RENDERER:1,SYNC_GPU_COMMANDS_COMPLETE:2,TIMEOUT_EXPIRED:3,ALREADY_SIGNALED:4,CONDITION_SATISFIED:5,
  isContextLost(){lossReads++;return mode==='lost'||(mode==='lost-after-guard'&&lossReads>1);},
  getExtension:()=>null,getParameter:()=> 'ANGLE Metal Renderer: Apple fixture',
  fenceSync(){fenceCalls++;return mode==='missing-fence'?null:{};},flush(){},deleteSync(){},clientWaitSync:()=>mode==='failed-fence'?0:4};
 const canvas=mode==='missing-canvas'?null:{width:mode==='zero-width'?0:844,height:mode==='zero-height'?0:390,getContext:()=>mode==='missing-context'?null:gl};
 const context=vm.createContext({document:{querySelector:selector=>{assert.equal(selector,'#game');return canvas;}},
  window:{__exteriorRendererLifecycle:{captureGuard(){journalCalls++;if(throwJournal)throw Error('diagnostic unavailable');}}},
  performance:{now:()=>++clock},setTimeout:()=>1,clearTimeout(){},cancelAnimationFrame(){},
  requestAnimationFrame:fn=>{frames++;queueMicrotask(fn);return frames;},page:{evaluate:fn=>fn()}});
 const run=vm.runInContext('('+paintedSource(source).replace(' async function painted','async function painted')+')',context);
 let value,error;try{value=plain(await run());}catch(e){error=e.message;}
 return{value,error,lossReads,frames,fenceCalls,journalCalls};
}

test('actual generated capture guard preserves original decisions, GL calls and fence flow', {skip:!process.env.STAGED_LANDMARK_GAME_DIR},async()=>{
 const work=await mkdtemp(resolve(tmpdir(),'exterior-lifecycle-guard-'));
 try{
  const game=process.env.STAGED_LANDMARK_GAME_DIR,receipt=await buildDriver({game,out:work});
  const derived=await readFile(receipt.output,'utf8'),original=await readFile(resolve(game,'scripts/staged-landmark-walk-proof.mjs'),'utf8');
  for(const mode of ['missing-canvas','missing-context','lost','zero-width','zero-height','live','lost-after-guard','missing-fence','failed-fence']){
   const expected=await exercisePainted(original,mode);
   for(const throws of [false,true]){
    const actual=await exercisePainted(derived,mode,throws);
    assert.equal(actual.journalCalls,1);delete actual.journalCalls;delete expected.journalCalls;
    assert.deepEqual(actual,expected,mode+' / observer throws '+throws);
   }
  }
  const span=(s,a,b)=>s.slice(s.indexOf(a),s.indexOf(b,s.indexOf(a)));
  assert.equal(span(derived,' async function waitMotion(',' async function dismount('),span(original,' async function waitMotion(',' async function dismount('));
  assert(derived.includes("await focusCanvas();await frames(3);"));assert(derived.includes('const CASE_MS=32*60_000;'));
 }finally{await rm(work,{recursive:true,force:true});}
});
