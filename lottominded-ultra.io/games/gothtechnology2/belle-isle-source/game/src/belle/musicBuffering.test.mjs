import test from 'node:test';
import assert from 'node:assert/strict';
import {BelleMusicPlayer} from './belleMusicPlayer.ts';
const flush=()=>new Promise(resolve=>setImmediate(resolve));
function fixture(){
 const pauses=[],loads=[],events=new Map();let creates=0;
 const audio={src:'',preload:'auto',volume:1,loop:false,currentTime:0,
  play:()=>Promise.resolve(),pause(){pauses.push({preload:this.preload,volume:this.volume});},load(){loads.push({src:this.src,preload:this.preload});},
  addEventListener:(name,listener)=>events.set(name,listener),removeEventListener:name=>events.delete(name),removeAttribute(){this.src='';}};
 const player=new BelleMusicPlayer([{id:'one',title:'One',url:'./audio/swoop/track-01.mp3'},{id:'two',title:'Two',url:'./audio/swoop/track-02.mp3'}],()=>{creates++;return audio;});
 player.configure(true,.34,'one');return{player,audio,pauses,loads,events,get creates(){return creates;}};
}
test('successful silent authorization retains only the selected track before native pause',async()=>{
 const f=fixture();assert.equal(f.creates,0);f.player.unlock();assert.equal(f.audio.preload,'none');await flush();
 assert.deepEqual(f.pauses.at(-1),{preload:'auto',volume:0});assert.equal(f.creates,1);assert.equal(f.loads.length,0);
});
test('gameplay pause keeps the current track buffered and resume preserves its position',async()=>{
 const f=fixture();f.player.setActive(true);f.player.unlock();await flush();assert.equal(f.audio.preload,'none');
 f.audio.currentTime=31;f.player.setActive(false);assert.deepEqual(f.pauses.at(-1),{preload:'auto',volume:0});
 for(let i=0;i<10;i++)f.player.unlock();await flush();f.player.setActive(true);await flush();assert.equal(f.audio.currentTime,31);assert.equal(f.creates,1);assert.equal(f.loads.length,0);
});
test('mute, playback error and disposal disable buffering without creating another player',async()=>{
 for(const action of ['mute','error','dispose']){const f=fixture();f.player.unlock();await flush();assert.equal(f.audio.preload,'auto');
  if(action==='mute')f.player.configure(false,.34,'one');else if(action==='error')f.events.get('error')();else f.player.dispose();
  assert.equal(f.audio.preload,'none',action);assert.equal(f.audio.volume,0);assert.equal(f.creates,1);
 }
});
test('changing tracks while paused does not preload the next track before playback',async()=>{
 for(const select of [f=>f.player.next(),f=>f.player.configure(true,.34,'two')]){const f=fixture();f.player.unlock();await flush();select(f);
  assert.equal(f.loads.at(-1).preload,'none');assert.equal(f.audio.src,'./audio/swoop/track-02.mp3');assert.equal(f.audio.volume,0);assert.equal(f.creates,1);
 }
});
