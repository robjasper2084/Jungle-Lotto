/** Opt-in, local-only ride diagnostics. Render CPU time is not GPU time. */
import {RideProfileStats} from './rideProfileStats.ts';
import type {NatureRenderFrame} from './renderDiagnostics.ts';
import type {RenderSubmissionFrame} from './renderSubmissionDiagnostics.ts';
import {observeLoop,type ManualLoopProbe} from './loopDiagnostics.ts';
import type {ManualGpuProbe} from './gpuRenderDiagnostics.ts';
interface RideProfileContext {gpuProbe?:Pick<ManualGpuProbe,'startCapture'|'stopCapture'>;build?:()=>unknown;gpuPacing?:()=>unknown;submissionCoverage?:()=>unknown;resetRenderDiagnostics?:()=>void;loopProbe?:ManualLoopProbe;loopCoverage?:()=>unknown;shortRideSeconds?:number;}
const snapshot=(value:unknown)=>value===undefined?null:JSON.parse(JSON.stringify(value));
const missingBuild={status:'unavailable',reason:'no build marker reader configured'};
export class RideProfile {
 private running=false;private stats=new RideProfileStats();private interruptions=0;
 private panel=document.createElement('details'); private label=document.createElement('summary');
 private button=document.createElement('button'); private output=document.createElement('textarea');
 private download=document.createElement('button');
 private stamp=0; private started='';
 private settingsAtStart:unknown=null;private buildAtStart:unknown=null;private pacingAtStart:unknown=null;private submissionCoverageAtStart:unknown=null;private loopCoverageAtStart:unknown=null;
 constructor(private settings:()=>unknown,private context:RideProfileContext={}){
  // Keep optional diagnostics in Settings, never above the riding/touch controls.
  this.panel.id='ride-profile';this.panel.style.cssText='margin:12px 0;padding:12px;max-width:100%;background:#0b242de8;color:#fff;font:12px system-ui';
  this.label.textContent='Ride profile · ready';this.label.style.cssText='min-height:44px;cursor:pointer';this.panel.append(this.label);
  this.button.type='button';this.button.style.minHeight='44px';this.button.textContent=this.context.shortRideSeconds?'Start Cadillac ride capture':'Start 10-minute capture';this.button.onclick=()=>this.running?this.finish():this.start();this.panel.append(this.button);
  this.output.readOnly=true;this.output.setAttribute('aria-label','Ride profile report');this.output.style.cssText='display:block;box-sizing:border-box;width:100%;max-width:100%;height:160px';this.output.hidden=true;this.panel.append(this.output);document.getElementById('settings')?.append(this.panel);
  this.download.type='button';this.download.style.minHeight='44px';this.download.textContent='Download JSON report';this.download.hidden=true;this.download.onclick=()=>{
   const url=URL.createObjectURL(new Blob([this.output.value],{type:'application/json;charset=utf-8'})),link=document.createElement('a');
   link.href=url;link.download='belle-isle-ride-profile-'+this.started.replace(/[:.]/g,'-')+'.json';link.style.display='none';document.body.append(link);link.click();link.remove();setTimeout(()=>URL.revokeObjectURL(url),10000);
  };this.panel.append(this.download);
  document.addEventListener('visibilitychange',()=>{if(this.running&&document.hidden)this.interruptions++;this.stats.breakPosition();this.context.resetRenderDiagnostics?.();observeLoop(this.context.loopProbe,probe=>probe.breakAssociation());});
  // Browser-only measurement boundary, never enabled on hosted production.
  // Genuine trusted release ends the FULL or DIAGNOSTIC local sample BEFORE opening Settings.
  const localBrowserProfile=typeof location!=='undefined'&&['localhost','127.0.0.1','[::1]'].includes(location.hostname)&&new URLSearchParams(location.search).get('profile')==='1';
  if(localBrowserProfile&&!this.context.shortRideSeconds)document.addEventListener('keyup',event=>{
   if(this.running&&event.isTrusted&&event.code==='KeyW')this.finish('trusted-W-keyup');
  },true);
 }
 get enabled(){return this.running;}
 get shortStatus(){if(!this.context.shortRideSeconds)return '';return this.running?'Ride capture '+Math.floor(this.stats.activeSeconds)+' / '+this.context.shortRideSeconds+' s':this.started?'Report ready in Settings':'';}
 breakFrameAssociation(){this.stats.breakCallback();this.context.resetRenderDiagnostics?.();observeLoop(this.context.loopProbe,probe=>probe.breakAssociation());}
 start(){this.context.gpuProbe?.startCapture();this.context.resetRenderDiagnostics?.();this.running=true;this.stats=new RideProfileStats();observeLoop(this.context.loopProbe,probe=>probe.startCapture());this.interruptions=0;this.stamp=0;this.started=new Date().toISOString();this.settingsAtStart=snapshot(this.settings());this.buildAtStart=snapshot(this.context.build?.()??missingBuild);this.pacingAtStart=snapshot(this.context.gpuPacing?.());this.submissionCoverageAtStart=snapshot(this.context.submissionCoverage?.());this.loopCoverageAtStart=snapshot(this.context.loopCoverage?.());this.output.hidden=true;this.download.hidden=true;this.button.textContent='Stop and show report';this.panel.open=false;}
 sample(dt:number,times:number[],draws:number,triangles:number,textures:number,geometries:number,x:number,z:number,speed:number,place:string,eligible:boolean,nature?:NatureRenderFrame,submission?:RenderSubmissionFrame){
  if(!this.running)return;
  const timing=observeLoop(this.context.loopProbe,probe=>probe.beginProfileSample());
  try{
   const previousProfiledSample=this.stats.previousProfiledSample;
   if(!this.stats.sample({dt,times,draws,triangles,textures,geometries,x,z,speed,place,eligible,hidden:document.hidden,nature,submission})){observeLoop(this.context.loopProbe,probe=>probe.rejectSampleAssociation());return;}
   observeLoop(this.context.loopProbe,probe=>probe.bindAcceptedSample({sample:this.stats.acceptedFrames,previousProfiledSample,associationValid:this.stats.previousProfiledSample===this.stats.acceptedFrames,frameMs:dt*1000,place,x,z,draws,triangles,renderMs:times[3]}));
   if(this.stats.activeSeconds-this.stamp>.5){this.stamp=this.stats.activeSeconds;this.label.textContent='Ride profile · '+(this.context.shortRideSeconds?Math.floor(this.stats.activeSeconds)+'/'+this.context.shortRideSeconds+' s active':Math.floor(this.stats.movingSeconds)+'/600 s riding · '+Math.floor(this.stats.activeSeconds)+' s active');}
   if(this.context.shortRideSeconds){if(this.stats.activeSeconds>=this.context.shortRideSeconds)this.finish('diagnostic-duration');}else if(this.stats.movingSeconds>=600)this.finish();
  }finally{observeLoop(this.context.loopProbe,probe=>probe.endScope(timing));}
 }
 finish(stopReason='manual'){
  const gpuDiagnostics=this.context.gpuProbe?.stopCapture();
  const loopReport=observeLoop(this.context.loopProbe,probe=>probe.stopCapture());
  this.breakFrameAssociation();this.running=false;this.button.textContent=this.context.shortRideSeconds?'Start Cadillac ride capture':'Start 10-minute capture';
  const report={version:6,...(gpuDiagnostics?{gpuDiagnostics}:{}),started:this.started,stopReason,...this.stats.report(),visibilityInterruptions:this.interruptions,settingsAtStart:this.settingsAtStart,settings:snapshot(this.settings()),buildAtStart:this.buildAtStart,build:snapshot(this.context.build?.()??missingBuild),gpuFramePacing:{atStart:this.pacingAtStart,atFinish:snapshot(this.context.gpuPacing?.()),note:'Lifetime animation-loop counters at capture boundaries, including menus and hidden periods; null means unsupported or uninstalled. Pending-fence spans run from the first skipped callback to resumption or clearing, and include time between browser callbacks. These are wall-time observations, not GPU execution timings or eligible-frame totals. Maxima are lifetime maxima; subtract only cumulative counters and sums. They do not alter the frame intervals or FPS above.'},submissionInstrumentation:{atStart:this.submissionCoverageAtStart,atFinish:snapshot(this.context.submissionCoverage?.()),note:'Manual rendering observer coverage. CPU timings include observer overhead; native calls and original frame accounting are preserved. Missing or failed hooks leave those operations unmeasured, not free. These are not GPU execution timings.'},...(this.context.loopProbe?{loopDiagnostics:{...(loopReport??{}),status:loopReport?'available':'unavailable',coverage:{atStart:this.loopCoverageAtStart,atFinish:snapshot(this.context.loopCoverage?.())}}}:{}),viewport:[innerWidth,innerHeight,devicePixelRatio],resources:performance.getEntriesByType('resource').map(e=>{const r=e as PerformanceResourceTiming;return {name:r.name.split('/').at(-1)?.split('?')[0],durationMs:r.duration,transferBytes:r.transferSize,decodedBytes:r.decodedBodySize};}).filter(r=>r.decodedBytes>250000).slice(0,100),note:'Eligible foreground frame intervals include long stalls; menu, paused, hidden and first-resume intervals are excluded. CPU phase durations are not GPU timings; worldAndActivityCpuMs includes world, audio and activity updates. Moving seconds use observed speed. Counts, means and maxima cover all accepted frames; percentiles use up to the first 150000 samples, slowFrames retains up to the 100 worst located stalls, and resources lists up to 100 large transfers.'};
  this.output.value=JSON.stringify(report,null,2);this.output.hidden=false;this.download.hidden=false;this.panel.open=true;this.label.textContent='Ride profile · '+Math.round(this.stats.activeSeconds)+' s captured';
 }
}
