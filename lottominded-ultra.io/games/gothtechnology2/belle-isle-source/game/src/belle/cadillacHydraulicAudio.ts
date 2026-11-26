type AudioFactory=()=>AudioContext|undefined;
type HydraulicGesture=Pick<Event,'isTrusted'>&{repeat?:boolean;type?:string};
export type HydraulicAudioOptions={enabled:boolean;volume:number;reduced?:boolean};
type Voice={source:OscillatorNode|AudioBufferSourceNode;gain:GainNode;released:boolean};
const INTERVAL_MS=220;
const acceptedEventTypes=new Set(['click','pointerup','touchend','keydown','keyup','input','change']);
const makeContext:AudioFactory=()=>{
 const scope=globalThis as typeof globalThis&{webkitAudioContext?:typeof AudioContext};
 const Constructor=scope.AudioContext??scope.webkitAudioContext;return Constructor?new Constructor():undefined;
};
const level=(volume:number)=>Number.isFinite(volume)?Math.max(0,Math.min(1,volume)):0;

/** A quiet, original toggle click and pressure hiss. The controller calls
 * trigger only after accepting a command from the current trusted gesture.
 * Construction, frame sync, preset indicators and controller rejections are
 * silent. One cached noise buffer and at most two brief voices are owned here. */
export class CadillacHydraulicAudio{
 private readonly create:AudioFactory;
 private readonly now:()=>number;
 private context?:AudioContext;
 private master?:GainNode;
 private filter?:BiquadFilterNode;
 private noise?:AudioBuffer;
 private readonly voices=new Set<Voice>();
 private active=false;
 private muted=false;
 private disposed=false;
 private generation=0;
 private nextAllowed=-Infinity;
 private readonly win=typeof window==='undefined'?undefined:window;
 private readonly doc=typeof document==='undefined'?undefined:document;
 private readonly interrupted=()=>this.silence();
 private readonly visibility=()=>{if(this.doc?.hidden)this.silence();};
 constructor(create:AudioFactory=makeContext,now:()=>number=()=>performance.now()){
  this.create=create;this.now=now;
  this.win?.addEventListener('blur',this.interrupted);this.win?.addEventListener('pagehide',this.interrupted);
  this.doc?.addEventListener('visibilitychange',this.visibility);
 }
 setActive(active:boolean){if(this.disposed||this.active===active)return;this.active=active;if(!active)this.silence();}
 setMuted(muted:boolean){if(this.disposed||this.muted===muted)return;this.muted=muted;if(muted)this.silence();}
 private allowed(){return !this.disposed&&this.active&&!this.muted&&!this.doc?.hidden&&(!this.doc?.hasFocus||this.doc.hasFocus());}
 private prepare(){
  if(this.context)return this.context;
  const context=this.create();if(!context)return;const nodes:AudioNode[]=[];
  try{
   const master=context.createGain();nodes.push(master);master.gain.value=0;
   const filter=context.createBiquadFilter();nodes.push(filter);filter.type='bandpass';filter.frequency.value=1450;filter.Q.value=.65;
   const noise=context.createBuffer(1,Math.ceil(context.sampleRate*.18),context.sampleRate),samples=noise.getChannelData(0);
   // Deterministic original noise, generated once. No downloaded sample,
   // looping source, timer, media element, or background playback is involved.
   let seed=0x1978cadd;
   for(let i=0;i<samples.length;i++){seed^=seed<<13;seed^=seed>>>17;seed^=seed<<5;samples[i]=((seed>>>0)/0xffffffff)*2-1;}
   filter.connect(master);master.connect(context.destination);
   this.context=context;this.master=master;this.filter=filter;this.noise=noise;return context;
  }catch{for(const node of nodes)node.disconnect();void context.close().catch(()=>{});return;}
 }
 private voice(source:OscillatorNode|AudioBufferSourceNode,output:AudioNode){
  let gain:GainNode|undefined;
  try{
   gain=this.context!.createGain();gain.gain.value=0;source.connect(gain);gain.connect(output);
   const voice:Voice={source,gain,released:false};this.voices.add(voice);source.onended=()=>this.release(voice);return voice;
  }catch{source.disconnect();gain?.disconnect();throw Error('Hydraulic sound voice unavailable');}
 }
 async trigger(gesture:HydraulicGesture,{enabled,volume,reduced=false}:HydraulicAudioOptions){
  const now=this.now(),volumeLevel=level(volume);
  if(!this.allowed()||!enabled||!volumeLevel||!gesture.isTrusted||gesture.repeat||!Number.isFinite(now)||now<this.nextAllowed||gesture.type&&!acceptedEventTypes.has(gesture.type))return false;
  this.nextAllowed=now+INTERVAL_MS;const generation=++this.generation;
  try{
   const context=this.prepare();if(!context)return false;
   if(context.state!=='running')await context.resume();
   if(!this.allowed()||generation!==this.generation||context.state!=='running')return false;
   // An unusually delayed ended event cannot accumulate old connected voices.
   this.stopVoices();const start=context.currentTime,hissDuration=reduced?.11:.17;
   const click=this.voice(context.createOscillator(),this.master!);
   const hiss=this.voice(context.createBufferSource(),this.filter!);
   const oscillator=click.source as OscillatorNode;oscillator.type='triangle';
   oscillator.frequency.setValueAtTime(920,start);oscillator.frequency.linearRampToValueAtTime(360,start+.035);
   const pressure=hiss.source as AudioBufferSourceNode;pressure.buffer=this.noise!;pressure.loop=false;
   click.gain.gain.setValueAtTime(0,start);click.gain.gain.linearRampToValueAtTime(.055*volumeLevel,start+.002);click.gain.gain.linearRampToValueAtTime(0,start+.037);
   hiss.gain.gain.setValueAtTime(0,start);hiss.gain.gain.linearRampToValueAtTime(.026*volumeLevel,start+.01);hiss.gain.gain.linearRampToValueAtTime(0,start+hissDuration);
   this.master!.gain.cancelScheduledValues(start);this.master!.gain.setValueAtTime(1,start);
   oscillator.start(start);oscillator.stop(start+.042);pressure.start(start);pressure.stop(start+hissDuration+.008);
   return true;
  }catch{this.silence();return false;}
 }
 private release(voice:Voice){
  if(voice.released)return;voice.released=true;voice.source.onended=null;voice.source.disconnect();voice.gain.disconnect();this.voices.delete(voice);
  if('buffer'in voice.source)voice.source.buffer=null;
 }
 private stopVoices(){for(const voice of this.voices){try{voice.source.stop();}catch{/* Already ended or not yet started. */}this.release(voice);}}
 silence(){
  this.generation++;
  if(this.context&&this.master){const time=this.context.currentTime;this.master.gain.cancelScheduledValues(time);this.master.gain.setValueAtTime(0,time);}
  this.stopVoices();
 }
 diagnostics(){return{active:this.active,muted:this.muted,contextState:this.context?.state??'uncreated',liveVoices:this.voices.size,noiseBuffers:this.noise?1:0};}
 async dispose(){
  if(this.disposed)return;this.disposed=true;this.active=false;this.silence();
  this.win?.removeEventListener('blur',this.interrupted);this.win?.removeEventListener('pagehide',this.interrupted);this.doc?.removeEventListener('visibilitychange',this.visibility);
  this.filter?.disconnect();this.master?.disconnect();const context=this.context;
  this.context=undefined;this.filter=undefined;this.master=undefined;this.noise=undefined;
  if(context&&context.state!=='closed')try{await context.close();}catch{/* Page teardown. */}
 }
}
