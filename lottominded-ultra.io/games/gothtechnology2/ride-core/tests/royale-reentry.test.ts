import test from 'node:test';import assert from 'node:assert/strict';import {readFile} from 'node:fs/promises';
import {initializeEngine} from '../src/engine/runtime.ts';import {ArenaTerrain} from '../src/royale/arena.ts';import {DowntownArena} from '../src/royale/downtownArena.ts';import {TagTerrain} from '../src/tag/fixture.ts';
import {RoyaleMatch,neutral,PROTECTION} from '../src/royale/rules.ts';import {initialSpawnNodes,recoveryNode} from '../src/royale/spawnNodes.ts';
import {loadHostFixture} from '../../love-tag-server/dist/hostFixture.js';import {fileURLToPath} from 'node:url';
await initializeEngine(await readFile(new URL('../src/engine/breadflower.wasm',import.meta.url)));
const terrain=await ArenaTerrain.create(),data=await loadHostFixture(fileURLToPath(new URL('../../love-tag-server/fixtures/',import.meta.url)),'swoop-detroit'),downtown=new DowntownArena(await TagTerrain.create(data.fixture,await data.physics()));
const advance=(m:RoyaleMatch,n:number)=>{for(let i=0;i<n;i++)m.step();};
function create(){const m=new RoyaleMatch(terrain,true,6,true,true);for(let i=0;i<6;i++)m.add('r'+i,'Rider '+i);m.start('reentry',7);advance(m,PROTECTION);return m;}
function place(m:RoyaleMatch,i:number,x:number,z:number){const a=m.actors[i];a.controller.reset({position:{x,y:terrain.ground(x,z).height,z},headingY:0});a.pose={...a.controller.poseValue};}
let seq=0;
function shot(m:RoyaleMatch,who='r0'){m.command(who,{...neutral(m.round,++seq,m.tick),fire:true,shot:seq});advance(m,1);m.command(who,neutral(m.round,++seq,m.tick));advance(m,14);}
function kill(m:RoyaleMatch){place(m,0,0,0);place(m,1,0,7);for(let i=0;i<9&&m.actors[1].alive;i++)shot(m);assert.equal(m.actors[1].alive,false);}
test('actual downtown has 12+ clear clustered nodes and unique seeded six/ten starts',()=>{
 assert(downtown.spawnNodes.length>=12);assert.equal(new Set(downtown.spawnNodes.map(n=>n.id)).size,downtown.spawnNodes.length);
 for(const cluster of new Set(downtown.spawnNodes.map(n=>n.cluster))){const group=downtown.spawnNodes.filter(n=>n.cluster===cluster);assert(group.length>=3);for(const a of group){assert(downtown.clear(a.position.x,a.position.z,.8,a.position.y));for(const b of group)assert(Math.hypot(a.position.x-b.position.x,a.position.z-b.position.z)<=100);}}
 for(const count of [6,10]){const a=initialSpawnNodes(downtown.spawnNodes,count,1),b=initialSpawnNodes(downtown.spawnNodes,count,2);assert.equal(new Set(a.map(n=>n.id)).size,count);assert.notDeepEqual(a,b);}
 const m=new RoyaleMatch(downtown,true,10,true,true);for(let i=0;i<10;i++)m.add('p'+i,'Player');m.start('city',9);assert.equal(new Set(m.actors.map(a=>a.spawnNode)).size,10);m.dispose();
});
test('safe recovery excludes eliminated/occupied nodes, danger zones and outside-field nodes',()=>{
 const nodes=downtown.spawnNodes,dead=nodes[0].position,field={...downtown.zones[0],radius:downtown.fieldRadii[0]};
 const live=nodes.slice(1,4).map(n=>n.position),node=recoveryNode(downtown,nodes,dead,nodes[0].id,live,field,8);assert(node);assert.notEqual(node.id,nodes[0].id);for(const p of live)assert(Math.hypot(node.position.x-p.x,node.position.z-p.z)>=90);
 assert.equal(recoveryNode(downtown,nodes,dead,nodes[0].id,nodes.map(n=>n.position),field,8),undefined);
});
test('compiled single re-entry protects for exactly 600 ticks and preserves use through host restore',()=>{
 seq=0;const m=create();kill(m);const old=m.actors[1].spawnNode;assert(m.snapshot('r1').self!.reentry.eligible);assert.equal(m.requestReentry('r1',true).ok,true);assert.notEqual(m.actors[1].spawnNode,old);assert.equal(m.actors[1].spawnSerial,1);assert.equal(m.actors[1].protectedUntil,m.tick+600);
 place(m,0,0,0);place(m,1,0,7);shot(m);assert.equal(m.actors[1].shield,50);assert.equal(m.actors[1].integrity,100);
 const b=new RoyaleMatch(terrain,true,6,true,true);b.restoreEngineState(m.captureEngineState());assert.equal(b.actors[1].reentryUsed,true);advance(m,599-(m.tick-(m.actors[1].protectedUntil-600)));advance(b,599-(b.tick-(b.actors[1].protectedUntil-600)));assert.deepEqual(b.captureEngineState(),m.captureEngineState());assert(m.actors[1].protectedUntil>m.tick);advance(m,1);assert.equal(m.actors[1].protectedUntil,m.tick);shot(m);assert(m.actors[1].shield<50);kill(m);assert.equal(m.requestReentry('r1',true).ok,false);m.dispose();b.dispose();
});
test('combat immediately cancels protection; decline and expired prompts cannot respawn',()=>{
 seq=0;const m=create();kill(m);assert(m.requestReentry('r1',true).ok);m.command('r1',{...neutral(m.round,1,m.tick),fire:true,shot:1});advance(m,1);assert.equal(m.actors[1].protectedUntil,0);m.dispose();
 seq=0;const a=create();kill(a);assert(a.requestReentry('r1',false).ok);assert.equal(a.requestReentry('r1',true).ok,false);a.dispose();
 seq=0;const b=create();kill(b);advance(b,1800);assert.equal(b.requestReentry('r1',true).ok,false);b.dispose();
});
test.after(()=>{terrain.dispose();downtown.terrain.dispose();});
