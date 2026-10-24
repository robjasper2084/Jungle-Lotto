import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {initializeEngine} from '../src/engine/runtime.ts';
import {ArenaTerrain} from '../src/royale/arena.ts';
import {RoyaleMatch,PROTECTION,neutral} from '../src/royale/rules.ts';
import {botWheelRecovery,recoverBotWheel} from '../src/royale/botWheelRecovery.ts';
import {WHEEL_PICKUP_TOTAL} from '../src/wheelPickupTiming.ts';
import {RideController,NEUTRAL_ACTIONS} from '../src/controller.ts';
await initializeEngine(await readFile(new URL('../src/engine/breadflower.wasm',import.meta.url)));
const terrain=await ArenaTerrain.create();
function setup(engine=true){
 const m=new RoyaleMatch(terrain,engine);m.add('human','Human');m.add('bot','AI',true);m.start('recovery',1);
 for(let i=0;i<PROTECTION;i++)m.step();
 for(const [i,a]of m.actors.entries()){
  a.controller.reset({position:{x:0,y:0,z:i?0:160},headingY:0});a.controller.combatOnFoot=true;a.pose={...a.controller.poseValue};
 }
 return m;
}
for(const engine of [false,true])test(`knocked-off AI picks up and remounts promptly, using ordinary animation (engine=${engine})`,()=>{
 const m=setup(engine),a=m.actors[1];a.controller.knockOff();a.pose={...a.controller.poseValue};
 const parked=[a.pose.parkX,a.pose.parkY,a.pose.parkZ],start=m.tick;let pickupAt=0,mountedAt=0;
 for(let i=0;i<360;i++){
  m.step();
  if(i<12)assert.equal(a.pose.footMode,2,'show the impact before recovering');
  if(a.pose.footMode===3&&!pickupAt)pickupAt=m.tick;
  if(a.pose.footMode){assert.deepEqual([a.pose.parkX,a.pose.parkY,a.pose.parkZ],parked);assert(!a.input.fire&&!a.input.reload,'AI combat must not cancel pickup');}
  if(!a.pose.footMode){mountedAt=m.tick;break;}
 }
 assert(pickupAt&&mountedAt);assert(mountedAt-start<75,'nearby wheel recovered immediately, in under 1.25 seconds');
 assert(mountedAt-pickupAt>=Math.floor(WHEEL_PICKUP_TOTAL*60/2.6)-2,'all pickup/remount phases retained at AI pace');
 const human=m.actors[0];human.controller.reset({position:{x:0,y:0,z:20},headingY:0});human.pose={...human.controller.poseValue};
 for(let i=0;i<300;i++){m.step();assert.equal(a.input.dismount,false,'do not immediately dismount again to engage a nearby enemy');}
 m.dispose();
});
test('AI returns to a wheel separated by impact momentum and preserves deterministic host recovery',()=>{
 const m=setup(),a=m.actors[1];a.controller.poseValue.velocityX=14;a.controller.knockOff();a.pose={...a.controller.poseValue};
 for(let i=0;i<65;i++)m.step();assert(a.pose.footMode);const saved=m.captureEngineState();
 const replay=setup();replay.restoreEngineState(saved);
 for(let i=0;i<300;i++){m.step();replay.step();}
 assert.equal(m.actors[1].pose.footMode,0);assert.deepEqual(replay.captureEngineState(),m.captureEngineState());
 m.dispose();replay.dispose();
});
test('critical health, fresh stagger and obstructed paths cannot force a mount',()=>{
 const m=setup(),a=m.actors[1],s=botWheelRecovery();a.controller.knockOff();a.pose={...a.controller.poseValue};
 let c=neutral(m.round);assert(recoverBotWheel(a,c,s,terrain,m.tick));assert(!c.dismount);
 a.pose.footStagger=0;a.integrity=15;c=neutral(m.round);recoverBotWheel(a,c,s,terrain,m.tick);assert(!c.dismount);assert(c.repair);
 a.integrity=100;a.pose.x=4;c=neutral(m.round);
 recoverBotWheel(a,c,s,{...terrain,line:()=>false,route:()=>[]} as unknown as ArenaTerrain,m.tick);
 assert(!c.dismount);assert.equal(c.throttle,0);assert.equal(c.steer,0);
 m.dispose();
});
test('voluntary dismount is not mistaken for a knock-off',()=>{
 const m=setup(),a=m.actors[1],c=neutral(m.round);a.pose.footMode=2;a.pose.footStagger=0;
 assert.equal(recoverBotWheel(a,c,botWheelRecovery(),terrain,m.tick),false);m.dispose();
});

test('high-speed AI building impact knocks off and keeps the wheel outside solid geometry',()=>{
 const rider=new RideController(terrain,{spawn:{position:{x:75,y:0,z:15},headingY:0}});rider.combatOnFoot=true;
 let fell=false;
 for(let i=0;i<1200;i++){rider.step(1/120,{...NEUTRAL_ACTIONS,throttle:1,quickMount:true,stableAI:true});if(rider.poseValue.footMode===2){fell=true;break;}}
 assert(fell,'a direct building impact must visibly knock off the AI');assert(rider.poseValue.parkZ<53,'wheel remains outside the building');
});
test('ordinary AI wall contact stops safely without a knock-off',()=>{
 const rider=new RideController(terrain,{spawn:{position:{x:75,y:0,z:50},headingY:0}});rider.combatOnFoot=true;
 for(let i=0;i<420;i++){rider.step(1/120,{...NEUTRAL_ACTIONS,throttle:.4,quickMount:true,stableAI:true});assert.equal(rider.poseValue.footMode,0);assert(!rider.crashed);}
 assert(rider.poseValue.z<53,'low speed contact cannot pass through cover');
});
for(const engine of [false,true])test(`AI resumes pursuing after recovery (engine=${engine})`,()=>{
 const m=setup(engine),a=m.actors[1],human=m.actors[0];
 human.controller.reset({position:{x:0,y:0,z:50},headingY:0});human.pose={...human.controller.poseValue};
 a.controller.knockOff();a.pose={...a.controller.poseValue};let mounted=false,moving=false;
 for(let i=0;i<240;i++){m.step();mounted ||= !a.pose.footMode;moving ||= mounted&&a.pose.speed>1&&a.input.throttle>0;}
 assert(mounted&&moving,'recovered bot must actively pursue again');m.dispose();
});
test('AI stops at a navigation boundary without falling or crossing it',()=>{
 const rider=new RideController({sampleGround(_x,z,out){return Object.assign(out,{height:0,normal:{x:0,y:1,z:0},surface:'pavement',offCourse:z>.5});},raycast:()=>null,raycastObstacle:()=>null});rider.combatOnFoot=true;
 for(let i=0;i<600;i++){rider.step(1/120,{...NEUTRAL_ACTIONS,throttle:1,stableAI:true});assert.equal(rider.poseValue.footMode,0);assert(!rider.crashed);assert(rider.poseValue.z<=.5);}
});
test.after(()=>terrain.dispose());
