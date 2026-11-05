import test from 'node:test';import assert from 'node:assert/strict';import {readFile} from 'node:fs/promises';
import {initializeEngine} from '../src/engine/runtime.ts';import {DowntownArena} from '../src/royale/downtownArena.ts';import {TagTerrain} from '../src/tag/fixture.ts';
import {loadHostFixture} from '../../love-tag-server/src/hostFixture.ts';import {fileURLToPath} from 'node:url';
import {RoyaleSession} from '../src/royaleClient.ts';import {neutral,PROTECTION,DEADLINE} from '../src/royale/rules.ts';
await initializeEngine(await readFile(new URL('../src/engine/breadflower.wasm',import.meta.url)));
test('compiled downtown ten-rider session runs all three rounds, re-entry, spectating and a clean rematch',async t=>{
 const data=await loadHostFixture(process.env.ROYALE_FIXTURES??fileURLToPath(new URL('../../swoop-source/public/love-tag/',import.meta.url)),'swoop-detroit');
 const terrain=new DowntownArena(await TagTerrain.create(data.fixture,await data.physics())),session=new RoyaleSession(terrain);const rounds:unknown[]=[];
 try{
  session.offline('DS_Armored_Rider_01','euc',10,true,9);
  let respawned=false,watched=false;
  for(let round=1;round<=3;round++){
   if(round>1)session.start();const match=session.match!;
   assert.equal(session.state!.series.number,round);assert.equal(session.state!.phase,'deployment');
   assert.equal(session.state!.self!.integrity,100);assert.equal(session.state!.self!.reentry.remaining,3);
   let steps=0,eliminated=false,restoredAt=-1,restoredPosition:{x:number;z:number}|undefined;
   while(session.state!.phase!=='results'&&steps++<PROTECTION+DEADLINE+2){
    const self=session.state!.self!;
    if(!self.alive)eliminated=true;
    if(!respawned&&self.reentry.eligible&&self.reentry.choices.length){
     const serial=self.spawnSerial;session.requestReentry(true,self.reentry.choices[0].id);
     const restored=session.state!.self!;assert(restored.alive);assert.equal(restored.integrity,100);assert.equal(restored.shield,50);assert.equal(restored.spawnSerial,serial+1);assert.equal(restored.reentry.remaining,2);assert.equal(restored.reentry.protectedUntil,match.tick+600);
     const actor=match.actors.find(a=>a.id===session.me)!;restoredPosition={x:actor.pose.x,z:actor.pose.z};restoredAt=match.tick;respawned=true;
    }else if(respawned&&!self.alive&&self.reentry.eligible)session.requestReentry(false);
    const watch=session.state!.spectating;
    if(watch?.choices.length){const target=watch.choices.at(-1)!;session.watch(target);assert.equal(session.state!.spectating?.target,target);assert(session.state!.spectating!.tick!<=session.state!.tick-180);watched=true;}
    const moving=restoredAt>=0&&match.tick-restoredAt<60;
    session.step({...neutral(match.round),throttle:moving?1:0,fire:moving&&match.tick===restoredAt+1});
    if(restoredPosition&&match.tick===restoredAt+60){const actor=match.actors.find(a=>a.id===session.me)!;assert(Math.hypot(actor.pose.x-restoredPosition.x,actor.pose.z-restoredPosition.z)>.5,'accepted movement after respawn');assert(actor.shots>0,'accepted fire after respawn');assert.equal(actor.lastSeq,session.seq);}
   }
   assert.equal(session.state!.phase,'results');assert.equal(session.state!.series.complete,round===3);assert.equal(match.series.completed.length,round);assert.equal(match.projectiles.length,0);
   rounds.push({round,ticks:match.tick,remaining:session.state!.remaining,eliminated,reason:session.state!.reason});
   t.diagnostic(JSON.stringify(rounds.at(-1)));
  }
  assert(respawned,'natural AI/field elimination offered a usable re-entry');assert(watched,'delayed spectating reached a living rider');
  session.start();assert.equal(session.state!.series.number,1);assert.equal(session.state!.series.complete,false);assert.equal(session.match!.series.completed.length,0);assert.equal(session.state!.self!.integrity,100);assert.equal(session.state!.self!.reentry.remaining,3);assert.equal(session.state!.self!.spawnSerial,0);assert.equal(session.seq,0);assert.equal(session.shot,0);
 }finally{session.leave();terrain.terrain.dispose();}
});
