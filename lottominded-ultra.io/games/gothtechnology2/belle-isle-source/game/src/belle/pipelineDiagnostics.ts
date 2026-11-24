/** Manual-only wall-clock observations of existing callbacks and native sync calls.
 * This observer never polls a fence, creates GPU work, or changes loop admission. */
import {gpuFramePacingDiagnostics} from './gpuFramePacing.ts';

type Callable=(this:unknown,...args:unknown[])=>unknown;
type Hook={target:object;name:string;own:PropertyDescriptor|undefined;wrapper:Callable};
type Poll={eventId:number;callbackId:number|null;enteredWallMs:number|null;exitedWallMs:number|null;resultCode:number|null};
type Fence={id:number;createdCapture:number;createdCallbackId:number|null;createdEnteredWallMs:number|null;createdExitedWallMs:number|null;
 imported:boolean;timeouts:number;lastTimeout:Poll|null;firstSignaled:Poll|null;failed:Poll|null;deletedWallMs:number|null;disposition:string};
type CallbackRow={id:number;capture:number;originalTimestampMs:number|null;enteredWallMs:number|null;exitedWallMs:number|null;
 gameEnteredWallMs:number|null;gameExitedWallMs:number|null;gameCalls:number;eligible:boolean|null;outcome:string;gateCallback:number|null;
 pendingBefore:number|null;pendingAfter:number|null;renderedDelta:number|null;submittedDelta:number|null;completedDelta:number|null;error:string|null};
type SyncRow=Poll&{method:string;fenceId:number|null;condition:number|null;flags:number|null;timeoutNs:number|null;result:string;error:string|null};
export const PIPELINE_DIAGNOSTIC_LIMITS=Object.freeze({callbacks:8192,syncEvents:32768,finishedFences:8192,trackedFences:64,lifecycleEvents:64,errors:20});

class Ring<T>{
 private rows:T[]=[];private cursor=0;dropped=0;private limit:number;
 constructor(limit:number){this.limit=limit;}
 push(row:T){if(this.rows.length<this.limit)this.rows.push(row);else{this.rows[this.cursor]=row;this.cursor=(this.cursor+1)%this.limit;this.dropped++;}}
 values(){return this.rows.length<this.limit?this.rows.slice():[...this.rows.slice(this.cursor),...this.rows.slice(0,this.cursor)];}
 clear(){this.rows=[];this.cursor=0;this.dropped=0;}
}
const object=(v:unknown):v is object=>v!==null&&(typeof v==='object'||typeof v==='function');
const numeric=(v:unknown)=>typeof v==='number'&&Number.isFinite(v)?v:null;
const counterDelta=(after:unknown,before:unknown)=>{const a=numeric(after),b=numeric(before);return a!==null&&b!==null?a-b:null;};
const copy=<T>(value:T):T=>JSON.parse(JSON.stringify(value));
const message=(value:unknown)=>{try{return String(value).slice(0,220);}catch{return 'unprintable error';}};

export function pipelineDiagnosticRequested(target:{hostname:string;search:string}){
 const query=new URLSearchParams(target.search);
 return ['localhost','127.0.0.1','[::1]'].includes(target.hostname)&&query.get('profile')==='manual'&&query.get('pipelineProbe')==='1';
}

/** Install BEFORE the existing gate, so the native loop wrapper sees skipped as
 * well as executed callbacks. runGameFrame only marks the original game body. */
export class ManualPipelineProbe {
 private renderer:object;private now:()=>number;private gl:object|undefined;
 private hooks:Hook[]=[];private hookStatus:{name:string;status:string}[]=[];
 private running=false;private disposed=false;private capture=0;private callbackId=0;private eventId=0;private fenceId=0;
 private startedWallMs:number|null=null;private stoppedWallMs:number|null=null;
 private current:CallbackRow|undefined;private errors:string[]=[];private observerErrors=0;
 private callbacks=new Ring<CallbackRow>(PIPELINE_DIAGNOSTIC_LIMITS.callbacks);
 private syncEvents=new Ring<SyncRow>(PIPELINE_DIAGNOSTIC_LIMITS.syncEvents);
 private finishedFences=new Ring<Fence>(PIPELINE_DIAGNOSTIC_LIMITS.finishedFences);
 private lifecycleEvents=new Ring<{kind:string;wallMs:number|null;callbackId:number|null}>(PIPELINE_DIAGNOSTIC_LIMITS.lifecycleEvents);
 private identities=new WeakMap<object,Fence>();private pending=new Map<number,Fence>();private pendingAtStart:Fence[]=[];
 private counts=this.newCounts();private pacingAtStart:unknown=null;
 private frozen:ReturnType<ManualPipelineProbe['readSnapshot']>|undefined;
 private canvas:EventTarget|undefined;
 private onContextLost=()=>this.contextChanged('context-lost');
 private onContextRestored=()=>this.contextChanged('context-restored');
 constructor(renderer:object,now:()=>number=()=>performance.now()){
  this.renderer=renderer;this.now=now;
  this.observe('install',()=>{
   const getContext=Reflect.get(renderer,'getContext');
   if(typeof getContext==='function'){const gl=Reflect.apply(getContext,renderer,[]);if(object(gl))this.gl=gl;}
   this.install(renderer,'setAnimationLoop',(original,self,args)=>{
    if(this.disposed||typeof args[0]!=='function')return Reflect.apply(original,self,args);
    const callback=args[0] as Callable,probe=this;
    const wrapped:Callable=function(...callbackArgs){return probe.animation(callback,this,callbackArgs);};
    return Reflect.apply(original,self,[wrapped,...args.slice(1)]);
   });
   for(const name of ['fenceSync','clientWaitSync','deleteSync'])
    this.install(this.gl,name,(original,self,args)=>this.sync(name,original,self,args));
   const canvas=Reflect.get(renderer,'domElement');
   if(canvas&&typeof canvas.addEventListener==='function'&&typeof canvas.removeEventListener==='function'){
    this.canvas=canvas;canvas.addEventListener('webglcontextlost',this.onContextLost);canvas.addEventListener('webglcontextrestored',this.onContextRestored);
   }
  });
 }
 private newCounts(){return {callbacks:0,executedCallbacks:0,pendingFenceSkippedCallbacks:0,contextLostSkippedCallbacks:0,unknownSkippedCallbacks:0,
  callbackErrors:0,fenceSyncCalls:0,clientWaitSyncCalls:0,deleteSyncCalls:0,nativeSyncErrors:0,timeouts:0,signaled:0,waitFailed:0,unknownWaitResults:0,untrackedFences:0};}
 private error(stage:string,error:unknown){this.observerErrors++;if(this.errors.length<PIPELINE_DIAGNOSTIC_LIMITS.errors)this.errors.push(stage+': '+message(error));}
 private observe<T>(stage:string,call:()=>T):T|undefined{try{return call();}catch(error){this.error(stage,error);return;}}
 private wall(){return this.observe('clock',()=>numeric(this.now()))??null;}
 private pacing(){return this.observe('pacing-snapshot',()=>gpuFramePacingDiagnostics(this.renderer))??null;}
 private install(target:object|undefined,name:string,invoke:(original:Callable,self:unknown,args:unknown[])=>unknown){
  const status={name,status:'missing'};this.hookStatus.push(status);if(!target)return;
  try{
   const original=Reflect.get(target,name);if(typeof original!=='function')return;
   const own=Object.getOwnPropertyDescriptor(target,name),wrapper:Callable=function(...args){return invoke(original,this,args);};
   Object.defineProperty(target,name,{configurable:true,writable:true,enumerable:own?.enumerable??false,value:wrapper});
   this.hooks.push({target,name,own,wrapper});status.status='installed';
  }catch(error){status.status='failed';this.error('install-'+name,error);}
 }
 private animation(original:Callable,self:unknown,args:unknown[]){
  if(!this.running||this.disposed)return Reflect.apply(original,self,args);
  const enteredWallMs=this.wall(),prior=this.current,before=this.pacing();
  const row=this.observe('callback-begin',()=>{
   const value:CallbackRow={id:++this.callbackId,capture:this.capture,originalTimestampMs:numeric(args[0]),enteredWallMs,exitedWallMs:null,
    gameEnteredWallMs:null,gameExitedWallMs:null,gameCalls:0,eligible:null,outcome:'unfinished',gateCallback:null,
    pendingBefore:before?.pendingCallbacks??null,pendingAfter:null,renderedDelta:null,submittedDelta:null,completedDelta:null,error:null};
   this.current=value;this.counts.callbacks++;return value;
  });
  let threw=false,error:unknown;
  try{return Reflect.apply(original,self,args);}catch(value){threw=true;error=value;throw value;}
  finally{
   this.observe('callback-end',()=>{
    if(!row)return;
    row.exitedWallMs=this.wall();const after=this.pacing();row.gateCallback=after?.animationCallbacks??null;row.pendingAfter=after?.pendingCallbacks??null;
    if(before&&after){
     row.renderedDelta=counterDelta(after.renderedCallbacks,before.renderedCallbacks);
     row.submittedDelta=counterDelta(after.submittedCallbacks,before.submittedCallbacks);
     row.completedDelta=counterDelta(after.completedCallbacks,before.completedCallbacks);
    }
    if(threw){row.outcome='error';row.error=message(error);this.counts.callbackErrors++;}
    else if(row.gameCalls){row.outcome=before&&after&&after.xrCallbacks>before.xrCallbacks?'xr':row.submittedDelta===0?'executed-no-fence':'executed';}
    else if(before&&after&&after.pendingFenceSkippedCallbacks>before.pendingFenceSkippedCallbacks){row.outcome='pending-fence';this.counts.pendingFenceSkippedCallbacks++;}
    else if(before&&after&&after.contextLostSkippedCallbacks>before.contextLostSkippedCallbacks){row.outcome='context-lost';this.counts.contextLostSkippedCallbacks++;}
    else{row.outcome='unobserved-game-body';this.counts.unknownSkippedCallbacks++;}
    if(row.gameCalls)this.counts.executedCallbacks++;
    if(row.capture===this.capture)this.callbacks.push(row);
   });
   this.current=prior;
  }
 }
 runGameFrame<T>(callback:()=>T,eligible:boolean):T{
  const row=this.running&&!this.disposed?this.current:undefined;
  this.observe('game-begin',()=>{if(row){row.gameCalls++;row.eligible=eligible;row.gameEnteredWallMs??=this.wall();}});
  try{return callback();}finally{this.observe('game-end',()=>{if(row)row.gameExitedWallMs=this.wall();});}
 }
 private identity(value:unknown,created:boolean,entered:number|null,exited:number|null){
  if(!object(value))return;
  const existing=this.identities.get(value);if(existing)return existing;
  if(this.pending.size>=PIPELINE_DIAGNOSTIC_LIMITS.trackedFences){if(this.running)this.counts.untrackedFences++;return;}
  const fence:Fence={id:++this.fenceId,createdCapture:this.running?this.capture:0,createdCallbackId:created?this.current?.id??null:null,
   createdEnteredWallMs:created?entered:null,createdExitedWallMs:created?exited:null,imported:!created,timeouts:0,lastTimeout:null,firstSignaled:null,failed:null,deletedWallMs:null,disposition:'pending'};
  this.identities.set(value,fence);this.pending.set(fence.id,fence);return fence;
 }
 private sync(name:string,original:Callable,self:unknown,args:unknown[]){
  if(this.disposed)return Reflect.apply(original,self,args);
  const entered=this.wall();let result:unknown,threw=false,error:unknown;
  try{result=Reflect.apply(original,self,args);return result;}catch(value){threw=true;error=value;throw value;}
  finally{this.observe('sync-'+name,()=>{
   const exited=this.wall(),eventId=++this.eventId,callbackId=this.current?.id??null;
   const fence=name==='fenceSync'?!threw?this.identity(result,true,entered,exited):undefined:this.identity(args[0],false,entered,exited);
   const row:SyncRow={eventId,callbackId,enteredWallMs:entered,exitedWallMs:exited,method:name,fenceId:fence?.id??null,
    condition:name==='fenceSync'?numeric(args[0]):null,flags:name==='deleteSync'?null:numeric(args[1]),timeoutNs:name==='clientWaitSync'?numeric(args[2]):null,
    resultCode:name==='clientWaitSync'?numeric(result):null,result:threw?'threw':name==='fenceSync'?object(result)?'created':'null':name==='deleteSync'?'deleted':'unknown',error:threw?message(error):null};
   if(this.running){if(name==='fenceSync')this.counts.fenceSyncCalls++;else if(name==='clientWaitSync')this.counts.clientWaitSyncCalls++;else this.counts.deleteSyncCalls++;if(threw)this.counts.nativeSyncErrors++;}
   if(name==='clientWaitSync'&&!threw&&typeof result==='number'){
    const poll:Poll={eventId,callbackId,enteredWallMs:entered,exitedWallMs:exited,resultCode:numeric(result)};
    if(result===Reflect.get(this.gl!,'TIMEOUT_EXPIRED')){row.result='timeout';if(fence){fence.timeouts++;fence.lastTimeout=poll;}if(this.running)this.counts.timeouts++;}
    else if(result===Reflect.get(this.gl!,'ALREADY_SIGNALED')||result===Reflect.get(this.gl!,'CONDITION_SATISFIED')){row.result='signaled';if(fence)fence.firstSignaled??=poll;if(this.running)this.counts.signaled++;}
    else if(result===Reflect.get(this.gl!,'WAIT_FAILED')){row.result='wait-failed';if(fence)fence.failed=poll;if(this.running)this.counts.waitFailed++;}
    else if(this.running)this.counts.unknownWaitResults++;
   }
   if(name==='deleteSync'&&!threw&&fence){fence.deletedWallMs=exited;fence.disposition=fence.firstSignaled?'deleted-after-signaled':fence.failed?'deleted-after-wait-failed':'deleted-without-observed-signal';this.pending.delete(fence.id);if(this.running)this.finishedFences.push(copy(fence));}
   if(this.running)this.syncEvents.push(row);
  });}
 }
 private contextChanged(kind:string){this.observe(kind,()=>{
  const wallMs=this.wall();
  if(this.running)this.lifecycleEvents.push({kind,wallMs,callbackId:this.current?.id??null});
  for(const fence of this.pending.values()){fence.disposition=kind;if(this.running)this.finishedFences.push(copy(fence));}
  this.pending.clear();this.identities=new WeakMap();
 });}
 startCapture(){
  if(this.disposed)return;
  this.capture++;this.frozen=undefined;this.counts=this.newCounts();this.callbacks.clear();this.syncEvents.clear();this.finishedFences.clear();this.lifecycleEvents.clear();
  this.pendingAtStart=copy([...this.pending.values()]);this.pacingAtStart=this.pacing();this.startedWallMs=this.wall();this.stoppedWallMs=null;this.running=true;
 }
 stopCapture(){this.stoppedWallMs=this.wall();this.running=false;this.frozen=this.readSnapshot();return copy(this.frozen);}
 snapshot(){return this.frozen?copy(this.frozen):this.readSnapshot();}
 private readSnapshot(){
  const hooks=this.hookStatus.map(x=>({...x})),complete=hooks.length===4&&hooks.every(x=>x.status==='installed');
  return {version:1,status:this.disposed?'disposed':this.running?'capturing':'stopped',capture:this.capture,
   clock:'performance.now() milliseconds in the page time origin; originalTimestampMs is the unchanged browser animation timestamp',
   startedWallMs:this.startedWallMs,stoppedWallMs:this.stoppedWallMs,limits:{...PIPELINE_DIAGNOSTIC_LIMITS},coverage:{complete,hooks,gameBodyMarkers:this.counts.executedCallbacks},
   counts:{...this.counts},observerErrors:this.observerErrors,errors:[...this.errors],
   dropped:{callbacks:this.callbacks.dropped,syncEvents:this.syncEvents.dropped,finishedFences:this.finishedFences.dropped,lifecycleEvents:this.lifecycleEvents.dropped},
   pacing:{atStart:copy(this.pacingAtStart),atFinish:this.pacing()},callbacks:copy(this.callbacks.values()),syncEvents:copy(this.syncEvents.values()),
   fences:{atStart:copy(this.pendingAtStart),finished:copy(this.finishedFences.values()),pending:copy([...this.pending.values()])},lifecycleEvents:copy(this.lifecycleEvents.values()),
   activeCallback:this.current?copy(this.current):null,
   notes:[
    'Manual local observer only. All original animation, game-body and WebGL calls keep their receiver, arguments, return values and exceptions. This ledger issues no additional native sync call, flush, timer query, draw or readback.',
    'Callback entry/exit and native call entry/exit are CPU wall times. They include observer overhead and are not GPU execution or display/present timings. gateCallback matches the existing lifetime animation callback counter.',
    'renderedDelta counts non-XR callbacks that changed the existing renderer counter while the loop remained active; submittedDelta counts application fence submissions. Neither proves GPU completion or presentation. executed-no-fence may contain a render, and eligibility alone does not prove a render. Unknown queue/completion fields remain null, including completedDelta in browser mode.',
    'Each fence retains its last TIMEOUT_EXPIRED observation and first signaled observation. Their call entry/exit bounds bracket when those statuses were observed, not the physical GPU completion time; native status propagation can lag GPU work. No signal before deletion is reported as unknown, never successful completion.',
    'A fence created before Start remains in atStart. Context events discard stale identities without touching native objects. Bounded rings retain the newest events; dropped counts and partial hook coverage must be checked before drawing causal conclusions.',
   ]};
 }
 dispose(){
  if(this.disposed)return;this.running=false;this.disposed=true;
  this.canvas?.removeEventListener('webglcontextlost',this.onContextLost);this.canvas?.removeEventListener('webglcontextrestored',this.onContextRestored);
  for(const hook of this.hooks)this.observe('restore-'+hook.name,()=>{
   if(Object.getOwnPropertyDescriptor(hook.target,hook.name)?.value!==hook.wrapper)return;
   if(hook.own)Object.defineProperty(hook.target,hook.name,hook.own);else Reflect.deleteProperty(hook.target,hook.name);
  });
 }
}
