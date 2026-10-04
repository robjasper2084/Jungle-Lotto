import type {RidePose} from './controller.ts';

/** Original synthesized motor, EUC warning and metal-on-ground scrape. */
export class RideAudio {
 private context?:AudioContext;private master?:GainNode;private motor?:OscillatorNode;private motorGain?:GainNode;
 private beep?:GainNode;private scrape?:GainNode;private filter?:BiquadFilterNode;
 enabled=false;
 async enable(value:boolean){
  this.enabled=value;
  if(value&&!this.context){
   const c=this.context=new AudioContext(),master=this.master=c.createGain();master.gain.value=0;master.connect(c.destination);
   this.motor=c.createOscillator();this.motorGain=c.createGain();this.motor.type='sine';this.motorGain.gain.value=0;this.motor.connect(this.motorGain).connect(master);this.motor.start();
   const tone=c.createOscillator();tone.type='square';tone.frequency.value=1560;this.beep=c.createGain();this.beep.gain.value=0;tone.connect(this.beep).connect(master);tone.start();
   const buffer=c.createBuffer(1,c.sampleRate,c.sampleRate),samples=buffer.getChannelData(0);let seed=719;
   for(let i=0;i<samples.length;i++){seed=(Math.imul(seed,1664525)+1013904223)|0;samples[i]=(seed>>>0)/2147483648-1;}
   const noise=c.createBufferSource();noise.buffer=buffer;noise.loop=true;
   this.filter=c.createBiquadFilter();this.filter.type='bandpass';this.filter.Q.value=.7;
   this.scrape=c.createGain();this.scrape.gain.value=0;noise.connect(this.filter).connect(this.scrape).connect(master);noise.start();
  }
  if(this.context&&value)await this.context.resume();
  if(!value&&this.context)this.master!.gain.setTargetAtTime(0,this.context.currentTime,.01);
 }
 update(p:RidePose,active:boolean){
  const c=this.context;if(!c)return;const t=c.currentTime;
  this.master!.gain.setTargetAtTime(this.enabled&&active?1:0,t,.012);
  this.motor!.frequency.setTargetAtTime(85+Math.abs(p.speed)*15,t,.08);
  this.motorGain!.gain.setTargetAtTime(.005+Math.min(.025,Math.abs(p.speed)*.001),t,.08);
  this.beep!.gain.setTargetAtTime(p.beepPulse*.035,t,.004);
  this.scrape!.gain.setTargetAtTime(p.scrape*(p.scrapeHard?.11:.035),t,.012);
  this.filter!.frequency.setTargetAtTime((p.scrapeHard?1400:450)+Math.abs(p.speed)*55,t,.025);
 }
 async dispose(){const c=this.context;this.enabled=false;this.context=undefined;this.master=undefined;this.motor=undefined;this.motorGain=undefined;this.beep=undefined;this.scrape=undefined;this.filter=undefined;if(c&&c.state!=='closed')await c.close();}
 get state(){return{enabled:this.enabled,context:this.context?.state??'not-created',masterGain:this.master?.gain.value??0,beepGain:this.beep?.gain.value??0,scrapeGain:this.scrape?.gain.value??0};}
}
