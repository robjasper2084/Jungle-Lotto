export type SoundZone={file:string;points:{x:number;z:number}[];radius:number;volume:number};
export function zoneLevel(zone:SoundZone,focus:{x:number;z:number}){
 const distance=Math.min(...zone.points.map(p=>Math.hypot(p.x-focus.x,p.z-focus.z)));
 const level=Math.max(0,1-distance/zone.radius);return level*level*zone.volume;
}
/** Recorded CC0 field audio. No sound until a player gesture; fades with proximity. */
export class NatureAudio {
 private context?:AudioContext;private tracks:{zone:SoundZone;gain:GainNode;pan:StereoPannerNode;source:AudioBufferSourceNode}[]=[];
 private loading=false;private failed=false;private active=false;private focus={x:0,z:0};private heading=0;
 private zones:SoundZone[];private enabled:()=>boolean;
 constructor(zones:SoundZone[],enabled:()=>boolean){
  this.enabled=enabled;this.zones=zones.filter(z=>z.points.length);
  const unlock=()=>queueMicrotask(()=>{this.update(this.focus,this.heading,this.active);if(!this.context||this.enabled())void this.unlock().catch(()=>{});});
  addEventListener('pointerdown',unlock);addEventListener('keydown',unlock);
  document.addEventListener('visibilitychange',()=>this.update(this.focus,this.heading,this.active));
 }
 private async unlock(){
  if(this.failed)return;this.context??=new AudioContext();const ctx=this.context;
  if(ctx.state==='suspended')await ctx.resume();if(this.loading)return;this.loading=true;
  try{
   const buffers=new Map<string,Promise<AudioBuffer>>();
   for(const z of this.zones){
    if(!buffers.has(z.file))buffers.set(z.file,fetch('/audio/nature/'+z.file).then(r=>{if(!r.ok)throw Error('Nature recording unavailable');return r.arrayBuffer();}).then(b=>ctx.decodeAudioData(b)));
    const buffer=await buffers.get(z.file)!,gain=ctx.createGain(),pan=ctx.createStereoPanner(),source=ctx.createBufferSource();source.buffer=buffer;source.loop=true;gain.gain.value=0;source.connect(gain).connect(pan).connect(ctx.destination);source.start();this.tracks.push({zone:z,gain,pan,source});
   }
   this.update(this.focus,this.heading,this.active);
  }catch(e){this.failed=true;for(const t of this.tracks)t.source.stop();this.tracks=[];console.warn('Nature recordings could not load',e);}
 }
 update(focus:{x:number;z:number},heading:number,active:boolean){
  this.focus={...focus};this.heading=heading;this.active=active;
  if(!this.context)return;const ctx=this.context,on=active&&this.enabled()&&!document.hidden;
  for(const t of this.tracks){
   t.gain.gain.setTargetAtTime(on?zoneLevel(t.zone,focus):0,ctx.currentTime,on?.22:.035);
   const p=t.zone.points.reduce((best,p)=>Math.hypot(p.x-focus.x,p.z-focus.z)<Math.hypot(best.x-focus.x,best.z-focus.z)?p:best);
   const lateral=(p.x-focus.x)*Math.cos(heading)-(p.z-focus.z)*Math.sin(heading);
   t.pan.pan.setTargetAtTime(Math.max(-.65,Math.min(.65,lateral/t.zone.radius)),ctx.currentTime,.2);
  }
 }
 get status(){return this.failed?'unavailable':this.context?.state==='running'?this.active&&this.enabled()?'playing':'muted':'waiting for player';}
}
