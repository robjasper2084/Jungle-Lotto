/** Opt-in QA timings. This module never receives or stores a position or heading. */
export const LOCATION_PERF_SAMPLE_LIMIT=14400;
export const LOCATION_PERF_STATES=['off','requesting','tracking','follow','poor-accuracy','stale','outside-map','denied','unavailable','timeout','unsupported','insecure','paused','jump-rejected','unknown'] as const;
export type LocationPerfState=typeof LOCATION_PERF_STATES[number];
export interface LocationPerfContext {
 active:boolean;paused:boolean;hidden:boolean;focused:boolean;preparing:boolean;modal:boolean;immersive:boolean;cooperative:boolean;reducedScene?:boolean;
 viewportWidth:number;viewportHeight:number;devicePixelRatio:number;renderPixelRatio:number;targetFrameCap:number;reducedMotion:boolean;
 locationState:LocationPerfState;
}
type Metadata={
 viewport:{width:number;height:number;devicePixelRatio:number;renderPixelRatio:number};
 targetFrameCap:number;reducedMotion:boolean;locationState:LocationPerfState;
};
export type LocationPerfStopReason='duration'|'manual'|'hidden'|'focus-lost'|'paused'|'inactive'|'preparing'|'modal'|'immersive'|'cooperative'|'reduced-scene'|'settings-changed'|'sample-limit'|'clock';
export type TimingDistribution={count:number;meanMs:number;p50Ms:number;p95Ms:number;p99Ms:number;maxMs:number};
export interface LocationPerfReport {
 version:1;outcome:'complete'|'stopped'|'interrupted';reason:LocationPerfStopReason;requestedSeconds:30|60;
 wallDurationMs:number;renderedFrames:number;renderedFramesPerSecond:number;firstFrameWaitMs:number|null;tailWithoutFrameMs:number;
 frameIntervalsMs:TimingDistribution|null;sceneRenderCpuMs:TimingDistribution|null;invalidCpuSamples:number;
 stalls:{over50Ms:number;over100Ms:number;over250Ms:number;over1000Ms:number};
 locationFrames:Partial<Record<LocationPerfState,number>>;atStart:Metadata;atEnd:Metadata;note:string;
}

export function locationPerformanceEnabled(search:string):boolean{return new URLSearchParams(search).get('locationPerf')==='1';}
function metadata(context:LocationPerfContext):Metadata|null {
 const {viewportWidth:width,viewportHeight:height,devicePixelRatio,renderPixelRatio,targetFrameCap}=context;
 if(![width,height,devicePixelRatio,renderPixelRatio,targetFrameCap].every(Number.isFinite)
  ||width<1||height<1||width>32768||height>32768||devicePixelRatio<=0||devicePixelRatio>8
  ||renderPixelRatio<=0||renderPixelRatio>8||targetFrameCap<1||targetFrameCap>240)return null;
 // Copy only the explicit aggregate schema, even if a caller supplies extra fields.
 return {viewport:{width,height,devicePixelRatio,renderPixelRatio},targetFrameCap,reducedMotion:context.reducedMotion===true,
  locationState:LOCATION_PERF_STATES.includes(context.locationState)?context.locationState:'unknown'};
}
function interruption(context:LocationPerfContext):LocationPerfStopReason|null {
 if(context.hidden)return 'hidden';if(!context.focused)return 'focus-lost';if(!context.active)return 'inactive';
 if(context.paused)return 'paused';if(context.preparing)return 'preparing';if(context.modal)return 'modal';
 if(context.immersive)return 'immersive';if(context.cooperative)return 'cooperative';if(context.reducedScene)return 'reduced-scene';return null;
}
function sameSettings(a:Metadata,b:Metadata):boolean {
 return a.targetFrameCap===b.targetFrameCap&&a.reducedMotion===b.reducedMotion
  &&a.viewport.width===b.viewport.width&&a.viewport.height===b.viewport.height
  &&a.viewport.devicePixelRatio===b.viewport.devicePixelRatio&&a.viewport.renderPixelRatio===b.viewport.renderPixelRatio;
}
function distribution(values:readonly number[]):TimingDistribution|null {
 if(!values.length)return null;
 const sorted=values.slice().sort((a,b)=>a-b),at=(q:number)=>sorted[Math.max(0,Math.ceil(q*sorted.length)-1)];
 return {count:values.length,meanMs:values.reduce((a,b)=>a+b,0)/values.length,p50Ms:at(.5),p95Ms:at(.95),p99Ms:at(.99),maxMs:sorted[sorted.length-1]};
}

/** Fixed wall-time windows, bounded samples, and no raw samples in the report. */
export class LocationPerformanceCapture {
 private intervals:number[]=[];private cpu:number[]=[];private frames=0;private invalidCpu=0;
 private started=0;private deadline=0;private seconds:30|60=30;private lastFrame:number|null=null;private firstFrame:number|null=null;
 private initial:Metadata|undefined;private latest:Metadata|undefined;private states:Partial<Record<LocationPerfState,number>>={};
 private recording=false;private finished:LocationPerfReport|undefined;
 get running(){return this.recording;}
 get renderedFrames(){return this.frames;}
 get result():LocationPerfReport|undefined{return this.finished?structuredClone(this.finished):undefined;}
 elapsed(now:number){return this.initial&&Number.isFinite(now)?Math.max(0,Math.min(now,this.deadline)-this.started):0;}
 start(now:number,seconds:30|60,context:LocationPerfContext):boolean {
  if(this.recording||!Number.isFinite(now)||now<0||(seconds!==30&&seconds!==60)||interruption(context))return false;
  const initial=metadata(context);if(!initial)return false;
  this.clear();this.initial=initial;this.latest=initial;this.started=now;this.seconds=seconds;this.deadline=now+seconds*1000;this.recording=true;return true;
 }
 check(now:number,context:LocationPerfContext):void {
  if(!this.recording)return;
  if(!Number.isFinite(now)||now<this.started||(this.lastFrame!==null&&now<this.lastFrame)){
   this.finish(this.lastFrame??this.started,'clock');return;
  }
  const next=metadata(context);if(next)this.latest=next;
  const reason=interruption(context);if(reason){this.finish(now,reason);return;}
  if(!next||!sameSettings(this.initial!,next)){this.finish(now,'settings-changed');return;}
  if(now>=this.deadline)this.finish(this.deadline,'duration');
 }
 /** Invoke only after a successful actual scene-render call, using its CPU completion time. */
 rendered(now:number,sceneRenderCpuMs:number|undefined,context:LocationPerfContext):void {
  this.check(now,context);if(!this.recording)return;
  if(this.lastFrame!==null&&now===this.lastFrame){this.finish(now,'clock');return;}
  if(this.frames>=LOCATION_PERF_SAMPLE_LIMIT){this.finish(now,'sample-limit');return;}
  if(this.lastFrame!==null)this.intervals.push(now-this.lastFrame);
  else this.firstFrame=now;
  this.lastFrame=now;this.frames++;
  if(sceneRenderCpuMs!==undefined){
   if(Number.isFinite(sceneRenderCpuMs)&&sceneRenderCpuMs>=0)this.cpu.push(sceneRenderCpuMs);else this.invalidCpu++;
  }
  const state=this.latest!.locationState;this.states[state]=(this.states[state]??0)+1;
 }
 stop(now:number,context:LocationPerfContext):void {
  this.check(now,context);if(this.recording)this.finish(now,'manual');
 }
 clear():void {
  this.recording=false;this.finished=undefined;this.intervals=[];this.cpu=[];this.frames=this.invalidCpu=0;
  this.initial=this.latest=undefined;this.states={};this.firstFrame=this.lastFrame=null;
 }
 private finish(now:number,reason:LocationPerfStopReason):void {
  if(!this.recording)return;
  this.recording=false;const end=Math.max(this.started,Math.min(now,this.deadline)),wallDurationMs=end-this.started;
  this.finished={version:1,outcome:reason==='duration'?'complete':reason==='manual'?'stopped':'interrupted',reason,requestedSeconds:this.seconds,
   wallDurationMs,renderedFrames:this.frames,renderedFramesPerSecond:wallDurationMs?this.frames*1000/wallDurationMs:0,
   firstFrameWaitMs:this.firstFrame===null?null:this.firstFrame-this.started,tailWithoutFrameMs:Math.max(0,end-(this.lastFrame??this.started)),
   frameIntervalsMs:distribution(this.intervals),sceneRenderCpuMs:distribution(this.cpu),invalidCpuSamples:this.invalidCpu,
   stalls:{over50Ms:this.intervals.filter(t=>t>50).length,over100Ms:this.intervals.filter(t=>t>100).length,
    over250Ms:this.intervals.filter(t=>t>250).length,over1000Ms:this.intervals.filter(t=>t>1000).length},
   locationFrames:{...this.states},atStart:this.initial!,atEnd:this.latest!,
   note:'Counts are successful full-scene render submissions. Frame intervals run between CPU completion times, not GPU completion or confirmed display presentation. CPU timings cover the scene render call only and are not GPU timings. Percentiles use nearest rank over every retained interval. Initial wait and an unfinished tail are reported separately, never invented as completed frame intervals. Capture stops on hidden/unfocused/paused/menu/preparation or settings changes. This opt-in observer adds a small CPU cost and changes no scene effects, quality or pacing. No location coordinates, headings, tracks, identifiers or absolute timestamps are collected.'};
  this.intervals=[];this.cpu=[];
 }
}

export interface LocationPerformancePanel {check():void;rendered(now:number,cpuMs:number):void;dispose():void;}
/** No DOM, listeners or measurement work unless the exact QA query flag is present. */
export function createLocationPerformancePanel(context:()=>LocationPerfContext,search=location.search):LocationPerformancePanel|undefined {
 if(!locationPerformanceEnabled(search))return;
 const capture=new LocationPerformanceCapture(),panel=document.createElement('details'),style=document.createElement('style');
 panel.id='location-perf';panel.open=true;
 style.textContent=`#location-perf{position:fixed;right:max(10px,env(safe-area-inset-right));top:max(12px,env(safe-area-inset-top));z-index:15000;width:min(310px,calc(100vw - 20px));box-sizing:border-box;max-height:75vh;overflow:auto;padding:10px;border:1px solid #7bafa6;border-radius:10px;background:#0b242df5;color:#eef7f5;font:12px/1.45 system-ui;box-shadow:0 6px 24px #0006;animation:none;transition:none}#location-perf summary{cursor:pointer;min-height:44px;font-weight:700}#location-perf p{margin:7px 0}#location-perf .location-perf-actions{display:flex;flex-wrap:wrap;gap:6px;margin:8px 0}#location-perf button,#location-perf select{font:inherit;min-height:44px;padding:6px 10px;border:1px solid #7bafa6;border-radius:6px;background:#153c45;color:#fff}#location-perf button:disabled{opacity:.55}#location-perf :focus-visible{outline:3px solid #ffd98b;outline-offset:2px}#location-perf-report{box-sizing:border-box;width:100%;height:160px;resize:vertical;background:#071c24;color:#eef7f5;font:11px/1.4 monospace}#location-perf [hidden]{display:none!important}@media(max-width:600px){#location-perf{top:calc(max(12px,env(safe-area-inset-top)) + 56px);max-height:calc(100dvh - 84px)}}`;
 const summary=document.createElement('summary');summary.textContent='Location timing · QA only';
 const note=document.createElement('p');note.textContent='Full-scene CPU frame intervals, including GPS follow. No positions or headings. Close other panels and keep this tab active.';
 const label=document.createElement('label');label.textContent='Capture duration ';
 const duration=document.createElement('select');duration.id='location-perf-duration';
 for(const seconds of [30,60]){const option=document.createElement('option');option.value=String(seconds);option.textContent=seconds+' seconds';duration.append(option);}label.append(duration);
 const actions=document.createElement('div');actions.className='location-perf-actions';
 const start=document.createElement('button'),stop=document.createElement('button'),remove=document.createElement('button');
 for(const button of [start,stop,remove])button.type='button';
 start.id='location-perf-start';start.textContent='Start capture';stop.id='location-perf-stop';stop.textContent='Stop';stop.disabled=true;
 remove.textContent='Remove QA';remove.setAttribute('aria-label','Remove the location performance QA panel');actions.append(start,stop,remove);
 const status=document.createElement('p');status.setAttribute('role','status');status.id='location-perf-status';status.textContent='Ready. Choose Start capture after the island is playable.';
 const results=document.createElement('p');results.id='location-perf-summary';results.hidden=true;
 const report=document.createElement('textarea');report.id='location-perf-report';report.readOnly=true;report.hidden=true;report.setAttribute('aria-label','Aggregate timing JSON report. Select and copy to keep it.');
 panel.append(summary,note,label,actions,status,results,report);document.head.append(style);document.body.append(panel);
 // Keep QA keyboard controls and button clicks out of game shortcuts/focus redirection.
 panel.addEventListener('keydown',event=>event.stopPropagation());panel.addEventListener('click',event=>event.stopPropagation());
 let disposed=false,lastReport:LocationPerfReport|undefined,nextPaint=0;
 function refresh(){
  if(disposed)return;
  start.disabled=capture.running;stop.disabled=!capture.running;duration.disabled=capture.running;
  if(capture.running){summary.textContent='Location timing · '+(capture.elapsed(performance.now())/1000).toFixed(1)+' s · '+capture.renderedFrames+' frames';return;}
  const result=capture.result;if(!result||lastReport)return;lastReport=result;
  summary.textContent='Location timing · '+result.outcome;status.textContent=result.outcome+' · '+result.reason.replaceAll('-',' ');
  const p=result.frameIntervalsMs;
  results.textContent=result.renderedFrames+' rendered frames / '+(result.wallDurationMs/1000).toFixed(2)+' s · '+result.renderedFramesPerSecond.toFixed(1)+' submissions/s'+(p?' · p50 / p95 / p99 '+[p.p50Ms,p.p95Ms,p.p99Ms].map(v=>v.toFixed(1)).join(' / ')+' ms':' · no complete frame intervals')+' · '+result.stalls.over250Ms+' stalls >250 ms. CPU timing, not GPU timing.';
  results.hidden=report.hidden=false;report.value=JSON.stringify(result,null,2);
 }
 function check(){
  if(disposed||!capture.running)return;
  const now=performance.now();capture.check(now,context());
  if(!capture.running||now>=nextPaint){nextPaint=now+250;refresh();}
 }
 start.onclick=()=>{
  if(!capture.start(performance.now(),Number(duration.value) as 30|60,context())){status.textContent='Capture unavailable. Resume solo play, close other panels and keep the game in focus.';return;}
  lastReport=undefined;results.hidden=report.hidden=true;report.value='';status.textContent='Recording full-scene renders. Collapse this QA panel if it covers the view.';refresh();
 };
 stop.onclick=()=>{capture.stop(performance.now(),context());refresh();};
 const hidden=()=>{if(document.hidden)check();},blur=()=>check(),pagehide=()=>{
  if(capture.running)capture.check(performance.now(),{...context(),hidden:true});refresh();
 };
 document.addEventListener('visibilitychange',hidden);window.addEventListener('blur',blur);window.addEventListener('pagehide',pagehide);
 const timer=window.setInterval(check,250);
 const api:LocationPerformancePanel={check,rendered(now,cpuMs){if(disposed||!capture.running)return;capture.rendered(now,cpuMs,context());if(!capture.running)refresh();},dispose(){
  if(disposed)return;disposed=true;capture.clear();lastReport=undefined;report.value='';window.clearInterval(timer);
  document.removeEventListener('visibilitychange',hidden);window.removeEventListener('blur',blur);window.removeEventListener('pagehide',pagehide);panel.remove();style.remove();
 }};
 remove.onclick=()=>{api.dispose();document.getElementById('game')?.focus({preventScroll:true});};return api;
}
