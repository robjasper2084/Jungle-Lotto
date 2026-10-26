import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {initializeEngine} from '../src/engine/runtime.ts';
import {ArenaTerrain} from '../src/royale/arena.ts';
import {RoyaleMatch,PROTECTION,neutral} from '../src/royale/rules.ts';
import {botWheelRecovery,recoverBotWheel} from '../src/royale/botWheelRecovery.ts';
import {WHEEL_PICKUP_TOTAL} from '../src/wheelPickupTiming.ts';
import {RideController,NEUTRAL_ACTIONS} from '../src/controller.ts';
import {playerHitBot,playerCollidesWithBot} from '../src/royale/botKnockoff.ts';
import {angle,clamp} from '../src/rideDynamics.ts';
await initializeEngine(await readFile(new URL('../src/engine/breadflower.wasm',import.meta.url)));
const terrain=await ArenaTerrain.create();
function setup(engine=true,world=terrain){
 const m=new RoyaleMatch(world,engine);m.add('human','Human');m.add('bot','AI',true);m.start('recovery',1);
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
 assert(pickupAt&&mountedAt);assert(mountedAt-start>=120&&mountedAt-start<216,'full fall and get-up play before the prompt pickup, within 3.6 seconds');
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
 const blocked=Object.assign(Object.create(terrain),{line:()=>false,raycastObstacle:()=>0,route:()=>[]}) as ArenaTerrain;
 for(let i=0;i<120;i++){c=neutral(m.round);recoverBotWheel(a,c,s,blocked,m.tick+i);assert(!c.dismount&&!c.recover,'an obstructed wheel must not hold either pickup input');assert.equal(c.throttle,0);assert.equal(c.steer,0);}
 m.dispose();
});
test('voluntary dismount is not mistaken for a knock-off',()=>{
 const m=setup(),a=m.actors[1],c=neutral(m.round);a.pose.footMode=2;a.pose.footStagger=0;
 assert.equal(recoverBotWheel(a,c,botWheelRecovery(),terrain,m.tick),false);m.dispose();
});

test('a pickup rejected beside a wall walks to a safe side and remounts without a held-button stall',()=>{
 const world=Object.create(terrain) as ArenaTerrain;
 // The wheel is just far enough from this wall for a short sight ray to pass,
 // but a direct pickup's endpoint/body margin must reject the approach.
 world.sampleGround=(_x,_z,out)=>Object.assign(out,{height:0,normal:{x:0,y:1,z:0},surface:'pavement',offCourse:false});
 world.raycastObstacle=(o,d,max,radius=0)=>{if(d.z>=0)return null;const hit=(-.4+radius-o.z)/d.z;return hit>=0&&hit<=max?hit:null;};
 const controller=new RideController(world,{spawn:{position:{x:0,y:0,z:1},headingY:0}});controller.combatOnFoot=true;
 const saved=controller.captureState();Object.assign(saved.fields.walking,{mode:2,latch:true,stagger:0});Object.assign(saved.fields.pose,{footMode:2,footBlend:1,parkX:0,parkY:0,parkZ:0});controller.restoreState(saved);
 const m=setup(false),a=m.actors[1];a.controller=controller;a.pose={...controller.poseValue};
 const state=botWheelRecovery();state.returning=true;let mounted=false,movedSideways=false,pickup=false,maxStep=0;
 for(let i=0;i<420;i++){
  a.pose={...controller.poseValue};const before={x:a.pose.x,z:a.pose.z},c=neutral(m.round);recoverBotWheel(a,c,state,world,1800+i);
  if(!i){assert(!c.recover&&!c.dismount,'blocked direct pickup must become a walking approach');assert(Math.hypot(c.throttle,c.steer)>.5);}
  const input={...NEUTRAL_ACTIONS,quickMount:true,stableAI:true,recover:c.recover,dismount:c.dismount,throttle:c.throttle,steer:c.steer,facingYaw:c.facingYaw??undefined};controller.step(1/120,input);controller.step(1/120,input);
  const p=controller.poseValue;maxStep=Math.max(maxStep,Math.hypot(p.x-before.x,p.z-before.z));movedSideways ||= Math.abs(p.x)>.2;pickup ||= p.footMode===3;
  assert(p.z>=-.13,'body must stay outside the wall');assert.deepEqual([p.parkX,p.parkY,p.parkZ],[0,0,0],'parked wheel must not be moved');
  if(!p.footMode){mounted=true;break;}
 }
 assert(movedSideways&&pickup&&mounted,'safe-side approach must finish ordinary pickup/remount');assert(maxStep<.2,`recovery step ${maxStep} exceeds the ordinary brisk pickup`);m.dispose();
});

test('even a high-speed AI building impact stops mounted outside solid geometry',()=>{
 const rider=new RideController(terrain,{spawn:{position:{x:75,y:0,z:15},headingY:0}});rider.combatOnFoot=true;
 for(let i=0;i<1200;i++){rider.step(1/120,{...NEUTRAL_ACTIONS,throttle:1,quickMount:true,stableAI:true});assert.equal(rider.poseValue.footMode,0);assert(!rider.crashed);}
 assert(rider.poseValue.z<53,'wheel remains outside the building');
});

test('the player still falls from a high-speed building impact',()=>{
 const rider=new RideController(terrain,{spawn:{position:{x:75,y:0,z:15},headingY:0}});rider.combatOnFoot=true;
 for(let i=0;i<1200&&!rider.poseValue.footMode;i++)rider.step(1/120,{...NEUTRAL_ACTIONS,throttle:1});
 assert.equal(rider.poseValue.footMode,2);
});

for(const engine of [false,true])test(`a confirmed player shot knocks a living bot off (engine=${engine})`,()=>{
 const m=setup(engine),[human,bot]=m.actors;
 human.controller.reset({position:{x:0,y:0,z:0},headingY:0});human.pose={...human.controller.poseValue};
 bot.controller.reset({position:{x:0,y:0,z:7},headingY:0});bot.pose={...bot.controller.poseValue};
 assert(m.command(human.id,{...neutral(m.round,human.lastSeq+1,m.tick),fire:true,shot:1}));
 for(let i=0;i<5;i++)m.step();
 assert(human.hits>0);assert(bot.alive);assert.equal(bot.pose.footMode,2);assert(bot.pose.footStagger>0);m.dispose();
});

test('only a player hit knocks off bots; protection and an existing recovery are respected',()=>{
 const m=setup(),[human,bot]=m.actors;
 assert.equal(playerHitBot({...human,bot:true},bot,m.tick),false);
 bot.protectedUntil=m.tick+1;assert.equal(playerHitBot(human,bot,m.tick),false);bot.protectedUntil=0;
 assert(playerHitBot(human,bot,m.tick));const after={...bot.pose};
 assert.equal(playerHitBot(human,bot,m.tick),false);assert.deepEqual(bot.pose,after);m.dispose();
});

test('swept player impacts catch fast crossings, but reject scenery, brushes and separate floors',()=>{
 const m=setup(),[human,bot]=m.actors;
 human.pose={...human.pose,x:0,y:0,z:1};bot.pose={...bot.pose,x:0,y:0,z:0};
 const before={...human.pose,z:-1},botBefore={...bot.pose};
 assert(playerCollidesWithBot(human,bot,before,botBefore,terrain,1/60));
 assert(!playerCollidesWithBot({...human,bot:true},bot,before,botBefore,terrain,1/60));
 assert(!playerCollidesWithBot(human,bot,{...before,z:.99},botBefore,terrain,1/60));
 assert(!playerCollidesWithBot({...human,pose:{...human.pose,y:3}},bot,{...before,y:3},botBefore,terrain,1/60));
 assert(!playerCollidesWithBot(human,bot,before,botBefore,{...terrain,line:()=>false} as unknown as ArenaTerrain,1/60));
 m.dispose();
});

for(const engine of [false,true])test(`the match applies a player wheel impact to a parked bot and the bot recovers (engine=${engine})`,()=>{
 // Keep the target parked so this contact/recovery regression is independent
 // of tactical route choice; normal moving pursuit is covered below.
 const world=Object.create(terrain) as ArenaTerrain;world.route=from=>[{...from}];
 const m=setup(engine,world),[human,bot]=m.actors;
 human.controller.reset({position:{x:0,y:0,z:0},headingY:0});human.pose={...human.controller.poseValue};
 bot.controller.reset({position:{x:0,y:0,z:4},headingY:0});bot.pose={...bot.controller.poseValue};
 let hit=false;
 for(let i=0;i<360&&!hit;i++){
  // Navigation may now take a different lane: deliberately intercept the real
  // moving bot instead of assuming it stays on the player's initial heading.
  const yaw=Math.atan2(bot.pose.x-human.pose.x,bot.pose.z-human.pose.z);
  assert(m.command(human.id,{...neutral(m.round,human.lastSeq+1,m.tick),throttle:1,steer:clamp(-angle(yaw-human.pose.headingY)*2,-1,1)}));m.step();
  hit=m.events.some(e=>e.kind==='player-knockoff'&&e.actor===human.id&&e.target===bot.id);
 }
 assert(hit,'host must turn a real player impact into a bot knock-off');assert.equal(bot.pose.footMode,2);
 m.release(human.id);for(let i=0;i<360;i++)m.step();assert.equal(bot.pose.footMode,0);m.dispose();
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
