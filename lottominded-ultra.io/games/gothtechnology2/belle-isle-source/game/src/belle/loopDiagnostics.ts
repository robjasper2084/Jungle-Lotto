/** Manual-capture CPU observations around the existing animation callback.
 * These observations never change delivery, native calls or profile accounting. */
export const loopTimingScopes = [
  'totalWrapperCpuMs', 'gateReadyCpuMs', 'callbackBodyCpuMs',
  'gateSubmittedCpuMs', 'fenceSyncCpuMs', 'flushCpuMs', 'profileSampleCpuMs',
] as const;
export type LoopTimingScope = typeof loopTimingScopes[number];
export type LoopMeasuredScope = Exclude<LoopTimingScope, 'totalWrapperCpuMs'>;
export type LoopOutcome = 'executed'|'no-draw'|'pending-fence'|'context-lost'|'xr'|'error';
export interface LoopCallbackKey {captureEpoch:number;callbackId:number}
export interface LoopToken extends Readonly<LoopCallbackKey> {}
export interface LoopScopeToken {
  readonly callback:LoopToken;readonly scope:LoopMeasuredScope;
  readonly start:number|undefined;readonly faults:number;
}
export interface LoopScopeObservation {calls:number;cpuMs:number;maxCpuMs:number;invalidCalls:number}
export interface LoopCallbackRecord extends LoopCallbackKey {
  rafTimestampMs:number;outcome:LoopOutcome;acceptedSample:number|null;associationEligible:boolean;
  place:string;x:number|null;z:number|null;draws:number|null;triangles:number|null;renderMs:number|null;
  scopes:Record<LoopTimingScope,LoopScopeObservation|null>;
  wallGapSincePreviousObservedCallbackMs:number|null;invalidObservations:number;
}
export interface LoopAcceptedSample {
  sample:number;previousProfiledSample:number|null;associationValid:boolean;
  frameMs:number;place:string;x:number;z:number;draws:number;triangles:number;renderMs:number;
}
export interface LoopSlowInterval {
  sample:number;captureEpoch:number;callbackId:number|null;frameMs:number;place:string;x:number;z:number;
  previousEligibleCallback:LoopCallbackRecord|null;
}
export interface LoopScopeTotals {callbacks:number;calls:number;cpuMs:number;maxCallCpuMs:number;maxCallbackCpuMs:number}
export interface LoopGroup {
  callbacks:number;validCallbacks:number;invalidCallbacks:number;
  scopes:Record<LoopTimingScope,LoopScopeTotals>;
  wallGap:{samples:number;totalMs:number;maxMs:number};
}
export interface LoopInFlight extends LoopCallbackKey {
  acceptedSample:number|null;associationEligible:boolean;openScopes:LoopMeasuredScope[];
  incomplete:true;
}
export interface LoopDiagnosticsReport {
  captureEpoch:number;capturing:boolean;completedCallbacks:number;
  acceptedSamples:number;acceptedSamplesWithoutObservedCallback:number;
  invalidObservations:number;allCallbacks:LoopGroup;acceptedCallbacks:LoopGroup;
  inFlightAtSnapshot:LoopInFlight|null;topCallbacks:LoopCallbackRecord[];slowIntervals:LoopSlowInterval[];
  note:string;
}

export const LOOP_DIAGNOSTICS_NOTE='Manual-capture CPU wall-clock observations, including observer overhead; not GPU execution timings. totalWrapperCpuMs contains gateReadyCpuMs, callbackBodyCpuMs and gateSubmittedCpuMs. fenceSyncCpuMs and flushCpuMs are nested inside gateSubmittedCpuMs; profileSampleCpuMs is nested inside callbackBodyCpuMs. Do not add nested scopes. Uninvoked scopes are null; measured zero-duration calls retain positive counts. All-callback and accepted-sample populations are separate. Wrapper timing begins after observer entry setup and ends before observer finalization. Wall gaps use consecutive observed wrapper entry/exit clocks and include prior observer finalization, next observer entry setup and other work between callbacks; they are not pure browser wait or GPU time. Slow intervals associate only an exact epoch/sample match to the previous completed eligible callback. Automatic export occurs inside the last callback: inFlightAtSnapshot is incomplete and excluded from completed timing totals, never replaced with zero. Invalid timing callbacks are counted but omitted from timing aggregates. Original intervals, acceptance, movement and FPS are unchanged.';

const finite=(value:number)=>Number.isFinite(value)&&value>=0;
const identity=(value:number)=>Number.isSafeInteger(value)&&value>=0;
const observation=():LoopScopeObservation=>({calls:0,cpuMs:0,maxCpuMs:0,invalidCalls:0});
const totals=():LoopScopeTotals=>({callbacks:0,calls:0,cpuMs:0,maxCallCpuMs:0,maxCallbackCpuMs:0});
const group=():LoopGroup=>({callbacks:0,validCallbacks:0,invalidCallbacks:0,
  scopes:Object.fromEntries(loopTimingScopes.map(name=>[name,totals()])) as LoopGroup['scopes'],
  wallGap:{samples:0,totalMs:0,maxMs:0}});
const scopes=():LoopCallbackRecord['scopes']=>Object.fromEntries(loopTimingScopes.map(name=>[name,null])) as LoopCallbackRecord['scopes'];
const numberOrNull=(value:number)=>Number.isFinite(value)?value:null;
const countOrNull=(value:number)=>finite(value)?value:null;
const label=(value:string)=>typeof value==='string'?value.slice(0,96):'';
function copyGroup(value:LoopGroup):LoopGroup{return {...value,scopes:Object.fromEntries(loopTimingScopes.map(name=>[name,{...value.scopes[name]}])) as LoopGroup['scopes'],wallGap:{...value.wallGap}};}
export function copyLoopCallback(value:LoopCallbackRecord):LoopCallbackRecord {
  return {...value,scopes:Object.fromEntries(loopTimingScopes.map(name=>[name,value.scopes[name]?{...value.scopes[name]}:null])) as LoopCallbackRecord['scopes']};
}
/** Only observer methods belong in this guard; never wrap a native operation. */
export function observeLoop<T>(probe:ManualLoopProbe|undefined,action:(value:ManualLoopProbe)=>T):T|undefined {
  if(!probe)return;
  try{return action(probe);}catch{try{probe.observerFault();}catch{/* Observation must never replace native behaviour. */}return;}
}
function copySlow(value:LoopSlowInterval):LoopSlowInterval{return {...value,previousEligibleCallback:value.previousEligibleCallback?copyLoopCallback(value.previousEligibleCallback):null};}
function copyReport(value:LoopDiagnosticsReport):LoopDiagnosticsReport {
  return {...value,allCallbacks:copyGroup(value.allCallbacks),acceptedCallbacks:copyGroup(value.acceptedCallbacks),
    inFlightAtSnapshot:value.inFlightAtSnapshot?{...value.inFlightAtSnapshot,openScopes:[...value.inFlightAtSnapshot.openScopes]}:null,
    topCallbacks:value.topCallbacks.map(copyLoopCallback),slowIntervals:value.slowIntervals.map(copySlow)};
}
function retain<T>(rows:T[],row:T,limit:number,score:(value:T)=>number){
  if(!limit)return;
  if(rows.length<limit){rows.push(row);return;}
  let least=0;for(let i=1;i<rows.length;i++)if(score(rows[i])<score(rows[least]))least=i;
  if(score(row)>score(rows[least]))rows[least]=row;
}

/** One current callback, one previous eligible completion and two capped lists.
 * A stopped epoch cannot receive later clocks or mutate an exported snapshot. */
export class ManualLoopProbe {
  private active=false;private epoch=0;private faults=0;private invalid=0;
  private lastClock:number|undefined;private lastExit:number|undefined;
  private current:LoopCallbackRecord|undefined;private currentToken:LoopToken|undefined;
  private wrapperStart:number|undefined;private wrapperFaults=0;
  private openScopes=new Set<LoopScopeToken>();
  private previousEligible:LoopCallbackRecord|null=null;
  private all=group();private accepted=group();private completed=0;private samples=0;private unobservedSamples=0;
  private top:LoopCallbackRecord[]=[];private slow:LoopSlowInterval[]=[];
  private stoppedReport:LoopDiagnosticsReport|null=null;
  private limit:number;private clock:()=>number;
  constructor(clock:()=>number=()=>performance.now(),limit=100){
    this.clock=clock;this.limit=Number.isFinite(limit)?Math.max(0,Math.min(100,Math.floor(limit))):100;
  }
  get capturing(){return this.active;}
  startCapture(){
    this.epoch++;this.active=true;this.faults=0;this.invalid=0;this.lastClock=undefined;this.lastExit=undefined;
    this.current=undefined;this.currentToken=undefined;this.wrapperStart=undefined;this.openScopes.clear();
    this.previousEligible=null;this.all=group();this.accepted=group();this.completed=0;this.samples=0;this.unobservedSamples=0;
    this.top=[];this.slow=[];this.stoppedReport=null;
  }
  stopCapture():LoopDiagnosticsReport {
    if(!this.active)return this.snapshot();
    const result=this.buildReport(false);this.active=false;this.current=undefined;this.currentToken=undefined;
    this.openScopes.clear();this.lastClock=undefined;this.lastExit=undefined;this.previousEligible=null;
    this.stoppedReport=result;return copyReport(result);
  }
  snapshot():LoopDiagnosticsReport{return this.stoppedReport?copyReport(this.stoppedReport):this.buildReport(this.active);}
  breakAssociation(){this.previousEligible=null;this.lastExit=undefined;if(this.current)this.current.wallGapSincePreviousObservedCallbackMs=null;}
  /** Unexpected observer failures disable only this capture's observations. */
  observerFault(){
    this.invalidObservation();this.active=false;this.stoppedReport=this.buildReport(false);
    this.current=undefined;this.currentToken=undefined;this.openScopes.clear();this.lastClock=undefined;this.lastExit=undefined;this.previousEligible=null;
  }
  /** Detachment must not retain an unfinished callback or let it complete later. */
  cancelCallback(){
    if(this.active&&this.current)this.invalidObservation();
    this.current=undefined;this.currentToken=undefined;this.openScopes.clear();this.wrapperStart=undefined;
    this.breakAssociation();
  }
  private validToken(token:LoopToken|undefined):token is LoopToken {
    return this.active&&!!token&&token===this.currentToken&&token.captureEpoch===this.epoch&&!!this.current;
  }
  private invalidObservation(){this.invalid++;this.faults++;if(this.current)this.current.invalidObservations++;}
  private now():number|undefined {
    let value:unknown;
    try{value=this.clock();}catch{value=undefined;}
    if(typeof value!=='number'||!finite(value)||this.lastClock!==undefined&&value<this.lastClock){
      this.invalidObservation();this.lastClock=undefined;return;
    }
    this.lastClock=value;return value;
  }
  beginCallback(callbackId:number,rafTimestamp:number):LoopToken|undefined {
    if(!this.active)return;
    if(this.current||!identity(callbackId)||!finite(rafTimestamp)){this.invalidObservation();return;}
    this.current={captureEpoch:this.epoch,callbackId,rafTimestampMs:rafTimestamp,outcome:'executed',
      acceptedSample:null,associationEligible:false,place:'',x:null,z:null,draws:null,triangles:null,renderMs:null,
      scopes:scopes(),wallGapSincePreviousObservedCallbackMs:null,invalidObservations:0};
    const token=Object.freeze({captureEpoch:this.epoch,callbackId});this.currentToken=token;
    const start=this.now();this.wrapperStart=start;this.wrapperFaults=this.faults;
    this.current.scopes.totalWrapperCpuMs={...observation(),calls:1};
    if(start!==undefined&&this.lastExit!==undefined){
      const gap=start-this.lastExit;
      if(finite(gap))this.current.wallGapSincePreviousObservedCallbackMs=gap;else this.invalidObservation();
    }
    return token;
  }
  beginScope(callback:LoopToken|undefined,scope:LoopMeasuredScope):LoopScopeToken|undefined {
    if(!this.validToken(callback))return;
    if(!loopTimingScopes.includes(scope)||String(scope)==='totalWrapperCpuMs'){this.invalidObservation();return;}
    if([...this.openScopes].some(value=>value.scope===scope)){this.invalidObservation();return;}
    const item=this.current!.scopes[scope]??(this.current!.scopes[scope]=observation());item.calls++;
    const start=this.now();const token=Object.freeze({callback,scope,start,faults:this.faults});
    this.openScopes.add(token);return token;
  }
  beginProfileSample():LoopScopeToken|undefined{return this.beginScope(this.currentToken,'profileSampleCpuMs');}
  endScope(token:LoopScopeToken|undefined){
    if(!token||!this.validToken(token.callback)||!this.openScopes.has(token))return;
    this.openScopes.delete(token);const end=this.now(),item=this.current!.scopes[token.scope]!;
    if(token.start===undefined||end===undefined||token.faults!==this.faults){item.invalidCalls++;return;}
    const elapsed=end-token.start;
    if(!finite(elapsed)||!finite(item.cpuMs+elapsed)){item.invalidCalls++;this.invalidObservation();return;}
    item.cpuMs+=elapsed;item.maxCpuMs=Math.max(item.maxCpuMs,elapsed);
  }
  rejectSampleAssociation(){this.breakAssociation();}
  bindAcceptedSample(value:LoopAcceptedSample){
    if(!this.active)return;
    this.samples++;
    if(!identity(value.sample)||value.sample===0||!finite(value.frameMs)||value.frameMs===0){this.unobservedSamples++;this.invalidObservation();this.breakAssociation();return;}
    const row=this.current;
    const canBind=!!row&&this.validToken(this.currentToken)&&row.acceptedSample===null;
    if(!canBind){this.unobservedSamples++;if(row)this.invalidObservation();}
    if(canBind){
      row!.acceptedSample=value.sample;row!.associationEligible=value.associationValid;
      row!.place=label(value.place);row!.x=numberOrNull(value.x);row!.z=numberOrNull(value.z);
      row!.draws=countOrNull(value.draws);row!.triangles=countOrNull(value.triangles);row!.renderMs=countOrNull(value.renderMs);
    }
    const previous=canBind&&value.associationValid&&this.previousEligible?.captureEpoch===this.epoch&&
      this.previousEligible.acceptedSample===value.previousProfiledSample?this.previousEligible:null;
    if(value.frameMs>100&&Number.isFinite(value.x)&&Number.isFinite(value.z)){
      const slow:LoopSlowInterval={sample:value.sample,captureEpoch:this.epoch,callbackId:canBind?row!.callbackId:null,
        frameMs:value.frameMs,place:label(value.place),x:value.x,z:value.z,previousEligibleCallback:previous?copyLoopCallback(previous):null};
      retain(this.slow,slow,this.limit,item=>item.frameMs);
    }
    if(!canBind||!value.associationValid)this.breakAssociation();
  }
  finishCallback(token:LoopToken|undefined,outcome:LoopOutcome){
    if(!this.validToken(token))return;
    const row=this.current!;row.outcome=outcome;
    if(this.openScopes.size)this.invalidObservation();
    const end=this.now(),total=row.scopes.totalWrapperCpuMs!;
    if(this.wrapperStart===undefined||end===undefined||this.wrapperFaults!==this.faults){total.invalidCalls++;}
    else{
      const elapsed=end-this.wrapperStart;
      if(finite(elapsed)){total.cpuMs=elapsed;total.maxCpuMs=elapsed;}else{total.invalidCalls++;this.invalidObservation();}
    }
    this.completed++;this.addGroup(this.all,row);if(row.acceptedSample!==null)this.addGroup(this.accepted,row);
    if(!row.invalidObservations&&!total.invalidCalls){
      retain(this.top,copyLoopCallback(row),this.limit,item=>item.scopes.totalWrapperCpuMs!.cpuMs);
      this.lastExit=end;
      if(row.acceptedSample!==null)this.previousEligible=row.associationEligible?copyLoopCallback(row):null;
    }else{this.lastExit=undefined;if(row.acceptedSample!==null)this.previousEligible=null;}
    if(outcome==='context-lost'||outcome==='xr'||outcome==='error')this.breakAssociation();
    this.current=undefined;this.currentToken=undefined;this.wrapperStart=undefined;this.openScopes.clear();
  }
  private addGroup(target:LoopGroup,row:LoopCallbackRecord){
    target.callbacks++;
    if(row.invalidObservations||row.scopes.totalWrapperCpuMs?.invalidCalls){target.invalidCallbacks++;return;}
    target.validCallbacks++;
    for(const name of loopTimingScopes){
      const item=row.scopes[name];if(!item)continue;const total=target.scopes[name];
      total.callbacks++;total.calls+=item.calls;total.cpuMs+=item.cpuMs;
      total.maxCallCpuMs=Math.max(total.maxCallCpuMs,item.maxCpuMs);total.maxCallbackCpuMs=Math.max(total.maxCallbackCpuMs,item.cpuMs);
    }
    const gap=row.wallGapSincePreviousObservedCallbackMs;
    if(gap!==null){target.wallGap.samples++;target.wallGap.totalMs+=gap;target.wallGap.maxMs=Math.max(target.wallGap.maxMs,gap);}
  }
  private buildReport(capturing:boolean):LoopDiagnosticsReport {
    return {captureEpoch:this.epoch,capturing,completedCallbacks:this.completed,acceptedSamples:this.samples,
      acceptedSamplesWithoutObservedCallback:this.unobservedSamples,invalidObservations:this.invalid,
      allCallbacks:copyGroup(this.all),acceptedCallbacks:copyGroup(this.accepted),
      inFlightAtSnapshot:this.current?{captureEpoch:this.current.captureEpoch,callbackId:this.current.callbackId,
        acceptedSample:this.current.acceptedSample,associationEligible:this.current.associationEligible,
        openScopes:[...this.openScopes].map(value=>value.scope),incomplete:true}:null,
      topCallbacks:this.top.slice().sort((a,b)=>b.scopes.totalWrapperCpuMs!.cpuMs-a.scopes.totalWrapperCpuMs!.cpuMs).map(copyLoopCallback),
      slowIntervals:this.slow.slice().sort((a,b)=>b.frameMs-a.frameMs).map(copySlow),note:LOOP_DIAGNOSTICS_NOTE};
  }
}
