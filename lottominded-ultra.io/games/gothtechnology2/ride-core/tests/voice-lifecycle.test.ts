import test from 'node:test';
import assert from 'node:assert/strict';
import {VoiceChat} from '../src/voiceChat.ts';

class Element extends EventTarget {
 tagName:string;dataset:Record<string,string>={};children:Element[]=[];options:any[]=[];value='';hidden=false;disabled=false;textContent='';onclick?:()=>void;onchange?:()=>void;
 constructor(tag:string){super();this.tagName=tag;}
 append(...items:any[]){this.children.push(...items);}
 add(option:any){this.options.push(option);if(this.options.length===1)this.value=option.value;}
 get selectedOptions(){return this.options.filter(o=>o.value===this.value);}
 setAttribute(){} replaceChildren(...items:any[]){this.children=items;}remove(){}
}
const doc=Object.assign(new EventTarget(),{hidden:false,body:new Element('body'),head:new Element('head'),createElement:(tag:string)=>new Element(tag),getElementById:()=>null});
Object.assign(globalThis,{document:doc,window:new EventTarget(),Option:class {constructor(public text:string,public value:string){}}});
Object.defineProperty(globalThis,'navigator',{configurable:true,value:{mediaDevices:{getUserMedia(){}}}});
const settle=()=>new Promise(r=>setImmediate(r));
function fixture(capture?:()=>Promise<MediaStream>){
 const track={enabled:false,muted:false,readyState:'live',stop(){this.readyState='ended';}},stream={getAudioTracks:()=>[track],getTracks:()=>[track]};
 const voice=new VoiceChat(capture??(async()=>stream as unknown as MediaStream));
 voice.bind('me',{state(){},signal(){}});
 return {voice,track,stream,root:voice.root as unknown as Element};
}
test('permission return and backgrounding preserve open-mic intent, while muting still wins',async()=>{
 const {voice,track,root}=fixture();
 try{
  voice.toggleMicrophone();await settle();assert.equal(track.enabled,true);assert.equal(root.dataset.mic,'on');
  doc.hidden=true;doc.dispatchEvent(new Event('visibilitychange'));assert.equal(track.enabled,false);assert.equal(root.dataset.mic,'paused');
  doc.hidden=false;doc.dispatchEvent(new Event('visibilitychange'));assert.equal(track.enabled,true);
  voice.toggleMicrophone();await settle();assert.equal(track.enabled,false);
  doc.hidden=true;doc.dispatchEvent(new Event('visibilitychange'));doc.hidden=false;doc.dispatchEvent(new Event('visibilitychange'));assert.equal(track.enabled,false);
 }finally{doc.hidden=false;voice.disconnect();}
 assert.equal(track.readyState,'ended');
});
test('permission accepted while hidden resumes on return, never transmits in the background',async()=>{
 let accept!:(stream:MediaStream)=>void;const pending=new Promise<MediaStream>(r=>accept=r);
 const {voice,track,stream}=fixture(()=>pending);
 try{voice.toggleMicrophone();doc.hidden=true;doc.dispatchEvent(new Event('visibilitychange'));accept(stream as unknown as MediaStream);await settle();assert.equal(track.enabled,false);doc.hidden=false;doc.dispatchEvent(new Event('visibilitychange'));assert.equal(track.enabled,true);}finally{doc.hidden=false;voice.disconnect();}
});
test('leaving during permission request stops the late stream',async()=>{
 let accept!:(stream:MediaStream)=>void;const pending=new Promise<MediaStream>(r=>accept=r);
 const {voice,track,stream}=fixture(()=>pending);voice.toggleMicrophone();voice.disconnect();accept(stream as unknown as MediaStream);await settle();assert.equal(track.readyState,'ended');assert.equal(track.enabled,false);
});
test('push-to-talk preparation never leaves the microphone open',async()=>{
 const {voice,track,root}=fixture();
 try{const mode=root.children.find(e=>e.tagName==='select')!;mode.value='hold';mode.onchange!();voice.toggleMicrophone();await settle();assert.equal(track.enabled,false);assert.equal(root.dataset.micMode,'hold');}finally{voice.disconnect();}
});
