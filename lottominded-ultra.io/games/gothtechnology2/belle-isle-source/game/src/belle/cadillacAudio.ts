export type AudioPoint=Readonly<{x:number;y:number;z:number}>;
export interface TrunkSpeakerFrame {
 source:AudioPoint;listener:AudioPoint;forward:AudioPoint;up:AudioPoint;
 /** Actual lid opening fraction, from 0 (latched) to 1 (fully open). */
 open:number;
}
type AudioFactory=()=>AudioContext|undefined;
const finite=(n:number,fallback=0)=>Number.isFinite(n)?n:fallback;
const unit=(n:number)=>Math.max(0,Math.min(1,finite(n)));
const makeContext:AudioFactory=()=>{
 const scope=globalThis as typeof globalThis&{webkitAudioContext?:typeof AudioContext};
 const Constructor=scope.AudioContext??scope.webkitAudioContext;
 return Constructor?new Constructor():undefined;
};
function point(target:AudioListener|PannerNode,p:AudioPoint,time:number){
 if(target.positionX){target.positionX.setValueAtTime(finite(p.x),time);target.positionY.setValueAtTime(finite(p.y),time);target.positionZ.setValueAtTime(finite(p.z),time);}
 else target.setPosition(finite(p.x),finite(p.y),finite(p.z));
}
function listener(context:AudioContext,frame:TrunkSpeakerFrame){
 const target=context.listener,time=context.currentTime;
 point(target,frame.listener,time);
 const f=frame.forward,u=frame.up,fl=Math.hypot(finite(f.x),finite(f.y),finite(f.z)),ul=Math.hypot(finite(u.x),finite(u.y),finite(u.z));
 const fx=fl?finite(f.x)/fl:0,fy=fl?finite(f.y)/fl:0,fz=fl?finite(f.z)/fl:-1,ux=ul?finite(u.x)/ul:0,uy=ul?finite(u.y)/ul:1,uz=ul?finite(u.z)/ul:0;
 if(target.forwardX){target.forwardX.setValueAtTime(fx,time);target.forwardY.setValueAtTime(fy,time);target.forwardZ.setValueAtTime(fz,time);target.upX.setValueAtTime(ux,time);target.upY.setValueAtTime(uy,time);target.upZ.setValueAtTime(uz,time);}
 else target.setOrientation(fx,fy,fz,ux,uy,uz);
}

/** One fixed music graph. Trunk motion changes parameters, never creates voices
 * or starts playback. Capture connects to the same post-spatial output as speakers. */
export class TrunkSpeakerBus {
 readonly input:GainNode;
 readonly output:GainNode;
 private readonly context:AudioContext;
 private readonly dry:GainNode;
 private readonly wet:GainNode;
 private readonly filter:BiquadFilterNode;
 private readonly panner:PannerNode;
 private readonly mix:GainNode;
 private readonly limiter:DynamicsCompressorNode;
 private enabled=false;
 private aperture=-1;
 private lastPose=-Infinity;
 private disposed=false;
 constructor(context:AudioContext){
  this.context=context;this.input=context.createGain();this.output=context.createGain();
  this.dry=context.createGain();this.wet=context.createGain();this.mix=context.createGain();
  this.filter=context.createBiquadFilter();this.filter.type='lowpass';this.filter.Q.value=.7;this.filter.frequency.value=1800;
  this.panner=context.createPanner();this.panner.panningModel='equalpower';this.panner.distanceModel='inverse';
  this.panner.refDistance=2.5;this.panner.maxDistance=40;this.panner.rolloffFactor=.8;
  this.panner.coneInnerAngle=360;this.panner.coneOuterAngle=360;
  this.limiter=context.createDynamicsCompressor();this.limiter.threshold.value=-2;this.limiter.knee.value=0;this.limiter.ratio.value=20;this.limiter.attack.value=.003;this.limiter.release.value=.08;
  this.dry.gain.value=1;this.wet.gain.value=0;
  this.input.connect(this.dry);this.dry.connect(this.mix);
  this.input.connect(this.filter);this.filter.connect(this.panner);this.panner.connect(this.wet);this.wet.connect(this.mix);
  this.mix.connect(this.limiter);this.limiter.connect(this.output);
 }
 setFrame(frame:TrunkSpeakerFrame|null){
  if(this.disposed)return;
  const time=this.context.currentTime,enabled=!!frame;
  if(enabled!==this.enabled){
   this.enabled=enabled;this.lastPose=-Infinity;this.aperture=-1;
   this.dry.gain.cancelScheduledValues(time);this.wet.gain.cancelScheduledValues(time);
   this.dry.gain.setTargetAtTime(enabled?0:1,time,.035);this.wet.gain.setTargetAtTime(enabled?1:0,time,.035);
  }
  if(!frame)return;
  // A 20 Hz spatial update is sufficient for this vehicle-sized source and
  // avoids scheduling AudioParams once per rendered frame on mobile devices.
  if(time-this.lastPose<.05)return;this.lastPose=time;
  point(this.panner,frame.source,time);listener(this.context,frame);
  const aperture=unit(frame.open);
  if(Math.abs(aperture-this.aperture)>.002){
   this.aperture=aperture;this.filter.frequency.setTargetAtTime(1800+14200*aperture,time,.06);
   this.wet.gain.setTargetAtTime(.62+.38*aperture,time,.06);
  }
 }
 capture(){
  if(this.disposed)return;
  const destination=this.context.createMediaStreamDestination(),output=this.output;let released=false;
  output.connect(destination);
  return {stream:destination.stream,release:()=>{if(released)return;released=true;try{output.disconnect(destination);}catch{/* The bus may already be disposed. */}destination.stream.getTracks().forEach(track=>track.stop());}};
 }
 dispose(){
  if(this.disposed)return;this.disposed=true;
  for(const node of [this.input,this.dry,this.filter,this.panner,this.wet,this.mix,this.limiter,this.output])node.disconnect();
 }
}

/** Adapts the existing built-in HTML soundtrack to the same trunk treatment.
 * attach/setFrame are silent; unlock is called from the existing trusted gesture. */
export class TrunkMediaOutput {
 private readonly create:AudioFactory;
 private audio?:HTMLMediaElement;
 private context?:AudioContext;
 private source?:MediaElementAudioSourceNode;
 private bus?:TrunkSpeakerBus;
 private frame:TrunkSpeakerFrame|null=null;
 private disposed=false;
 constructor(create:AudioFactory=makeContext){this.create=create;}
 attach(audio:HTMLMediaElement){if(this.disposed)return;if(this.audio&&this.audio!==audio)throw Error('The soundtrack output owns one media element');this.audio=audio;}
 async unlock(){
  if(this.disposed||!this.audio)return false;
  try{
   if(!this.context){
    const context=this.create();if(!context)return false;
    // Construct the graph before binding the media element, so an unsupported
    // audio API cannot permanently divert it into an incomplete output.
    let bus:TrunkSpeakerBus;
    try{bus=new TrunkSpeakerBus(context);}catch{void context.close().catch(()=>{});return false;}
    let source:MediaElementAudioSourceNode;
    try{source=context.createMediaElementSource(this.audio);}catch{bus.dispose();void context.close().catch(()=>{});return false;}
    this.context=context;this.bus=bus;this.source=source;source.connect(bus.input);bus.output.connect(context.destination);bus.setFrame(this.frame);
   }
   if(this.context.state!=='running')await this.context.resume();
   return !this.disposed&&this.context.state==='running';
  }catch{return false;}
 }
 setFrame(frame:TrunkSpeakerFrame|null){this.frame=frame;this.bus?.setFrame(frame);}
 capture(){
  if(this.disposed)return;return this.bus?.capture();
 }
 async dispose(){
  if(this.disposed)return;this.disposed=true;this.source?.disconnect();this.bus?.dispose();
  const context=this.context;this.context=undefined;this.bus=undefined;this.source=undefined;this.audio=undefined;
  if(context&&context.state!=='closed')try{await context.close();}catch{/* Page teardown. */}
 }
}

type HornGesture=Pick<Event,'isTrusted'>&{repeat?:boolean};
type HornVoice={tone:OscillatorNode;gain:GainNode;released:boolean};
/** A short, original dual-tone double honk. Only the accepted trunk-opening
 * click/key handler may request it; resets, frames and lid animation stay silent. */
export class CadillacHorn {
 private readonly create:AudioFactory;
 private readonly now:()=>number;
 private context?:AudioContext;
 private master?:GainNode;
 private filter?:BiquadFilterNode;
 private limiter?:DynamicsCompressorNode;
 private readonly voices=new Set<HornVoice>();
 private active=false;
 private disposed=false;
 private generation=0;
 private nextAllowed=-Infinity;
 private interrupted=()=>this.silence();
 private visibility=()=>{if(document.hidden)this.silence();};
 constructor(create:AudioFactory=makeContext,now:()=>number=()=>performance.now()){
  this.create=create;this.now=now;
  if(typeof window!=='undefined'){window.addEventListener('blur',this.interrupted);window.addEventListener('pagehide',this.interrupted);}
  if(typeof document!=='undefined')document.addEventListener('visibilitychange',this.visibility);
 }
 setActive(active:boolean){if(this.disposed||this.active===active)return;this.active=active;if(!active)this.silence();}
 async trunkOpened({gesture,volume,muted=false}:{gesture:HornGesture;volume:number;muted?:boolean}){
  const now=this.now(),level=unit(volume);
  if(this.disposed||!this.active||!gesture.isTrusted||gesture.repeat||muted||!level||now<this.nextAllowed||(typeof document!=='undefined'&&document.hidden))return false;
  this.nextAllowed=now+700;const generation=++this.generation;
  try{
   if(!this.context){
    const context=this.create();if(!context)return false;const nodes:AudioNode[]=[];
    try{
     const master=context.createGain();nodes.push(master);master.gain.value=0;
     const filter=context.createBiquadFilter();nodes.push(filter);filter.type='lowpass';filter.frequency.value=2400;filter.Q.value=.7;
     const limiter=context.createDynamicsCompressor();nodes.push(limiter);limiter.threshold.value=-12;limiter.knee.value=6;limiter.ratio.value=8;limiter.attack.value=.003;limiter.release.value=.08;
     master.connect(filter);filter.connect(limiter);limiter.connect(context.destination);
     this.context=context;this.master=master;this.filter=filter;this.limiter=limiter;
    }catch{for(const node of nodes)node.disconnect();void context.close().catch(()=>{});return false;}
   }
   const context=this.context;
   if(context.state!=='running')await context.resume();
   if(this.disposed||!this.active||generation!==this.generation||context.state!=='running'||(typeof document!=='undefined'&&document.hidden))return false;
   const start=context.currentTime;
   this.master!.gain.cancelScheduledValues(start);this.master!.gain.setValueAtTime(1,start);
   for(const [offset,duration]of [[0,.16],[.28,.22]])for(const hz of [349.23,440]){
    const tone=context.createOscillator(),gain=context.createGain(),voice: HornVoice={tone,gain,released:false};
    this.voices.add(voice);tone.type='sawtooth';tone.frequency.value=hz;
    const t=start+offset;gain.gain.value=0;gain.gain.setValueAtTime(0,t);gain.gain.linearRampToValueAtTime(.1*level,t+.012);gain.gain.setValueAtTime(.1*level,t+duration-.035);gain.gain.linearRampToValueAtTime(0,t+duration);
    tone.connect(gain);gain.connect(this.master!);tone.onended=()=>this.release(voice);tone.start(t);tone.stop(t+duration+.01);
   }
   return true;
  }catch{this.silence();return false;}
 }
 private release(voice:HornVoice){if(voice.released)return;voice.released=true;voice.tone.onended=null;voice.tone.disconnect();voice.gain.disconnect();this.voices.delete(voice);}
 silence(){
  this.generation++;
  if(this.context&&this.master){const time=this.context.currentTime;this.master.gain.cancelScheduledValues(time);this.master.gain.setValueAtTime(0,time);}
  for(const voice of this.voices){try{voice.tone.stop();}catch{/* Already ended. */}this.release(voice);}
 }
 async dispose(){
  if(this.disposed)return;this.disposed=true;this.active=false;this.silence();
  if(typeof window!=='undefined'){window.removeEventListener('blur',this.interrupted);window.removeEventListener('pagehide',this.interrupted);}
  if(typeof document!=='undefined')document.removeEventListener('visibilitychange',this.visibility);
  this.master?.disconnect();this.filter?.disconnect();this.limiter?.disconnect();
  const context=this.context;this.context=undefined;
  if(context&&context.state!=='closed')try{await context.close();}catch{/* Page teardown. */}
 }
}

/** The caller has already accepted a parked trunk-open action. Closing the
 * controls menu clears audio first, so this fresh gesture may re-arm it only
 * after the menu is closed and every current audio permission still passes. */
export function playAcceptedTrunkHorn(horn:CadillacHorn,gesture:HornGesture,state:{
 trunkPresent:boolean;unlocked:boolean;visible:boolean;focused:boolean;dialogOpen:boolean;
 enabled:boolean;volume:number;
}){
 if(!gesture.isTrusted||gesture.repeat||!state.trunkPresent||!state.unlocked||!state.visible||!state.focused||state.dialogOpen||!state.enabled||!unit(state.volume))return Promise.resolve(false);
 horn.setActive(true);
 return horn.trunkOpened({gesture,volume:state.volume});
}
