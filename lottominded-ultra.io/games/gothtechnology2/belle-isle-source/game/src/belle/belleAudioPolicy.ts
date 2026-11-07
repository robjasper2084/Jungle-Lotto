/** Audio values adapted from Swoop's wheelCue, brakingCue and RideAudio.
 * Only measured controller fields drive warning and contact sounds. */
export interface WheelAudioPose {
 speed:number; footMode?:number; footBlend?:number; airHeight:number;
 crashBlend:number; beepPulse:number; scrape:number; scrapeHard:number;
 brakeAmount:number;
}
export interface AudioPreferences {
 music:boolean; effects:boolean; warnings:boolean;
 musicVolume:number; effectsVolume:number; warningVolume:number; track:string;
}
export const AUDIO_KEY='belle-isle-swoop-audio-v1';
export const DEFAULT_AUDIO:Readonly<AudioPreferences>=Object.freeze({
 music:true,effects:false,warnings:false,musicVolume:.34,effectsVolume:.65,warningVolume:.6,track:'track-01'
});
export const finite=(value:unknown,fallback=0):number=>typeof value==='number'&&Number.isFinite(value)?value:fallback;
export const unit=(value:unknown,fallback=0):number=>Math.max(0,Math.min(1,finite(value,fallback)));
export function audioPreferences(raw:unknown,trackIds:readonly string[]):AudioPreferences {
 const p=raw&&typeof raw==='object'?raw as Record<string,unknown>:{};
 // Missing preferences use the ride-start music default; an explicit saved OFF wins.
 return {music:p.music===undefined?DEFAULT_AUDIO.music:p.music===true,effects:p.effects===true,warnings:p.warnings===true,
 musicVolume:unit(p.musicVolume,DEFAULT_AUDIO.musicVolume),effectsVolume:unit(p.effectsVolume,DEFAULT_AUDIO.effectsVolume),warningVolume:unit(p.warningVolume,DEFAULT_AUDIO.warningVolume),
 track:typeof p.track==='string'&&trackIds.includes(p.track)?p.track:(trackIds[0]??'')};
}
export function wheelAudioTargets(p:WheelAudioPose,active:boolean,prefs:AudioPreferences) {
 const speed=Math.min(28,Math.abs(finite(p.speed)));
 const mounted=active&&finite(p.footMode)===0&&finite(p.footBlend)<.05&&finite(p.crashBlend)<.3;
 const grounded=mounted&&finite(p.airHeight)<.15;
 const effects=mounted&&prefs.effects?prefs.effectsVolume:0;
 const hard=finite(p.scrapeHard)>0;
 return {
  motorHz:55+speed*7,
  motorGain:Math.min(.035,speed*.0018)*(grounded?1:.3)*effects,
  windHz:180+Math.min(500,speed*12),windGain:Math.min(.018,speed*.0006)*effects,
  // Braking hiss is separate from actual contact scrape; neither fires in mid-air.
  brakeGain:grounded?unit(p.brakeAmount)*Math.min(1,speed/6)*.016*effects:0,
  scrapeGain:grounded?unit(p.scrape)*(hard?.11:.035)*effects:0,
  scrapeHz:(hard?1400:450)+speed*55,
  beepGain:mounted&&prefs.warnings?unit(p.beepPulse)*.035*prefs.warningVolume:0
 };
}
export interface MusicTrack {id:string;title:string;url:string;group:string;duration:number}
export function musicCatalog(raw:readonly Record<string,unknown>[]):MusicTrack[] {
 const urls=new Set<string>();
 return raw.flatMap(t=>{
  if(t.duplicateOf||['effect','shop','store','armory'].includes(String(t.group)))return [];
  const match=String(t.url??'').match(/(?:^|\/)audio\/swoop\/(track-\d+\.mp3)$/);
  if(!match||urls.has(match[1])||typeof t.id!=='string'||typeof t.title!=='string')return [];
  urls.add(match[1]);return [{id:t.id,title:t.title,url:'./audio/swoop/'+match[1],group:String(t.group??'ride'),duration:Math.max(0,finite(t.duration))}];
 });
}
