import test from 'node:test';
import assert from 'node:assert/strict';
import {CadillacHydraulicAudio} from './cadillacHydraulicAudio.ts';

// Verify synthesis, gesture gating and release. Audible quality and hardware
// output remain browser/device checks; the fake never pretends to play sound.
function audioContext({resume}={}){
 const metrics={creates:0,resumes:0,closes:0,buffers:0},nodes=[],buffers=[];
 const param=(value=0)=>({value,events:[],setValueAtTime(v,t){assert(Number.isFinite(v)&&Number.isFinite(t));this.value=v;this.events.push(['value',v,t]);},linearRampToValueAtTime(v,t){assert(Number.isFinite(v)&&Number.isFinite(t));this.value=v;this.events.push(['ramp',v,t]);},cancelScheduledValues(t){this.events.push(['cancel',t]);}});
 const node=kind=>{const n={kind,connections:new Set(),disconnects:0,connect(target){this.connections.add(target);return target;},disconnect(){this.disconnects++;this.connections.clear();}};nodes.push(n);return n;};
 const source=kind=>Object.assign(node(kind),{starts:[],stops:[],onended:null,start(t){this.starts.push(t);},stop(t){this.stops.push(t);}});
 const c={state:'suspended',currentTime:1,sampleRate:48000,destination:{kind:'destination'},
  createGain:()=>Object.assign(node('gain'),{gain:param(1)}),
  createBiquadFilter:()=>Object.assign(node('filter'),{frequency:param(),Q:param()}),
  createOscillator:()=>Object.assign(source('oscillator'),{frequency:param()}),
  createBufferSource:()=>Object.assign(source('buffer-source'),{buffer:null,loop:false}),
  createBuffer(channels,length,sampleRate){metrics.buffers++;const data=new Float32Array(length),buffer={numberOfChannels:channels,length,sampleRate,getChannelData:()=>data};buffers.push(buffer);return buffer;},
  async resume(){metrics.resumes++;if(resume)await resume(c);if(c.state!=='closed')c.state='running';},
  async close(){metrics.closes++;c.state='closed';},
 };
 return{c,nodes,buffers,metrics,create:()=>{metrics.creates++;return c;},finish(){for(const node of nodes)node.onended?.();}};
}
const gesture={isTrusted:true,type:'click'},options={enabled:true,volume:1};

test('construction, frame activation, rejected input and disabled effects never create an audio context',async()=>{
 const f=audioContext(),audio=new CadillacHydraulicAudio(f.create,()=>1000);
 assert.equal(await audio.trigger(gesture,options),false);audio.setActive(true);
 for(const event of [{...gesture,isTrusted:false},{...gesture,repeat:true},{...gesture,type:'pointerdown'},{...gesture,type:'pointermove'},{...gesture,type:'touchstart'}])assert.equal(await audio.trigger(event,options),false);
 for(const patch of [{enabled:false},{volume:0},{volume:-1},{volume:NaN},{volume:Infinity}])assert.equal(await audio.trigger(gesture,{...options,...patch}),false);
 audio.setMuted(true);assert.equal(await audio.trigger(gesture,options),false);audio.setMuted(false);
 for(let i=0;i<100;i++){audio.setActive(false);audio.setActive(true);}
 assert.equal(f.metrics.creates,0);assert.equal(f.nodes.length,0);assert.equal(audio.diagnostics().liveVoices,0);await audio.dispose();
});

test('an accepted tap creates one quiet click/hiss pair, a cached original noise buffer, and at most two live voices',async()=>{
 const f=audioContext();let now=1000;const audio=new CadillacHydraulicAudio(f.create,()=>now);audio.setActive(true);
 assert(await audio.trigger(gesture,{...options,volume:2}));
 assert.equal(f.metrics.creates,1);assert.equal(f.metrics.buffers,1);assert.equal(f.metrics.resumes,1);assert.equal(audio.diagnostics().liveVoices,2);
 const voices=f.nodes.filter(node=>node.kind==='oscillator'||node.kind==='buffer-source');assert.equal(voices.length,2);
 assert(voices.every(node=>node.starts.length===1&&node.starts[0]===1&&node.stops[0]<=1.18));
 const click=voices.find(node=>node.kind==='oscillator'),hiss=voices.find(node=>node.kind==='buffer-source');
 assert.equal(click.type,'triangle');assert.deepEqual(click.frequency.events.map(event=>event[1]),[920,360]);assert.equal(hiss.loop,false);
 const buffer=f.buffers[0],samples=buffer.getChannelData(0);assert.equal(buffer.length,8640);assert.equal(buffer.numberOfChannels,1);assert(samples.some(sample=>sample!==0));assert(samples.every(sample=>Number.isFinite(sample)&&Math.abs(sample)<=1));
 const filter=f.nodes.find(node=>node.kind==='filter');assert.equal(filter.type,'bandpass');assert.equal(filter.frequency.value,1450);
 for(const node of f.nodes.filter(node=>node.kind==='gain'))for(const event of node.gain.events)if(event[0]==='ramp')assert(event[1]>=0&&event[1]<=.055);
 now=1200;assert.equal(await audio.trigger({...gesture,type:'input'},options),false);assert.equal(audio.diagnostics().liveVoices,2);
 now=1220;assert(await audio.trigger({...gesture,type:'input'},options));assert.equal(f.metrics.buffers,1);assert.equal(f.metrics.creates,1);
 assert.equal(audio.diagnostics().liveVoices,2,'late ended callbacks cannot accumulate voices');assert(voices.every(node=>node.disconnects===1&&!node.connections.size));
 f.finish();assert.equal(audio.diagnostics().liveVoices,0);await audio.dispose();await audio.dispose();
 assert.equal(f.metrics.closes,1);assert(f.nodes.every(node=>node.disconnects===1&&!node.connections.size),'every owned node releases exactly once');
});

test('slider bursts are bounded to the rate limit while reduced motion uses the same deliberate, quiet feedback',async()=>{
 const f=audioContext();let now=1000;const audio=new CadillacHydraulicAudio(f.create,()=>now);audio.setActive(true);
 let accepted=0;for(let i=0;i<100;i++){now+=10;if(await audio.trigger({...gesture,type:'input'},{...options,volume:.4,reduced:true}))accepted++;}
 assert.equal(accepted,5);assert.equal(f.metrics.buffers,1);assert.equal(audio.diagnostics().liveVoices,2);
 assert.equal(f.nodes.filter(node=>node.kind==='oscillator').length,5);
 for(const node of f.nodes.filter(node=>node.kind==='buffer-source'))assert(node.stops[0]<=1.12);
 for(const node of f.nodes.filter(node=>node.kind==='gain'))for(const event of node.gain.events)if(event[0]==='ramp')assert(event[1]<=.055*.4+1e-9);
 await audio.dispose();
});

for(const action of ['leave','mute','silence','dispose'])test(action+' cancels a pending browser resume and cannot replay a stale accepted tap',async()=>{
 let resolve;const pending=new Promise(r=>{resolve=r;}),f=audioContext({resume:()=>pending}),audio=new CadillacHydraulicAudio(f.create,()=>1000);audio.setActive(true);
 const result=audio.trigger(gesture,options);
 if(action==='leave'){audio.setActive(false);audio.setActive(true);}else if(action==='mute'){audio.setMuted(true);audio.setMuted(false);}else if(action==='dispose')await audio.dispose();else audio.silence();
 resolve();assert.equal(await result,false);assert.equal(f.nodes.filter(node=>node.kind==='oscillator').length,0);assert.equal(audio.diagnostics().liveVoices,0);await audio.dispose();assert.equal(f.metrics.closes,1);
});

test('blur, pagehide and hidden tabs stop live sources; background gestures remain blocked and listeners are released',async t=>{
 const descriptors=new Map(['window','document'].map(key=>[key,Object.getOwnPropertyDescriptor(globalThis,key)]));
 class Target extends EventTarget{listeners=new Map();addEventListener(type,listener){super.addEventListener(type,listener);const set=this.listeners.get(type)??new Set();set.add(listener);this.listeners.set(type,set);}removeEventListener(type,listener){super.removeEventListener(type,listener);this.listeners.get(type)?.delete(listener);}}
 let focused=true;const window=new Target(),document=Object.assign(new Target(),{hidden:false,hasFocus:()=>focused});Object.assign(globalThis,{window,document});
 t.after(()=>{for(const [key,descriptor]of descriptors)if(descriptor)Object.defineProperty(globalThis,key,descriptor);else delete globalThis[key];});
 const f=audioContext();let now=1000;const audio=new CadillacHydraulicAudio(f.create,()=>now);audio.setActive(true);
 for(const event of ['blur','pagehide','visibilitychange']){
  document.hidden=false;focused=true;assert(await audio.trigger(gesture,options));
  if(event==='visibilitychange'){document.hidden=true;document.dispatchEvent(new Event(event));}else{focused=false;window.dispatchEvent(new Event(event));}
  assert.equal(audio.diagnostics().liveVoices,0);assert.equal(f.nodes[0].gain.value,0);now+=1000;
  assert.equal(await audio.trigger(gesture,options),false);
 }
 await audio.dispose();assert([...window.listeners.values(),...document.listeners.values()].every(set=>!set.size));
 assert(f.nodes.every(node=>!node.connections.size));
});

test('mute and vehicle exit immediately silence scheduled audio and reactivation alone never restarts it',async()=>{
 const f=audioContext();let now=1000;const audio=new CadillacHydraulicAudio(f.create,()=>now);audio.setActive(true);
 assert(await audio.trigger(gesture,options));audio.setMuted(true);assert.equal(audio.diagnostics().liveVoices,0);assert.equal(f.nodes[0].gain.value,0);
 audio.setMuted(false);now+=1000;assert(await audio.trigger(gesture,options));audio.setActive(false);assert.equal(audio.diagnostics().liveVoices,0);
 const count=f.nodes.length;audio.setActive(true);assert.equal(f.nodes.length,count);assert.equal(f.nodes[0].gain.value,0);await audio.dispose();
});

test('a denied browser resume can retry on a later deliberate command without duplicating the graph',async()=>{
 let deny=true,now=1000;const f=audioContext({resume:()=>deny?Promise.reject(Error('gesture denied')):Promise.resolve()}),audio=new CadillacHydraulicAudio(f.create,()=>now);audio.setActive(true);
 assert.equal(await audio.trigger(gesture,options),false);assert.equal(audio.diagnostics().liveVoices,0);assert.equal(f.nodes.filter(node=>node.kind==='oscillator').length,0);
 deny=false;now+=1000;assert(await audio.trigger(gesture,options));assert.equal(f.metrics.creates,1);assert.equal(f.metrics.resumes,2);assert.equal(f.metrics.buffers,1);await audio.dispose();
});

test('unsupported or partially constructed audio releases safely and does not poison the next deliberate request',async()=>{
 const unsupported=new CadillacHydraulicAudio(()=>undefined,()=>1000);unsupported.setActive(true);assert.equal(await unsupported.trigger(gesture,options),false);await unsupported.dispose();
 const failed=audioContext(),working=audioContext();failed.c.createBiquadFilter=()=>{throw Error('filter unavailable');};
 let first=true,now=1000;const audio=new CadillacHydraulicAudio(()=>{if(first){first=false;return failed.create();}return working.create();},()=>now);audio.setActive(true);
 assert.equal(await audio.trigger(gesture,options),false);assert.equal(failed.metrics.closes,1);assert(failed.nodes.every(node=>node.disconnects===1&&!node.connections.size));
 now+=1000;assert(await audio.trigger(gesture,options));await audio.dispose();assert.equal(working.metrics.closes,1);
});

test('a failed voice creation stops its partial pair and retries without leaked nodes or an orphan click',async()=>{
 const f=audioContext(),createSource=f.c.createBufferSource;f.c.createBufferSource=()=>{throw Error('source unavailable');};
 let now=1000;const audio=new CadillacHydraulicAudio(f.create,()=>now);audio.setActive(true);
 assert.equal(await audio.trigger(gesture,options),false);assert.equal(audio.diagnostics().liveVoices,0);
 const failedClick=f.nodes.find(node=>node.kind==='oscillator');assert.equal(failedClick.starts.length,0);assert.equal(failedClick.disconnects,1);
 f.c.createBufferSource=createSource;now+=1000;assert(await audio.trigger(gesture,options));await audio.dispose();assert(f.nodes.every(node=>node.disconnects===1&&!node.connections.size));
});

test('only the newest accepted input survives concurrent delayed resumes',async()=>{
 let resolve,now=1000;const pending=new Promise(r=>{resolve=r;}),f=audioContext({resume:()=>pending}),audio=new CadillacHydraulicAudio(f.create,()=>now);audio.setActive(true);
 const old=audio.trigger(gesture,options);now+=1000;const recent=audio.trigger(gesture,options);resolve();
 assert.equal(await old,false);assert.equal(await recent,true);assert.equal(audio.diagnostics().liveVoices,2);assert.equal(f.metrics.creates,1);assert.equal(f.metrics.buffers,1);await audio.dispose();
});
