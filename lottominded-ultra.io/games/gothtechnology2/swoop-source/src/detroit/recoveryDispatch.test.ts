import test from 'node:test';
import assert from 'node:assert/strict';
import {dispatchRecovery} from './recoveryDispatch.ts';
import {SplitRideInput} from './splitInput.ts';
import {SplitRaceSimulation} from './splitRaceSimulation.ts';
import {NEUTRAL_ACTIONS} from './controller.ts';
import {createGroundSample,type TerrainSampler} from './terrain.ts';
const flat:TerrainSampler={sampleGround(_x,_z,out){return Object.assign(out,createGroundSample());},raycast:()=>null,raycastObstacle:()=>null};
test('shared Recover routes to the owning guest, never resets the host locally',()=>{
 const calls:string[]=[];const local=(i:number)=>calls.push('local:'+i),remote=()=>calls.push('remote');
 for(let slot=1;slot<4;slot++)assert(dispatchRecovery({active:true,isHost:false,slot},undefined,local,remote));
 assert.deepEqual(calls,['remote','remote','remote']);
 assert.equal(dispatchRecovery({active:true,isHost:false,slot:2},0,local,remote),false);
 dispatchRecovery({active:true,isHost:true,slot:0},undefined,local,remote);
 dispatchRecovery({active:false,isHost:false,slot:-1},3,local,remote);
 assert.deepEqual(calls,['remote','remote','remote','local:0','local:3']);
});
test('a recovery key pressed immediately after a crash survives neutral rearming',()=>{
 const input=new SplitRideInput(['wasd','arrows']);input.clear();
 input.handleKey('KeyW',true);input.handleKey('KeyR',true);input.handleKey('Backspace',true);
 input.poll([],[0,0],1/60);
 assert.equal(input.consume(0).throttle,0);
 assert.equal(input.events(0).recover,true);assert.equal(input.events(1).recover,true);
 input.poll([],[0,0],1/60);assert.equal(input.events(0).recover,false);
});
test('each of four seats queues an early fall recovery and completes it independently',()=>{
 const ids=['DS_Man_01','DS_Hoodie_Woman_01','DS_Mascot_Hoodie_01','DS_Mascot_Suit_01'] as const;
 for(let seat=0;seat<4;seat++){
  const room=new SplitRaceSimulation(flat,ids,{mode:'free',spawn:{x:0,y:0,z:0,heading:0}});
  const others=room.riders.map(r=>({...r.pose}));
  assert(room.riders[seat].sim.receiveImpact({speed:8,vx:0,vz:8}));
  assert(room.requestRecovery(seat));assert(room.recoveryPending(seat));
  for(let i=0;i<900;i++)room.step(1/120,ids.map(()=>NEUTRAL_ACTIONS));
  assert.equal(room.recoveryPending(seat),false);assert.equal(room.riders[seat].sim.crashed,false);
  assert.notEqual(room.riders[seat].sim.snapshot().state,'recovering');
  assert.equal(room.riders[seat].stock.used,0);
  room.riders.forEach((r,i)=>{if(i!==seat){assert.equal(r.pose.x,others[i].x);assert.equal(r.pose.z,others[i].z);}});
 }
});

test('split recovery preserves dry-ground checks and reserves its mounted space',()=>{
 let wet=false;const reserved:any[]=[];
 const room=new SplitRaceSimulation({...flat,waterAt:()=>wet,reserveRecoverySpace:(...v)=>reserved.push(v)},['DS_Man_01','DS_Hoodie_Woman_01'],{mode:'free',spawn:{x:0,y:0,z:0,heading:0}});
 wet=true;assert.equal(room.requestRecovery(0),false,'no recovery candidate may be under water');assert.equal(reserved.length,0);
 wet=false;assert.equal(room.requestRecovery(0),true);assert.equal(reserved.length,1);
});
