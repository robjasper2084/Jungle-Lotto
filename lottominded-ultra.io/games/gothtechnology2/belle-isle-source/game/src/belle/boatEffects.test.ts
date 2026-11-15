import test from 'node:test';import assert from 'node:assert/strict';
import {WakeHistory,smoothHelm,jetPower,hullSprayStrength} from './boatEffectsState.ts';
import {boatAudioTargets,DEFAULT_AUDIO} from './belleAudioPolicy.ts';
test('wake stays in world space, bounds memory and expires after the boat leaves',()=>{
 const h=new WakeHistory();for(let i=0;i<500;i++){h.advance(.02);h.add(i,Math.sin(i*.02)*10,0,4,1);}
 assert.equal(h.count,128);assert.equal(h.samples.length,128);const first={...h.at(0)!};h.advance(.02);assert.deepEqual(h.at(0),first);
 for(let i=0;i<100;i++)h.advance(.1);assert.equal(h.count,0);
});
test('teleport and boat switch break the wake instead of drawing across the island',()=>{
 const h=new WakeHistory();h.add(0,0,0,4,1);h.advance(.1);h.add(0,3,0,4,1);assert.equal(h.at(0)!.chain,h.at(1)!.chain);
 h.add(1000,1000,0,4,1);assert.notEqual(h.at(1)!.chain,h.at(2)!.chain);h.break();h.add(1001,1000,0,2,1);assert.notEqual(h.at(2)!.chain,h.at(3)!.chain);
 const count=h.count;h.add(NaN,0,0,4,1);assert.equal(h.count,count);
});
test('helm is smooth, rate independent and settles without overshoot',()=>{
 const advance=(hz:number)=>{let a=0;for(let i=0;i<hz;i++)a=smoothHelm(a,1,1/hz);return a;};
 assert(Math.abs(advance(30)-advance(120))<1e-10);assert(smoothHelm(0,1,1/60)>-.85);
 let a=advance(60);for(let i=0;i<120;i++)a=smoothHelm(a,0,1/60);assert(Math.abs(a)<1e-8);assert.equal(smoothHelm(.2,1,0),.2);
});
test('jet power and sound honor throttle, mute, volume and active state',()=>{
 const p={throttle:1,powerPercent:80,speed:20,hydroplane:true},prefs={...DEFAULT_AUDIO,effects:true};
 assert.equal(jetPower(p),.8);assert.equal(jetPower({...p,throttle:0}),0);assert.equal(jetPower({...p,throttle:-1}),0);
 const zero=(v:ReturnType<typeof boatAudioTargets>)=>Object.entries(v).filter(([k])=>k.endsWith('Gain')).every(([,v])=>v===0);
 assert(zero(boatAudioTargets(p,true,DEFAULT_AUDIO)));assert(zero(boatAudioTargets(p,false,prefs)));assert(zero(boatAudioTargets(p,true,{...prefs,effectsVolume:0})));
 assert(boatAudioTargets(p,true,prefs).motorHz>boatAudioTargets({...p,powerPercent:10},true,prefs).motorHz);
 assert.equal(boatAudioTargets({...p,throttle:0},true,prefs).motorGain,0);
});
test('hull contact foam responds to turns, acceleration and vertical impact',()=>{
 const p={speed:20,throttle:1,powerPercent:70,yawRate:0,acceleration:0,verticalAcceleration:0},base=hullSprayStrength(p);
 assert.equal(hullSprayStrength({...p,speed:0}),0);
 for(const extra of [{yawRate:.3},{acceleration:4},{verticalAcceleration:3}])assert(hullSprayStrength({...p,...extra})>base);
 assert.equal(hullSprayStrength({...p,speed:100,verticalAcceleration:100}),1);
});
