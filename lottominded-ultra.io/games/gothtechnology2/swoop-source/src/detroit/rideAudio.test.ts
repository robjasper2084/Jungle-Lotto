import {test} from 'node:test';
import assert from 'node:assert/strict';
import {RideAudio} from './rideAudio.ts';
import {RideController,createPose,NEUTRAL_ACTIONS} from './controller.ts';
import type {TerrainSampler} from './terrain.ts';

class Param {value=0;setTargetAtTime(value:number){this.value=value;}}
class AudioNodeMock {gain=new Param();frequency=new Param();Q=new Param();type='';loop=false;buffer:unknown;connect(next:AudioNodeMock){return next;}start(){}}
class ContextMock {
 static latest:ContextMock;static created=0;state='suspended';currentTime=0;sampleRate=120;destination=new AudioNodeMock();
 constructor(){ContextMock.created++;ContextMock.latest=this;}
 createGain(){return new AudioNodeMock();}createOscillator(){return new AudioNodeMock();}createBiquadFilter(){return new AudioNodeMock();}createBufferSource(){return new AudioNodeMock();}
 createBuffer(_channels:number,length:number){return {getChannelData:()=>new Float32Array(length)};}
 async resume(){this.state='running';}async close(){this.state='closed';}
}
const flat:TerrainSampler={sampleGround(_x,_z,o){o.height=0;o.normal={x:0,y:1,z:0};o.surface='pavement';o.offCourse=false;return o;},raycast:()=>null,raycastObstacle:()=>null};

test('actual controller warning and scrape cues reach audio gains, and pause/mute silence output',async(t)=>{
 const original=Object.getOwnPropertyDescriptor(globalThis,'AudioContext');
 Object.defineProperty(globalThis,'AudioContext',{value:ContextMock,configurable:true});
 t.after(()=>{if(original)Object.defineProperty(globalThis,'AudioContext',original);else Reflect.deleteProperty(globalThis,'AudioContext');});
 const audio=new RideAudio(),controller=new RideController(flat),pose=createPose();
 assert.equal(audio.state.context,'not-created');await audio.enable(false);assert.equal(audio.state.context,'not-created');
 await audio.enable(true);assert.equal(audio.state.context,'running');
 const created=ContextMock.created;await audio.enable(true);assert.equal(ContextMock.created,created);
 let peakBeep=0,peakScrape=0;
 for(let i=0;i<1200;i++){
  controller.step(1/120,{...NEUTRAL_ACTIONS,throttle:1});controller.writePose(pose);audio.update(pose,true);peakBeep=Math.max(peakBeep,audio.state.beepGain);
 }
 assert.ok(peakBeep>0,'overspeed warning must be audible');
 for(let i=0;i<180;i++){
  controller.step(1/120,{...NEUTRAL_ACTIONS,throttle:.7,steer:1});controller.writePose(pose);audio.update(pose,true);peakScrape=Math.max(peakScrape,audio.state.scrapeGain);
 }
 assert.ok(peakScrape>0,'hard pedal contact must feed scrape audio');
 audio.update(pose,false);assert.equal(audio.state.masterGain,0);
 audio.update(pose,true);assert.equal(audio.state.masterGain,1);
 await audio.enable(false);assert.equal(audio.state.masterGain,0);audio.update(pose,true);assert.equal(audio.state.masterGain,0);
 await audio.dispose();assert.equal(audio.state.context,'not-created');assert.equal(audio.state.enabled,false);
});


test('landing and confirmation audio require unlock, scale and decay, with no replay after mute/pause',async(t)=>{
 const original=Object.getOwnPropertyDescriptor(globalThis,'AudioContext');Object.defineProperty(globalThis,'AudioContext',{value:ContextMock,configurable:true});
 t.after(()=>{if(original)Object.defineProperty(globalThis,'AudioContext',original);else Reflect.deleteProperty(globalThis,'AudioContext');});
 const audio=new RideAudio(),p=createPose();audio.landing(5,'dirt');audio.confirm();assert.equal(audio.state.context,'not-created');assert.equal(audio.state.impacts,0);
 await audio.enable(true);const c=ContextMock.latest;audio.landing(2,'pavement');audio.update(p,true);const soft=audio.state.impactGain;assert.ok(soft>0);
 c.currentTime=.5;audio.landing(5,'gravel');audio.update(p,true);assert.ok(audio.state.impactGain>soft);
 audio.confirm('trick');audio.update(p,true);assert.ok(audio.state.confirmationGain>0);c.currentTime+=.4;audio.update(p,true);assert.equal(audio.state.impactGain+audio.state.confirmationGain,0);
 audio.confirm();audio.landing(4,'pavement',true);audio.update(p,false);assert.equal(audio.state.masterGain,0);audio.update(p,true);assert.equal(audio.state.impactGain+audio.state.confirmationGain,0);
 await audio.enable(false);const count=audio.state.impacts;audio.landing(5,'dirt');audio.confirm();audio.update(p,true);assert.equal(audio.state.impacts,count);assert.equal(audio.state.masterGain,0);await audio.dispose();
});
