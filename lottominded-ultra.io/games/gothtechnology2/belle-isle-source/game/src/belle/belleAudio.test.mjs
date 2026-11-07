import test from 'node:test';
import assert from 'node:assert/strict';
import {audioPreferences,DEFAULT_AUDIO,wheelAudioTargets,musicCatalog} from './belleAudioPolicy.ts';
import {BelleMusicPlayer} from './belleMusicPlayer.ts';
import {BelleWheelAudio} from './belleWheelAudio.ts';
import {BELLE_MUSIC} from './belleMusicCatalog.ts';
const p={speed:12,footMode:0,footBlend:0,airHeight:0,crashBlend:0,beepPulse:1,scrape:1,scrapeHard:1,brakeAmount:1};
const prefs={...DEFAULT_AUDIO,effects:true,warnings:true,effectsVolume:1,warningVolume:1};
const zero=v=>Object.entries(v).filter(([k])=>k.endsWith('Gain')).every(([,value])=>value===0);
const flush=()=>new Promise(resolve=>setImmediate(resolve));
const deferred=()=>{let resolve,reject;const promise=new Promise((a,b)=>{resolve=a;reject=b;});return{promise,resolve,reject};};
class FakeAudio{
 src='';preload='auto';volume=1;loop=true;currentTime=0;plays=0;pauses=0;loads=0;events=new Map();queue=[];
 play(){this.plays++;return this.queue.shift()??Promise.resolve();}pause(){this.pauses++;}load(){this.loads++;}
 addEventListener(n,fn){this.events.set(n,fn);}removeEventListener(n){this.events.delete(n);}
 removeAttribute(n){if(n==='src')this.src='';}
}
function music(){const audio=new FakeAudio(),statuses=[];let creates=0;const player=new BelleMusicPlayer(BELLE_MUSIC,()=>{creates++;return audio;},s=>statuses.push(s));return{player,audio,statuses,get creates(){return creates;}};}
test('music defaults on at 34 percent while wheel effects and warnings stay opt-in',()=>{assert.equal(DEFAULT_AUDIO.music,true);assert.equal(DEFAULT_AUDIO.musicVolume,.34);assert.equal(DEFAULT_AUDIO.effects,false);assert.equal(DEFAULT_AUDIO.warnings,false);});
test('corrupt preferences use safe defaults',()=>assert.deepEqual(audioPreferences(null,['track-01']),DEFAULT_AUDIO));
test('volumes clamp and unrecognized track never becomes a URL',()=>{const v=audioPreferences({music:'true',effects:true,musicVolume:2,effectsVolume:-3,warningVolume:NaN,track:'https://evil.invalid'},['track-01']);assert.equal(v.music,false);assert.equal(v.effects,true);assert.equal(v.musicVolume,1);assert.equal(v.effectsVolume,0);assert.equal(v.warningVolume,.6);assert.equal(v.track,'track-01');});
test('inactive wheel is entirely silent',()=>assert.ok(zero(wheelAudioTargets(p,false,prefs))));
test('wheel pitch rises with speed and handles reverse',()=>{assert.equal(wheelAudioTargets(p,true,prefs).motorHz,139);assert.equal(wheelAudioTargets({...p,speed:-12},true,prefs).motorHz,139);assert.equal(wheelAudioTargets({...p,speed:0},true,prefs).motorGain,0);});
test('walking disables motor, warning and scrapes',()=>assert.ok(zero(wheelAudioTargets({...p,footBlend:1},true,prefs))));
test('falling disables motor, warning and scrapes',()=>assert.ok(zero(wheelAudioTargets({...p,crashBlend:1},true,prefs))));
test('airborne wheels cannot scrape or emit braking contact',()=>{const v=wheelAudioTargets({...p,airHeight:1},true,prefs);assert.equal(v.scrapeGain,0);assert.equal(v.brakeGain,0);assert.ok(v.motorGain>0&&v.motorGain<wheelAudioTargets(p,true,prefs).motorGain);});
test('no contact means no metal scrape even when braking',()=>{const v=wheelAudioTargets({...p,scrape:0},true,prefs);assert.equal(v.scrapeGain,0);assert.ok(v.brakeGain>0);});
test('hard contact is louder and brighter than soft contact',()=>{const hard=wheelAudioTargets(p,true,prefs),soft=wheelAudioTargets({...p,scrapeHard:0},true,prefs);assert.ok(hard.scrapeGain>soft.scrapeGain);assert.ok(hard.scrapeHz>soft.scrapeHz);});
test('beep uses actual warning pulse, not arbitrary speed threshold',()=>{assert.equal(wheelAudioTargets({...p,speed:28,beepPulse:0},true,prefs).beepGain,0);assert.ok(wheelAudioTargets({...p,speed:0},true,prefs).beepGain>0);});
test('warning and wheel volume controls are independent',()=>{const v=wheelAudioTargets(p,true,{...prefs,effects:false});assert.equal(v.motorGain,0);assert.equal(v.scrapeGain,0);assert.ok(v.beepGain>0);assert.equal(wheelAudioTargets(p,true,{...prefs,warnings:false}).beepGain,0);});
test('zero volume silences all channels',()=>assert.ok(zero(wheelAudioTargets(p,true,{...prefs,effectsVolume:0,warningVolume:0}))));
test('invalid telemetry cannot send NaN into Web Audio',()=>{const invalid=Object.fromEntries(Object.keys(p).map(k=>[k,NaN]));assert.ok(Object.values(wheelAudioTargets(invalid,true,prefs)).every(Number.isFinite));});
test('catalog strips duplicate, effect, storefront and unsafe entries',()=>{const rows=[{id:'a',title:'Song',url:'/audio/swoop/track-01.mp3',group:'ride'}, {id:'b',title:'Copy',url:'/audio/swoop/track-01.mp3',group:'ride'}, {id:'c',title:'Effect',url:'/audio/swoop/track-16.mp3',group:'effect'}, {id:'d',title:'Store',url:'/audio/swoop/track-02.mp3',group:'shop'}, {id:'e',title:'Bad',url:'https://elsewhere.invalid/x.mp3',group:'ride'}];assert.equal(musicCatalog(rows).length,1);assert.equal(musicCatalog(rows)[0].url,'./audio/swoop/track-01.mp3');});
test('verified catalog has 19 unique musical tracks and no sound-design one-shot',()=>{assert.equal(BELLE_MUSIC.length,19);assert.equal(new Set(BELLE_MUSIC.map(x=>x.url)).size,19);assert.ok(!BELLE_MUSIC.some(x=>x.id==='track-16'));});
test('construction and restored opt-in do not create or play audio',()=>{const m=music();m.player.configure(true,.2,'track-01');m.player.setActive(true);assert.equal(m.creates,0);assert.equal(m.audio.plays,0);});
test('gesture creates one player with preload none',async()=>{const m=music();m.player.configure(true,.2,'track-01');m.player.setActive(true);m.player.unlock();await flush();assert.equal(m.creates,1);assert.equal(m.audio.preload,'none');assert.equal(m.audio.volume,.2);assert.equal(m.player.state.playing,true);});
test('menu unlock is inaudible and immediately pauses when priming resolves',async()=>{const m=music();m.player.configure(true,.2,'track-01');m.player.unlock();assert.equal(m.audio.volume,0);await flush();assert.equal(m.player.state.playing,false);assert.ok(m.audio.pauses>0);m.player.setActive(true);await flush();assert.equal(m.audio.volume,.2);});
test('pause silences immediately and resume reuses the element',async()=>{const m=music();m.player.configure(true,.3,'track-01');m.player.setActive(true);m.player.unlock();await flush();m.player.setActive(false);assert.equal(m.audio.volume,0);m.player.setActive(true);await flush();assert.equal(m.creates,1);assert.equal(m.audio.volume,.3);});
test('muting during pending play cannot resurrect music',async()=>{const m=music(),d=deferred();m.audio.queue.push(d.promise);m.player.configure(true,.3,'track-01');m.player.setActive(true);m.player.unlock();m.player.configure(false,.3,'track-01');d.resolve();await flush();assert.equal(m.audio.volume,0);assert.equal(m.player.state.playing,false);});
test('play rejection is handled and never retried by the frame loop',async()=>{const m=music();m.audio.queue.push(Promise.reject(Error('blocked')));m.player.configure(true,.3,'track-01');m.player.setActive(true);m.player.unlock();await flush();assert.equal(m.player.state.blocked,true);for(let i=0;i<100;i++)m.player.setActive(true);assert.equal(m.audio.plays,1);m.player.unlock();await flush();assert.equal(m.audio.plays,2);assert.equal(m.player.state.playing,true);});
test('repeated running updates create no extra play requests',async()=>{const m=music();m.player.configure(true,.3,'track-01');m.player.setActive(true);m.player.unlock();await flush();for(let i=0;i<10000;i++)m.player.setActive(true);assert.equal(m.audio.plays,1);});
test('next track uses same player and a valid catalog URL',async()=>{const m=music();m.player.configure(true,.3,'track-01');m.player.setActive(true);m.player.unlock();await flush();m.player.next();await flush();assert.equal(m.creates,1);assert.equal(m.player.selected,'track-02');assert.equal(m.audio.src,'./audio/swoop/track-02.mp3');});
test('late failure for an abandoned track cannot block its successor',async()=>{const m=music(),d=deferred();m.audio.queue.push(d.promise);m.player.configure(true,.3,'track-01');m.player.setActive(true);m.player.unlock();m.player.next();await flush();d.reject(Error('old request cancelled'));await flush();assert.equal(m.player.state.blocked,false);assert.equal(m.player.state.playing,true);});
test('ended song advances one track but never when paused',async()=>{const m=music();m.player.configure(true,.3,'track-01');m.player.setActive(true);m.player.unlock();await flush();m.audio.events.get('ended')();await flush();assert.equal(m.player.selected,'track-02');m.player.setActive(false);m.audio.events.get('ended')();assert.equal(m.player.selected,'track-02');});
test('empty music catalog remains silent',()=>{const p=new BelleMusicPlayer([],()=>{throw Error('must not create');});p.configure(true,1,'');p.setActive(true);p.unlock();p.next();assert.equal(p.state.created,false);});
test('dispose releases media listeners and ignores future activation',async()=>{const m=music();m.player.configure(true,.3,'track-01');m.player.setActive(true);m.player.unlock();await flush();m.player.dispose();m.player.dispose();m.player.unlock();assert.equal(m.audio.events.size,0);assert.equal(m.audio.src,'');assert.equal(m.player.state.created,false);});
function fakeContext(){
 const metrics={oscillators:0,noises:0,stopped:0,resumes:0,closes:0},gains=[];
 const param=()=>({value:0,setTargetAtTime(v){this.value=v;},setValueAtTime(v){this.value=v;},cancelScheduledValues(){}});
 const node=()=>({connect(){return this;},disconnect(){},start(){},stop(){metrics.stopped++;}});
 const c={state:'suspended',sampleRate:100,currentTime:1,destination:{},createGain(){const g={...node(),gain:param()};gains.push(g);return g;},createOscillator(){metrics.oscillators++;return {...node(),frequency:param()};},createBuffer(){return {getChannelData:()=>new Float32Array(100)};},createBufferSource(){metrics.noises++;return node();},createBiquadFilter(){return {...node(),frequency:param(),Q:param()};},async resume(){metrics.resumes++;c.state='running';},async close(){metrics.closes++;c.state='closed';}};
 return{c,metrics,gains};
}
test('wheel context is lazy and a thousand frames allocate no new voices',async()=>{const f=fakeContext();let created=0;const a=new BelleWheelAudio(()=>{created++;return f.c;});a.update(p,true,prefs);assert.equal(created,0);await a.unlock();for(let i=0;i<1000;i++)a.update(p,true,prefs);assert.equal(created,1);assert.equal(f.metrics.oscillators,2);assert.equal(f.metrics.noises,1);await a.unlock();assert.equal(f.metrics.resumes,1);});
test('wheel silence immediately zeros master and disposal stops every source once',async()=>{const f=fakeContext(),a=new BelleWheelAudio(()=>f.c);await a.unlock();a.update(p,true,prefs);assert.equal(f.gains[0].gain.value,1);a.silence();assert.equal(f.gains[0].gain.value,0);await a.dispose();await a.dispose();assert.equal(f.metrics.stopped,3);assert.equal(f.metrics.closes,1);});
test('unavailable AudioContext does not crash the game',async()=>{const a=new BelleWheelAudio(()=>undefined);assert.equal(await a.unlock(),false);a.update(p,true,prefs);a.silence();await a.dispose();});

// Default-on changes the preference, not browser authorization or mute ownership.
test('missing and partial preferences inherit 34 percent ride-start music',()=>{
 for(const raw of [null,undefined,{},42,'corrupt',[],{effects:true}]){
  const value=audioPreferences(raw,['track-01']);
  assert.equal(value.music,true);assert.equal(value.musicVolume,.34);
 }
});
test('saved mute and zero volume survive the new default',()=>{
 const muted=audioPreferences({music:false,musicVolume:0},['track-01']);
 assert.equal(muted.music,false);assert.equal(muted.musicVolume,0);
 const quieter=audioPreferences({music:true,musicVolume:.12,track:'track-02'},['track-01','track-02']);
 assert.equal(quieter.musicVolume,.12);assert.equal(quieter.track,'track-02');
});
test('malformed explicit music values fail closed instead of forcing playback',()=>{
 for(const value of [null,0,1,'true','false',[],{}])assert.equal(audioPreferences({music:value},['track-01']).music,false);
});
test('fresh defaults wait for a gesture, then play automatically at exactly 34 percent',async()=>{
 const m=music(),defaults=audioPreferences(null,BELLE_MUSIC.map(t=>t.id));
 m.player.configure(defaults.music,defaults.musicVolume,defaults.track);
 m.player.setActive(true);assert.equal(m.creates,0);assert.equal(m.audio.plays,0);
 m.player.unlock();await flush();assert.equal(m.player.state.playing,true);assert.equal(m.audio.volume,.34);
});
test('default-on Start primes silently during loading and plays when the ride activates',async()=>{
 const m=music(),defaults=audioPreferences(null,BELLE_MUSIC.map(t=>t.id));
 m.player.configure(defaults.music,defaults.musicVolume,defaults.track);
 m.player.unlock();assert.equal(m.audio.volume,0);await flush();assert.equal(m.player.state.playing,false);
 m.player.setActive(true);await flush();assert.equal(m.player.state.playing,true);assert.equal(m.audio.volume,.34);
 m.player.setActive(false);assert.equal(m.audio.volume,0);
 m.player.setActive(true);await flush();assert.equal(m.audio.volume,.34);assert.equal(m.creates,1);
});
test('persisted music OFF cannot be undone by Start or repeated ride updates',async()=>{
 const m=music(),saved=audioPreferences({music:false,musicVolume:.34},['track-01']);
 m.player.configure(saved.music,saved.musicVolume,saved.track);m.player.unlock();m.player.setActive(true);
 for(let i=0;i<100;i++)m.player.setActive(true);await flush();assert.equal(m.audio.plays,0);assert.equal(m.creates,0);
});
test('default-on browser denial stays silent and a deliberate retry recovers at 34 percent',async()=>{
 const m=music(),defaults=audioPreferences(null,['track-01']);
 m.audio.queue.push(Promise.reject(new DOMException('User activation required','NotAllowedError')));
 m.player.configure(defaults.music,defaults.musicVolume,defaults.track);m.player.setActive(true);m.player.unlock();
 await flush();assert.equal(m.player.state.blocked,true);assert.equal(m.audio.volume,0);
 for(let i=0;i<100;i++)m.player.setActive(true);assert.equal(m.audio.plays,1);
 m.player.unlock();await flush();assert.equal(m.player.state.playing,true);assert.equal(m.audio.volume,.34);
});
