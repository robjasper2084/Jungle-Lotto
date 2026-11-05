export class HoverAudio {
 enabled=localStorage.getItem('belle-hover-sound')!=='off';
 private context:AudioContext|undefined;private master:GainNode|undefined;private rotor:AudioBufferSourceNode|undefined;private motor:GainNode|undefined;private wind:GainNode|undefined;private buffers=new Map<string,AudioBuffer>();private pending:Promise<void>|undefined;private voices=new Set<AudioBufferSourceNode>();private lastBrake=false;private lastFlying=false;private lastLanded=true;
 async unlock(){
  if(!this.context){this.context=new AudioContext();this.master=this.context.createGain();this.master.gain.value=0;this.master.connect(this.context.destination);}
  await this.context.resume();
  if(!this.pending)this.pending=this.load().catch(e=>{this.pending=undefined;console.warn('Hover audio unavailable',e);});await this.pending;
 }
 private async load(){
  const c=this.context!,master=this.master!;
  await Promise.all(['rotor-loop','takeoff','landing','airbrake'].map(async name=>{const response=await fetch('./belle/vehicles/audio/'+name+'.wav');if(!response.ok)throw Error('Audio '+name+' unavailable');this.buffers.set(name,await c.decodeAudioData(await response.arrayBuffer()));}));
  this.motor=c.createGain();this.motor.gain.value=0;this.motor.connect(master);this.rotor=c.createBufferSource();this.rotor.buffer=this.buffers.get('rotor-loop')!;this.rotor.loop=true;this.rotor.connect(this.motor);this.rotor.start();
  const noise=c.createBuffer(1,c.sampleRate*2,c.sampleRate),channel=noise.getChannelData(0);let brown=0;for(let i=0;i<channel.length;i++){brown=(brown+(Math.random()*2-1)*.035)/1.025;channel[i]=brown*4;}const source=c.createBufferSource();source.buffer=noise;source.loop=true;const filter=c.createBiquadFilter();filter.type='bandpass';filter.frequency.value=600;filter.Q.value=.6;this.wind=c.createGain();this.wind.gain.value=0;source.connect(filter);filter.connect(this.wind);this.wind.connect(master);source.start();
 }
 toggle(){this.enabled=!this.enabled;localStorage.setItem('belle-hover-sound',this.enabled?'on':'off');if(this.enabled)void this.unlock();else this.silence();}
 private play(name:string,volume:number){if(!this.enabled||!this.context||!this.master||!this.buffers.has(name))return;const source=this.context.createBufferSource(),gain=this.context.createGain();source.buffer=this.buffers.get(name)!;gain.gain.value=volume;source.connect(gain);gain.connect(this.master);this.voices.add(source);source.onended=()=>{this.voices.delete(source);source.disconnect();gain.disconnect();};source.start();}
 update(rpm:number,speed:number,lift:number,flying:boolean,landed:boolean,brake:boolean,running:boolean){
  if(flying&&!this.lastFlying)this.play('takeoff',.48);if(landed&&!this.lastLanded)this.play('landing',.55);if(brake&&!this.lastBrake&&Math.abs(speed)>2)this.play('airbrake',.32);this.lastFlying=flying;this.lastLanded=landed;this.lastBrake=brake;
  if(!this.context||!this.master)return;const t=this.context.currentTime;this.master.gain.setTargetAtTime(this.enabled&&running?.7:0,t,.08);this.motor?.gain.setTargetAtTime(Math.min(1,rpm)*(.25+Math.abs(speed)*.007+Math.abs(lift)*.009),t,.2);this.rotor?.playbackRate.setTargetAtTime(.68+rpm*.28+Math.abs(speed)*.008,t,.15);this.wind?.gain.setTargetAtTime(Math.min(.2,Math.abs(speed)*.006),t,.3);
 }
 capture(){const c=this.context,master=this.master;if(!c||!master)return;const output=c.createMediaStreamDestination();master.connect(output);return{stream:output.stream,release:()=>{master.disconnect(output);output.stream.getTracks().forEach(t=>t.stop());}};}
 silence(){if(this.master&&this.context)this.master.gain.setTargetAtTime(0,this.context.currentTime,.035);for(const voice of this.voices){try{voice.stop();}catch{}}this.voices.clear();}
}
