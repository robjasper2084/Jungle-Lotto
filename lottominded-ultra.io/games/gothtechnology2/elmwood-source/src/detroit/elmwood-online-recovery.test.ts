import test from 'node:test';
import {Scene} from 'three';
import {PedalSparks} from '../../../ride-core/src/pedalSparks.ts';
import assert from 'node:assert/strict';
import {ElmwoodOnlineRide} from './elmwood-online-ride.ts';
import {ElmwoodSessionInput} from './elmwood-session-input.ts';
import {ElmwoodRun} from './elmwood-gameplay.ts';
import {RideMotion} from './ride-motion.ts';
import type {TerrainSampler} from '../simulation/world.ts';
const flat:TerrainSampler={sampleGround(_x,_z,out){return Object.assign(out,{height:0,normal:{x:0,y:1,z:0},surface:'pavement',offCourse:false});},raycast:()=>null,raycastObstacle:()=>null};
// Exercise the real online update/dispatch methods with physics and input intact.
// Rendering/transport are sinks; this is not a real-network or browser test.
const noop=()=>{};
test('paused Elmwood host and every local seat recover; a guest sends its own reset',()=>{
 const oldDocument=globalThis.document,oldGamepads=navigator.getGamepads,oldMatchMedia=globalThis.matchMedia;
 Object.assign(globalThis,{matchMedia:()=>({matches:false}),document:{documentElement:{dataset:{}},hidden:false,querySelector:()=>null,body:{classList:{contains:()=>false}}}});
 Object.defineProperty(navigator,'getGamepads',{value:()=>[],configurable:true});
 try{
  for(const mode of ['local','host','guest'])for(const seat of mode==='local'?[0,1,2,3]:[0]){
   const runtime=Object.create(ElmwoodOnlineRide.prototype) as any;
   const input=new ElmwoodSessionInput();input.configure(mode==='local'?['wasd','arrows','ijkl','numpad']:['wasd']);
   const riders=Array.from({length:4},()=>{const motion=new RideMotion(flat),run=new ElmwoodRun([]);run.reset('free',motion.pose);return {sparks:new PedalSparks(new Scene()),motion,run,view:{root:{visible:true},apply:noop,lights:{setBeam:noop}},camera:{}};});
   const own=mode==='guest'?2:0,commands:any[]=[];
   Object.assign(runtime,{input,riders,own,local:mode==='local',match:{mode:'free',members:riders.map(()=>({rider:'DS_Man_01'}))},terrain:flat,countdown:0,elapsed:0,frozen:true,boardAt:Infinity,canvas:{dataset:{},focus:noop},rooms:{isHost:mode==='host',healthy:true,inputBlocked:false,inputs:(a:any)=>riders.map((_,i)=>i===own?a:{}),command:(a:any)=>commands.push(a),update:noop}});
   const victim=riders[mode==='guest'?own:seat];victim.motion.core.controller.knockOff();victim.motion.update(1/120,{});
   runtime.recoverSeat(seat);runtime.update(1/60);
   assert.equal(runtime.frozen,false);assert.equal(runtime.canvas.dataset.paused,'false');
   if(mode==='guest'){assert.equal(commands.length,1);assert.equal(commands[0].reset,true);assert.equal(victim.motion.sim.crashed,true,'guest must not mutate host physics');}
   else{
    for(let i=0;i<150;i++)runtime.update(1/60);
    assert.equal(victim.motion.sim.crashed,false);assert.equal(victim.motion.pose.crashRecovery,0);assert.equal(victim.run.recoveryStock.used,0);
    const before={...victim.motion.pose},others=riders.filter(r=>r!==victim).map(r=>[r.motion.pose.x,r.motion.pose.z]);
    input.touch(seat,'forward',true);for(let i=0;i<60;i++)runtime.update(1/60);
    assert.ok(victim.motion.pose.speed>1,'fresh movement works after get-up');
    assert.ok(Math.hypot(victim.motion.pose.x-before.x,victim.motion.pose.z-before.z)>.5);
    assert.deepEqual(riders.filter(r=>r!==victim).map(r=>[r.motion.pose.x,r.motion.pose.z]),others,'recovery keeps other seats independent');
   }
   for(const r of riders)r.sparks.dispose();
  }
 }finally{Object.assign(globalThis,{document:oldDocument,matchMedia:oldMatchMedia});Object.defineProperty(navigator,'getGamepads',{value:oldGamepads,configurable:true});}
});
