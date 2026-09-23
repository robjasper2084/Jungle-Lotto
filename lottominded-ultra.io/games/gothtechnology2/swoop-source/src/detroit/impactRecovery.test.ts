import {test} from 'node:test';
import assert from 'node:assert/strict';
import {RideController,createPose,NEUTRAL_ACTIONS} from './controller.ts';
import {FallMotion} from './fallMotion.ts';
import {TrafficFall} from './trafficFall.ts';
import {createGroundSample,type TerrainSampler,type ActorImpact} from './terrain.ts';
import {DetroitWorld,trafficAt} from './world.ts';
import {GeoTerrain} from './geo-terrain.ts';
import {toLocal} from './geo-profile.ts';
const flat:TerrainSampler={sampleGround(_x,_z,out){return Object.assign(out,createGroundSample());},raycast:()=>null,raycastObstacle:()=>null};
test('slow bumps yield; hard impacts notify the struck actor exactly once',()=>{
 for(const throttle of [.10,1]){
  let events:ActorImpact[]=[];const blocker={id:'walker',x:0,y:0,z:8,radius:.4,height:1.8,kind:'pedestrian',vx:0,vz:0,onImpact:(i:ActorImpact)=>events.push(i)};
  const sim=new RideController({...flat,navigationObstacles:()=>[blocker]},{spawn:{position:{x:0,y:0,z:0},headingY:0}});
  for(let i=0;i<2400;i++)sim.step(1/120,{...NEUTRAL_ACTIONS,throttle:throttle===1?1:Math.max(-.1,Math.min(.1,(1.3-sim.snapshot().speed)*.7))});
  assert.equal(sim.crashed,throttle===1);assert.equal(events.length,throttle===1?1:0);
  if(events.length){assert.ok(events[0].speed>2.2);assert.ok(events[0].vz>0);assert.equal(events[0].vx,0);}
 }
});
test('actual impact direction controls the recipient, including sideways and backward shoves',()=>{
 for(const [vx,vz]of [[8,0],[-8,0],[0,8],[0,-8]]){
  const sim=new RideController(flat,{spawn:{position:{x:0,y:0,z:0},headingY:0}});assert.ok(sim.receiveImpact({speed:8,vx,vz}));
  for(let i=0;i<360;i++)sim.step(1/120,NEUTRAL_ACTIONS);const p=createPose();sim.writePose(p);
  if(vx)assert.equal(Math.sign(p.crashLateral),Math.sign(vx));if(vz)assert.equal(Math.sign(p.crashForward),Math.sign(vz));
  assert.equal(sim.snapshot().crashes,1);assert.equal(sim.receiveImpact({speed:20,vx:0,vz:20}),false);
 }
});
test('20, 43 and 72 km/h produce progressively longer slides and high speed no longer saturates',t=>{
 const distances=[5.56,12,20].map(speed=>{const p=createPose();p.speed=speed;const f=new FallMotion(p,'collision');f.sample(6,p);return Math.hypot(p.crashForward,p.crashLateral);});
 assert.ok(distances[1]>distances[0]+2);assert.ok(distances[2]>distances[1]+5);t.diagnostic(JSON.stringify({slideMetres:distances}));
});
test('recovery has a supported get-up phase, blocks acceleration, and restores riding',()=>{
 const c=new RideController(flat);c.receiveImpact({speed:12,vx:0,vz:10});for(let i=0;i<360;i++)c.step(1/120,NEUTRAL_ACTIONS);
 assert.ok(c.recover());assert.equal(c.snapshot().state,'recovering');const p=createPose();let mid=false;
 for(let i=0;i<360;i++){c.step(1/120,{...NEUTRAL_ACTIONS,throttle:1});c.writePose(p);if(c.snapshot().state==='recovering'){assert.equal(p.speed,0);if(p.crashRecovery>.4&&p.crashRecovery<.8)mid=true;}}
 assert.ok(mid);assert.equal(p.crashMotion,0);assert.ok(p.speed>0);
});
test('a fallen pedestrian pauses with the game, waits for space, then gets up without changing identity',()=>{
 const f=new TrafficFall({x:0,y:0,z:0,heading:0,speed:1.1},{speed:10,vx:0,vz:8});
 f.step(0,flat);assert.equal(f.age,0);
 for(let i=0;i<300;i++)f.step(1/30,flat,false);assert.equal(f.done,false);assert.ok(f.pose.crashRecovery<=.481);
 const end={...f.position};for(let i=0;i<90;i++)f.step(1/30,flat,true);assert.ok(f.done);assert.deepEqual(f.position,end);
});
test('NPC drift is stopped by a wall and a missing ground boundary',()=>{
 for(const wall of [false,true]){const terrain:TerrainSampler={...flat,raycastObstacle:()=>wall?.8:null,sampleGround(x,z,out){flat.sampleGround(x,z,out);out.offCourse=z>1;return out;}};
  const f=new TrafficFall({x:0,y:0,z:0,heading:0,speed:0},{speed:20,vx:0,vz:17});for(let i=0;i<90;i++)f.step(1/30,terrain);assert.ok(f.position.z<=1.001);}
});
test('GeoTerrain forwards collision momentum in the correct map frame and pedestrians recover in the live world',async()=>{
 const world=await new DetroitWorld().init(),terrain=new GeoTerrain(world),entry=trafficAt(2,0),local=toLocal(entry.x,entry.y,entry.z);
 world.updateTraffic(0,entry.x,entry.z);world.step();const actor=terrain.navigationObstacles(local.x,local.z,2).find(o=>o.id==='traffic-2');assert.ok(actor?.onImpact);
 actor.onImpact({speed:8,vx:5,vz:3});world.updateTraffic(1/30,entry.x+8,entry.z+8);
 assert.ok(world.traffic.find(t=>t.id===2)?.fall);let sawRecovery=false;
 for(let i=2;i<600;i++){world.updateTraffic(i/30,entry.x+12,entry.z+12);world.step();const t=world.traffic.find(t=>t.id===2);if(t?.fallPhase==='getting up')sawRecovery=true;}
 assert.ok(sawRecovery);assert.equal(world.traffic.find(t=>t.id===2)?.fall,undefined);world.physics.free();
});
