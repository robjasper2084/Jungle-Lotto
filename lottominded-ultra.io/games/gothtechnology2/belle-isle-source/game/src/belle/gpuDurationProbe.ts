/** Opt-in asynchronous diagnostics. Frame admission is unchanged; no explicit GPU wait or render is added. */
export const GPU_DURATION_LIMITS={sampleEvery:7,maxIssued:256,maxPending:4} as const;
export const GPU_DURATION_API_WALL_LIMIT=12;
export const GPU_DURATION_API_STAGES=['issue.drawingBufferWidth','issue.drawingBufferHeight','issue.drawFramebufferBinding','issue.samples',
 'issue.sampleBuffers','issue.createQuery','issue.beginQuery','issue.ownershipAfterBegin','close.ownership','close.endQuery'] as const;
export const GPU_DURATION_API_WALL_NOTE='Per-call elapsed wall time from separate performance.now reads, not pure CPU execution time or proof of a GPU cause. Scheduling, driver/process communication and synchronization can contribute. These non-overlapping call scopes overlap the legacy callback or query-bracket intervals; close scopes occur after cpuEndMs but within a completed query bracket. Never add child scopes to their containing intervals. Legacy issuedCpuTimeMs remains before the metadata reads and beginQuery, and queryBracketCpuMs keeps that original origin. Initialization, result polling, ordinary scene work and callbacks issuing no query are not individually timed; cpuStartMs to issuedCpuTimeMs remains the broad pre-issue interval. Only issued samples retain call receipts; failures before query allocation have no sample. Invalid/throwing clock reads retain null durations and explicit errors. Cleanup calls are separately marked and bounded; dropped receipts are counted. No additional GL calls or explicit waits are made.';
export const GPU_DURATION_NOTE='Diagnostic only, not release acceptance. Queries surround sky/world updates through the final scene render/copy in sampled eligible recorded callbacks. Elapsed GPU-command intervals can include gaps while the CPU supplies commands; they exclude earlier queue delay and browser composition/presentation, and are not pure GPU busy time. CPU timings include observer overhead and overlap GPU work; do not add them or subtract their percentiles. Next-callback intervals are associations, not proof of cause. RAF timestamps and performance.now timestamps have different callback timing semantics. Counts and samples are bounded lifetime observations; compare settingsAtStart for repeated captures. Snapshots never poll GL; unresolved queries at capture stop are not zero-duration results. No locations, headings, inputs or account data are collected.';
export const gpuDurationEnabled=(search:string)=>new URLSearchParams(search).get('gpu-duration')==='1';
export const gpuDurationContextExcluded=(context:{xr:boolean;coop:boolean;reducedScene:boolean;following:boolean;locationState:string|undefined})=>
 context.xr||context.coop||context.reducedScene||context.following||(context.locationState!==undefined&&context.locationState!=='off');

type TimerExtension={TIME_ELAPSED_EXT:number;QUERY_COUNTER_BITS_EXT:number;GPU_DISJOINT_EXT:number};
type Context=Pick<WebGL2RenderingContext,'getExtension'|'getQuery'|'getParameter'|'getQueryParameter'|'createQuery'|'deleteQuery'|'beginQuery'|'endQuery'|'isContextLost'|'getContextAttributes'|'drawingBufferWidth'|'drawingBufferHeight'|'CURRENT_QUERY'|'QUERY_RESULT_AVAILABLE'|'QUERY_RESULT'|'DRAW_FRAMEBUFFER_BINDING'|'SAMPLES'|'SAMPLE_BUFFERS'|'VENDOR'|'RENDERER'|'VERSION'>;
type ContextSource=Context|WebGLRenderingContext;
export interface GpuDurationFrameStart {rafTimeMs:number;cpuStartMs:number;recording:boolean;eligible:boolean;excluded:boolean;}
export interface GpuDurationFrameEnd {cpuEndMs:number;renderSubmitCpuMs:number;eligible:boolean;drawCalls:number;triangles:number;renderPasses:number;shadowUpdateRequested:boolean;}
type Association={callback:number;rafTimeMs:number;intervalMs:number;eligible:boolean};
export interface GpuDurationApiWallCall {
 stage:typeof GPU_DURATION_API_STAGES[number];phase:'issue'|'end'|'cleanup';
 startMs:number|null;endMs:number|null;wallMs:number|null;outcome:'returned'|'threw';
 clockErrors:('start-threw'|'start-invalid'|'end-threw'|'end-invalid'|'regressed')[];
}
type ApiWall={calls:GpuDurationApiWallCall[];dropped:number};
export interface GpuDurationSample {
 sample:number;callback:number;eligibleCallback:number;rafTimeMs:number;cpuStartMs:number;issuedCpuTimeMs:number;
 cpuEndMs:number|null;cpuElapsedMs:number|null;renderSubmitCpuMs:number|null;queryBracketCpuMs:number|null;
 drawCalls:number|null;triangles:number|null;renderPasses:number|null;shadowUpdateRequested:boolean|null;
 drawingBuffer:{width:number;height:number};framebuffer:{defaultBound:boolean;samples:number|null;sampleBuffers:number|null};
 status:'pending'|'valid'|'rejected';rejectionReason:string|null;gpuNanoseconds:number|null;gpuMs:number|null;
 resultCallback:number|null;resolutionDelayCallbacks:number|null;resolutionDelayCpuMs:number|null;
 nextAdmittedCallback:Association|null;nextEligibleCallback:Association|null;association:'waiting'|'paired'|'interrupted';
 apiWall:ApiWall;
}
type Pending={query:WebGLQuery;row:GpuDurationSample};
const finite=(value:unknown):value is number=>typeof value==='number'&&Number.isFinite(value);
const nonnegative=(value:unknown):value is number=>finite(value)&&value>=0;
const parameterNumber=(value:unknown)=>nonnegative(value)?value:null;
const parameterText=(value:unknown)=>typeof value==='string'?value.slice(0,512):null;

/** The disabled factory does not even acquire a context or read its properties. */
export function createGpuDurationProbe(enabled:boolean,getContext:()=>ContextSource,clock:()=>number=()=>performance.now(),apiClock:()=>number=()=>performance.now()){
 return enabled?new GpuDurationProbe(getContext,clock,apiClock):undefined;
}

export class GpuDurationProbe {
 private gl:Context|undefined;private ext:TimerExtension|undefined;
 private status:'waiting'|'ready'|'unsupported'|'context-lost'|'error'|'disposed'='waiting';
 private capability={extension:'EXT_disjoint_timer_query_webgl2',available:null as boolean|null,counterBits:null as number|null};
 private backend:{vendor:string|null;renderer:string|null;version:string|null;antialias:boolean|null}|null=null;
 private pending:Pending[]=[];private active:Pending|undefined;private waitingAssociation:GpuDurationSample|undefined;
 private completingAssociation:GpuDurationSample|undefined;
 private rows:GpuDurationSample[]=[];
 private counts={admittedCallbacks:0,eligibleCallbacks:0,issued:0,valid:0,rejected:0,pendingPeak:0,disjointEvents:0,contextLosses:0,errors:0,interruptedAssociations:0};
 private skips={notRecording:0,ineligible:0,excluded:0,cadence:0,limit:0,pendingLimit:0,foreignQuery:0,invalidClock:0,unsupported:0};
 private rejectionReasons:Record<string,number>={};
 private getContext:()=>ContextSource;private clock:()=>number;private apiClock:()=>number;
 constructor(getContext:()=>ContextSource,clock:()=>number=()=>performance.now(),apiClock:()=>number=()=>performance.now()){
  this.getContext=getContext;this.clock=clock;this.apiClock=apiClock;
 }

 private readApiClock(){
  try{const value=this.apiClock();return nonnegative(value)?{value,error:null}:{value:null,error:'invalid' as const};}
  catch{return{value:null,error:'threw' as const};}
 }
 /** Timing failures cannot suppress a GL call or replace its original exception. */
 private apiCall<T>(timing:ApiWall,stage:GpuDurationApiWallCall['stage'],phase:GpuDurationApiWallCall['phase'],operation:()=>T):T{
  if(timing.calls.length>=GPU_DURATION_API_WALL_LIMIT){timing.dropped++;return operation();}
  const start=this.readApiClock();let outcome:GpuDurationApiWallCall['outcome']='threw';
  try{const value=operation();outcome='returned';return value;}
  finally{
   const end=this.readApiClock(),clockErrors:GpuDurationApiWallCall['clockErrors']=[];
   if(start.error)clockErrors.push(start.error==='threw'?'start-threw':'start-invalid');
   if(end.error)clockErrors.push(end.error==='threw'?'end-threw':'end-invalid');
   if(start.value!==null&&end.value!==null&&end.value<start.value)clockErrors.push('regressed');
   timing.calls.push({stage,phase,startMs:start.value,endMs:end.value,
    wallMs:clockErrors.length||start.value===null||end.value===null?null:end.value-start.value,outcome,clockErrors});
  }
 }

 private initialize(){
  if(this.status!=='waiting')return this.status==='ready';
  const context=this.getContext();
  if(!['getQuery','getQueryParameter','createQuery','deleteQuery','beginQuery','endQuery'].every(name=>typeof (context as unknown as Record<string,unknown>)[name]==='function')){
   this.capability.available=false;this.status='unsupported';return false;
  }
  const gl=this.gl=context as Context;
  if(gl.isContextLost()){this.contextLost();return false;}
  const ext=gl.getExtension('EXT_disjoint_timer_query_webgl2') as TimerExtension|null;
  this.capability.available=!!ext;
  if(!ext||![ext.TIME_ELAPSED_EXT,ext.QUERY_COUNTER_BITS_EXT,ext.GPU_DISJOINT_EXT].every(finite)){
   this.status='unsupported';return false;
  }
  const bits=gl.getQuery(ext.TIME_ELAPSED_EXT,ext.QUERY_COUNTER_BITS_EXT) as unknown;
  this.capability.counterBits=finite(bits)?bits:null;
  if(!Number.isSafeInteger(bits)||!finite(bits)||bits<=0){this.status='unsupported';return false;}
  this.ext=ext;
  const debug=gl.getExtension('WEBGL_debug_renderer_info') as {UNMASKED_VENDOR_WEBGL:number;UNMASKED_RENDERER_WEBGL:number}|null;
  this.backend={vendor:parameterText(gl.getParameter(debug?.UNMASKED_VENDOR_WEBGL??gl.VENDOR)),
   renderer:parameterText(gl.getParameter(debug?.UNMASKED_RENDERER_WEBGL??gl.RENDERER)),version:parameterText(gl.getParameter(gl.VERSION)),
   antialias:gl.getContextAttributes()?.antialias??null};
  this.status='ready';return true;
 }
 private deleteQuery(query:WebGLQuery){try{this.gl?.deleteQuery(query);}catch{this.counts.errors++;}}
 private reject(item:Pending,reason:string){
  if(item.row.status!=='pending')return;
  item.row.status='rejected';item.row.rejectionReason=reason;this.counts.rejected++;
  this.rejectionReasons[reason]=(this.rejectionReasons[reason]??0)+1;this.deleteQuery(item.query);
 }
 /** End only the query we own. Never end a foreign elapsed query. */
 private close(item:Pending,phase:'end'|'cleanup'){
  const gl=this.gl!,ext=this.ext!;
  if(this.apiCall(item.row.apiWall,'close.ownership',phase,()=>gl.getQuery(ext.TIME_ELAPSED_EXT,gl.CURRENT_QUERY))!==item.query)return false;
  this.apiCall(item.row.apiWall,'close.endQuery',phase,()=>gl.endQuery(ext.TIME_ELAPSED_EXT));return true;
 }
 private fail(){
  this.counts.errors++;this.status='error';
  if(this.active){const item=this.active;this.active=undefined;try{this.close(item,'cleanup');}catch{}this.reject(item,'observer-error');}
  for(const item of this.pending)this.reject(item,'observer-error');this.pending=[];this.breakAssociation();
 }
 private disjoint(){
  this.counts.disjointEvents++;
  for(const item of this.pending)this.reject(item,'disjoint');this.pending=[];
 }
 /** Must only be called after an existing frame gate admits a callback. */
 beginFrame(frame:GpuDurationFrameStart){
  try{
   if(this.status==='disposed')return;
   if(this.active)this.cancelFrame();
   const callback=++this.counts.admittedCallbacks;
   const eligible=frame.recording&&frame.eligible&&!frame.excluded;
   const previous=this.waitingAssociation;
   if(previous){
    const interval=frame.rafTimeMs-previous.rafTimeMs;
    if(frame.recording&&!frame.excluded&&finite(interval)&&interval>0){
     previous.nextAdmittedCallback={callback,rafTimeMs:frame.rafTimeMs,intervalMs:interval,eligible};
     if(eligible){this.completingAssociation=previous;this.waitingAssociation=undefined;}
     else this.breakAssociation();
    }else this.breakAssociation();
   }
   if(!frame.recording){this.skips.notRecording++;return;}
   if(frame.excluded){this.skips.excluded++;return;}
   if(!frame.eligible){this.skips.ineligible++;return;}
   if(!nonnegative(frame.rafTimeMs)||!nonnegative(frame.cpuStartMs)){this.skips.invalidClock++;this.breakAssociation();return;}
   const eligibleCallback=++this.counts.eligibleCallbacks,opportunity=eligibleCallback%GPU_DURATION_LIMITS.sampleEvery===0;
   if(!opportunity&&!this.pending.length){this.skips.cadence++;return;}
   if(this.counts.issued>=GPU_DURATION_LIMITS.maxIssued&&!this.pending.length){this.skips.limit++;return;}
   if(!this.initialize()){this.skips.unsupported++;return;}
   const gl=this.gl!,ext=this.ext!;
   if(gl.isContextLost()){this.contextLost();return;}
   // Query and disjoint state belong to the context, including other observers.
   if(gl.getQuery(ext.TIME_ELAPSED_EXT,gl.CURRENT_QUERY)!==null){this.skips.foreignQuery++;return;}
   const available=this.pending.filter(item=>item.row.callback<callback&&gl.getQueryParameter(item.query,gl.QUERY_RESULT_AVAILABLE)===true);
   if(gl.getParameter(ext.GPU_DISJOINT_EXT)===true){this.disjoint();return;}
   for(const item of available){
    const ns=gl.getQueryParameter(item.query,gl.QUERY_RESULT) as unknown;
    const resolved=this.clock();
    item.row.resultCallback=callback;item.row.resolutionDelayCallbacks=callback-item.row.callback;
    item.row.resolutionDelayCpuMs=finite(resolved)&&resolved>=item.row.issuedCpuTimeMs?resolved-item.row.issuedCpuTimeMs:null;
    if(!finite(ns)||!Number.isSafeInteger(ns)||ns<=0)this.reject(item,'invalid-result');
    else{item.row.status='valid';item.row.gpuNanoseconds=ns;item.row.gpuMs=ns/1e6;this.counts.valid++;this.deleteQuery(item.query);}
   }
   this.pending=this.pending.filter(item=>item.row.status==='pending');
   if(!opportunity){this.skips.cadence++;return;}
   if(this.counts.issued>=GPU_DURATION_LIMITS.maxIssued){this.skips.limit++;return;}
   if(this.pending.length>=GPU_DURATION_LIMITS.maxPending){this.skips.pendingLimit++;return;}
   const issued=this.clock();
   if(!nonnegative(issued)||issued<frame.cpuStartMs){this.skips.invalidClock++;return;}
   const apiWall:ApiWall={calls:[],dropped:0};
   const width=this.apiCall(apiWall,'issue.drawingBufferWidth','issue',()=>gl.drawingBufferWidth),
    height=this.apiCall(apiWall,'issue.drawingBufferHeight','issue',()=>gl.drawingBufferHeight);
   const framebuffer={defaultBound:this.apiCall(apiWall,'issue.drawFramebufferBinding','issue',()=>gl.getParameter(gl.DRAW_FRAMEBUFFER_BINDING))===null,
    samples:parameterNumber(this.apiCall(apiWall,'issue.samples','issue',()=>gl.getParameter(gl.SAMPLES))),
    sampleBuffers:parameterNumber(this.apiCall(apiWall,'issue.sampleBuffers','issue',()=>gl.getParameter(gl.SAMPLE_BUFFERS)))};
   const query=this.apiCall(apiWall,'issue.createQuery','issue',()=>gl.createQuery());
   if(!query){this.fail();return;}
   const row:GpuDurationSample={sample:++this.counts.issued,callback,eligibleCallback,rafTimeMs:frame.rafTimeMs,cpuStartMs:frame.cpuStartMs,issuedCpuTimeMs:issued,
    cpuEndMs:null,cpuElapsedMs:null,renderSubmitCpuMs:null,queryBracketCpuMs:null,drawCalls:null,triangles:null,renderPasses:null,shadowUpdateRequested:null,
    drawingBuffer:{width,height},framebuffer,apiWall,status:'pending',rejectionReason:null,gpuNanoseconds:null,gpuMs:null,
    resultCallback:null,resolutionDelayCallbacks:null,resolutionDelayCpuMs:null,nextAdmittedCallback:null,nextEligibleCallback:null,association:'waiting'};
   this.rows.push(row);this.active={query,row};this.waitingAssociation=row;
   this.counts.pendingPeak=Math.max(this.counts.pendingPeak,this.pending.length+1);
   this.apiCall(apiWall,'issue.beginQuery','issue',()=>gl.beginQuery(ext.TIME_ELAPSED_EXT,query));
   if(this.apiCall(apiWall,'issue.ownershipAfterBegin','issue',()=>gl.getQuery(ext.TIME_ELAPSED_EXT,gl.CURRENT_QUERY))!==query){this.reject(this.active,'query-not-started');this.active=undefined;this.breakAssociation();}
  }catch{this.fail();}
 }
 /** Call immediately after the final render/copy. The outer finally still calls cancelFrame. */
 endFrame(frame:GpuDurationFrameEnd){
  const association=this.completingAssociation;this.completingAssociation=undefined;
  if(association){
   if(frame.eligible&&[frame.cpuEndMs,frame.renderSubmitCpuMs,frame.drawCalls,frame.triangles,frame.renderPasses].every(nonnegative)){
    association.nextEligibleCallback={...association.nextAdmittedCallback!};association.association='paired';
   }else{if(association.nextAdmittedCallback)association.nextAdmittedCallback.eligible=false;this.interruptAssociation(association);}
  }
  if(!this.active)return;
  try{
   if(this.gl!.isContextLost()){this.contextLost();return;}
   const item=this.active;
   const closed=this.close(item,'end');
   const ended=this.clock(),row=item.row;
   if(!closed){this.reject(item,'query-ownership');this.active=undefined;this.breakAssociation();return;}
   if(!frame.eligible){this.reject(item,'eligibility-changed');this.active=undefined;this.breakAssociation();return;}
   if(!nonnegative(frame.cpuEndMs)||frame.cpuEndMs<row.cpuStartMs||!nonnegative(frame.renderSubmitCpuMs)||
      !finite(ended)||ended<row.issuedCpuTimeMs||![frame.drawCalls,frame.triangles,frame.renderPasses].every(nonnegative)){
    this.reject(item,'invalid-cpu-metadata');this.active=undefined;this.breakAssociation();return;
   }
   row.cpuEndMs=frame.cpuEndMs;row.cpuElapsedMs=frame.cpuEndMs-row.cpuStartMs;row.renderSubmitCpuMs=frame.renderSubmitCpuMs;
   row.queryBracketCpuMs=ended-row.issuedCpuTimeMs;row.drawCalls=frame.drawCalls;row.triangles=frame.triangles;
   row.renderPasses=frame.renderPasses;row.shadowUpdateRequested=frame.shadowUpdateRequested;
   this.pending.push(item);this.active=undefined;
  }catch{this.fail();}
 }
 /** Idempotent cleanup for original exceptions and early returns; never throws over them. */
 cancelFrame(){
  if(this.completingAssociation){
   if(this.completingAssociation.nextAdmittedCallback)this.completingAssociation.nextAdmittedCallback.eligible=false;
   this.interruptAssociation(this.completingAssociation);this.completingAssociation=undefined;
  }
  if(!this.active)return;
  const item=this.active;this.active=undefined;
  try{if(!this.gl!.isContextLost())this.close(item,'cleanup');}catch{this.counts.errors++;}
  this.reject(item,'incomplete-callback');this.breakAssociation();
 }
 /** Immediate modal/focus/privacy boundaries must also break pairs between admitted callbacks. */
 breakAssociation(){
  if(this.waitingAssociation){this.interruptAssociation(this.waitingAssociation);this.waitingAssociation=undefined;}
  if(this.completingAssociation){
   if(this.completingAssociation.nextAdmittedCallback)this.completingAssociation.nextAdmittedCallback.eligible=false;
   this.interruptAssociation(this.completingAssociation);this.completingAssociation=undefined;
  }
 }
 private interruptAssociation(row:GpuDurationSample){
  if(row.association!=='interrupted'){row.association='interrupted';row.nextEligibleCallback=null;this.counts.interruptedAssociations++;}
 }
 contextLost(){
  if(this.status==='disposed'||this.status==='context-lost')return;
  this.status='context-lost';this.counts.contextLosses++;
  if(this.active){this.reject(this.active,'context-lost');this.active=undefined;}
  for(const item of this.pending)this.reject(item,'context-lost');this.pending=[];this.breakAssociation();
 }
 dispose(){
  if(this.status==='disposed')return;
  this.cancelFrame();for(const item of this.pending)this.reject(item,'disposed');this.pending=[];this.breakAssociation();this.status='disposed';
 }
 /** Detached cached data only: reading a report cannot finish or poll GPU work. */
 snapshot(){
  const values=this.rows.flatMap(row=>row.status==='valid'&&row.gpuMs!==null?[row.gpuMs]:[]).sort((a,b)=>a-b);
  const gpuMs=values.length?{count:values.length,mean:values.reduce((a,b)=>a+b,0)/values.length,
   p50:values[Math.min(values.length-1,Math.floor(values.length*.5))],p95:values[Math.min(values.length-1,Math.floor(values.length*.95))],max:values.at(-1)!}:null;
  return structuredClone({version:2,enabled:true,status:this.status,limits:GPU_DURATION_LIMITS,capability:this.capability,backend:this.backend,
   apiWallTiming:{clock:'performance.now',maxCallsPerSample:GPU_DURATION_API_WALL_LIMIT,stages:GPU_DURATION_API_STAGES,note:GPU_DURATION_API_WALL_NOTE},
   counts:{...this.counts,completed:this.counts.valid+this.counts.rejected,unresolved:this.pending.length+Number(!!this.active)},
   skips:this.skips,rejectionReasons:this.rejectionReasons,gpuMs,samples:this.rows,note:GPU_DURATION_NOTE});
 }
}
