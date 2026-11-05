import {natureMix,waterLevel,type Fountain} from './waterFeatures.ts';
import {birdActivity,natureShouldPlay,shoreSoundLevel} from './natureSoundscape.ts';
import type {Point} from './terrain.ts';
/** Locally hosted CC0 birdsong plus generated breeze/water. No microphone. */
export class NatureAudio{
 enabled=true;volume=.55;birdVolume=.85;
 private context?:AudioContext;private wind?:GainNode;private water?:GainNode;private birds?:GainNode;
 private playing=false;private desired=false;private serial=Promise.resolve();private timer?:ReturnType<typeof setInterval>;
 private indoors=false;private waterNear=0;private shoreNear=0;private nextBird=0;private lastMix=0;private hour=12;
 private lastShore=-Infinity;private previewUntil=0;private disposed=false;private recordingReady=false;private loading?:Promise<void>;private loadAbort=new AbortController();
 private loops:AudioBufferSourceNode[]=[];private lastStatus='';
 private visibility=()=>{if(document.hidden||!document.hasFocus())this.previewUntil=0;this.sync();};
 private pagehide=()=>{this.playing=false;this.previewUntil=0;this.sync();};
 constructor(private sources:Fountain[],private status:(text:string)=>void,private shores:Point[][]=[]){
  try{this.enabled=localStorage.getItem('belle-nature-enabled')!=='false';this.volume=this.saved('belle-nature-volume',.55);this.birdVolume=this.saved('belle-bird-volume',.85);}catch{/* private browsing */}
  document.addEventListener('visibilitychange',this.visibility);window.addEventListener('blur',this.visibility);window.addEventListener('focus',this.visibility);window.addEventListener('pagehide',this.pagehide);
 }
 private saved(key:string,fallback:number){const v=Number(localStorage.getItem(key)??fallback);return Number.isFinite(v)?Math.max(0,Math.min(1,v)):fallback;}
 private build(){
  if(this.context||this.disposed)return;const AudioCtor=window.AudioContext||(window as unknown as {webkitAudioContext:typeof AudioContext}).webkitAudioContext;if(!AudioCtor){this.status('Nature audio unavailable in this browser');return;}
  const c=this.context=new AudioCtor();this.wind=c.createGain();this.water=c.createGain();this.birds=c.createGain();for(const gain of[this.wind,this.water,this.birds]){gain.gain.value=0;gain.connect(c.destination);}
  const noise=c.createBuffer(2,c.sampleRate*4,c.sampleRate);for(let ch=0;ch<2;ch++){const p=noise.getChannelData(ch);let low=0;for(let i=0;i<p.length;i++){low=(low+(Math.random()*2-1)*.025)/1.025;p[i]=low*3.8;}}
  const wind=c.createBufferSource();wind.buffer=noise;wind.loop=true;const filter=c.createBiquadFilter();filter.type='lowpass';filter.frequency.value=900;wind.connect(filter).connect(this.wind);wind.start();this.loops.push(wind);
  const water=c.createBufferSource();water.buffer=noise;water.loop=true;water.playbackRate.value=1.71;const splash=c.createBiquadFilter();splash.type='bandpass';splash.frequency.value=1450;splash.Q.value=.35;water.connect(splash).connect(this.water);water.start(0,.73);this.loops.push(water);
  this.timer=setInterval(()=>this.ambience(),250);c.onstatechange=()=>this.report();
 }
 private loadBirdsong(){
  if(this.loading||!this.context||this.disposed)return;const c=this.context;
  this.loading=(async()=>{try{
   const response=await fetch('./belle/audio/park-birdsong.mp3',{signal:this.loadAbort.signal});if(!response.ok)throw Error('Birdsong unavailable');
   const decoded=await c.decodeAudioData(await response.arrayBuffer());if(this.disposed)return;
   const loop=c.createBufferSource();loop.buffer=decoded;loop.loop=true;loop.connect(this.birds!);loop.start();this.loops.push(loop);this.recordingReady=true;this.mix();this.report();
  }catch{/* Generated calls remain available offline or if audio decoding fails. */}})();
 }
 /** Resume synchronously from a user gesture so iPad browsers can unlock audio. */
 unlock(){if(!this.enabled||this.disposed){this.report();return;}try{this.build();void this.context?.resume().then(()=>{this.sync();this.loadBirdsong();}).catch(()=>this.status('Tap Preview nature sounds to enable audio'));}catch{this.status('Nature audio unavailable');}}
 configure(enabled:boolean,volume:number,birds=this.birdVolume){this.enabled=enabled;this.volume=Number.isFinite(volume)?Math.max(0,Math.min(1,volume)):0;this.birdVolume=Number.isFinite(birds)?Math.max(0,Math.min(1,birds)):0;if(!enabled)this.previewUntil=0;try{localStorage.setItem('belle-nature-enabled',String(enabled));localStorage.setItem('belle-nature-volume',String(this.volume));localStorage.setItem('belle-bird-volume',String(this.birdVolume));}catch{}if(enabled)this.unlock();this.sync();this.mix();}
 /** Hear the mix while Settings otherwise pauses the game. */
 preview(){if(!this.enabled||this.volume===0){this.status('Enable nature sounds and raise Nature volume to preview');return;}this.previewUntil=performance.now()+8000;this.unlock();this.sync();}
 update(x:number,z:number,indoors:boolean,playing:boolean,hour=12){this.indoors=indoors;this.hour=hour;this.waterNear=waterLevel(this.sources,x,z);const now=performance.now();if(now-this.lastShore>1500){this.lastShore=now;this.shoreNear=shoreSoundLevel(this.shores,x,z);}if(playing!==this.playing){this.playing=playing;if(playing)this.previewUntil=0;this.sync();}const c=this.context;if(c&&c.currentTime-this.lastMix>.1){this.lastMix=c.currentTime;this.mix();}}
 private sync(){
  this.desired=!this.disposed&&natureShouldPlay(this.enabled,this.volume,this.playing,!document.hidden,document.hasFocus(),this.previewUntil>performance.now());this.mix();
  this.serial=this.serial.then(async()=>{const c=this.context;if(!c||c.state==='closed')return;if(this.desired&&c.state!=='running')await c.resume();else if(!this.desired&&c.state==='running')await c.suspend();}).catch(()=>this.status('Tap Preview nature sounds to enable audio'));this.report();
 }
 private mix(){const c=this.context;if(!c||!this.wind||!this.water||!this.birds)return;const m=natureMix(this.enabled,this.desired,this.volume,this.indoors,Math.max(this.waterNear,this.indoors?0:this.shoreNear*.65)),gust=.8+.2*Math.sin(c.currentTime*.31),birds=this.previewUntil>performance.now()?1:birdActivity(this.hour);for(const[g,v]of [[this.wind,m.wind*gust],[this.water,m.water*(.85+.15*Math.sin(c.currentTime*.7))],[this.birds,m.birds*this.birdVolume*birds]] as [GainNode,number][])g.gain.setTargetAtTime(v,c.currentTime,.35);}
 private ambience(){const c=this.context;if(this.previewUntil&&performance.now()>=this.previewUntil){this.previewUntil=0;this.sync();}if(!c||!this.desired||c.state!=='running')return;this.mix();if(this.recordingReady||c.currentTime<this.nextBird||this.indoors||birdActivity(this.hour)<.1)return;this.nextBird=c.currentTime+3+Math.random()*5;const base=1700+Math.random()*1800,pan=c.createStereoPanner();pan.pan.value=Math.random()*1.6-.8;pan.connect(this.birds!);
  const calls=2+Math.floor(Math.random()*3);for(let i=0;i<calls;i++){const start=c.currentTime+i*.17,osc=c.createOscillator(),gain=c.createGain();osc.type='sine';osc.frequency.setValueAtTime(base,start);osc.frequency.exponentialRampToValueAtTime(base*(1.4+Math.random()*.25),start+.04);osc.frequency.exponentialRampToValueAtTime(base*.78,start+.13);gain.gain.setValueAtTime(0,start);gain.gain.linearRampToValueAtTime(.065,start+.015);gain.gain.exponentialRampToValueAtTime(.0001,start+.14);osc.connect(gain).connect(pan);osc.start(start);osc.stop(start+.16);osc.onended=()=>{osc.disconnect();gain.disconnect();if(i===calls-1)pan.disconnect();};}
 }
 private report(){const text=!this.enabled||this.volume===0?'Nature sounds muted':!this.context?'Nature sounds start with your ride':!this.desired?'Nature sounds paused with the game':this.context.state==='running'?(this.previewUntil>performance.now()?'Previewing birds, breeze and water · 8 seconds':this.recordingReady?'Nature sounds playing · recorded birdsong, breeze and nearby water':'Nature sounds playing · breeze, water and bird calls'):'Tap Preview nature sounds to enable audio';if(text!==this.lastStatus){this.lastStatus=text;this.status(text);}}
 capture(){const c=this.context;if(!c)return;const output=c.createMediaStreamDestination();const gains=[this.wind,this.water,this.birds].filter((g):g is GainNode=>!!g);for(const g of gains)g.connect(output);return{stream:output.stream,release:()=>{for(const g of gains)g.disconnect(output);output.stream.getTracks().forEach(t=>t.stop());}};}
 dispose(){this.disposed=true;this.loadAbort.abort();if(this.timer)clearInterval(this.timer);document.removeEventListener('visibilitychange',this.visibility);window.removeEventListener('blur',this.visibility);window.removeEventListener('focus',this.visibility);window.removeEventListener('pagehide',this.pagehide);for(const source of this.loops){source.stop();source.disconnect();}void this.context?.close();}
}
