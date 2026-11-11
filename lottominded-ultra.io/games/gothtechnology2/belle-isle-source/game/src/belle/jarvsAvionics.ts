/** JARVS flight advisor. No models, requests, DOM, timers or extra render targets.
 * This is an optional, bounded heuristic copilot; HoverController remains the
 * authoritative collision/flight simulator. Never run it during a race start.
 */
export type JarvsStatus='STANDBY'|'SCANNING'|'CAUTION'|'CRITICAL';
export type JarvsPriority='info'|'warning'|'critical';
export type JarvsVoice={text:string;priority:JarvsPriority};
export type JarvsInput={
 now:number;x:number;y:number;z:number;heading:number;speed:number;clearance:number;
 flying:boolean;landed:boolean;collision:boolean;hazard:boolean;
 mode:'classic'|'drone';blocked:boolean;racing:boolean;
};
export type JarvsEnvironment={
 floor:(x:number,z:number)=>number;
 obstacle?:(origin:{x:number;y:number;z:number},direction:{x:number;y:number;z:number},distance:number)=>number|null;
};
export type JarvsReading={
 status:JarvsStatus;signalLock:boolean;radarMeters:number|null;terrainRise:number;
 threat:number;memoryCells:number;intensity:'normal'|'high';advice:string;
 suggestedLift:number;announcement?:JarvsVoice;
};
type Cell={risk:number;rise:number;visits:number};
const finite=(n:number)=>Number.isFinite(n);
const clamp=(x:number,a:number,b:number)=>Math.max(a,Math.min(b,x));
const neutral=():JarvsReading=>({status:'STANDBY',signalLock:false,radarMeters:null,terrainRise:0,
 threat:0,memoryCells:0,intensity:'normal',advice:'Standing by',suggestedLift:0});

/** No unbounded storage: at most 64 transient 40-metre grid cells per ride. */
export class JarvsAvionics {
 private cells=new Map<string,Cell>();
 private lastScan=-Infinity;
 private lastVoice=-Infinity;
 private lastStatus:JarvsStatus='STANDBY';
 private view:JarvsReading=neutral();
 assistEnabled=false;
 readonly maxCells=64;
 readonly scanIntervalMs=250;
 private readonly environment:JarvsEnvironment;
 constructor(environment:JarvsEnvironment){this.environment=environment;}
 reset(){this.cells.clear();this.lastScan=-Infinity;this.lastVoice=-Infinity;this.lastStatus='STANDBY';this.view=neutral();}
 get snapshot():JarvsReading{return {...this.view};}
 private cell(x:number,z:number){return Math.floor(x/40)+':'+Math.floor(z/40);}
 private remember(key:string,risk:number,rise:number){
  const old=this.cells.get(key);
  if(old)this.cells.delete(key); // Reinsert as most recently used.
  else if(this.cells.size>=this.maxCells)this.cells.delete(this.cells.keys().next().value!);
  this.cells.set(key,{risk:clamp((old?.risk??0)*.75+risk*.25,0,1),
   rise:Math.max(rise,(old?.rise??0)*.8),visits:Math.min(65535,(old?.visits??0)+1)});
 }
 update(s:JarvsInput):JarvsReading{
  if(![s.now,s.x,s.y,s.z,s.heading,s.speed,s.clearance].every(finite)||
     !s.flying||s.landed||s.blocked||s.racing){
   this.view={...neutral(),memoryCells:this.cells.size};
   this.lastScan=-Infinity;this.lastStatus='STANDBY';return {...this.view};
  }
  if(s.now-this.lastScan<this.scanIntervalMs)return {...this.view};
  this.lastScan=s.now;
  const distance=clamp(10+Math.abs(s.speed)*.8,10,32);
  const dx=Math.sin(s.heading),dz=Math.cos(s.heading);
  const aheadX=s.x+dx*distance,aheadZ=s.z+dz*distance;
  // Two cheap height samples and at most one forward collision ray every 250ms.
  let rise=0,hit:null|number=null;
  try{
   const a=this.environment.floor(s.x,s.z),b=this.environment.floor(aheadX,aheadZ);
   if(finite(a)&&finite(b))rise=clamp(b-a,0,36);
   const candidate=this.environment.obstacle?.({x:s.x,y:s.y+1,z:s.z},{x:dx,y:0,z:dz},distance);
   if(candidate!==null&&candidate!==undefined&&finite(candidate)&&candidate>=0)hit=clamp(candidate,0,distance);
  }catch{ // A diagnostic sensor must never interrupt the flight loop.
   this.view={...neutral(),status:'CAUTION',advice:'Sensor unavailable',memoryCells:this.cells.size};
   return {...this.view};
  }
  const threshold=clamp(6+Math.abs(s.speed)*1.1,8,24);
  const close=hit!==null&&hit<threshold;
  const currentKey=this.cell(s.x,s.z),nextKey=this.cell(aheadX,aheadZ);
  const remembered=this.cells.get(nextKey);
  const predictedRise=Math.max(rise,remembered?.rise??0);
  const climb=predictedRise>1.2&&s.clearance<predictedRise+2;
  const warning=s.collision||s.hazard||close;
  const risk=s.collision?1:warning?0.85:climb?0.48:0;
  this.remember(currentKey,risk,rise);
  const status:JarvsStatus=s.collision?'CRITICAL':warning||climb?'CAUTION':'SCANNING';
  const high=Math.abs(s.speed)>=14||s.collision;
  const suggestedLift=this.assistEnabled&&s.mode==='drone'&&!warning&&climb&&s.clearance>1.2
   ?clamp((predictedRise+2-s.clearance)*.12,.12,.38):0;
  const advice=s.collision?'Contact detected — stabilize':
   warning?'Obstacle ahead — steer or brake':
   climb?'Rising terrain — increase clearance':'Flight path clear';
  let announcement:JarvsVoice|undefined;
  const change=status!==this.lastStatus;
  const interval=status==='CRITICAL'?1800:6500;
  if(change&&s.now-this.lastVoice>=interval){
   if(status==='CRITICAL')announcement={text:'Jarvs. Contact detected. Stabilize now.',priority:'critical'};
   else if(warning)announcement={text:'Jarvs. Obstacle ahead. Steer clear or brake.',priority:'warning'};
   else if(climb)announcement={text:'Jarvs. Ground rising ahead. Increase altitude.',priority:'warning'};
   else if(this.lastStatus==='CAUTION')announcement={text:'Jarvs. Flight path clear.',priority:'info'};
   if(announcement)this.lastVoice=s.now;
  }
  this.lastStatus=status;
  this.view={status,signalLock:true,radarMeters:hit,terrainRise:predictedRise,
   threat:risk,memoryCells:this.cells.size,intensity:high?'high':'normal',
   advice,suggestedLift};
  return {...this.view,announcement};
 }
 /** Never override a human lift input, a race lock, or Classic flight physics. */
 assistLift(userLift:number,mode:'classic'|'drone',racing:boolean):number{
  if(!finite(userLift))return 0;
  if(!this.assistEnabled||mode!=='drone'||racing||userLift!==0||!this.view.signalLock)return userLift;
  return this.view.suggestedLift;
 }
}
