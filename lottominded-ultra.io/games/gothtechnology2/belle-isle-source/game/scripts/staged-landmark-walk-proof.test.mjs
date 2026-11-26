import assert from 'node:assert/strict';
import test from 'node:test';
import {assertContact,assertNativeEvidence,assertPassage} from './staged-landmark-walk-proof.mjs';

const id='107227742';
const sample=(frames,u,v)=>({frames,actor:{x:u,y:2,z:v,onFoot:true,footBlend:1},sites:[{id,local:{u,v}}]});
function passage(){
 const trace=Array.from({length:10},(_,i)=>sample(i+1,.68,-44+i*.81));
 return{before:trace[0],after:trace.at(-1),trace,id,axis:'v',boundary:-38,clearHalfWidth:1.65};
}
function contact(){
 const before=sample(1,0,0),trace=[sample(2,1,0),sample(3,2,0),...Array.from({length:8},(_,i)=>sample(i+4,3,0))];
 const after=structuredClone(trace.at(-1));
 after.actor.forwardProbe={radius:.27,bodyHeights:[.62,1.1,1.58],maxDistance:.7,blocked:false,sweptHits:[0,null,null]};
 after.actor.visibleForwardSurfaces=[{height:.62,distance:.30,mesh:'actual wall'},null,null];
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
 const value=contact();value.after.actor.visibleForwardSurfaces[0].distance=1.5;assert.throws(()=>assertContact(value),/visible surface and existing collision/);
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
