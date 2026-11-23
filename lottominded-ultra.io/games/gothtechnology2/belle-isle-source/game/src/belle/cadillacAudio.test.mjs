import test from 'node:test';
import assert from 'node:assert/strict';
import {CadillacHorn,TrunkSpeakerBus,TrunkMediaOutput,playAcceptedTrunkHorn} from './cadillacAudio.ts';

// Graph/lifecycle tests only: these do not claim Safari output or audible quality.
function audioContext({legacy=false,resume}={}){
 const metrics={creates:0,resumes:0,closes:0,mediaSources:0,trackStops:0},nodes=[];
 const param=(value=0)=>({value,events:[],setValueAtTime(v,t){assert(Number.isFinite(v));this.value=v;this.events.push(['value',v,t]);},setTargetAtTime(v,t,constant){assert(Number.isFinite(v));this.value=v;this.events.push(['target',v,t,constant]);},linearRampToValueAtTime(v,t){assert(Number.isFinite(v));this.value=v;this.events.push(['ramp',v,t]);},cancelScheduledValues(t){this.events.push(['cancel',t]);}});
 const node=kind=>{
  const result={kind,connections:new Set(),disconnects:0,connect(target){this.connections.add(target);return target;},disconnect(target){this.disconnects++;if(target){if(!this.connections.delete(target))throw Error('Already disconnected');}else this.connections.clear();}};
  nodes.push(result);return result;
 };
 const position=()=>legacy?{position:[],setPosition(...v){this.position=v;}}:{positionX:param(),positionY:param(),positionZ:param()};
 const c={state:'suspended',currentTime:1,destination:{kind:'destination'},
  listener:{...position(),...(legacy?{orientation:[],setOrientation(...v){this.orientation=v;}}:{forwardX:param(),forwardY:param(),forwardZ:param(-1),upX:param(),upY:param(1),upZ:param()})},
  createGain(){return Object.assign(node('gain'),{gain:param(1)});},
  createBiquadFilter(){return Object.assign(node('filter'),{frequency:param(),Q:param()});},
  createPanner(){return Object.assign(node('panner'),position());},
  createDynamicsCompressor(){return Object.assign(node('limiter'),{threshold:param(),knee:param(),ratio:param(),attack:param(),release:param()});},
  createOscillator(){return Object.assign(node('oscillator'),{frequency:param(),starts:[],stops:[],start(t){this.starts.push(t);},stop(t){this.stops.push(t);},onended:null});},
  createMediaElementSource(element){metrics.mediaSources++;return Object.assign(node('media-source'),{element});},
  createMediaStreamDestination(){return Object.assign(node('capture'),{stream:{getTracks:()=>[{stop(){metrics.trackStops++;}}]}});},
  async resume(){metrics.resumes++;if(resume)await resume(c);c.state='running';},
  async close(){metrics.closes++;c.state='closed';}
 };
 return {c,nodes,metrics,create:()=>{metrics.creates++;return c;},finish(){for(const n of nodes)if(n.kind==='oscillator')n.onended?.();}};
}
const pose=()=>({source:{x:4,y:1,z:-2},listener:{x:3,y:1.3,z:1},forward:{x:0,y:0,z:-1},up:{x:0,y:1,z:0},open:0});
const gesture={isTrusted:true};
const permission={trunkPresent:true,unlocked:true,visible:true,focused:true,dialogOpen:false,enabled:true,volume:.65};

test('trunk radio changes parameters at 20 Hz with a reused mutable frame and fixed node count',()=>{
 const f=audioContext(),bus=new TrunkSpeakerBus(f.c),frame=pose(),count=f.nodes.length;
 const filter=f.nodes.find(n=>n.kind==='filter'),panner=f.nodes.find(n=>n.kind==='panner');
 bus.setFrame(frame);assert.equal(filter.frequency.value,1800);assert.equal(panner.positionX.value,4);
 frame.source.x=6;f.c.currentTime+=.02;bus.setFrame(frame);assert.equal(panner.positionX.value,4);
 f.c.currentTime+=.04;bus.setFrame(frame);assert.equal(panner.positionX.value,6);
 frame.open=1;f.c.currentTime+=.06;bus.setFrame(frame);assert.equal(filter.frequency.value,16000);
 const before=panner.positionX.events.length;
 for(let i=0;i<10000;i++){f.c.currentTime+=.001;frame.source.x+=.001;bus.setFrame(frame);}
 assert.equal(f.nodes.length,count,'no per-frame audio nodes');
 assert(panner.positionX.events.length-before<=201,'spatial scheduling stays at or below 20 Hz');
 const dry=[...bus.input.connections].find(n=>n.kind==='gain');assert.equal(dry.gain.value,0);
 bus.setFrame(null);assert.equal(dry.gain.value,1,'normal output returns when leaving the Cadillac');
 const writes=panner.positionX.events.length;f.c.currentTime+=1;bus.setFrame(null);assert.equal(panner.positionX.events.length,writes);
 bus.dispose();bus.dispose();assert(f.nodes.every(n=>n.connections.size===0));
});

test('capture receives the same post-spatial, limited music output and releases safely after disposal',async()=>{
 const f=audioContext(),output=new TrunkMediaOutput(f.create),element={volume:.34,play(){throw Error('Output routing cannot start playback');}};
 output.attach(element);output.setFrame(pose());assert.equal(f.metrics.creates,0);
 assert(await output.unlock());assert.equal(f.metrics.creates,1);assert.equal(f.metrics.mediaSources,1);assert.equal(element.volume,.34);
 await output.unlock();assert.equal(f.metrics.creates,1);assert.equal(f.metrics.mediaSources,1);assert.equal(f.metrics.resumes,1);
 const capture=output.capture(),destination=f.nodes.find(n=>n.kind==='capture');
 const final=f.nodes.find(n=>n.connections.has(destination));
 assert(final.connections.has(f.c.destination),'capture and device receive the identical bus output');
 assert(f.nodes.some(n=>n.kind==='limiter'&&n.connections.has(final)),'the final output is limited');
 const panner=f.nodes.find(n=>n.kind==='panner');assert.equal(panner.positionX.value,4);
 await output.dispose();capture.release();capture.release();assert.equal(f.metrics.trackStops,1);assert.equal(f.metrics.closes,1);
 assert.equal(await output.unlock(),false);assert.equal(output.capture(),undefined);
});

test('unsupported audio routing leaves the existing media element untouched',async()=>{
 const audio={volume:.34},output=new TrunkMediaOutput(()=>undefined);output.attach(audio);output.setFrame(pose());
 assert.equal(await output.unlock(),false);assert.equal(audio.volume,.34);assert.equal(output.capture(),undefined);await output.dispose();
});

test('legacy spatial methods receive finite positions and valid fallback axes',()=>{
 const f=audioContext({legacy:true}),bus=new TrunkSpeakerBus(f.c),frame=pose();
 frame.source={x:NaN,y:Infinity,z:-2};frame.forward={x:0,y:0,z:0};frame.up={x:0,y:0,z:0};bus.setFrame(frame);
 assert.deepEqual(f.nodes.find(n=>n.kind==='panner').position,[0,0,-2]);assert.deepEqual(f.c.listener.orientation,[0,0,-1,0,1,0]);bus.dispose();
});

test('model/frame activation, mute, zero volume, synthetic input and held keys cannot unlock a horn',async()=>{
 const f=audioContext(),horn=new CadillacHorn(f.create,()=>1000);
 assert.equal(await horn.trunkOpened({gesture,volume:1}),false);horn.setActive(true);
 for(const options of [{gesture:{isTrusted:false},volume:1},{gesture:{...gesture,repeat:true},volume:1},{gesture,volume:1,muted:true},{gesture,volume:0},{gesture,volume:NaN}])assert.equal(await horn.trunkOpened(options),false);
 assert.equal(f.metrics.creates,0);assert.equal(f.nodes.length,0);await horn.dispose();
});

test('one accepted opening schedules two bounded dual-tone pulses and resists repeated requests',async()=>{
 const f=audioContext();let now=1000;const horn=new CadillacHorn(f.create,()=>now);horn.setActive(true);
 assert(await horn.trunkOpened({gesture,volume:2}));const voices=f.nodes.filter(n=>n.kind==='oscillator');
 assert.equal(voices.length,4);assert.deepEqual(voices.map(n=>n.frequency.value),[349.23,440,349.23,440]);
 assert.deepEqual(voices.map(n=>n.starts[0]),[1,1,1.28,1.28]);assert(voices.every(n=>n.stops[0]<=1.51));
 for(const n of f.nodes.filter(n=>n.kind==='gain'))for(const event of n.gain.events)if(event[0]==='ramp')assert(event[1]<=.1);
 now=1200;assert.equal(await horn.trunkOpened({gesture,volume:1}),false);assert.equal(f.nodes.filter(n=>n.kind==='oscillator').length,4);
 f.finish();now=1800;assert(await horn.trunkOpened({gesture,volume:.4}));assert.equal(f.nodes.filter(n=>n.kind==='oscillator').length,8);
 horn.silence();assert.equal(f.nodes.find(n=>n.kind==='gain').gain.value,0);assert(f.nodes.filter(n=>n.kind==='oscillator').every(n=>n.connections.size===0));
 await horn.dispose();await horn.dispose();assert.equal(f.metrics.closes,1);
});

test('closing the menu and clearing audio permits exactly the new accepted trusted opening',async()=>{
 const f=audioContext(),horn=new CadillacHorn(f.create,()=>1000);
 horn.setActive(true);horn.setActive(false);horn.silence();
 assert(await playAcceptedTrunkHorn(horn,gesture,permission),'closed menu plus fresh accepted input can re-arm');
 assert.equal(f.nodes.filter(n=>n.kind==='oscillator').length,4);await horn.dispose();
 for(const patch of [{trunkPresent:false},{unlocked:false},{visible:false},{focused:false},{dialogOpen:true},{enabled:false},{volume:0}]){
  const denied=audioContext(),sound=new CadillacHorn(denied.create,()=>1000);
  assert.equal(await playAcceptedTrunkHorn(sound,gesture,{...permission,...patch}),false);assert.equal(denied.metrics.creates,0);await sound.dispose();
 }
});

test('a later pause or leave cancels a pending audio resume and cannot resurrect the horn',async()=>{
 let resolve;const pending=new Promise(r=>{resolve=r;}),f=audioContext({resume:()=>pending}),horn=new CadillacHorn(f.create,()=>1000);
 const opened=playAcceptedTrunkHorn(horn,gesture,permission);horn.setActive(false);resolve();
 assert.equal(await opened,false);assert.equal(f.nodes.filter(n=>n.kind==='oscillator').length,0);await horn.dispose();
});

test('visibility, blur and pagehide immediately stop an already scheduled sequence',async t=>{
 const descriptors=new Map(['window','document'].map(k=>[k,Object.getOwnPropertyDescriptor(globalThis,k)]));
 const window=new EventTarget(),document=Object.assign(new EventTarget(),{hidden:false});Object.assign(globalThis,{window,document});
 t.after(()=>{for(const [key,descriptor]of descriptors){if(descriptor)Object.defineProperty(globalThis,key,descriptor);else delete globalThis[key];}});
 const f=audioContext();let now=1000;const horn=new CadillacHorn(f.create,()=>now);horn.setActive(true);
 for(const event of ['visibilitychange','blur','pagehide']){
  document.hidden=false;assert(await horn.trunkOpened({gesture,volume:1}));
  if(event==='visibilitychange'){document.hidden=true;document.dispatchEvent(new Event(event));}else window.dispatchEvent(new Event(event));
  assert.equal(f.nodes.find(n=>n.kind==='gain').gain.value,0);assert(f.nodes.filter(n=>n.kind==='oscillator').every(n=>n.connections.size===0));now+=1000;
 }
 await horn.dispose();
});

test('denied browser resume is handled and a later deliberate opening can retry',async()=>{
 let deny=true,now=1000;const f=audioContext({resume:()=>deny?Promise.reject(Error('gesture denied')):Promise.resolve()}),horn=new CadillacHorn(f.create,()=>now);horn.setActive(true);
 assert.equal(await horn.trunkOpened({gesture,volume:1}),false);assert.equal(f.nodes.filter(n=>n.kind==='oscillator').length,0);
 deny=false;now=2000;assert(await horn.trunkOpened({gesture,volume:1}));assert.equal(f.metrics.creates,1);assert.equal(f.metrics.resumes,2);await horn.dispose();
});

test('an incomplete horn graph is released and does not poison the next deliberate request',async()=>{
 const failed=audioContext(),working=audioContext();failed.c.createBiquadFilter=()=>{throw Error('Audio graph unavailable');};
 let now=1000,first=true;const horn=new CadillacHorn(()=>{if(first){first=false;return failed.create();}return working.create();},()=>now);horn.setActive(true);
 assert.equal(await horn.trunkOpened({gesture,volume:1}),false);assert.equal(failed.metrics.closes,1);assert(failed.nodes.every(n=>!n.connections.size));
 now=2000;assert(await horn.trunkOpened({gesture,volume:1}));assert.equal(working.metrics.creates,1);await horn.dispose();
});
