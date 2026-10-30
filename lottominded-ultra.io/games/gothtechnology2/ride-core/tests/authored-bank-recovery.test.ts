import test from 'node:test';import assert from 'node:assert/strict';import {fileURLToPath} from 'node:url';import {readFile} from 'node:fs/promises';
import {loadHostFixture} from '../../love-tag-server/src/hostFixture.ts';
import {TagTerrain} from '../src/tag/fixture.ts';import {DowntownArena} from '../src/royale/downtownArena.ts';
import {RoyaleMatch} from '../src/royale/rules.ts';import {RideController,NEUTRAL_ACTIONS} from '../src/controller.ts';
import {initializeEngine} from '../src/engine/runtime.ts';
import {botObstacleRecovery,recoverBotObstacle} from '../src/botObstacleRecovery.ts';
import {setSimulationProfiling,takeSimulationProfile} from '../src/simulationProfile.ts';
await initializeEngine(await readFile(new URL('../src/engine/breadflower.wasm',import.meta.url)));
const data=await loadHostFixture(process.env.ROYALE_FIXTURES??fileURLToPath(new URL('../../swoop-source/public/love-tag/',import.meta.url)),'swoop-detroit');
const terrain=new DowntownArena(await TagTerrain.create(data.fixture,await data.physics()));
const bank={x:937.3123117650673,y:4.53271492553711,z:33.7432346860411},grass={x:580.4887210520022,y:4.380123220214845,z:9.050509737849055};
test('both playtest banks have a supported detour instead of a route onto the overhead deck',()=>{
 const target={...terrain.zones[0],y:terrain.ground(terrain.zones[0].x,terrain.zones[0].z).height};
 for(const p of [bank,grass]){
  assert.equal(terrain.raycastObstacle({...p,y:p.y+1.65},{x:0,y:0,z:1},2,.28),null,'can leave downhill');
  assert.notEqual(terrain.raycastObstacle({...p,y:p.y+1.65},{x:0,y:0,z:-1},2,.28),null,'cannot push farther into slab');
  const route=terrain.route(p,target);assert(route.length>1);assert(route[0].z>p.z,'first leg goes downhill instead of climbing a road underside');
  let previous=p;for(const next of route){assert(terrain.travelClear(previous,next),JSON.stringify({previous,next}));previous=next;}
 }
});
test('the observed stuck AI rides out of the bank with continuous motion',()=>{
 const m=new RoyaleMatch(terrain,false,6);m.add('human','Human');m.add('bot','Bot',true);m.start('bank',2);
 const h=m.actors[0];h.controller.reset({position:{x:2000,y:terrain.ground(2000,100).height,z:100},headingY:0});h.pose={...h.controller.poseValue};
 const a=m.actors[1];a.controller.reset({position:bank,headingY:-14.869286287106592});a.pose={...a.controller.poseValue};
 for(let i=0;i<1500;i++){const old={...a.pose};m.step();assert.equal(a.controller.crashed,false);assert.equal(a.pose.footMode,0);assert(Math.hypot(a.pose.x-old.x,a.pose.z-old.z)<.6);}
 assert(Math.hypot(a.pose.x-bank.x,a.pose.z-bank.z)>40,JSON.stringify(a.pose));m.dispose();
});
test('a player on foot can back away from the reported grass bank',()=>{
 const rider=new RideController(terrain,{spawn:{position:grass,headingY:0}});
 rider.step(1/60,{...NEUTRAL_ACTIONS,dismount:true});for(let i=0;i<180;i++)rider.step(1/60,NEUTRAL_ACTIONS);
 assert.equal(rider.poseValue.footMode,2);const z=rider.poseValue.z;
 for(let i=0;i<120;i++)rider.step(1/60,{...NEUTRAL_ACTIONS,throttle:1});
 assert(rider.poseValue.z>z+1,JSON.stringify(rider.poseValue));assert.equal(rider.crashed,false);
});
test('mounted bots can build reverse torque away from downtown walls on a downhill grade at battle substeps',()=>{
 for(const spawn of [
  {position:{x:-628.3958528633628,y:7.0509835107421885,z:-160.0716674276601},headingY:9.184185154973632},
  {position:{x:-595.252487746661,y:7.529701314697267,z:-144.73634977759403},headingY:-3.899745125319665},
 ]){
  const rider=new RideController(terrain,{spawn}),state=botObstacleRecovery();let escaped=false;
  for(let i=0;i<480;i++){
   const p={...rider.poseValue},escape=recoverBotObstacle(terrain,p,{x:p.x,y:p.y,z:p.z+20},state,i/60,1/60);
   const input={...NEUTRAL_ACTIONS,stableAI:true,...(escape??{throttle:.5,steer:0})};
   rider.step(1/120,input);rider.step(1/120,input);
   assert.equal(rider.crashed,false);assert.equal(rider.poseValue.footMode,0);
   assert(Math.hypot(rider.poseValue.x-p.x,rider.poseValue.z-p.z)<.4,'no relocation through contact');
   if(Math.hypot(rider.poseValue.x-spawn.position.x,rider.poseValue.z-spawn.position.z)>2){escaped=true;break;}
  }
  assert(escaped,JSON.stringify({spawn,p:rider.poseValue,state}));
 }
});
test('real-map route warming and a cold route cache preserve the compiled host snapshot',async()=>{
 const a=new RoyaleMatch(terrain,true,6);a.add('human','Human');a.add('bot','Bot',true);a.start('restore-bank',2);
 const bot=a.actors[1];bot.controller.reset({position:bank,headingY:0});bot.pose={...bot.controller.poseValue};
 const before=a.captureEngineState();let yielded=0;await a.prepareNavigation(async()=>{yielded++;});assert(yielded>=1&&yielded<=9,'warm-up must yield in bounded slices');const after=a.captureEngineState();assert.deepEqual({...after,navigation:undefined},{...before,navigation:undefined},'warming navigation must not advance physics, health or controls');
 for(let i=0;i<120;i++)a.step();
 const cold=new DowntownArena(terrain.terrain),b=new RoyaleMatch(cold,true,6);b.restoreEngineState(a.captureEngineState());
 let profile:ReturnType<typeof takeSimulationProfile>={};
 try{for(let i=0;i<120;i++){setSimulationProfiling(false);a.step();setSimulationProfiling(true);b.step();}profile=takeSimulationProfile();}finally{setSimulationProfiling(false);}
 assert((profile.movement?.calls??0)>0,'opt-in timings are available without changing host commands/state');
 assert.deepEqual(b.captureEngineState(),a.captureEngineState());a.dispose();b.dispose();
});
test('simulation warm-up cannot spend a live life, round, input or replay tick',async()=>{
 const match=new RoyaleMatch(terrain,true,6,true,true);match.add('human','Human');match.add('bot','Bot',true);match.start('warm-isolation',2);
 await match.prepareNavigation();const before=match.captureEngineState(),snapshot=match.snapshot('human');let yields=0;
 await match.prepareSimulation(async()=>{yields++;});
 assert.equal(yields,13);assert.deepEqual(match.captureEngineState(),before);assert.deepEqual(match.snapshot('human'),snapshot);assert.equal(match.killcam('human'),undefined);
 match.step();const active=match.captureEngineState();await match.prepareSimulation(async()=>{throw Error('must not warm an active tick');});assert.deepEqual(match.captureEngineState(),active);match.dispose();
});

test.after(()=>terrain.terrain.dispose());
