/** Local diagnostics only; no network telemetry, save mutation or device-FPS claims. */
export class StartupTelemetry{
 private origin:number;private stageStart:number;private label='boot';private phases:{name:string;ms:number}[]=[];
 private liveStart:number|null=null;private last:number|null=null;private submittedFrames=0;private samples:{t:number;frameMs:number;cpuMs:number;draws:number;textures:number;geometries:number;programs:number}[]=[];
 private observer:PerformanceObserver|undefined;private longTasks:{startMs:number;durationMs:number}[]=[];private mode='solo';
 private now:()=>number;
 constructor(now=()=>performance.now()){
  this.now=now;
  this.origin=this.stageStart=now();
  if(typeof PerformanceObserver!=='undefined'&&PerformanceObserver.supportedEntryTypes?.includes('longtask')){
   this.observer=new PerformanceObserver(list=>{for(const e of list.getEntries())if(this.longTasks.length<256)this.longTasks.push({startMs:e.startTime-this.origin,durationMs:e.duration});});
   try{this.observer.observe({type:'longtask',buffered:false});}catch{this.observer=undefined;}
  }
 }
 stage(name:string){const now=this.now();if(this.phases.length<128)this.phases.push({name:this.label,ms:now-this.stageStart});this.label=name;this.stageStart=now;}
 begin(mode='solo'){try{this.observer?.observe({type:'longtask',buffered:false});}catch{/* Optional observer unavailable. */}this.mode=mode;this.liveStart=this.now();this.last=null;this.samples=[];this.submittedFrames=0;this.stage('gameplay '+mode);}
 sample(cpuMs:number,draws:number,textures:number,geometries:number,programs:number,eligible:boolean){
  const now=this.now();if(this.liveStart===null)return;this.submittedFrames++;const t=now-this.liveStart;
  if(!eligible){this.last=null;return;}const elapsed=this.last===null?null:now-this.last;this.last=now;
  if(t>30000){this.observer?.disconnect();return;}
  if(elapsed!==null&&this.samples.length<4000)this.samples.push({t,frameMs:elapsed,cpuMs,draws,textures,geometries,programs});
 }
 snapshot(){const bands=[[0,5000],[5000,15000],[15000,30000]];
  return {mode:this.mode,submittedFrames:this.submittedFrames,scope:'Local wall-frame and CPU measurements. Screenshot/CI time is not hardware FPS certification.',phases:[...this.phases],currentPhase:this.label,longTasks:[...this.longTasks],windows:bands.map(([from,to])=>{
   const rows=this.samples.filter(s=>s.t>=from&&s.t<to),times=rows.map(s=>s.frameMs).sort((a,b)=>a-b),p=(q:number)=>times.length?times[Math.min(times.length-1,Math.floor(times.length*q))]:null;
   return {fromSeconds:from/1000,toSeconds:to/1000,frames:rows.length,medianMs:p(.5),p95Ms:p(.95),p99Ms:p(.99),worstMs:times.at(-1)??null,over50Ms:times.filter(t=>t>50).length,over250Ms:times.filter(t=>t>250).length,maxCpuMs:rows.length?Math.max(...rows.map(r=>r.cpuMs)):null,maxDraws:rows.length?Math.max(...rows.map(r=>r.draws)):null,first:rows[0]??null,last:rows.at(-1)??null};
  })};
 }
 dispose(){this.observer?.disconnect();}
}
