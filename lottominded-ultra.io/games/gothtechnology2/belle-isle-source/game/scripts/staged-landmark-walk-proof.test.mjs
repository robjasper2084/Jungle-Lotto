import assert from 'node:assert/strict';
import test from 'node:test';
import {readFile} from 'node:fs/promises';
import {ParkTerrain} from '../src/belle/terrain.ts';
import {RideCore} from '../runtime/ride-core/src/ridecore.ts';
import {assertContact,assertNativeEvidence,assertPassage,turnEntranceHeading,assertEntranceTurns,readEntrancePulse} from './staged-landmark-walk-proof.mjs';

const id='107227742';
const sample=(frames,u,v)=>({frames,actor:{x:u,y:2,z:v,headingY:0,onFoot:true,footBlend:1},sites:[{id,local:{u,v}}]});
function passage(){
 const trace=Array.from({length:10},(_,i)=>sample(i+1,.68,-44+i*.81));
 return{before:trace[0],after:trace.at(-1),trace,id,axis:'v',boundary:-38,clearHalfWidth:1.65};
}
function contact(){
 const before=sample(1,0,0),trace=[sample(2,1,0),sample(3,2,0),...Array.from({length:8},(_,i)=>sample(i+4,3,0))];
 const after=structuredClone(trace.at(-1));
 after.actor.forwardProbe={radius:.27,bodyHeights:[.62,1.1,1.58],maxDistance:.7,blocked:false,sweptHits:[0,null,null]};
 after.actor.visibleForwardSurfaces=[{height:.62,distance:.30,mesh:'actual wall'},null,null];
 after.actor.visibleForwardSweeps=[.62,1.1,1.58].map((height,i)=>({height,radius:.27,maxDistance:.7,origin:[3,2+height,0],direction:[0,0,1],checkedTriangles:1,unsupportedMeshes:[],
  hit:i===0?{distance:.03,point:[3,2+height,.3],feature:'face',featureIndex:-1,mesh:'actual wall',meshUuid:'loaded-mesh',faceIndex:0,instanceId:null,vertexIndices:[0,1,2],triangle:[[2,2,.3],[4,2,.3],[3,4,.3]]}:null}));
 return{before,after,trace,id,axis:'u'};
}
function native(){
 const events=[];
 for(const code of ['KeyW','KeyF','KeyV','KeyA'])for(const type of ['keydown','keyup'])events.push({type,code,trusted:true});
 events.push({type:'click',target:'#start',trusted:true},
  {type:'click',text:'Travel to entrance',landmark:'Belle Isle Aquarium',trusted:true},
  {type:'click',text:'Travel to path',landmark:'Anna Scripps Whitcomb Conservatory',trusted:true},
  {type:'click',text:'Explore Palm House on foot',landmark:'Anna Scripps Whitcomb Conservatory',trusted:true});
 for(const phase of ['aquarium-native-entry','aquarium-native-gallery','aquarium-tank-contact','conservatory-native-entry',
  'conservatory-native-vestibule','conservatory-wall-contact','conservatory-native-palm-house'])
  for(const type of ['keydown','keyup'])events.push({phase,type,code:'KeyW',trusted:true});
 return{events,overflow:false,held:[],focusLossDuringInput:[]};
}

test('a real-frame trajectory crosses the existing doorway within body clearance',()=>{
 const result=assertPassage(passage());assert(result.crossingSamples>0);assert(result.movedMetres>7);
});
test('an actor teleported across the portal without observed crossing frames fails',()=>{
 const value=passage();value.trace=[value.before,value.after];assert.throws(()=>assertPassage(value),/samples at the entrance/);
});
test('crossing an authored wall beside the door fails even when the endpoint is inside',()=>{
 const value=passage();for(const s of value.trace)s.sites[0].local.u=2;assert.throws(()=>assertPassage(value),/outside the existing doorway/);
});
test('repeated screenshots with a frozen frame counter cannot establish entry',()=>{
 const value=passage();value.after.frames=value.before.frames;assert.throws(()=>assertPassage(value),/frame progression/);
});
test('moving on a board cannot establish an on-foot entrance passage',()=>{
 const value=passage();value.trace[3].actor.onFoot=false;assert.throws(()=>assertPassage(value),/changed out of walking/);
});
test('a moving approach followed by a real-frame plateau and nearby visual/collider pair passes',()=>{
 const result=assertContact(contact());assert.equal(result.plateauFrames,7);assert.equal(result.movedMetres,3);
});
test('a render stall cannot masquerade as physical collision',()=>{
 const value=contact();for(const s of value.trace.slice(-8))s.frames=4;assert.throws(()=>assertContact(value),/real frames at contact/);
});
test('a stationary actor without approach travel cannot establish contact',()=>{
 const value=contact();value.before.actor.x=3;assert.throws(()=>assertContact(value),/approach movement/);
});
test('movement cessation without an actual terrain obstruction fails',()=>{
 const value=contact();value.after.actor.forwardProbe.sweptHits=[null,null,null];assert.throws(()=>assertContact(value),/No real terrain obstruction/);
});
test('an invisible or spatially mismatched collider cannot pass visual contact proof',()=>{
 const value=contact(),hit=value.after.actor.visibleForwardSweeps[0].hit;hit.distance=.5;hit.point[2]=.77;
 for(const vertex of hit.triangle)vertex[2]=.77;
 assert.throws(()=>assertContact(value),/visible surface and existing collision/);
});
test('a real pane edge sphere contact may pass while all centerline rays remain null',()=>{
 const value=contact();value.after.actor.visibleForwardSurfaces=[null,null,null];value.after.actor.visibleForwardSweeps[0].hit.feature='edge';
 const result=assertContact(value);assert.equal(result.visualPairs[0].surfaceDifferenceMetres,.03);assert.deepEqual(result.visibleForwardSurfaces,[null,null,null]);
});
test('a nearby triangle without an actual forward sweep hit cannot establish contact',()=>{
 const value=contact();value.after.actor.visibleForwardSweeps[0].hit=null;
 assert.throws(()=>assertContact(value),/visible surface and existing collision/);
});
test('changing the radius, heading, height or origin cannot make another surface satisfy the same contact',()=>{
 for(const change of[v=>v.radius=.5,v=>v.height=1.2,v=>v.origin[0]+=.1,v=>v.direction=[1,0,0]]){
  const value=contact();change(value.after.actor.visibleForwardSweeps[0]);assert.throws(()=>assertContact(value));
 }
});
test('all three observed body-height sweeps and complete supported geometry coverage are required',()=>{
 const value=contact();value.after.actor.visibleForwardSweeps.pop();assert.throws(()=>assertContact(value),/same-radius/);
 const incomplete=contact();incomplete.after.actor.visibleForwardSweeps[1].unsupportedMeshes=['unobserved pane'];assert.throws(()=>assertContact(incomplete),/coverage/);
});
test('a nearest point or malformed triangle cannot impersonate a swept-sphere hit',()=>{
 const value=contact();value.after.actor.visibleForwardSweeps[0].hit.point[2]=.2;assert.throws(()=>assertContact(value),/finite triangle/);
 const wrongRadius=contact();wrongRadius.after.actor.visibleForwardSweeps[0].hit.distance=.02;assert.throws(()=>assertContact(wrongRadius),/real same-radius/);
 const missing=contact();delete missing.after.actor.visibleForwardSweeps[0].hit.triangle;assert.throws(()=>assertContact(missing));
 const behind=contact();behind.after.actor.visibleForwardSweeps[0].hit.distance=-.1;assert.throws(()=>assertContact(behind),/Invalid forward/);
});
test('forward penetration cannot pass as a contact plateau',()=>{
 const value=contact();value.trace.at(-1).sites[0].local.u+=.2;assert.throws(()=>assertContact(value),/stop penetration/);
});
test('small tangential sliding is recorded separately from blocked wall penetration',()=>{
 const value=contact();value.trace.at(-1).sites[0].local.v=.2;const result=assertContact(value);
 assert.equal(result.normalMaximumMetres,0);assert.equal(result.tangentialMaximumMetres,.2);
});
test('movement leaving the sampled wall region cannot establish a contact plateau',()=>{
 const value=contact();value.trace.at(-1).sites[0].local.v=1;assert.throws(()=>assertContact(value),/Tangential movement exceeded/);
});
test('trusted clicks, movement and releases are required for every authored segment',()=>{
 assertNativeEvidence(native());
 const value=native();value.events=value.events.filter(e=>!(e.phase==='aquarium-native-entry'&&e.type==='keyup'));
 assert.throws(()=>assertNativeEvidence(value),/Missing native walk keyup/);
});
test('script-dispatched input invalidates the native evidence',()=>{
 const value=native();value.events[0].trusted=false;assert.throws(()=>assertNativeEvidence(value),/Untrusted input/);
});
test('focus loss during a held movement key invalidates the route',()=>{
 const value=native();value.focusLossDuringInput.push({reason:'window blur'});assert.throws(()=>assertNativeEvidence(value),/lost focus/);
});
test('held native keys or an overflowed receipt buffer invalidate completion',()=>{
 const value=native();value.held=['KeyW'];assert.throws(()=>assertNativeEvidence(value),/remained held/);
 value.held=[];value.overflow=true;assert.throws(()=>assertNativeEvidence(value),/overflowed/);
});

const turnMap=JSON.parse(await readFile(new URL('../public/belle/map.json',import.meta.url),'utf8'));
const turnTerrain=new ParkTerrain(turnMap);
async function entranceTurnSample({hz,offset,initial,heading,latencyMs=0}){
 const core=new RideCore(turnTerrain,{spawn:{position:{x:1350.8787341500893,y:2,z:1125.3483974696717},headingY:initial}});
 let firstPerson=true,frames=0,wall=0,next=offset,steer=0;
 const history=[],events=[],phases=[],receipt={};
 const advance=milliseconds=>{const end=wall+milliseconds;while(next<=end){
  core.advance(Math.min(1/hz,.05),{steer});frames++;
  history.push({frames,time:next/1000,actor:{...core.renderPose,onFoot:core.current.footMode===2,firstPerson}});
  next+=1000/hz;
 }wall=end;};
 core.advance(1/120,{dismount:true});advance(2000);assert.equal(core.current.footMode,2);
 const motion=async()=>history.at(-1);
 await turnEntranceHeading({heading,name:'sampled-entrance-turn',receipt,motion,phase:async name=>phases.push(name),focusCanvas:async()=>{},
  setFirstPerson:async wanted=>{firstPerson=wanted;advance(80);},
  pulse:async(key,milliseconds)=>{
   const phase=phases.at(-1);events.push({phase,type:'keydown',code:'Key'+key.toUpperCase(),trusted:true,at:wall});
   steer=key==='a'?-1:1;advance(milliseconds+latencyMs);steer=0;
   events.push({phase,type:'keyup',code:'Key'+key.toUpperCase(),trusted:true,at:wall});
   return readEntrancePulse(events,{name:phase,key});
  },settleHeading:async name=>{
   phases.push(name);advance(900);
   const tail=history.slice(-4),row=tail.at(-1);
   assert(row.frames-tail[0].frames>=3);
   assert(tail.every(sample=>Math.abs(Math.atan2(Math.sin(sample.actor.headingY-row.actor.headingY),Math.cos(sample.actor.headingY-row.actor.headingY)))<.002));
   return row;
  }});
 assert.equal(new Set(phases).size,phases.length,'Each native correction needs an individual trace phase');
 return{receipt,events};
}

test('original entrance turns converge after real RideCore yaw settles at 30 and 60 Hz',async()=>{
 // Native c746 phone entrance artifact15161298327 recorded these repeated
 // overcorrections around the actual Conservatory wall heading. Include the
 // full initial turn, both overshoot sides and wraparound/half-step targets.
 const starts=[1.8837963,3.6740115,3.1675935,3.7425476];
 let cases=0;
 for(const hz of[30,60])for(const offset of[0,5,11,20,31])for(const latencyMs of[0,8,20,50,75,100])for(const initial of starts){
  for(const heading of[3.454592653589793,initial+Math.PI,initial-.71,initial+2.7/hz/2]){
   const {receipt}=await entranceTurnSample({hz,offset,initial,heading,latencyMs});cases++;
   assert(receipt.complete&&receipt.finalErrorRadians<=.15&&receipt.after.actor.firstPerson);
   assert.equal(receipt.maximumCorrections,4);assert(receipt.pulses.length<=4);
   assert(receipt.pulses.every(pulse=>pulse.milliseconds>=8&&pulse.milliseconds<=900));
  }
 }
 assert.equal(cases,960);
});

test('ignored entrance steering still fails after the original four corrections',async()=>{
 const actor={x:0,z:0,headingY:0,onFoot:true,firstPerson:true},receipt={};let count=0;
 await assert.rejects(turnEntranceHeading({heading:1,name:'ignored',receipt,motion:async()=>({actor:{...actor}}),phase:async()=>{},focusCanvas:async()=>{},
  setFirstPerson:async wanted=>{actor.firstPerson=wanted;},pulse:async()=>{count++;},settleHeading:async()=>({actor:{...actor}})}),/did not reach the intended obstacle/);
 assert.equal(count,4);assert.equal(receipt.complete,false);assert.equal(actor.headingY,0);
});

test('accepted entrance turns retain actual trusted pulse releases and the original heading limit',async()=>{
 const sample=await entranceTurnSample({hz:30,offset:11,initial:1.8837963,heading:3.454592653589793});
 const report={entranceTurns:[],nativeEvidence:{events:[]}};
 for(const name of['aquarium-tank-contact-turn','conservatory-wall-contact-turn']){
  const turn=structuredClone(sample.receipt);turn.name=name;
  for(const pulse of turn.pulses)pulse.name=pulse.name.replace('sampled-entrance-turn',name);
  report.entranceTurns.push(turn);
  report.nativeEvidence.events.push(...sample.events.map(event=>({...event,phase:event.phase.replace('sampled-entrance-turn',name)})));
 }
 assertEntranceTurns(report);
 for(const mutate of[
  r=>r.entranceTurns.pop(),r=>r.entranceTurns[0].tolerance=.2,r=>r.entranceTurns[0].maximumCorrections=5,
  r=>r.entranceTurns[0].after.actor.headingY+=.3,r=>r.entranceTurns[0].after.actor.x+=.1,
  r=>r.entranceTurns[0].after.actor.firstPerson=false,r=>r.entranceTurns[0].pulses[0].milliseconds=1000,
  r=>r.entranceTurns[0].pulses[0].after.actor.x+=.1,r=>r.entranceTurns[0].pulses[0].native.heldMilliseconds+=1,
  r=>r.nativeEvidence.events.reverse(),r=>r.nativeEvidence.events.push({...r.nativeEvidence.events[0]}),
  r=>r.nativeEvidence.events=r.nativeEvidence.events.filter(event=>event.type!=='keyup'),
  r=>{for(const event of r.nativeEvidence.events)event.trusted=false;},
 ]){const candidate=structuredClone(report);mutate(candidate);assert.throws(()=>assertEntranceTurns(candidate));}
});
