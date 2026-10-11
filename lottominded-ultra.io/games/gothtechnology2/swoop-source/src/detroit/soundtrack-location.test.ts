import test from 'node:test';
import assert from 'node:assert/strict';
import {Soundtrack} from './soundtrack.ts';

class ElementStub {
 textContent='';value='';children:any[]=[];nodes=new Map<string,ElementStub>();
 append(...children:any[]){this.children.push(...children);}
 setAttribute(){}
 querySelector(selector:string){if(!this.nodes.has(selector))this.nodes.set(selector,new ElementStub());return this.nodes.get(selector)!;}
}
class AudioStub {
 private source='';currentTime=0;volume=0;paused=true;preload='';
 get src(){return this.source;}
 set src(value:string){this.source=new URL(value,'http://game.local/').href;this.currentTime=0;}
 pause(){this.paused=true;}
 play(){this.paused=false;return Promise.resolve();}
}
let saved:any;
Object.assign(globalThis,{Audio:AudioStub,BroadcastChannel:undefined,
 document:{hidden:false,createElement:()=>new ElementStub(),addEventListener(){}},
 localStorage:{getItem:()=>JSON.stringify(saved),setItem:(_key:string,value:string)=>{saved=JSON.parse(value);}}
});
function create(lastTrack:string){saved={enabled:true,station:'shuffle',shuffleVersion:1,lastTrack};return new Soundtrack(new ElementStub() as any);}
test('starting inside LottoMind with only a saved last-track ID chooses valid outdoor audio on exit',()=>{
 const music=create('track-19');music.setStore(true);music.unlock();
 assert.equal(music.state.scene,'lotto-store');assert.equal(music.state.track,'track-01.mp3');
 music.setStore(false);
 assert.equal(music.state.scene,'ride');assert.match(music.state.track!,/^track-\d+\.mp3$/);assert(!['track-01.mp3','track-02.mp3'].includes(music.state.track!));
});
test('store exit resumes the previous outdoor song and position, never the store recording',()=>{
 const music=create('track-19');music.unlock();music.audio.currentTime=37;
 const previous=music.state.track;music.setStore(true);assert.equal(music.state.track,'track-01.mp3');
 music.setStore(false);assert.equal(music.state.track,previous);assert.equal(music.audio.currentTime,37);
});
test('a stale saved store selection cannot play outdoors after loading',()=>{
 saved={enabled:true,station:'track-01',lastTrack:'track-01',shuffleVersion:1};
 const music=new Soundtrack(new ElementStub() as any);music.unlock();
 assert.equal(music.station,'shuffle');assert(!['track-01.mp3','track-02.mp3'].includes(music.state.track!));
});
