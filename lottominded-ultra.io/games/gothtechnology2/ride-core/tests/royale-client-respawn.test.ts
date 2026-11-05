import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {initializeEngine} from '../src/engine/runtime.ts';
import {ArenaTerrain} from '../src/royale/arena.ts';
import {neutral,PROTECTION} from '../src/royale/rules.ts';
import {RoyaleSession} from '../src/royaleClient.ts';

await initializeEngine(await readFile(new URL('../src/engine/breadflower.wasm',import.meta.url)));
test('waiting at the respawn prompt does not lock out movement or shooting on the next life',async()=>{
 const terrain=await ArenaTerrain.create(),session=new RoyaleSession(terrain);
 try{
  session.offline('DS_Armored_Rider_01','euc',6,false,1);
  const match=session.match!,victim=match.actors[0],attacker=match.actors[1];attacker.bot=false;
  const step=(n:number,fire=false)=>{for(let i=0;i<n;i++)session.step({...neutral(match.round),throttle:1,fire});};
  step(PROTECTION);
  for(const [actor,z]of [[victim,7],[attacker,0]] as const){actor.controller.reset({position:{x:0,y:0,z},headingY:0});actor.pose={...actor.controller.poseValue};}
  let seq=0;
  for(let i=0;i<10&&victim.alive;i++){
   match.command(attacker.id,{...neutral(match.round,++seq,match.tick),fire:true,shot:seq});
   session.step(neutral(match.round));
   match.command(attacker.id,neutral(match.round,++seq,match.tick));
   for(let n=0;n<14;n++)session.step(neutral(match.round));
  }
  assert.equal(session.state!.self!.alive,false);
  const before={seq:session.seq,shot:session.shot,tick:match.tick};step(360,true);
  assert.equal(match.tick,before.tick+360,'the offline match must keep advancing');
  assert.equal(session.seq,before.seq,'dead input must not outrun the accepted sequence');
  assert.equal(session.shot,before.shot,'dead fire must not spend shot numbers');
  session.requestReentry(true);assert.equal(session.state!.self!.alive,true);
  const spawn={...victim.pose};step(60);
  assert.equal(victim.lastSeq,session.seq,'post-respawn commands are accepted');
  assert(Math.hypot(victim.pose.x-spawn.x,victim.pose.z-spawn.z)>.5,'rider moves after respawn');
  const shots=victim.shots;session.step({...neutral(match.round),fire:true});
  assert(victim.shots>shots,'rider fires after respawn');
 }finally{session.leave();terrain.dispose();}
});

test('guest recovery prediction uses authoritative health and waits for legal remount',async()=>{
 const terrain=await ArenaTerrain.create(),session=new RoyaleSession(terrain);
 let match:NonNullable<RoyaleSession['match']>|undefined;
 try{
  session.offline('DS_Armored_Rider_01','euc',6,false,1);match=session.match!;
  const rider=match.actors[0];rider.controller.reset({position:{x:0,y:0,z:0},headingY:0});rider.controller.combatOnFoot=true;rider.controller.knockOff();
  for(let i=0;i<240;i++)rider.controller.step(1/120,{throttle:0,steer:0,hop:false,hopHeld:false,crouch:false,reset:false,trick:0});
  rider.pose={...rider.controller.poseValue};assert.equal(rider.pose.footMode,2);
  // Use a transport sink to exercise snapshot reconciliation and guest input,
  // without joining a public room or claiming a real-network test.
  session.match=undefined;session.room={send(){},leave(){}} as any;
  rider.integrity=10;(session as any).accept(match.snapshot(session.me));
  session.step({...neutral(match.round),recover:true});
  assert.equal(session.prediction!.controller.poseValue.footMode,2,'critical health must not show a false pickup on the guest');
  session.pending=[];rider.integrity=100;(session as any).accept(match.snapshot(session.me));
  session.step({...neutral(match.round),recover:true});
  assert.equal(session.prediction!.controller.poseValue.footMode,3,'healthy guest can predict the same legal pickup as the host');
 }finally{session.leave();match?.dispose();terrain.dispose();}
});
