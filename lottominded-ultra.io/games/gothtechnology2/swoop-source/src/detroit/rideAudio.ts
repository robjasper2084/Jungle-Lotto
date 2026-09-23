import type {RidePose} from './controller.ts';
import type {SurfaceId} from './terrain.ts';

/** Original synthesized motor, EUC warning and metal-on-ground scrape. */
export class RideAudio {
 private context?:AudioContext;private master?:GainNode;private motor?:OscillatorNode;private motorGain?:GainNode;
 private wind?:GainNode;private windFilter?:BiquadFilterNode;private beep?:GainNode;private scrape?:GainNode;private filter?:BiquadFilterNode;
 private impact?:GainNode;private impactFilter?:BiquadFilterNode;private thump?:GainNode;private chime?:GainNode;private chimeTone?:OscillatorNode;
 private impactAt=-Infinity;private impactLevel=0;private chimeAt=-Infinity;private chimeKind='checkpoint';
 private impacts=0;private confirmations=0;
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
   this.windFilter=c.createBiquadFilter();this.windFilter.type='lowpass';this.wind=c.createGain();this.wind.gain.value=0;noise.connect(this.windFilter).connect(this.wind).connect(master);
   this.impactFilter=c.createBiquadFilter();this.impactFilter.type='lowpass';this.impact=c.createGain();this.impact.gain.value=0;noise.connect(this.impactFilter).connect(this.impact).connect(master);
   const bass=c.createOscillator();bass.type='sine';bass.frequency.value=82;this.thump=c.createGain();this.thump.gain.value=0;bass.connect(this.thump).connect(master);bass.start();
   this.chimeTone=c.createOscillator();this.chimeTone.type='sine';this.chime=c.createGain();this.chime.gain.value=0;this.chimeTone.connect(this.chime).connect(master);this.chimeTone.start();
  }
  if(this.context&&value)await this.context.resume();
  if(!value&&this.context)this.master!.gain.setTargetAtTime(0,this.context.currentTime,.01);
 }
 landing(impact:number,surface:SurfaceId,wet=false){
  if(!this.enabled||!this.context||impact<.8)return;
  this.impactAt=this.context.currentTime;this.impactLevel=Math.min(1,(impact-.8)/5);this.impacts++;
  this.impactFilter!.frequency.setTargetAtTime(wet?1800:surface==='grass'?480:['dirt','gravel','sand'].includes(surface)?1100:700,this.impactAt,.005);
 }
 confirm(kind='checkpoint'){
  if(!this.enabled||!this.context)return;this.chimeAt=this.context.currentTime;this.chimeKind=kind;this.confirmations++;
 }
 update(p:RidePose,active:boolean){
  const c=this.context;if(!c)return;const t=c.currentTime;
  this.master!.gain.setTargetAtTime(this.enabled&&active?1:0,t,.012);
  if(!this.enabled||!active){this.impactAt=-Infinity;this.chimeAt=-Infinity;}
  const impactAge=t-this.impactAt,chimeAge=t-this.chimeAt;
  const impactEnvelope=impactAge>=0&&impactAge<.25?Math.exp(-impactAge*24)*this.impactLevel:0;
  this.impact!.gain.setTargetAtTime(impactEnvelope*.09,t,.004);this.thump!.gain.setTargetAtTime(impactEnvelope*.045,t,.004);
  const note=chimeAge<.09?0:1,envelope=chimeAge>=0&&chimeAge<.28?Math.exp(-(chimeAge-(note?.09:0))*20):0;
  this.chimeTone!.frequency.setTargetAtTime((this.chimeKind==='trick'?660:540)*(note?1.5:1),t,.006);this.chime!.gain.setTargetAtTime(envelope*.022,t,.004);
  this.wind!.gain.setTargetAtTime(.002+Math.min(.018,Math.abs(p.speed)*.0006),t,.5);this.windFilter!.frequency.setTargetAtTime(180+Math.min(500,Math.abs(p.speed)*12),t,.5);
  this.motor!.frequency.setTargetAtTime(85+Math.abs(p.speed)*15,t,.08);
  this.motorGain!.gain.setTargetAtTime(.005+Math.min(.025,Math.abs(p.speed)*.001),t,.08);
  this.beep!.gain.setTargetAtTime(p.beepPulse*.035,t,.004);
  this.scrape!.gain.setTargetAtTime(p.scrape*(p.scrapeHard?.11:.035),t,.012);
  this.filter!.frequency.setTargetAtTime((p.scrapeHard?1400:450)+Math.abs(p.speed)*55,t,.025);
 }
 async dispose(){const c=this.context;this.enabled=false;this.context=undefined;this.master=undefined;this.motor=undefined;this.motorGain=undefined;this.beep=undefined;this.scrape=undefined;this.filter=undefined;this.impact=this.thump=this.chime=undefined;this.impactFilter=undefined;this.chimeTone=undefined;this.impactAt=this.chimeAt=-Infinity;if(c&&c.state!=='closed')await c.close();}
 get state(){return{enabled:this.enabled,context:this.context?.state??'not-created',masterGain:this.master?.gain.value??0,beepGain:this.beep?.gain.value??0,scrapeGain:this.scrape?.gain.value??0,impactGain:this.impact?.gain.value??0,confirmationGain:this.chime?.gain.value??0,impacts:this.impacts,confirmations:this.confirmations};}
}
