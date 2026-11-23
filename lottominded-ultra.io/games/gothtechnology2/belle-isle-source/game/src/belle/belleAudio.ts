import {AUDIO_KEY,audioPreferences,type AudioPreferences,type WheelAudioPose,type BoatAudioPose} from './belleAudioPolicy.ts';
import {BelleMusicPlayer} from './belleMusicPlayer.ts';
import {BelleWheelAudio} from './belleWheelAudio.ts';
import {BELLE_MUSIC} from './belleMusicCatalog.ts';
import {CadillacHorn,TrunkMediaOutput,playAcceptedTrunkHorn,type TrunkSpeakerFrame} from './cadillacAudio.ts';
import './belleAudio.css';

export function createBelleAudio(){
 const storage=()=>{try{return localStorage;}catch{return null;}};
 let raw:unknown;try{raw=JSON.parse(storage()?.getItem(AUDIO_KEY)??'null');}catch{raw=null;}
 let prefs=audioPreferences(raw,BELLE_MUSIC.map(t=>t.id));
 const effects=new BelleWheelAudio();let disposed=false,unlocked=false,lastSample=-Infinity;
 const panel=document.createElement('fieldset');panel.className='belle-audio';panel.id='belle-audio';
 panel.innerHTML=`<legend>Swoop Detroit audio</legend>
 <p>Music starts automatically at 34% when you begin riding. Your saved volume and mute choices take priority. Vehicle effects and warning beeps remain optional.</p>
 <label><input id="belle-music" type="checkbox"> Music</label>
 <label>Music volume <input id="belle-music-volume" type="range" min="0" max="100" step="1"><output></output></label>
 <label>Track <select id="belle-track"></select></label>
 <div class="belle-audio-actions"><button id="belle-music-next" type="button">Next track</button><button id="belle-music-retry" type="button">Retry music</button></div>
 <label><input id="belle-effects" type="checkbox"> Vehicle motor, boat jets, wind, contact sounds and Cadillac trunk horn</label>
 <label>Vehicle effects volume <input id="belle-effects-volume" type="range" min="0" max="100" step="1"><output></output></label>
 <label><input id="belle-warnings" type="checkbox"> Wheel warning beeps</label>
 <label>Warning volume <input id="belle-warning-volume" type="range" min="0" max="100" step="1"><output></output></label>
 <button id="belle-audio-mute" type="button">Mute music and vehicle audio</button>
 <p>Checkpoint and finish chimes keep their existing separate Gate sounds setting. Hoverbike engine and nature sound controls are unchanged.</p>
 <p id="belle-audio-status" role="status" aria-live="polite">Press Start to ride with music. Use Music or Mute to turn it off.</p>`;
 const host=document.getElementById('settings');
 if(!host){console.warn('Belle audio settings dialog is unavailable. Riding remains usable.');return{update(_pose:WheelAudioPose,_state:{active:boolean;wheel:boolean;boat?:BoatAudioPose},_now?:number){},setTrunkSpeaker(_frame:TrunkSpeakerFrame|null){},trunkOpened(_gesture:Event&{repeat?:boolean}){return Promise.resolve(false);},setVehicleEffects(_enabled:boolean,_gesture:Event){},get effectsEnabled(){return false;},get effectsVolume(){return 0;},silence(){},dispose(){}};}
 host.append(panel);
 const get=<T extends HTMLElement>(id:string)=>panel.querySelector<T>('#'+id)!;
 const status=get('belle-audio-status'),track=get<HTMLSelectElement>('belle-track');
 for(const song of BELLE_MUSIC){const option=document.createElement('option');option.value=song.id;option.textContent=song.title;track.append(option);}
 const soundtrack=new TrunkMediaOutput(),horn=new CadillacHorn();let trunkFrame:TrunkSpeakerFrame|null=null;
 const music=new BelleMusicPlayer(BELLE_MUSIC,()=>{const audio=new Audio();soundtrack.attach(audio);return audio;},text=>{status.textContent=text;track.value=music.selected;if(music.selected&&prefs.track!==music.selected){prefs={...prefs,track:music.selected};save();}});
 const save=()=>{try{storage()?.setItem(AUDIO_KEY,JSON.stringify(prefs));}catch{status.textContent='Audio choices apply for this visit; browser storage is unavailable.';}};
 const synchronize=()=>{
  for(const [id,key]of [['belle-music','music'],['belle-effects','effects'],['belle-warnings','warnings']] as const)get<HTMLInputElement>(id).checked=prefs[key];
  for(const [id,key]of [['belle-music-volume','musicVolume'],['belle-effects-volume','effectsVolume'],['belle-warning-volume','warningVolume']] as const){
   const input=get<HTMLInputElement>(id);input.value=String(Math.round(prefs[key]*100));input.parentElement!.querySelector('output')!.textContent=input.value+'%';
  }
  track.value=prefs.track;music.configure(prefs.music,prefs.musicVolume,prefs.track);
 };
 const unlock=()=>{
  if(disposed)return;unlocked=true;music.unlock();if(prefs.music)void soundtrack.unlock();
  if(prefs.effects||prefs.warnings)void effects.unlock().then(ok=>{if(!ok&&!disposed)status.textContent='Wheel audio could not start. Toggle it off and on to retry.';});
 };
 for(const [id,key]of [['belle-music','music'],['belle-effects','effects'],['belle-warnings','warnings']] as const){
  get<HTMLInputElement>(id).addEventListener('change',event=>{prefs={...prefs,[key]:get<HTMLInputElement>(id).checked};effects.silence();horn.silence();synchronize();save();if(event.isTrusted)unlock();if(!prefs.effects&&!prefs.warnings)effects.silence();});
 }
 for(const [id,key]of [['belle-music-volume','musicVolume'],['belle-effects-volume','effectsVolume'],['belle-warning-volume','warningVolume']] as const){
  get<HTMLInputElement>(id).addEventListener('input',()=>{prefs={...prefs,[key]:Number(get<HTMLInputElement>(id).value)/100};if(key==='effectsVolume')horn.silence();synchronize();save();});
 }
 track.addEventListener('change',event=>{prefs={...prefs,track:track.value};synchronize();save();if(event.isTrusted)unlock();});
 get('belle-music-next').addEventListener('click',event=>{music.next();prefs={...prefs,track:music.selected};synchronize();save();if(event.isTrusted)unlock();});
 get('belle-music-retry').addEventListener('click',event=>{if(event.isTrusted)unlock();});
 get('belle-audio-mute').addEventListener('click',()=>{prefs={...prefs,music:false,effects:false,warnings:false};synchronize();effects.silence();horn.silence();save();status.textContent='Music, vehicle effects and warning beeps muted.';});
 const gesture=(event:Event)=>{if(event.isTrusted&&!(event instanceof KeyboardEvent&&event.repeat))unlock();};
 const suspend=()=>{music.setActive(false);effects.silence();horn.setActive(false);horn.silence();lastSample=-Infinity;};
 const visibility=()=>{if(document.hidden)suspend();};
 // No polling timer and no second animation loop. Audio follows the actual game frame.
 document.addEventListener('click',gesture,{capture:true});document.addEventListener('keydown',gesture,{capture:true});
 window.addEventListener('blur',suspend);window.addEventListener('pagehide',suspend);document.addEventListener('visibilitychange',visibility);
 synchronize();
 return {
  update(pose:WheelAudioPose,state:{active:boolean;wheel:boolean;boat?:BoatAudioPose},now=performance.now()){
   if(disposed)return;
   const active=state.active&&unlocked&&!document.hidden&&document.hasFocus();
   horn.setActive(active&&!!trunkFrame);
   music.setActive(active);
   if(!active){effects.silence();return;}
   if(now-lastSample<1000/30)return;lastSample=now;
   effects.update(pose,state.wheel,prefs,state.boat);
  },
  setTrunkSpeaker(frame:TrunkSpeakerFrame|null){trunkFrame=frame;soundtrack.setFrame(frame);if(!frame)horn.setActive(false);},
  trunkOpened(gesture:Event&{repeat?:boolean}){return playAcceptedTrunkHorn(horn,gesture,{trunkPresent:!!trunkFrame,unlocked,visible:!document.hidden,focused:document.hasFocus(),dialogOpen:!!document.querySelector('dialog[open]'),enabled:prefs.effects,volume:prefs.effectsVolume});},
  setVehicleEffects(enabled:boolean,gesture:Event){
   if(disposed)return;prefs={...prefs,effects:enabled};effects.silence();horn.silence();synchronize();save();if(gesture.isTrusted)unlock();
  },
  get effectsEnabled(){return prefs.effects;},
  get effectsVolume(){return prefs.effectsVolume;},
  silence:suspend,
  dispose(){if(disposed)return;disposed=true;suspend();music.dispose();void soundtrack.dispose();void horn.dispose();void effects.dispose();
   document.removeEventListener('click',gesture,{capture:true});document.removeEventListener('keydown',gesture,{capture:true});
   window.removeEventListener('blur',suspend);window.removeEventListener('pagehide',suspend);document.removeEventListener('visibilitychange',visibility);panel.remove();}
 };
}
