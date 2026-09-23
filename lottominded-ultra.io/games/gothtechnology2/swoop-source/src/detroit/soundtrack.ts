import {TRACKS} from './soundtrackCatalog.ts';
import {MusicShuffle} from './musicShuffle.ts';
export type MusicScene='ride'|'style'|'garden'|'results';
/** Stream one normalized MP3 at a time. No full soundtrack preloading. */
export class Soundtrack {
 readonly audio=new Audio();private effect=new Audio();enabled=true;volume=.38;scene:MusicScene='ride';station='shuffle';private unlocked=false;private lastTrack:string|undefined;private now:HTMLElement;private toggle:HTMLButtonElement;private selector:HTMLSelectElement;private shuffle=new MusicShuffle();private playing=false;private blocked=false;private gain=0;private ended=false;private persistStatus:HTMLElement;
 constructor(parent:HTMLElement){
  try{const p=JSON.parse(localStorage.getItem('swoop-music-v1')??'{}');this.enabled=p.enabled!==false;if(Number.isFinite(p.volume))this.volume=Math.max(0,Math.min(1,p.volume));if(['shuffle','auto','all','bonus',...TRACKS.map(t=>t.id)].includes(p.station))this.station=p.station;if(!p.shuffleVersion&&this.station==='auto')this.station='shuffle';if(typeof p.lastTrack==='string')this.lastTrack=p.lastTrack;}catch{}
  this.audio.preload='none';this.effect.preload='none';this.audio.volume=0;this.effect.src='/audio/swoop/track-16.mp3';this.audio.onended=()=>{this.ended=true;};this.audio.onerror=()=>{this.now.textContent='Track unavailable. Choose Next to continue.';this.playing=false;this.blocked=true;};
  const box=document.createElement('details');box.id='musicPanel';box.innerHTML='<summary>Soundtrack · Digital Static radio</summary><p id="musicNow" role="status">Music starts when you ride.</p><div class="loopButtons"><button id="musicToggle"></button><button id="musicNext">Next track</button></div><label>Music volume <input id="musicVolume" type="range" min="0" max="1" step="0.01" aria-label="Music volume"></label><label>Station / track <select id="musicStation" aria-label="Music station"></select></label><small>Your music streams on demand. Shuffle mixes all available tracks without repeats; Auto shuffles music for the map and mode; warning beeps duck the music. Bonus radio includes the LottoMind recordings.</small><small id="musicPersistence"></small>';parent.append(box);
  this.now=box.querySelector('#musicNow')!;this.toggle=box.querySelector('#musicToggle')!;this.selector=box.querySelector('#musicStation')!;this.persistStatus=box.querySelector('#musicPersistence')!;
  for(const[value,label]of [['shuffle','Shuffle · all music'],['auto','Auto · match my ride'],['all','Main soundtrack · shuffle'],['bonus','Bonus · LottoMind radio'],...TRACKS.filter(t=>t.group!=='effect'&&!('duplicateOf'in t)).map(t=>[t.id,t.title])]){const option=document.createElement('option');option.value=value;option.textContent=label;this.selector.append(option);}
  this.selector.value=this.station;this.selector.onchange=()=>{this.station=this.selector.value;this.save();this.next();};
  const slider=box.querySelector<HTMLInputElement>('#musicVolume')!;slider.value=String(this.volume);slider.oninput=()=>{this.volume=Number(slider.value);this.save();};
  this.toggle.onclick=()=>{if(this.blocked){this.enabled=true;this.unlock();return;}this.enabled=!this.enabled;this.save();if(this.enabled)this.unlock();else{this.audio.pause();this.effect.pause();this.playing=false;}this.label();};
  box.querySelector<HTMLButtonElement>('#musicNext')!.onclick=()=>{this.enabled=true;this.save();this.unlocked=true;this.next();this.label();};this.label();
  document.addEventListener('visibilitychange',()=>{if(document.hidden){this.audio.pause();this.effect.pause();this.playing=false;}});
 }
 private label(){this.toggle.textContent=this.enabled?'Music on':'Music off';this.toggle.setAttribute('aria-pressed',String(this.enabled));}
 private save(){try{localStorage.setItem('swoop-music-v1',JSON.stringify({enabled:this.enabled,volume:this.volume,station:this.station,shuffleVersion:1,lastTrack:this.lastTrack}));}catch{this.persistStatus.textContent='Settings work for this session; browser storage is unavailable.';}}
 private list(){return TRACKS.filter(t=>!('duplicateOf'in t)&&t.group!=='effect'&&(this.station==='shuffle'?true:this.station==='all'?t.group!=='bonus':this.station==='bonus'?t.group==='bonus':this.station==='auto'?t.group===this.scene:t.id===this.station));}
 unlock(){this.unlocked=true;this.blocked=false;if(!this.enabled)return;if(!this.audio.src)this.next();else this.play();}
 private play(){if(!this.unlocked||!this.enabled||document.hidden||this.blocked)return;this.playing=true;void this.audio.play().then(()=>{this.label();this.now.textContent=TRACKS.find(t=>t.id===this.lastTrack)?.title??'Digital Static radio';}).catch(()=>{this.playing=false;this.blocked=true;this.now.textContent='Tap to enable music playback.';this.toggle.textContent='Tap to play music';});}
 next(){const tracks=this.list();if(!tracks.length)return;const key=this.station==='auto'?this.scene:this.station;const id=this.shuffle.next(key,tracks.map(t=>t.id),this.lastTrack);const track=tracks.find(t=>t.id===id)!;this.lastTrack=track.id;this.save();this.audio.pause();this.blocked=false;this.audio.src=track.url;this.audio.volume=0;this.gain=0;this.now.textContent=track.title;this.ended=false;this.play();}
 update(dt:number,scene:MusicScene,active:boolean,speed:number,flow:number,warning:number){
  if(this.scene!==scene){this.scene=scene;if(this.station==='auto'&&this.unlocked&&this.enabled)this.next();}
  if(!active||!this.enabled||document.hidden){this.audio.pause();this.effect.pause();this.playing=false;return;}
  if(this.ended&&this.unlocked)this.next();else if(!this.playing&&this.unlocked)this.play();
  const target=this.volume*(.68+Math.min(.22,Math.abs(speed)/65)+Math.min(.1,flow/4000))*(warning>0?.22:1);
  this.gain+=(target-this.gain)*(1-Math.exp(-dt*(warning>0?15:2)));this.audio.volume=Math.max(0,Math.min(1,this.gain));
 }
 celebrate(){if(!this.enabled||!this.unlocked)return;this.effect.currentTime=0;this.effect.volume=this.volume*.4;void this.effect.play().catch(()=>{});}
 get state(){return {enabled:this.enabled,volume:this.volume,station:this.station,scene:this.scene,playing:!this.audio.paused,track:this.audio.src.split('/').pop(),time:this.audio.currentTime};}
}
