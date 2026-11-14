import type {MusicTrack} from './belleAudioPolicy.ts';
import {unit} from './belleAudioPolicy.ts';
/** Only a verified Pages assembly opts into the existing same-origin Swoop copy.
 * Local previews and portable standalone builds keep their local soundtrack. */
export function belleMusicUrl(url:string,base:string|null|undefined=typeof document==='undefined'?null:document.querySelector('meta[name="belle-music-base"]')?.getAttribute('content')){
 return base==='../swoop-detroit/'&&/^\.\/audio\/swoop\/track-\d{2}\.mp3$/.test(url)?base+url.slice(2):url;
}
export interface MusicElement {
 src:string;preload:string;volume:number;loop:boolean;currentTime:number;
 play():Promise<void>;pause():void;load():void;
 addEventListener(name:string,listener:()=>void):void;
 removeEventListener(name:string,listener:()=>void):void;
 removeAttribute(name:string):void;
}
/** One lazily created HTML audio element; never preloads the entire playlist. */
export class BelleMusicPlayer {
 private audio?:MusicElement;private authorized=false;private active=false;
 private enabled=false;private volume=.22;private index=0;private generation=0;
 private pending=false;private playing=false;private blocked=false;private disposed=false;
 private readonly factory:()=>MusicElement;private readonly changed:(text:string)=>void;
 readonly tracks:readonly MusicTrack[];
 constructor(tracks:readonly MusicTrack[],factory:()=>MusicElement,changed:(text:string)=>void=()=>{}){
  this.tracks=tracks;this.factory=factory;this.changed=changed;
 }
 private ended=()=>{if(this.enabled&&this.active)this.next();};
 private failed=()=>{
  if(this.disposed)return;
  this.blocked=true;this.stop();this.changed('Music unavailable. Select another track or use Retry music.');
 };
 configure(enabled:boolean,volume:number,track:string){
  if(this.disposed)return;
  const index=this.tracks.findIndex(t=>t.id===track),changed=index>=0&&index!==this.index;
  const turnedOn=enabled&&!this.enabled;
  this.enabled=enabled;this.volume=unit(volume);
  if(changed){this.stop();this.index=index;this.blocked=false;if(this.audio){this.audio.src=belleMusicUrl(this.tracks[index].url);this.audio.load();}}
  if(!enabled){this.stop();return;}
  if(this.audio)this.audio.volume=this.playing&&this.active?this.volume:0;
  if(changed||turnedOn)this.start(false);
 }
 /** Called synchronously by a real click/key gesture. Prime silently when in a menu. */
 unlock(){
  if(this.disposed||!this.enabled||!this.tracks.length)return;
  // Global click/key listeners also see settings interactions. Once permission
  // is primed, leave paused media alone; only a denied/error state needs re-priming.
  const prime=!this.authorized||this.blocked;
  this.authorized=true;this.blocked=false;this.start(prime);
 }
 setActive(value:boolean){
  if(this.disposed||this.active===value)return;
  this.active=value;
  if(value)this.start(false);else this.stop();
 }
 private start(prime:boolean){
  if(this.disposed||!this.enabled||!this.authorized||this.blocked||!this.tracks.length||this.pending||this.playing||(!this.active&&!prime))return;
  if(!this.audio){
   try{this.audio=this.factory();this.audio.preload='none';this.audio.loop=false;this.audio.src=belleMusicUrl(this.tracks[this.index].url);
    this.audio.addEventListener('ended',this.ended);this.audio.addEventListener('error',this.failed);
   }catch{this.blocked=true;this.changed('Music is unavailable in this browser.');return;}
  }
  const audio=this.audio,generation=++this.generation;this.pending=true;
  audio.volume=this.active?this.volume:0;
  let result:Promise<void>;
  try{result=audio.play();}catch(error){result=Promise.reject(error);}
  void result.then(()=>{
   if(generation!==this.generation){if(!this.enabled||!this.active||this.disposed)audio.pause();return;}
   this.pending=false;
   if(!this.enabled||!this.active||this.disposed){audio.pause();audio.volume=0;this.playing=false;return;}
   this.playing=true;audio.volume=this.volume;this.changed('Playing: '+this.tracks[this.index].title);
  },()=>{
   if(generation!==this.generation)return;
   this.pending=false;this.playing=false;audio.pause();audio.volume=0;this.blocked=true;
   this.changed('Music needs a fresh click. Use Retry music.');
  });
 }
 private stop(){
  this.generation++;this.pending=false;this.playing=false;
  if(this.audio){this.audio.volume=0;this.audio.pause();}
 }
 next(){
  if(this.disposed||!this.tracks.length)return;
  const track=this.tracks[(this.index+1)%this.tracks.length];
  // A one-track playlist still restarts through a new, handled play request.
  this.stop();this.index=(this.index+1)%this.tracks.length;this.blocked=false;
  if(this.audio){this.audio.src=belleMusicUrl(track.url);this.audio.currentTime=0;this.audio.load();}
  this.start(false);
 }
 get selected(){return this.tracks[this.index]?.id??'';}
 get state(){return {created:!!this.audio,active:this.active,authorized:this.authorized,pending:this.pending,playing:this.playing,blocked:this.blocked,selected:this.selected};}
 dispose(){
  if(this.disposed)return;this.disposed=true;this.stop();
  if(this.audio){this.audio.removeEventListener('ended',this.ended);this.audio.removeEventListener('error',this.failed);this.audio.removeAttribute('src');this.audio.load();}
  this.audio=undefined;
 }
}
