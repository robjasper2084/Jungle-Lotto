import {test} from 'node:test';
import assert from 'node:assert/strict';
import {RideController,createPose,NEUTRAL_ACTIONS,type RideActions} from './controller.ts';
import {RideFeedback,pedalContact} from './rideFeedback.ts';
import type {TerrainSampler} from './terrain.ts';
const flat:TerrainSampler={sampleGround(_x,_z,o){o.height=0;o.normal={x:0,y:1,z:0};o.offCourse=false;o.surface='pavement';return o;},raycast:()=>null,raycastObstacle:()=>null};
function run(c:RideController,seconds:number,a:Partial<RideActions>={}){for(let i=0;i<seconds*120;i++)c.step(1/120,{...NEUTRAL_ACTIONS,...a});const p=createPose();c.writePose(p);return p;}
test('stopping plants a foot and remounts promptly when accelerating',()=>{
 const c=new RideController(flat);const p=run(c,1);assert.ok(p.stopFoot>.97);assert.equal(p.speed,0);
 const first=run(c,.04,{throttle:1});assert.ok(first.stopFoot<.4);assert.ok(first.speed>0);
 const moving=run(c,1,{throttle:1});assert.equal(moving.stopFoot,0);assert.ok(moving.speed>1);
 const stopped=run(c,3,{throttle:-1});assert.equal(stopped.speed,0);assert.ok(stopped.stopFoot>.8);
 run(c,.1);const reverse=run(c,1,{throttle:-1});assert.equal(reverse.stopFoot,0);assert.ok(reverse.speed<-.5);
});
test('mounted stop holds on a hill and never plants a boot over a ledge',()=>{
 const hill:TerrainSampler={...flat,sampleGround(x,z,o){flat.sampleGround(x,z,o);o.height=.1*z;o.normal={x:0,y:Math.sqrt(.99),z:-.1};return o;}};
 const c=new RideController(hill),p=run(c,3);assert.equal(p.speed,0);assert.ok(p.stopFoot>.99);assert.ok(Math.abs(p.z)<.001);
 const ledge:TerrainSampler={...flat,sampleGround(x,z,o){flat.sampleGround(x,z,o);if(Math.abs(x)>.3)o.height=-2;return o;}};
 assert.equal(run(new RideController(ledge),2).stopFoot,0);
});
test('warning beeps become more frequent near the speed ceiling and stop airborne or crashed',()=>{
 function pulses(speed:number){const f=new RideFeedback(),p=createPose();p.speed=speed;let last=0,count=0;for(let i=0;i<1200;i++){f.update(1/120,p,flat,true,false);if(p.beepPulse&&!last)count++;last=p.beepPulse;}return count;}
 assert.equal(pulses(16),0);assert.ok(pulses(21)>pulses(17.5)*2);
 const f=new RideFeedback(),p=createPose();p.speed=21;f.update(.01,p,flat,true,false);assert.equal(p.beepPulse,1);
 f.update(.01,p,flat,false,false);assert.equal(p.beepPulse,0);f.update(.01,p,flat,true,true);assert.equal(p.beepPulse,0);
});
test('pedal contact uses the low outside corner on either side and ignores airborne wheels',()=>{
 const p=createPose();p.speed=15;p.rollAngle=.94;
 const a=pedalContact(p,flat);assert.ok(a.intensity>.2);assert.equal(a.side,1);assert.equal(a.hard,true);
 p.rollAngle=-.94;const b=pedalContact(p,flat);assert.equal(b.side,-1);assert.ok(Math.abs(a.intensity-b.intensity)<1e-6);
 assert.equal(pedalContact(p,flat,false).intensity,0);p.rollAngle=.4;assert.equal(pedalContact(p,flat).intensity,0);
 const grass:TerrainSampler={...flat,sampleGround(x,z,o){flat.sampleGround(x,z,o);o.surface='grass';return o;}};p.rollAngle=.94;assert.equal(pedalContact(p,grass).hard,false);
});
test('fast full-lock carving produces a scrape but release clears it and recovery clears all cues',()=>{
 const c=new RideController(flat);run(c,7,{throttle:1});let peak=0;for(let i=0;i<180;i++){const p=run(c,1/120,{throttle:.7,steer:1});peak=Math.max(peak,p.scrape);}assert.ok(peak>.05);
 assert.ok(run(c,1,{steer:0}).scrape<.001);
 const p=run(c,1/120,{reset:true});assert.equal(p.scrape,0);assert.equal(p.beepPulse,0);assert.equal(p.stopFoot,0);
});
