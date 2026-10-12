import test from 'node:test';
import assert from 'node:assert/strict';
import {spatialCue,wheelCue} from './audioCues.ts';
import {RoyaleAudio} from './audio.ts';
import {createPose} from '../controller.ts';

test('directional cues follow the listener, attenuate and never reveal distant actors',()=>{
 assert(spatialCue(10,0,0).pan>0);assert(spatialCue(10,0,Math.PI).pan<0);
 assert(Math.abs(spatialCue(10,0,Math.PI/2).pan)<1e-8);
 assert(spatialCue(5,0,0).gain>spatialCue(50,0,0).gain);assert.equal(spatialCue(101,0,0).gain,0);
 assert.deepEqual(spatialCue(0,0,0),{gain:1,pan:0});
});

test('audio waits for a gesture, reuses its motor, deduplicates cues, and mutes on pause',async()=>{
 let voices=0;const param=()=>({value:0,setValueAtTime(){},exponentialRampToValueAtTime(){},setTargetAtTime(){}});
 const node=()=>({gain:param(),frequency:param(),pan:param(),connect(other:unknown){return other;},disconnect(){},start(){},stop(){}});
 class Context {state='running';currentTime=1;sampleRate=48000;destination=node();createGain=node;createStereoPanner=node;createBiquadFilter=node;createOscillator(){voices++;return node();}createBufferSource(){voices++;return node();}createBuffer(){return{getChannelData:()=>new Float32Array(14400)};}async resume(){}async close(){}}
 const original=Object.getOwnPropertyDescriptor(globalThis,'window');Object.defineProperty(globalThis,'window',{value:{AudioContext:Context},configurable:true});
 try{
  const audio=new RoyaleAudio();audio.music=false;assert.equal(audio.status.context,'not-created');assert.equal(voices,0);await audio.unlock();assert.equal(voices,1);
  const state={round:'test',tick:250,phase:'active',events:[],actors:[{id:'me',alive:true,pose:{...createPose(),speed:8},dog:{x:1,z:0,speed:2,phase:1}}],field:{x:0,z:0,radius:100,remaining:7,phase:0}};
  audio.update(state,'me',true);const first=voices;assert(first>1);assert(audio.status.wheelLevel>0);
  for(let i=0;i<120;i++)audio.update(state,'me',true);assert.equal(voices,first);
  state.tick++;audio.update(state,'me',true);assert.equal(voices,first);
  audio.update(state,'me',false);assert.equal(audio.status.wheelLevel,0);audio.effects=false;audio.update(state,'me',true);assert.equal(audio.status.wheelLevel,0);assert.equal(voices,first);audio.dispose();
 }finally{if(original)Object.defineProperty(globalThis,'window',original);else Reflect.deleteProperty(globalThis,'window');}
});
test('wheel sound tracks speed but silences on foot, death, pause and crashes',()=>{
 const p={speed:10,footMode:0,airHeight:0,crashBlend:0};const riding=wheelCue(p,true,true);
 assert(riding.gain>0);assert(wheelCue({...p,speed:20},true,true).hz>riding.hz);
 for(const cue of [wheelCue(p,false,true),wheelCue(p,true,false),wheelCue({...p,footMode:2},true,true),wheelCue({...p,crashBlend:1},true,true),wheelCue({...p,speed:0},true,true)])assert.equal(cue.gain,0);
 assert(wheelCue({...p,airHeight:1},true,true).gain<riding.gain);assert(wheelCue({...p,speed:100},true,true).gain<=.035);
});
