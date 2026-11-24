/** Opt-in, in-memory compass. No network, storage, or sensor access on construction. */
export type CompassStatus='off'|'requesting'|'tracking'|'unavailable'|'denied'|'stale';
export interface CompassSnapshot {
 status:CompassStatus;
 headingDegrees:number|null;
 accuracyDegrees:number|null;
}
export interface CompassReading {
 absolute?:boolean;
 alpha?:number|null;
 beta?:number|null;
 gamma?:number|null;
 webkitCompassHeading?:number|null;
 webkitCompassAccuracy?:number|null;
}
type CompassDirection=Pick<CompassSnapshot,'headingDegrees'|'accuracyDegrees'>;
const radians=Math.PI/180;
const finite=(value:unknown):value is number=>typeof value==='number'&&Number.isFinite(value);
const wrap=(degrees:number)=>((degrees%360)+360)%360;

/** Shortest angular interpolation, including the 359° → 1° boundary. */
export function smoothCompassHeading(previous:number,next:number,seconds:number,timeConstant=.18):number {
 if(!finite(previous)||!finite(next)||!finite(seconds)||seconds<0)return finite(next)?wrap(next):0;
 const fraction=1-Math.exp(-Math.min(seconds,1)/Math.max(.001,timeConstant));
 return wrap(previous+((next-previous+540)%360-180)*fraction);
}

/**
 * Compass bearing of the current screen's top edge, not the camera's optical axis.
 * W3C body→Earth rotation is Rz(alpha) Rx(beta) Ry(gamma); Earth X is east,
 * Y is north. Screen rotation changes screen-up to [sin(angle),cos(angle),0].
 * Near-vertical top edges have no dependable horizontal bearing and are rejected.
 * https://www.w3.org/TR/2026/CRD-orientation-event-20261118/#a-2-alternate-device-orientation-representations
 */
function projectedTop(alpha:number,beta:number,gamma:number,screenAngle:number):number|null {
 const a=alpha*radians,b=beta*radians,g=gamma*radians,s=screenAngle*radians;
 const ca=Math.cos(a),sa=Math.sin(a),cb=Math.cos(b),sb=Math.sin(b),cg=Math.cos(g),sg=Math.sin(g);
 const upX=Math.sin(s),upY=Math.cos(s);
 const east=(ca*cg-sa*sb*sg)*upX-sa*cb*upY;
 const north=(sa*cg+ca*sb*sg)*upX+ca*cb*upY;
 if(Math.hypot(east,north)<.35)return null;
 return wrap(Math.atan2(east,north)/radians);
}

export function compassHeadingFromEvent(event:CompassReading,screenAngle=0):CompassDirection|null {
 if(!finite(screenAngle)||!finite(event.beta)||!finite(event.gamma)||Math.abs(event.beta)>180||Math.abs(event.gamma)>90)return null;
 // Safari's compass is already north referenced. Use only its explicitly valid
 // accuracy, and rotate from the hardware top edge to the current screen top.
 if(event.webkitCompassHeading!==undefined&&event.webkitCompassHeading!==null){
  if(!finite(event.webkitCompassHeading)||event.webkitCompassHeading<0||event.webkitCompassHeading>360||
     !finite(event.webkitCompassAccuracy)||event.webkitCompassAccuracy<0||event.webkitCompassAccuracy>30)return null;
  const natural=projectedTop(0,event.beta,event.gamma,0),screen=projectedTop(0,event.beta,event.gamma,screenAngle);
  if(natural===null||screen===null)return null;
  return {headingDegrees:wrap(event.webkitCompassHeading+screen-natural),accuracyDegrees:event.webkitCompassAccuracy};
 }
 // Ordinary relative alpha has an arbitrary zero. Never label it as north.
 if(event.absolute!==true||!finite(event.alpha)||event.alpha<0||event.alpha>360)return null;
 const headingDegrees=projectedTop(event.alpha,event.beta,event.gamma,screenAngle);
 return headingDegrees===null?null:{headingDegrees,accuracyDegrees:null};
}

export interface CompassEventTarget {
 addEventListener(type:string,listener:EventListener):void;
 removeEventListener(type:string,listener:EventListener):void;
}
export interface CompassDocument extends CompassEventTarget {readonly hidden:boolean;}
export interface CompassPermissionSource {requestPermission?:(absolute?:boolean)=>Promise<string>;}
export interface CompassClock {
 now:()=>number;
 setInterval:(callback:()=>void,milliseconds:number)=>unknown;
 clearInterval:(id:unknown)=>void;
}
export interface CompassDependencies {
 page?:CompassEventTarget|null;
 document?:CompassDocument|null;
 orientation?:CompassPermissionSource|null;
 secureContext?:boolean;
 screenAngle?:()=>number;
 screenOrientation?:CompassEventTarget|null;
 clock?:CompassClock;
}

export class BrowserCompass {
 private state:CompassSnapshot={status:'off',headingDegrees:null,accuracyDegrees:null};
 private onChange:(snapshot:CompassSnapshot)=>void;
 private page:CompassEventTarget|null;
 private document:CompassDocument|null;
 private orientation:CompassPermissionSource|null;
 private secureContext:boolean;
 private screenAngle:()=>number;
 private screenOrientation:CompassEventTarget|null;
 private clock:CompassClock;
 private generation=0;
 private requested=false;
 private disposed=false;
 private interval:unknown=null;
 private listener:EventListener|null=null;
 private previousHeading:number|null=null;
 private lastReadingAt:number|null=null;
 private startedAt=0;
 private lastNotifyAt=-Infinity;
 private lastScreenAngle:number|null=null;
 private visibility:EventListener=()=>{if(this.document?.hidden)this.stop();};
 private pagehide:EventListener=()=>this.stop();
 private screenChanged:EventListener=()=>{
  if(!this.requested)return;
  this.previousHeading=null;this.lastReadingAt=null;this.lastScreenAngle=null;
  this.set('unavailable');
 };

 constructor(onChange:(snapshot:CompassSnapshot)=>void,dependencies:CompassDependencies={}){
  this.onChange=onChange;
  this.page=dependencies.page===undefined?(typeof window==='undefined'?null:window):dependencies.page;
  this.document=dependencies.document===undefined?(typeof document==='undefined'?null:document):dependencies.document;
  this.orientation=dependencies.orientation===undefined?(typeof DeviceOrientationEvent==='undefined'?null:DeviceOrientationEvent as unknown as CompassPermissionSource):dependencies.orientation;
  this.secureContext=dependencies.secureContext??(typeof isSecureContext!=='undefined'&&isSecureContext);
  this.screenOrientation=dependencies.screenOrientation===undefined?(typeof window==='undefined'?null:window.screen.orientation??null):dependencies.screenOrientation;
  this.screenAngle=dependencies.screenAngle??(()=>{
   if(typeof window==='undefined')return 0;
   const legacy=(window as Window&{orientation?:number}).orientation;
   const angle=window.screen.orientation?.angle;
   // Safari's legacy angle is tied to its device-orientation frame. Modern
   // browsers expose the natural-screen rotation through ScreenOrientation.
   return finite(legacy)?legacy:finite(angle)?angle:0;
  });
  this.clock=dependencies.clock??{
   now:()=>performance.now(),
   setInterval:(callback,milliseconds)=>globalThis.setInterval(callback,milliseconds),
   clearInterval:id=>globalThis.clearInterval(id as ReturnType<typeof setInterval>)
  };
  this.document?.addEventListener('visibilitychange',this.visibility);
  this.page?.addEventListener('pagehide',this.pagehide);
  this.page?.addEventListener('orientationchange',this.screenChanged);
  this.screenOrientation?.addEventListener('change',this.screenChanged);
 }

 get snapshot():CompassSnapshot{return {...this.state};}
 get active():boolean{return this.requested;}

 /** Call directly in a real click handler; do not defer it through another await. */
 async enable():Promise<void>{
  if(this.disposed||this.requested)return;
  this.detach();
  const generation=++this.generation;
  if(!this.secureContext||!this.page||!this.orientation||this.document?.hidden){this.set('unavailable');return;}
  this.requested=true;
  this.set('requesting');
  if(generation!==this.generation||this.disposed)return;
  try{
   // The permission function is invoked synchronously before this first await,
   // preserving transient user activation required by iOS and the specification.
   const permission=this.orientation.requestPermission?.call(this.orientation,true);
   if(permission!==undefined){
    const result=await permission;
    if(generation!==this.generation||this.disposed)return;
    if(result!=='granted'){this.requested=false;this.set('denied');return;}
   }
   if(generation!==this.generation||this.disposed)return;
   if(this.document?.hidden){this.stop();return;}
   this.startedAt=this.clock.now();
   this.listener=(event:Event)=>this.receive(event as DeviceOrientationEvent,generation);
   this.page.addEventListener('deviceorientation',this.listener);
   this.page.addEventListener('deviceorientationabsolute',this.listener);
   this.interval=this.clock.setInterval(()=>{
    if(generation!==this.generation||this.disposed)return;
    const age=this.clock.now()-(this.lastReadingAt??this.startedAt);
    if(age>=3000){this.previousHeading=null;this.set(this.lastReadingAt===null?'unavailable':'stale');}
   },250);
  }catch(error){
   if(generation!==this.generation||this.disposed)return;
   this.detach();this.requested=false;
   const name=error&&typeof error==='object'&&'name'in error?String(error.name):'';
   this.set(name==='NotAllowedError'||name==='SecurityError'?'denied':'unavailable');
  }
 }

 private receive(event:CompassReading,generation:number){
  if(generation!==this.generation||this.disposed||!this.requested||this.document?.hidden)return;
  const angle=this.screenAngle(),reading=compassHeadingFromEvent(event,angle);
  if(!reading||reading.headingDegrees===null){
   // Relative companion events may arrive alongside valid absolute events. They
   // neither replace a heading nor refresh its expiry. Explicitly bad compass
   // data (including vertical tilt or poor accuracy) invalidates it immediately.
   if(event.absolute===true||event.webkitCompassHeading!==undefined&&event.webkitCompassHeading!==null){
    this.previousHeading=null;this.lastReadingAt=null;this.set('unavailable');
   }
   return;
  }
  const now=this.clock.now();
  const reoriented=this.lastScreenAngle!==null&&wrap(angle)!==this.lastScreenAngle;
  const heading=this.previousHeading===null||this.lastReadingAt===null||reoriented
   ?reading.headingDegrees:smoothCompassHeading(this.previousHeading,reading.headingDegrees,Math.max(0,(now-this.lastReadingAt)/1000));
  const priorStatus=this.state.status;
  this.previousHeading=heading;this.lastReadingAt=now;this.lastScreenAngle=wrap(angle);
  this.state={status:'tracking',headingDegrees:heading,accuracyDegrees:reading.accuracyDegrees};
  // Keep sensor math responsive without rebuilding status text at sensor rate.
  if(priorStatus!=='tracking'||now-this.lastNotifyAt>=100){this.lastNotifyAt=now;this.onChange(this.snapshot);}
 }

 private set(status:CompassStatus){
  if(this.state.status===status&&this.state.headingDegrees===null&&this.state.accuracyDegrees===null)return;
  this.state={status,headingDegrees:null,accuracyDegrees:null};
  this.onChange(this.snapshot);
 }
 private detach(){
  if(this.listener){this.page?.removeEventListener('deviceorientation',this.listener);this.page?.removeEventListener('deviceorientationabsolute',this.listener);this.listener=null;}
  if(this.interval!==null){this.clock.clearInterval(this.interval);this.interval=null;}
  this.previousHeading=null;this.lastReadingAt=null;this.lastScreenAngle=null;this.lastNotifyAt=-Infinity;
 }
 stop(){
  ++this.generation;this.requested=false;this.detach();
  this.set('off');
 }
 dispose(){
  if(this.disposed)return;
  this.stop();this.disposed=true;
  this.document?.removeEventListener('visibilitychange',this.visibility);
  this.page?.removeEventListener('pagehide',this.pagehide);
  this.page?.removeEventListener('orientationchange',this.screenChanged);
  this.screenOrientation?.removeEventListener('change',this.screenChanged);
 }
}
