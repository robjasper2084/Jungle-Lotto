import test from 'node:test';import assert from 'node:assert/strict';import {readFile} from 'node:fs/promises';
import {initializeEngine} from '../src/engine/runtime.ts';import {ArenaTerrain} from '../src/royale/arena.ts';import {DowntownArena} from '../src/royale/downtownArena.ts';import {TagTerrain} from '../src/tag/fixture.ts';
import {RoyaleMatch,neutral,PROTECTION} from '../src/royale/rules.ts';import {initialSpawnNodes,recoveryNode,spawnCameraSpace} from '../src/royale/spawnNodes.ts';
import {loadHostFixture} from '../../love-tag-server/src/hostFixture.ts';import {fileURLToPath} from 'node:url';
await initializeEngine(await readFile(new URL('../src/engine/breadflower.wasm',import.meta.url)));
const terrain=await ArenaTerrain.create(),data=await loadHostFixture(process.env.ROYALE_FIXTURES??fileURLToPath(new URL('../../swoop-source/public/love-tag/',import.meta.url)),'swoop-detroit'),downtown=new DowntownArena(await TagTerrain.create(data.fixture,await data.physics()));
const advance=(m:RoyaleMatch,n:number)=>{for(let i=0;i<n;i++)m.step();};
function create(){const m=new RoyaleMatch(terrain,true,6,true,true);for(let i=0;i<6;i++)m.add('r'+i,'Rider '+i);m.start('reentry',7);advance(m,PROTECTION);return m;}
function place(m:RoyaleMatch,i:number,x:number,z:number){const a=m.actors[i];a.controller.reset({position:{x,y:terrain.ground(x,z).height,z},headingY:0});a.pose={...a.controller.poseValue};}
let seq=0;
function shot(m:RoyaleMatch,who='r0'){if(m.actors.find(a=>a.id===who)!.combat.magazine.static===0){m.command(who,{...neutral(m.round,++seq,m.tick),reload:true});advance(m,180);}m.command(who,{...neutral(m.round,++seq,m.tick),fire:true,shot:seq});advance(m,1);m.command(who,neutral(m.round,++seq,m.tick));advance(m,14);}
function kill(m:RoyaleMatch){place(m,0,0,0);place(m,1,0,7);for(let i=0;i<9&&m.actors[1].alive;i++)shot(m);assert.equal(m.actors[1].alive,false);}
test('actual downtown has 12+ clear clustered nodes and unique seeded six/ten starts',()=>{
 assert(downtown.spawnNodes.length>=12);assert.equal(new Set(downtown.spawnNodes.map(n=>n.id)).size,downtown.spawnNodes.length);
 for(const cluster of new Set(downtown.spawnNodes.map(n=>n.cluster))){const group=downtown.spawnNodes.filter(n=>n.cluster===cluster);assert(group.length>=3);for(const a of group){assert(downtown.clear(a.position.x,a.position.z,.8,a.position.y));for(const b of group)assert(Math.hypot(a.position.x-b.position.x,a.position.z-b.position.z)<=100);}}
 for(const count of [6,10]){const a=initialSpawnNodes(downtown.spawnNodes,count,1),b=initialSpawnNodes(downtown.spawnNodes,count,2);assert.equal(new Set(a.map(n=>n.id)).size,count);assert.notDeepEqual(a,b);}
 const m=new RoyaleMatch(downtown,true,10,true,true);for(let i=0;i<10;i++)m.add('p'+i,'Player');m.start('city',9);assert.equal(new Set(m.actors.map(a=>a.spawnNode)).size,10);m.dispose();
});
test('Chene starts and recovery sites leave room for the chase camera outside the canopy',()=>{
 assert.equal(spawnCameraSpace({x:-211,z:-1625}),false);assert.equal(spawnCameraSpace({x:-115,z:-1759}),true);
 for(const node of [...downtown.spawnNodes,...downtown.recoverySpawnNodes])assert(spawnCameraSpace(downtown.sourcePosition(node.position)),node.id+' is beneath the amphitheatre');
 const chene=downtown.spawnNodes.filter(n=>n.cluster==='chene');assert(chene.length>=3);
 for(const node of chene){const p=downtown.sourcePosition(node.position);assert(Math.hypot(p.x+115,p.z+1759)<120);}
});
test('safe recovery excludes eliminated/occupied nodes, danger zones and outside-field nodes',()=>{
 const nodes=downtown.spawnNodes,dead=nodes[0].position,field={...downtown.zones[0],radius:downtown.fieldRadii[0]};
 const live=nodes.slice(1,4).map(n=>n.position),node=recoveryNode(downtown,nodes,dead,nodes[0].id,live,field,8);assert(node);assert.notEqual(node.id,nodes[0].id);for(const p of live)assert(Math.hypot(node.position.x-p.x,node.position.z-p.z)>=90);
 assert.equal(recoveryNode(downtown,nodes,dead,nodes[0].id,nodes.map(n=>n.position),field,8),undefined);
});
test('compiled respawn protects for exactly 600 ticks and preserves count through host restore',()=>{
 seq=0;const m=create();kill(m);const old=m.actors[1].spawnNode;assert(m.snapshot('r1').self!.reentry.eligible);assert.equal(m.requestReentry('r1',true).ok,true);assert.notEqual(m.actors[1].spawnNode,old);assert.equal(m.actors[1].spawnSerial,1);assert.equal(m.actors[1].protectedUntil,m.tick+600);
 place(m,0,0,0);place(m,1,0,7);shot(m);assert.equal(m.actors[1].shield,50);assert.equal(m.actors[1].integrity,100);
 const b=new RoyaleMatch(terrain,true,6,true,true);b.restoreEngineState(m.captureEngineState());assert.equal(b.actors[1].reentryUsed,1);advance(m,599-(m.tick-(m.actors[1].protectedUntil-600)));advance(b,599-(b.tick-(b.actors[1].protectedUntil-600)));assert.deepEqual(b.captureEngineState(),m.captureEngineState());assert(m.actors[1].protectedUntil>m.tick);advance(m,1);assert.equal(m.actors[1].protectedUntil,m.tick);shot(m);assert(m.actors[1].shield<50);kill(m);assert.equal(m.requestReentry('r1',true).ok,true);assert.equal(m.snapshot('r1').self!.reentry.remaining,1);m.dispose();b.dispose();
});
test('combat immediately cancels protection; decline and expired prompts cannot respawn',()=>{
 seq=0;const m=create();kill(m);assert(m.requestReentry('r1',true).ok);m.command('r1',{...neutral(m.round,1,m.tick),fire:true,shot:1});advance(m,1);assert.equal(m.actors[1].protectedUntil,0);m.dispose();
 seq=0;const a=create();kill(a);assert(a.requestReentry('r1',false).ok);assert.equal(a.requestReentry('r1',true).ok,false);a.dispose();
 seq=0;const b=create();kill(b);advance(b,1800);assert.equal(b.requestReentry('r1',true).ok,false);b.dispose();
});
test('three selectable respawns consume one each, reject duplicates and fourth use, then reset on rematch',()=>{
 seq=0;const m=create();assert.equal(m.snapshot('r1').self!.reentry.remaining,3);
 for(let used=0;used<3;used++){
  if(used){m.command('r1',{...neutral(m.round,++seq,m.tick),fire:true,shot:seq});advance(m,1);}
  kill(m);const offers=m.snapshot('r1').self!.reentry.choices;assert(offers.length>0);const choice=offers.at(-1)!;
  assert.equal(m.requestReentry('r1',true,'unknown-location').ok,false);assert.equal(m.actors[1].reentryUsed,used);
  assert(m.requestReentry('r1',true,choice.id).ok);assert.equal(m.actors[1].spawnNode,choice.id);assert.equal(m.actors[1].spawnSerial,used+1);
  assert.equal(m.snapshot('r1').self!.reentry.remaining,2-used);assert.equal(m.requestReentry('r1',true,choice.id).ok,false);
  m.disconnect('r1');m.reconnect('r1');assert.equal(m.snapshot('r1').self!.reentry.remaining,2-used);
 }
 m.command('r1',{...neutral(m.round,++seq,m.tick),fire:true,shot:seq});advance(m,1);kill(m);
 assert.equal(m.snapshot('r1').self!.reentry.eligible,false);assert.equal(m.requestReentry('r1',true).ok,false);assert.equal(m.actors[1].reentryUsed,3);
 while(m.phase!=='results')m.step();m.start('rematch',8);assert.equal(m.snapshot('r1').self!.reentry.remaining,3);assert.equal(m.actors[1].spawnSerial,0);m.dispose();
});
test('a chosen point is revalidated and an occupied location selects the next safe point',()=>{
 seq=0;const m=create();kill(m);const choice=m.respawnChoices('r1')[0];assert(choice);const old={...m.actors[2].pose};
 place(m,2,choice.position.x,choice.position.z);assert(m.requestReentry('r1',true,choice.id).ok);assert.notEqual(m.actors[1].spawnNode,choice.id);assert.equal(m.snapshot('r1').self!.reentry.remaining,2);
 assert(Math.hypot(m.actors[1].pose.x-choice.position.x,m.actors[1].pose.z-choice.position.z)>=90);m.dispose();
});
test('occupied starting clusters leave supported downtown recovery points inside a closing field',()=>{
 const nodes=downtown.spawnNodes,dead=nodes[0].position,live=nodes.map(n=>n.position);
 for(const radius of [1525,1220,762.5,250]){
  const field={...downtown.zones[0],radius};
  assert.equal(recoveryNode(downtown,nodes,dead,nodes[0].id,live,field,8),undefined);
  const chosen=recoveryNode(downtown,[...nodes,...downtown.recoverySpawnNodes],dead,nodes[0].id,live,field,8);
  assert(chosen,`safe recovery at radius ${radius}`);assert(downtown.clear(chosen.position.x,chosen.position.z,.8,chosen.position.y));
  assert(Math.hypot(chosen.position.x-field.x,chosen.position.z-field.z)<radius-30);
  assert(live.every(p=>Math.hypot(p.x-chosen.position.x,p.z-chosen.position.z)>=90));
 }
});

test.after(()=>{terrain.dispose();downtown.terrain.dispose();});


test('confirmed killer identity survives event expiry and host restore, then clears on respawn',()=>{
 seq=0;const m=create();m.actors[0].name='Night Rider';kill(m);
 const death=m.snapshot('r1').self!.elimination;assert.equal(death?.killer?.id,'r0');assert.equal(death?.killer?.name,'Night Rider');assert.equal(death?.killer?.bot,false);assert.equal(death?.cause,'rider');
 assert.equal(m.snapshot('r0').self!.elimination,undefined);m.events=[];advance(m,12);assert.deepEqual(m.snapshot('r1').self!.elimination,death);
 const restored=new RoyaleMatch(terrain,true,6,true,true);restored.restoreEngineState(m.captureEngineState());assert.deepEqual(restored.snapshot('r1').self!.elimination,death);
 assert(m.requestReentry('r1',true).ok);assert.equal(m.snapshot('r1').self!.elimination,undefined);m.dispose();restored.dispose();
});
test('disconnect elimination does not invent a killer',()=>{
 const m=create();m.disconnect('r1');advance(m,1201);const death=m.snapshot('r1').self!.elimination;assert.equal(death?.cause,'disconnect');assert.equal(death?.killer,undefined);m.dispose();
});
