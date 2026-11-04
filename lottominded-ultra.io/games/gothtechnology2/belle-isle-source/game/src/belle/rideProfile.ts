/** Opt-in, local-only ride diagnostics. Render CPU time is not GPU time. */
export class RideProfile {
 private running=false; private elapsed=0; private moving=0; private distance=0;
 private lastPosition:{x:number;z:number}|null=null; private excluded=0;
 private frames:number[][]=[]; private slowFrames:{place:string;x:number;z:number;frameMs:number;renderMs:number}[]=[]; private places=new Set<string>(); private interruptions=0;
 private panel=document.createElement('details'); private label=document.createElement('summary');
 private button=document.createElement('button'); private output=document.createElement('textarea');
 private stamp=0; private started='';
 constructor(private settings:()=>unknown){
  this.panel.id='ride-profile';this.panel.style.cssText='position:fixed;bottom:66px;left:12px;z-index:40;max-width:min(440px,90vw);padding:8px;background:#0b242de8;color:#fff;font:12px system-ui';
  this.label.textContent='Ride profile · ready';this.panel.append(this.label);
  this.button.textContent='Start 10-minute capture';this.button.onclick=()=>this.running?this.finish():this.start();this.panel.append(this.button);
  this.output.readOnly=true;this.output.setAttribute('aria-label','Ride profile report');this.output.style.cssText='display:block;width:400px;max-width:80vw;height:160px';this.output.hidden=true;this.panel.append(this.output);document.body.append(this.panel);
  document.addEventListener('visibilitychange',()=>{if(this.running&&document.hidden)this.interruptions++;this.lastPosition=null;});
 }
 get enabled(){return this.running;}
 start(){this.running=true;this.elapsed=this.moving=this.distance=this.excluded=0;this.interruptions=0;this.stamp=0;this.frames=[];this.slowFrames=[];this.places.clear();this.lastPosition=null;this.started=new Date().toISOString();this.output.hidden=true;this.button.textContent='Stop and show report';this.panel.open=false;}
 sample(dt:number,times:number[],draws:number,triangles:number,textures:number,geometries:number,x:number,z:number,speed:number,place:string,eligible:boolean){
  if(!this.running)return;
  if(!eligible||document.hidden||dt>2){this.excluded+=dt;this.lastPosition=null;return;}
  this.elapsed+=dt;if(Math.abs(speed)>.35)this.moving+=dt;
  if(this.lastPosition){const d=Math.hypot(x-this.lastPosition.x,z-this.lastPosition.z);if(d<25)this.distance+=d;}
  this.lastPosition={x,z};this.places.add(place);
  if(dt>.1&&this.slowFrames.length<100)this.slowFrames.push({place,x,z,frameMs:dt*1000,renderMs:times[3]});
  if(this.frames.length<150000)this.frames.push([dt*1000,...times,draws,triangles,textures,geometries]);
  if(this.elapsed-this.stamp>.5){this.stamp=this.elapsed;this.label.textContent='Ride profile · '+Math.floor(this.moving)+'/600 s riding · '+Math.floor(this.elapsed)+' s active';}
  if(this.moving>=600)this.finish();
 }
 finish(){
  this.running=false;this.button.textContent='Start 10-minute capture';
  const metric=(column:number)=>{const a=this.frames.map(r=>r[column]).sort((x,y)=>x-y);return a.length?{mean:a.reduce((s,v)=>s+v,0)/a.length,p50:a[Math.floor(a.length*.5)],p95:a[Math.floor(a.length*.95)],p99:a[Math.floor(a.length*.99)],max:a.at(-1)}:null;};
  const report={version:2,slowFrames:this.slowFrames,started:this.started,activeSeconds:this.elapsed,movingSeconds:this.moving,distanceMetres:this.distance,excludedSeconds:this.excluded,visibilityInterruptions:this.interruptions,frames:this.frames.length,observedFPS:this.frames.length/Math.max(.001,this.elapsed),over50ms:this.frames.filter(f=>f[0]>50).length,over100ms:this.frames.filter(f=>f[0]>100).length,settings:this.settings(),viewport:[innerWidth,innerHeight,devicePixelRatio],places:[...this.places],metrics:Object.fromEntries(['frameMs','simulationCpuMs','presentationCpuMs','worldCpuMs','renderSubmitCpuMs','hudCpuMs','drawCalls','triangles','textures','geometries'].map((name,i)=>[name,metric(i)])),resources:performance.getEntriesByType('resource').map(e=>{const r=e as PerformanceResourceTiming;return {name:r.name.split('/').at(-1)?.split('?')[0],durationMs:r.duration,transferBytes:r.transferSize,decodedBytes:r.decodedBodySize};}).filter(r=>r.decodedBytes>250000),note:'Foreground frame intervals and CPU submission timings; not GPU timings. Menu, paused and hidden time excluded. Moving seconds distinguish riding from standing.'};
  this.output.value=JSON.stringify(report,null,2);this.output.hidden=false;this.panel.open=true;this.label.textContent='Ride profile · '+Math.round(this.elapsed)+' s captured';
 }
}
