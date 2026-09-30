import {test} from 'node:test';
import assert from 'node:assert/strict';
class ElementMock {textContent='';value='';onclick:any;onchange:any;oninput:any;nodes=new Map();append(){}setAttribute(){}querySelector(id:string){if(!this.nodes.has(id))this.nodes.set(id,new ElementMock());return this.nodes.get(id);}}
class AudioMock {src='';volume=0;paused=true;preload='';currentTime=0;play(){this.paused=false;return Promise.resolve();}pause(){this.paused=true;}}
class ChannelMock {static instances:ChannelMock[]=[];onmessage:any;constructor(_name:string){ChannelMock.instances.push(this);}postMessage(data:any){for(const c of ChannelMock.instances)if(c!==this)c.onmessage?.({data});}}
test('starting another ride silences previous music and keeps it stopped until a new gesture',async()=>{
 Object.assign(globalThis,{Audio:AudioMock,BroadcastChannel:ChannelMock,document:{hidden:false,createElement:()=>new ElementMock(),addEventListener(){}},localStorage:{getItem(){return null;},setItem(){}}});
 const {Soundtrack}=await import('./soundtrack.ts');const a=new Soundtrack(new ElementMock() as any),b=new Soundtrack(new ElementMock() as any);
 a.unlock();assert.equal(a.state.playing,true);b.unlock();assert.equal(a.state.playing,false);assert.equal(b.state.playing,true);
 a.update(1,'ride',true,0,0,0);assert.equal(a.state.playing,false,'inactive tab must not restart on its next frame');
 a.unlock();assert.equal(a.state.playing,true);assert.equal(b.state.playing,false);
});
