import {test} from 'node:test';
import assert from 'node:assert/strict';
import {SplitRideInput,splitSetupError} from './splitInput.ts';
import {RaceRules,RACE_ROUTE} from './raceRules.ts';
import {SplitRaceSimulation} from './splitRaceSimulation.ts';
import {splitViewports} from './splitLayout.ts';
import {NEUTRAL_ACTIONS} from './controller.ts';
import {createGroundSample,type TerrainSampler} from './terrain.ts';
import {DetroitWorld,cutCoords,clamp} from './world.ts';
import {GeoTerrain} from './geo-terrain.ts';
import {toMap} from './geo-profile.ts';
import {routePosition} from './districtView.ts';
import type {PadLike} from './gamepadInput.ts';
const ids=['DS_Man_01','DS_Hoodie_Woman_01'] as const;
const flat:TerrainSampler={sampleGround(_x,_z,out){return Object.assign(out,createGroundSample());},raycast:()=>null,raycastObstacle:()=>null};
const pad=(index:number):PadLike=>({id:'controller-'+index,index,connected:true,mapping:'standard',axes:[0,0,0,0],buttons:Array.from({length:16},()=>({pressed:false,value:0}))});
const arm=(input:SplitRideInput,pads:PadLike[]=[])=>{for(let i=0;i<30;i++)input.poll(pads,[0,0],1/120);};

test('two keyboards own separate throttle, steering, hop and recovery controls',()=>{
 const input=new SplitRideInput(['wasd','arrows']);arm(input);
 input.handleKey('KeyW',true);input.handleKey('ArrowLeft',true);
 assert.equal(input.consume(0).throttle,1);assert.equal(input.consume(0).steer,0);assert.equal(input.consume(1).throttle,0);assert.equal(input.consume(1).steer,-1);
 input.handleKey('Enter',true);assert.equal(input.consume(0).hopHeld,false);assert.equal(input.consume(1).hopHeld,true);input.handleKey('Enter',false);
 assert.equal(input.consume(1).hop,true);assert.equal(input.consume(1).hop,false);assert.equal(input.consume(0).hop,false);
 input.handleKey('Backspace',true);assert.deepEqual(input.events(1),{recover:true,camera:false,cruise:false});assert.equal(input.events(0).recover,false);
 input.clear(0);assert.equal(input.consume(0).throttle,0);assert.equal(input.consume(1).steer,-1,'a P1 crash cannot clear P2 controls');
});
test('per-player cruise cancels on braking or interruption without affecting the other rider',()=>{
 const input=new SplitRideInput(['wasd','arrows']);arm(input);input.toggleCruise(0);assert.ok(input.consume(0).throttle>0);assert.equal(input.consume(1).throttle,0);
 input.toggleCruise(1);input.handleKey('KeyS',true);assert.equal(input.consume(0).throttle,-1);assert.equal(input.cruising[0],false);assert.equal(input.cruising[1],true);
 input.clear(0);assert.equal(input.cruising[1],true);input.clear();arm(input);assert.deepEqual(input.cruising,[false,false]);assert.equal(input.consume(1).throttle,0);
});
test('controller assignments never broadcast a pad to both riders and interruption requires neutral',()=>{
 const a=pad(0),b=pad(2),input=new SplitRideInput(['pad:2','pad:0']);arm(input,[a,b]);
 (b.buttons as {pressed:boolean;value:number}[])[7]={pressed:true,value:.8};input.poll([a,null,b],[0,0],1/60);
 assert.equal(input.consume(0).throttle,.8);assert.equal(input.consume(1).throttle,0);
 input.clear();for(let i=0;i<120;i++)input.poll([a,b],[0,0],1/60);assert.equal(input.consume(0).throttle,0);
 (b.buttons as {pressed:boolean;value:number}[])[7]={pressed:false,value:0};arm(input,[a,b]);(b.buttons as {pressed:boolean;value:number}[])[7]={pressed:true,value:.6};input.poll([a,b],[0,0],1/60);assert.equal(input.consume(0).throttle,.6);
 assert.equal(input.poll([a],[0,0],1/60).disconnected,true);
 assert.match(splitSetupError(['pad:0','pad:0'],[a]),/different/);assert.match(splitSetupError(['wasd','pad:2'],[a]),/not connected/);assert.equal(splitSetupError(['wasd','arrows'],[]),'');
});
test('one finish does not stop the other player and ordered gates are required for each',()=>{
 const rules=new RaceRules(ids[0],{opponents:[ids[1]],waitForAll:true});rules.advance(3);
 for(let d=(RACE_ROUTE.start+.1);d<RACE_ROUTE.end+.2;d+=.1){rules.advance(.02);rules.observe(ids[0],d,-1.2,.02);}
 assert.notEqual(rules.racers[0].finish,null);assert.equal(rules.done,false);const first=rules.racers[0].finish;
 rules.observe(ids[1],RACE_ROUTE.end+1,0,.02);assert.equal(rules.racers[1].finish,null);assert.equal(rules.racers[1].missed,true);
 const time=rules.elapsed;rules.recover(ids[1]);assert.equal(rules.elapsed,time);assert.equal(rules.racers[0].finish,first);
 for(let d=(RACE_ROUTE.start+.1);d<RACE_ROUTE.end+.2;d+=.1){rules.advance(.01);rules.observe(ids[1],d,1.2,.01);}
 assert.equal(rules.done,true);assert.equal(rules.racers[1].gate,RACE_ROUTE.gates.length);assert.equal(rules.order[0].id,ids[0]);
 const frozen=rules.elapsed;rules.advance(10);assert.equal(rules.elapsed,frozen);
});
test('two-player countdown, paused zero ticks, and restart preserve fairness without records',()=>{
 const room=new SplitRaceSimulation(flat,ids),start=room.snapshot;
 for(let i=0;i<240;i++)room.step(1/120,[{...NEUTRAL_ACTIONS,throttle:1},{...NEUTRAL_ACTIONS,throttle:1}]);
 assert.deepEqual(room.snapshot.racers.map(r=>r.position),start.racers.map(r=>r.position));assert.equal(room.rules.elapsed,0);
 const paused=room.snapshot;room.step(0,[NEUTRAL_ACTIONS,NEUTRAL_ACTIONS]);assert.deepEqual(room.snapshot,paused);
 const reset=new SplitRaceSimulation(flat,ids);assert.equal(reset.rules.countdown,3);assert.ok(reset.snapshot.racers.every(r=>r.gate===0&&r.finish===null&&r.banked===0&&r.pending===0));
});
test('a local crash settles independently and recovery cannot move the other rider or advance gates',()=>{
 let blocker:{x:number;z:number}|undefined;
 const terrain:TerrainSampler={...flat,raycastObstacle:(o)=>blocker&&Math.hypot(o.x-blocker.x,o.z-blocker.z)<1?0:null};
 const room=new SplitRaceSimulation(terrain,ids);
 for(let i=0;i<600;i++)room.step(1/120,[{...NEUTRAL_ACTIONS,throttle:.5},{...NEUTRAL_ACTIONS,throttle:.4}]);
 blocker={...room.riders[0].pose};for(let i=0;i<400;i++)room.step(1/120,[NEUTRAL_ACTIONS,{...NEUTRAL_ACTIONS,throttle:.4}]);
 assert.equal(room.riders[0].sim.crashed,true);assert.equal(room.riders[0].sim.snapshot().fallPhase,'settled');assert.equal(room.riders[1].sim.crashed,false);
 assert.ok(room.riders[1].pose.speed>2);const other=room.riders[1].sim.snapshot(),time=room.rules.elapsed,gate=room.rules.racers[0].gate;
 blocker=undefined;assert.equal(room.recover(0),true);assert.equal(room.rules.elapsed,time);assert.equal(room.rules.racers[0].gate,gate);assert.deepEqual(room.riders[1].sim.snapshot(),other);assert.equal(room.riders[0].pose.speed,0);
});
test('split viewports cover odd and portrait dimensions once, without overlap or hidden panes',()=>{
 for(const [w,h]of [[1280,800],[1279,719],[844,390],[390,844]]){const [a,b]=splitViewports(w,h);assert.equal(a.width*a.height+b.width*b.height,w*(h-52));assert.ok(a.x+a.width<=w&&b.x+b.width<=w);assert.ok(a.y+a.height<=h&&b.y+b.height<=h);assert.ok(a.x+a.width<=b.x||a.y+a.height<=b.y);}
});
test('both local riders can complete the full route to Mack Avenue with the existing controllers',async t=>{
 const mapped=await new DetroitWorld().init();mapped.updateTraffic(0,1e8,1e8);mapped.step();
 try{
  const room=new SplitRaceSimulation(new GeoTerrain(mapped),ids),dt=1/120;
  for(let tick=0;tick<900*120+360&&!room.rules.done;tick++){
   const actions=room.riders.map((r,i)=>{const p=toMap(r.pose.x,r.pose.y,r.pose.z),c=cutCoords(p.x,p.z),target=routePosition(c.d+8,i===0?-1.2:1.2),desired=Math.atan2(target.x-r.pose.x,target.z-r.pose.z),err=Math.atan2(Math.sin(desired-r.pose.headingY),Math.cos(desired-r.pose.headingY));return {...NEUTRAL_ACTIONS,throttle:clamp(((i===0?6.6:5.8)-r.pose.speed)*.45,-.3,.6),steer:clamp(-err*2.5,-.8,.8)};});
   mapped.step();room.step(dt,actions);
  }
  assert.ok(room.rules.racers.every(r=>r.finish!==null&&r.gate===RACE_ROUTE.gates.length),JSON.stringify(room.snapshot));assert.ok(room.riders.every(r=>!r.sim.crashed));assert.equal(room.rules.order[0].id,ids[0]);
  t.diagnostic(JSON.stringify(room.rules.racers.map(r=>({id:r.id,seconds:r.finish,gates:r.gate}))));
 }finally{mapped.physics.free();}
});
