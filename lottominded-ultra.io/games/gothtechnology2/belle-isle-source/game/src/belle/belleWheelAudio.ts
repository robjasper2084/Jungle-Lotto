import {wheelAudioTargets,type AudioPreferences,type WheelAudioPose} from './belleAudioPolicy.ts';
/** Original Swoop synthesis: sine motor, 1560 Hz warning, filtered metal scrape.
 * Resource count is constant during riding; no effects are allocated per frame. */
export class BelleWheelAudio {
 private context?:AudioContext;private master?:GainNode;
 private motor?:OscillatorNode;private motorGain?:GainNode;
 private wind?:GainNode;private windFilter?:BiquadFilterNode;
 private beep?:GainNode;private scrape?:GainNode;private scrapeFilter?:BiquadFilterNode;private brake?:GainNode;
 private sources:(OscillatorNode|AudioBufferSourceNode)[]=[];
 private disposed=false;private ready=false;
 private readonly create:()=>AudioContext|undefined;
 constructor(create:()=>AudioContext|undefined=()=>{
  const scope=globalThis as typeof globalThis & {webkitAudioContext?:typeof AudioContext};
  const C=scope.AudioContext??scope.webkitAudioContext;return C?new C():undefined;
 }){this.create=create;}
 async unlock(){
  if(this.disposed)return false;
  try{
   if(!this.context){
    const c=this.context=this.create();if(!c)return false;
    const master=this.master=c.createGain();master.gain.value=0;master.connect(c.destination);
    const voice=(type:OscillatorType,hz:number)=>{
     const tone=c.createOscillator(),gain=c.createGain();tone.type=type;tone.frequency.value=hz;gain.gain.value=0;
     tone.connect(gain);gain.connect(master);tone.start();this.sources.push(tone);return {tone,gain};
    };
    const motor=voice('sine',55);this.motor=motor.tone;this.motorGain=motor.gain;this.beep=voice('square',1560).gain;
    const buffer=c.createBuffer(1,c.sampleRate,c.sampleRate),samples=buffer.getChannelData(0);let seed=719;
    for(let i=0;i<samples.length;i++){seed=(Math.imul(seed,1664525)+1013904223)|0;samples[i]=(seed>>>0)/2147483648-1;}
    const noise=c.createBufferSource();noise.buffer=buffer;noise.loop=true;
    const filter=(type:BiquadFilterType,hz:number)=>{const f=c.createBiquadFilter(),g=c.createGain();f.type=type;f.frequency.value=hz;f.Q.value=.7;g.gain.value=0;noise.connect(f);f.connect(g);g.connect(master);return{filter:f,gain:g};};
    const metal=filter('bandpass',450);this.scrape=metal.gain;this.scrapeFilter=metal.filter;
    const wind=filter('lowpass',180);this.wind=wind.gain;this.windFilter=wind.filter;
    this.brake=filter('bandpass',700).gain;noise.start();this.sources.push(noise);
   }
   const context=this.context;if(!context)return false;if(context.state!=='running')await context.resume();
   this.ready=!this.disposed&&context.state==='running';return this.ready;
  }catch{
   this.ready=false;const context=this.context;this.context=undefined;
   for(const source of this.sources){try{source.stop();source.disconnect();}catch{}}
   this.sources=[];
   if(context&&context.state!=='closed')void context.close().catch(()=>{});
   return false;
  }
 }
 update(p:WheelAudioPose,active:boolean,prefs:AudioPreferences){
  const c=this.context;if(!c||!this.ready||this.disposed)return;
  const t=c.currentTime,v=wheelAudioTargets(p,active,prefs);
  this.master!.gain.setTargetAtTime(active?1:0,t,.012);
  this.motor!.frequency.setTargetAtTime(v.motorHz,t,.08);this.motorGain!.gain.setTargetAtTime(v.motorGain,t,.08);
  this.wind!.gain.setTargetAtTime(v.windGain,t,.14);this.windFilter!.frequency.setTargetAtTime(v.windHz,t,.14);
  this.beep!.gain.setTargetAtTime(v.beepGain,t,.004);
  this.scrape!.gain.setTargetAtTime(v.scrapeGain,t,.012);this.scrapeFilter!.frequency.setTargetAtTime(v.scrapeHz,t,.025);
  this.brake!.gain.setTargetAtTime(v.brakeGain,t,.012);
 }
 silence(){
  if(!this.context||!this.master)return;
  const t=this.context.currentTime;this.master.gain.cancelScheduledValues(t);this.master.gain.setValueAtTime(0,t);
 }
 async dispose(){
  if(this.disposed)return;this.disposed=true;this.silence();
  for(const source of this.sources){try{source.stop();source.disconnect();}catch{/* Already stopped. */}}
  this.sources=[];const c=this.context;this.context=undefined;this.ready=false;
  if(c&&c.state!=='closed'){try{await c.close();}catch{/* Page teardown. */}}
 }
}
