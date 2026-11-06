/** Pure, bounded capture statistics. Eligible foreground stalls are real frame time. */
export interface RideProfileFrame {
 dt:number;times:readonly number[];draws:number;triangles:number;textures:number;geometries:number;
 x:number;z:number;speed:number;place:string;eligible:boolean;hidden:boolean;
}
interface SlowFrame {place:string;x:number;z:number;frameMs:number;renderMs:number}
interface Limits {frames:number;slowFrames:number;places:number}
const metricNames=['frameMs','simulationCpuMs','presentationCpuMs','worldAndActivityCpuMs','renderSubmitCpuMs','hudCpuMs','drawCalls','triangles','textures','geometries'] as const;
export class RideProfileStats {
 activeSeconds=0;movingSeconds=0;distanceMetres=0;
 private excludedSeconds=0;private hiddenSeconds=0;private inactiveSeconds=0;private invalidSamples=0;private invalidMetricSamples=0;
 private frameCount=0;private over50ms=0;private over100ms=0;private over250ms=0;private over2s=0;
 private frames:number[][]=[];private slowFrames:SlowFrame[]=[];private places=new Set<string>();private placesTruncated=false;
 private sums=Array<number>(metricNames.length).fill(0);private maxima=Array<number>(metricNames.length).fill(0);
 private lastPosition:{x:number;z:number}|null=null;private limits:Limits;
 constructor(limits:Partial<Limits>={}){this.limits={frames:limits.frames??150000,slowFrames:limits.slowFrames??100,places:limits.places??256};}
 breakPosition(){this.lastPosition=null;}
 sample(frame:RideProfileFrame){
  const {dt,eligible,hidden}=frame;
  if(!Number.isFinite(dt)||dt<=0||!Number.isFinite(dt*1000)){this.invalidSamples++;this.breakPosition();return false;}
  if(!eligible||hidden){this.excludedSeconds+=dt;if(hidden)this.hiddenSeconds+=dt;else this.inactiveSeconds+=dt;this.breakPosition();return false;}
  this.activeSeconds+=dt;this.frameCount++;
  if(Number.isFinite(frame.speed)&&Math.abs(frame.speed)>.35)this.movingSeconds+=dt;
  const positionValid=Number.isFinite(frame.x)&&Number.isFinite(frame.z);
  if(positionValid){
   if(this.lastPosition){const distance=Math.hypot(frame.x-this.lastPosition.x,frame.z-this.lastPosition.z);if(distance<25)this.distanceMetres+=distance;}
   this.lastPosition={x:frame.x,z:frame.z};
  }else this.breakPosition();
  if(!this.places.has(frame.place)){if(this.places.size<this.limits.places)this.places.add(frame.place);else this.placesTruncated=true;}
  const values=[dt*1000,...Array.from({length:5},(_,i)=>frame.times[i]),frame.draws,frame.triangles,frame.textures,frame.geometries];
  if(values.some(value=>!Number.isFinite(value)||value<0))this.invalidMetricSamples++;
  const row=values.map(value=>Number.isFinite(value)&&value>=0?value:0);
  for(let i=0;i<row.length;i++){this.sums[i]+=row[i];this.maxima[i]=Math.max(this.maxima[i],row[i]);}
  if(this.frames.length<this.limits.frames)this.frames.push(row);
  if(dt>.05)this.over50ms++;if(dt>.1)this.over100ms++;if(dt>.25)this.over250ms++;if(dt>2)this.over2s++;
  if(dt>.1&&positionValid&&this.limits.slowFrames>0){
   const slow={place:frame.place,x:frame.x,z:frame.z,frameMs:row[0],renderMs:row[4]};
   if(this.slowFrames.length<this.limits.slowFrames)this.slowFrames.push(slow);
   else{let least=0;for(let i=1;i<this.slowFrames.length;i++)if(this.slowFrames[i].frameMs<this.slowFrames[least].frameMs)least=i;if(slow.frameMs>this.slowFrames[least].frameMs)this.slowFrames[least]=slow;}
  }
  return true;
 }
 report(){
  const metric=(column:number)=>{
   if(!this.frameCount)return null;
   const values=this.frames.map(row=>row[column]).sort((a,b)=>a-b);
   return {mean:this.sums[column]/this.frameCount,p50:values.length?values[Math.floor(values.length*.5)]:null,p95:values.length?values[Math.floor(values.length*.95)]:null,p99:values.length?values[Math.floor(values.length*.99)]:null,max:this.maxima[column]};
  };
  return {activeSeconds:this.activeSeconds,movingSeconds:this.movingSeconds,distanceMetres:this.distanceMetres,
   excludedSeconds:this.excludedSeconds,hiddenSeconds:this.hiddenSeconds,inactiveSeconds:this.inactiveSeconds,invalidSamples:this.invalidSamples,invalidMetricSamples:this.invalidMetricSamples,
   frames:this.frameCount,sampledFrames:this.frames.length,droppedFrameSamples:this.frameCount-this.frames.length,
   observedFPS:this.frameCount/Math.max(.001,this.activeSeconds),over50ms:this.over50ms,over100ms:this.over100ms,over250ms:this.over250ms,over2s:this.over2s,maxFrameMs:this.maxima[0],
   slowFrames:this.slowFrames.slice().sort((a,b)=>b.frameMs-a.frameMs),places:[...this.places],placesTruncated:this.placesTruncated,
   metrics:Object.fromEntries(metricNames.map((name,i)=>[name,metric(i)]))};
 }
}
