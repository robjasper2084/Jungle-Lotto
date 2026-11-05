import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {EngineContext,initializeEngine} from '../src/engine/runtime.ts';
import {routeBattleInput} from '../src/engine/royaleKernel.ts';
import {neutral,move,type Command} from '../src/royale/rules.ts';
import {WEAPONS} from '../src/royale/combatProfiles.ts';
import {WHEELS,kphToMps,mphToMps} from '../src/royale/wheelProfiles.ts';
import {traceBallistic,movingTargetHit} from '../src/royale/ballisticSweep.ts';
import {RideController} from '../src/controller.ts';
import type {TerrainSampler} from '../src/terrain.ts';
await initializeEngine(await readFile(new URL('../src/engine/breadflower.wasm',import.meta.url)));
function fixture(){const c=new EngineContext();for(let i=0;i<6;i++)c.checked('add',i);c.checked('start',23);for(let i=0;i<240;i++)step(c);return c;}
function step(c:EngineContext,partial:Partial<Command>={},advance=true){routeBattleInput(c,0,{...neutral('test'),...partial});c.checked('begin');c.checked('rules');if(advance){for(let i=0;i<256;i++)if(c.call('projectile',i,0))c.checked('resolve',i,c.call('projectile',i,1),-2);c.checked('end');}}
function finish(c:EngineContext){for(let i=0;i<256;i++)if(c.call('projectile',i,0))c.checked('resolve',i,c.call('projectile',i,1),-2);c.checked('end');}
test('all mounted input channels round-trip through compiled upstream storage',()=>{const c=new EngineContext();const got=routeBattleInput(c,0,{...neutral('x'),reload:true,cycleMode:true,aimMode:2,lean:-.5,crouch:true});assert.equal(got.reload,true);assert.equal(got.cycleMode,true);assert.equal(got.aimMode,2);assert.equal(got.lean,-.5);assert.equal(got.crouch,true);c.dispose();});
test('compiled semi, burst and auto honor edges, cadence and magazine',()=>{
 const c=fixture();for(let i=0;i<40;i++)step(c,{fire:true});assert.equal(c.call('actor',0,19),1);
 step(c,{cycleMode:true});step(c);for(let i=0;i<40;i++)step(c,{fire:true});assert.equal(c.call('actor',0,19),4);
 step(c,{cycleMode:true});step(c);for(let i=0;i<30;i++)step(c,{fire:true});assert.equal(c.call('actor',0,19),8);assert.equal(c.call('combat',0,0),12);assert.equal(c.call('actor',0,6),72);c.dispose();
});
test('reload commits exactly once; before/after cancellation conserve total ammunition',()=>{
 const c=fixture();step(c,{fire:true});step(c);step(c,{reload:true});const start=c.call('combat',0,3);assert(start>240);
 for(let i=0;i<20;i++)step(c);step(c,{fire:true});assert.equal(c.call('combat',0,3),-1);assert.equal(c.call('combat',0,0),19);assert.equal(c.call('actor',0,6),79);
 for(let i=0;i<10;i++)step(c);step(c,{reload:true});const commit=c.call('combat',0,4);
 while(c.call('state',0)<commit)step(c);assert.equal(c.call('combat',0,0),20);assert.equal(c.call('actor',0,6),79);assert.equal(c.call('combat',0,6),1);
 step(c,{fire:true});assert.equal(c.call('combat',0,3),-1);assert.equal(c.call('combat',0,0),20);assert.equal(c.call('actor',0,6),79);c.dispose();
});
test('C++ trajectory has travel time, world gravity and inherited shooter velocity',()=>{
 const c=fixture();c.checked('pose',0,0,0,0,0,0,1);c.checked('motion',0,20,3,.4,0,0);step(c,{fire:true},false);
 const i=Array.from({length:256},(_,i)=>i).find(i=>c.call('projectile',i,0))!;
 const y=c.call('projectile',i,6),vy=c.call('projectile',i,9),vx=c.call('projectile',i,8),z=c.call('projectile',i,7);
 assert(Math.abs(vx-20)<.3);assert(Math.abs(c.call('trajectory',i,1/60,1)-(y+vy/60-.5*9.81/3600))<1e-9);
 assert(c.call('trajectory',i,1/60,2)-z>3);finish(c);const y1=c.call('projectile',i,6);
 for(let t=0;t<29;t++)step(c);assert(c.call('projectile',i,6)<y1-1);c.dispose();
});
test('mid-reload snapshot restores timers, recoil, modes and hidden pattern counters',()=>{
 const a=fixture();step(a,{fire:true,aimMode:2,lean:-1});step(a);step(a,{reload:true});for(let i=0;i<30;i++)step(a);
 const b=new EngineContext();b.restore(a.capture());for(let i=0;i<170;i++){const input={fire:i>100,cycleMode:i===100,aimMode:2};step(a,input);step(b,input);}assert.deepEqual(a.capture(),b.capture());a.dispose();b.dispose();
});
test('high relative speed crossing is hit and thin cover wins before the target',()=>{
 const target={id:1,alive:true,previous:{x:-2,y:0,z:2},current:{x:2,y:0,z:2}};
 assert.notEqual(movingTargetHit({x:0,y:1,z:0},{x:0,y:1,z:4},target,.01,0,1),null);
 const point=(t:number)=>({x:0,y:1-4.905*t*t,z:240*t});
 const hit=traceBallistic(point,.045,[{...target,previous:{x:0,y:0,z:3},current:{x:0,y:0,z:3}}],(p,d)=>p.z<=2&&p.z+d.z>=2?(2-p.z)/d.z:null,()=>({height:0}));assert.equal(hit,-1);
});
test('unit conversion and every selected wheel reaches its own capped speed on level pavement',()=>{
 assert.equal(kphToMps(36),10);assert.equal(mphToMps(1),.44704);
 const flat:TerrainSampler={sampleGround(_x,_z,out){Object.assign(out,{height:0,surface:'pavement',offCourse:false});Object.assign(out.normal,{x:0,y:1,z:0});return out;},raycast:()=>null,raycastObstacle:()=>null};
 for(const w of WHEELS){const a={wheelId:w.id,controller:new RideController(flat,{tuning:w.tuning}),energy:100,burstUntil:0,burstLatch:false};for(let t=0;t<60*120;t++)move(a,{...neutral('speed'),throttle:1,burst:t%300<36},t);
  const speed=a.controller.poseValue.speed,target=w.tuning.maxSpeed;assert(Math.abs(speed-target)/target<.02,`${w.id}: ${speed} versus ${target}`);assert(speed<=target+.01);}
 assert(WEAPONS.static.gravity>0);
});
