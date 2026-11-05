/** Opt-in, local-only ride diagnostics. Render CPU time is not GPU time. */
import {RideProfileStats} from './rideProfileStats.ts';
export class RideProfile {
 private running=false;private stats=new RideProfileStats();private interruptions=0;
 private panel=document.createElement('details'); private label=document.createElement('summary');
 private button=document.createElement('button'); private output=document.createElement('textarea');
 private stamp=0; private started='';
 constructor(private settings:()=>unknown){
  this.panel.id='ride-profile';this.panel.style.cssText='position:fixed;bottom:66px;left:12px;z-index:40;max-width:min(440px,90vw);padding:8px;background:#0b242de8;color:#fff;font:12px system-ui';
  this.label.textContent='Ride profile · ready';this.panel.append(this.label);
  this.button.textContent='Start 10-minute capture';this.button.onclick=()=>this.running?this.finish():this.start();this.panel.append(this.button);
  this.output.readOnly=true;this.output.setAttribute('aria-label','Ride profile report');this.output.style.cssText='display:block;width:400px;max-width:80vw;height:160px';this.output.hidden=true;this.panel.append(this.output);document.body.append(this.panel);
  document.addEventListener('visibilitychange',()=>{if(this.running&&document.hidden)this.interruptions++;this.stats.breakPosition();});
 }
 get enabled(){return this.running;}
 start(){this.running=true;this.stats=new RideProfileStats();this.interruptions=0;this.stamp=0;this.started=new Date().toISOString();this.output.hidden=true;this.button.textContent='Stop and show report';this.panel.open=false;}
 sample(dt:number,times:number[],draws:number,triangles:number,textures:number,geometries:number,x:number,z:number,speed:number,place:string,eligible:boolean){
  if(!this.running)return;
  if(!this.stats.sample({dt,times,draws,triangles,textures,geometries,x,z,speed,place,eligible,hidden:document.hidden}))return;
  if(this.stats.activeSeconds-this.stamp>.5){this.stamp=this.stats.activeSeconds;this.label.textContent='Ride profile · '+Math.floor(this.stats.movingSeconds)+'/600 s riding · '+Math.floor(this.stats.activeSeconds)+' s active';}
  if(this.stats.movingSeconds>=600)this.finish();
 }
 finish(){
  this.running=false;this.button.textContent='Start 10-minute capture';
  const report={version:3,started:this.started,...this.stats.report(),visibilityInterruptions:this.interruptions,settings:this.settings(),viewport:[innerWidth,innerHeight,devicePixelRatio],resources:performance.getEntriesByType('resource').map(e=>{const r=e as PerformanceResourceTiming;return {name:r.name.split('/').at(-1)?.split('?')[0],durationMs:r.duration,transferBytes:r.transferSize,decodedBytes:r.decodedBodySize};}).filter(r=>r.decodedBytes>250000).slice(0,100),note:'Eligible foreground frame intervals include long stalls; menu, paused, hidden and first-resume intervals are excluded. CPU phase durations are not GPU timings; worldAndActivityCpuMs includes world, audio and activity updates. Moving seconds use observed speed. Counts, means and maxima cover all accepted frames; percentiles use up to the first 150000 samples, slowFrames retains up to the 100 worst located stalls, and resources lists up to 100 large transfers.'};
  this.output.value=JSON.stringify(report,null,2);this.output.hidden=false;this.panel.open=true;this.label.textContent='Ride profile · '+Math.round(this.stats.activeSeconds)+' s captured';
 }
}
