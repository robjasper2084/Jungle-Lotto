import {natureMix,waterLevel,type Fountain} from './waterFeatures.ts';

/** Original synthesized ambience: no streamed audio, downloads or microphone. */
export class NatureAudio{
 enabled=true;volume=.35;private context?:AudioContext;private wind?:GainNode;private water?:GainNode;private birds?:GainNode;
 private playing=false;private desired=false;private serial=Promise.resolve();private timer?:ReturnType<typeof setInterval>;
 private indoors=false;private waterNear=0;private nextBird=0;private lastMix=0;
 constructor(private sources:Fountain[],private status:(text:string)=>void){
  try{this.enabled=localStorage.getItem('belle-nature-enabled')!=='false';const v=Number(localStorage.getItem('belle-nature-volume')??'.35');this.volume=Number.isFinite(v)?Math.max(0,Math.min(1,v)):.35;}catch{/* private browsing */}
  document.addEventListener('visibilitychange',()=>this.sync());window.addEventListener('blur',()=>this.sync());window.addEventListener('focus',()=>this.sync());
  window.addEventListener('pagehide',()=>{this.playing=false;this.sync();});
 }
 private build(){
  if(this.context)return;const AudioCtor=window.AudioContext||(window as unknown as {webkitAudioContext:typeof AudioContext}).webkitAudioContext;if(!AudioCtor){this.status('Nature audio unavailable in this browser');return;}
  const c=this.context=new AudioCtor();this.wind=c.createGain();this.water=c.createGain();this.birds=c.createGain();for(const gain of[this.wind,this.water,this.birds]){gain.gain.value=0;gain.connect(c.destination);}
  const noise=c.createBuffer(2,c.sampleRate*4,c.sampleRate);for(let ch=0;ch<2;ch++){const p=noise.getChannelData(ch);let low=0;for(let i=0;i<p.length;i++){low=(low+(Math.random()*2-1)*.025)/1.025;p[i]=low*3.8;}}
  const wind=c.createBufferSource();wind.buffer=noise;wind.loop=true;const filter=c.createBiquadFilter();filter.type='lowpass';filter.frequency.value=1000;wind.connect(filter).connect(this.wind);wind.start();
  const water=c.createBufferSource();water.buffer=noise;water.loop=true;water.playbackRate.value=1.71;const splash=c.createBiquadFilter();splash.type='bandpass';splash.frequency.value=1450;splash.Q.value=.35;water.connect(splash).connect(this.water);water.start(.0,.73);
  this.timer=setInterval(()=>this.ambience(),250);c.onstatechange=()=>this.report();
 }
 /** Called synchronously from Start or the sound checkbox, preserving iOS activation. */
 unlock(){if(!this.enabled){this.report();return;}try{this.build();void this.context?.resume().then(()=>this.sync()).catch(()=>this.status('Tap the nature-sounds switch to enable audio'));}catch{this.status('Nature audio unavailable');}}
 configure(enabled:boolean,volume:number){this.enabled=enabled;this.volume=Number.isFinite(volume)?Math.max(0,Math.min(1,volume)):0;try{localStorage.setItem('belle-nature-enabled',String(enabled));localStorage.setItem('belle-nature-volume',String(this.volume));}catch{}if(enabled)this.unlock();this.sync();}
 update(x:number,z:number,indoors:boolean,playing:boolean){this.indoors=indoors;this.waterNear=waterLevel(this.sources,x,z);if(playing!==this.playing){this.playing=playing;this.sync();}const c=this.context;if(c&&c.currentTime-this.lastMix>.1){this.lastMix=c.currentTime;this.mix();}}
 private sync(){
  const want=this.enabled&&this.volume>0&&this.playing&&!document.hidden&&document.hasFocus();if(want===this.desired&&(!this.context||(want?this.context.state==='running':this.context.state!=='running'))){this.report();return;}this.desired=want;this.mix();
  this.serial=this.serial.then(async()=>{const c=this.context;if(!c||c.state==='closed')return;if(this.desired&&c.state!=='running')await c.resume();else if(!this.desired&&c.state==='running')await c.suspend();}).catch(()=>{this.status('Tap the nature-sounds switch to enable audio');});this.report();
 }
 private mix(){const c=this.context;if(!c||!this.wind||!this.water||!this.birds)return;const m=natureMix(this.enabled,this.desired,this.volume,this.indoors,this.waterNear),gust=.8+.2*Math.sin(c.currentTime*.31);for(const[g,v]of [[this.wind,m.wind*gust],[this.water,m.water],[this.birds,m.birds]] as [GainNode,number][])g.gain.setTargetAtTime(v,c.currentTime,.20);}
 private ambience(){const c=this.context;if(!c||!this.desired||c.state!=='running')return;this.mix();if(c.currentTime<this.nextBird||this.indoors)return;this.nextBird=c.currentTime+3.5+Math.random()*6;const base=1700+Math.random()*1800,pan=c.createStereoPanner();pan.pan.value=Math.random()*1.6-.8;pan.connect(this.birds!);
  const calls=2+Math.floor(Math.random()*3);for(let i=0;i<calls;i++){const start=c.currentTime+i*.17,osc=c.createOscillator(),gain=c.createGain();osc.type='sine';osc.frequency.setValueAtTime(base,start);osc.frequency.exponentialRampToValueAtTime(base*(1.4+Math.random()*.25),start+.04);osc.frequency.exponentialRampToValueAtTime(base*.78,start+.13);gain.gain.setValueAtTime(0,start);gain.gain.linearRampToValueAtTime(.038,start+.015);gain.gain.exponentialRampToValueAtTime(.0001,start+.14);osc.connect(gain).connect(pan);osc.start(start);osc.stop(start+.16);osc.onended=()=>{osc.disconnect();gain.disconnect();if(i===calls-1)pan.disconnect();};}
 }
 private report(){this.status(!this.enabled||this.volume===0?'Nature sounds muted':!this.context?'Nature sounds start with your ride':!this.desired?'Nature sounds paused with the game':this.context.state==='running'?'Nature sounds playing · birds, breeze and nearby water':'Tap the nature-sounds switch to enable audio');}
 capture(){const c=this.context;if(!c)return;const output=c.createMediaStreamDestination();const gains=[this.wind,this.water,this.birds].filter((g):g is GainNode=>!!g);for(const g of gains)g.connect(output);return{stream:output.stream,release:()=>{for(const g of gains)g.disconnect(output);output.stream.getTracks().forEach(t=>t.stop());}};}
 dispose(){if(this.timer)clearInterval(this.timer);void this.context?.close();}
}
