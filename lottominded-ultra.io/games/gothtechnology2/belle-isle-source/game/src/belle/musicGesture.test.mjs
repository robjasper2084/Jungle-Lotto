import test from 'node:test';
import assert from 'node:assert/strict';
import {BelleMusicPlayer} from './belleMusicPlayer.ts';
const tracks=[{id:'track-01',title:'First',url:'./audio/swoop/track-01.mp3',duration:193,group:'ride'},{id:'track-02',title:'Second',url:'./audio/swoop/track-02.mp3',duration:200,group:'ride'}];
const flush=()=>new Promise(resolve=>setImmediate(resolve));
function fixture(){
 const events=new Map(),messages=[];let creates=0;
 const audio={src:'',preload:'auto',volume:1,loop:true,currentTime:0,plays:0,pauses:0,loads:0,queue:[],
  play(){this.plays++;return this.queue.shift()??Promise.resolve();},pause(){this.pauses++;},load(){this.loads++;},
  addEventListener(name,listener){events.set(name,listener);},removeEventListener(name){events.delete(name);},removeAttribute(name){if(name==='src')this.src='';}};
 const player=new BelleMusicPlayer(tracks,()=>{creates++;return audio;},message=>messages.push(message));
 player.configure(true,.34,'track-01');return{player,audio,events,messages,get creates(){return creates;}};
}
test('unrelated settings clicks cannot repeatedly prime an already authorized paused soundtrack',async()=>{
 const f=fixture();f.player.unlock();await flush();assert.equal(f.audio.plays,1);assert.equal(f.audio.pauses,1);
 const src=f.audio.src;
 for(let i=0;i<20;i++){f.player.unlock();await flush();}
 assert.equal(f.audio.plays,1,'A menu click must not trigger another play/pause cycle');
 assert.equal(f.audio.pauses,1);assert.equal(f.audio.volume,0);assert.equal(f.audio.src,src);assert.equal(f.audio.loads,0);assert.equal(f.creates,1);
});
test('cinematic settings sequence leaves the soundtrack paused until the actual ride resumes',async()=>{
 const f=fixture();f.player.unlock();await flush();f.player.setActive(true);await flush();assert.equal(f.audio.plays,2);
 f.audio.currentTime=31;f.player.setActive(false);const before=f.audio.plays;
 for(const action of ['open settings','full cockpit','compact cockpit','racing','cinematic','exploration','sunset','reduced motion','close settings']){
  f.player.unlock();await flush();assert.equal(f.audio.plays,before,action);assert.equal(f.audio.volume,0,action);
 }
 f.player.setActive(true);await flush();assert.equal(f.audio.plays,before+1);assert.equal(f.audio.volume,.34);assert.equal(f.audio.currentTime,31);assert.equal(f.creates,1);
});
test('first prime remains synchronous with the trusted gesture and uses preload none',async()=>{
 const f=fixture();assert.equal(f.creates,0);f.player.unlock();assert.equal(f.audio.plays,1);assert.equal(f.audio.volume,0);assert.equal(f.audio.preload,'none');await flush();
});
test('rapid repeated gestures do not duplicate a pending prime',async()=>{
 const f=fixture();let complete;f.audio.queue.push(new Promise(r=>complete=r));f.player.unlock();for(let i=0;i<100;i++)f.player.unlock();assert.equal(f.audio.plays,1);complete();await flush();f.player.unlock();await flush();assert.equal(f.audio.plays,1);
});
test('browser rejection still permits a fresh gesture retry in a menu',async()=>{
 const f=fixture();f.audio.queue.push(Promise.reject(new DOMException('Blocked','NotAllowedError')));f.player.unlock();await flush();assert.equal(f.player.state.blocked,true);
 f.player.unlock();await flush();assert.equal(f.audio.plays,2);assert.equal(f.player.state.blocked,false);assert.equal(f.audio.volume,0);
 f.player.unlock();await flush();assert.equal(f.audio.plays,2);f.player.setActive(true);await flush();assert.equal(f.audio.volume,.34);
});
test('native media error still permits an explicit retry without a frame-loop retry storm',async()=>{
 const f=fixture();f.player.setActive(true);f.player.unlock();await flush();f.events.get('error')();assert.equal(f.player.state.blocked,true);
 for(let i=0;i<100;i++)f.player.setActive(true);assert.equal(f.audio.plays,1);f.player.unlock();await flush();assert.equal(f.audio.plays,2);assert.equal(f.player.state.playing,true);
});
test('mute and disposal cannot be undone by unrelated gestures',async()=>{
 const f=fixture();f.player.unlock();await flush();f.player.configure(false,.34,'track-01');for(let i=0;i<10;i++)f.player.unlock();assert.equal(f.audio.plays,1);f.player.dispose();f.player.unlock();f.player.setActive(true);assert.equal(f.audio.plays,1);assert.equal(f.audio.src,'');
});
test('an explicitly selected next track waits silently in a menu and plays on resume',async()=>{
 const f=fixture();f.player.unlock();await flush();f.player.next();const src=f.audio.src;f.player.unlock();await flush();assert.equal(f.audio.plays,1);assert.equal(src,'./audio/swoop/track-02.mp3');f.player.setActive(true);await flush();assert.equal(f.audio.plays,2);assert.equal(f.audio.src,src);assert.equal(f.audio.volume,.34);
});
