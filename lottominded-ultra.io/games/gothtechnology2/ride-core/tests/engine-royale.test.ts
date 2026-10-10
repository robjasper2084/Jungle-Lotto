import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {initializeEngine,EngineContext,ENGINE_ID} from '../src/engine/runtime.ts';
import {routeBattleInput} from '../src/engine/royaleKernel.ts';
import {ArenaTerrain,currentHandshake,compatible,ground} from '../src/royale/arena.ts';
import {RoyaleMatch,neutral,PROTECTION,DEADLINE} from '../src/royale/rules.ts';
const bytes=await readFile(new URL('../src/engine/breadflower.wasm',import.meta.url));
await initializeEngine(bytes);
const terrain=await ArenaTerrain.create();
function full(bots=false){const m=new RoyaleMatch(terrain);for(let i=0;i<6;i++)m.add('r'+i,'Rider '+i,bots);m.start('engine-test',1);return m;}
function place(m:RoyaleMatch,i:number,x:number,z:number,headingY=0){const a=m.actors[i];a.controller.reset({position:{x,y:ground(x,z).height,z},headingY});a.pose={...a.controller.poseValue};}
function advance(m:RoyaleMatch,n:number){for(let i=0;i<n;i++)m.step();}
test('hash failure is rejected; each instance/slot and aim channel is independent',async()=>{
 await assert.rejects(initializeEngine(new Uint8Array([1,2,3])),/hash/);
 const a=new EngineContext(),b=new EngineContext();
 const c=routeBattleInput(a,0,{...neutral('x'),steer:.5,throttle:-.5,aimYaw:1,aimPitch:-.2,fire:true,hop:true,shot:1});
 assert.equal(c.steer,.5);assert.equal(c.throttle,-.5);assert(Math.abs(c.aimYaw-1)<1e-6);assert.equal(c.hop,true);assert.equal(b.get(0,0),0);
 const before=a.capture();assert.throws(()=>a.frame(0,[[3,1],[64,1]]));assert.throws(()=>a.frame(.5,[[3,1]]));assert.throws(()=>a.frame(0,[[3,NaN]]));assert.deepEqual(a.capture(),before);
 a.clear();assert.equal(a.get(0,8),0);a.dispose();assert.throws(()=>a.get(0,0));b.dispose();
});
test('handshake includes real module hash and rejects legacy/mismatched modules',()=>{
 assert.equal(currentHandshake().protocol,3);assert(compatible(currentHandshake()));
 assert(!compatible({...currentHandshake(),module:'wrong'}));assert(!compatible({...currentHandshake(),engine:'legacy'}));
});
test('actual RideCore movement consumes compiled input and engine rules own shield damage',()=>{
 const m=full();place(m,0,0,0);place(m,1,0,7,Math.PI);advance(m,PROTECTION);
 assert(m.command('r0',{...neutral(m.round,1,m.tick),fire:true,shot:1}));
 advance(m,15);assert.equal(m.actors[0].ammo.static,79);assert.equal(m.actors[1].shield,30);
 assert.equal(m.snapshot('r0').engine?.module,ENGINE_ID.module);assert(m.snapshot('r0').engineInputFrames>=6*255);
 assert(m.command('r0',{...neutral(m.round,2,m.tick),throttle:1,steer:.3}));advance(m,15);assert(m.actors[0].pose.speed>0);
 m.dispose();
});
test('real collision cover blocks full projectile segments',()=>{
 const m=full();advance(m,PROTECTION);place(m,0,28,5);place(m,1,28,39);
 m.command('r0',{...neutral(m.round,1,m.tick),fire:true,shot:1});advance(m,45);
 assert.equal(m.actors[1].shield,50);assert.equal(m.actors[0].ammo.static,79);m.dispose();
});
test('host snapshot restores engine, hidden controller, queues and bot brain exactly',()=>{
 const a=full(true);advance(a,340);const saved=a.captureEngineState(),b=full();b.restoreEngineState(saved);
 advance(a,180);advance(b,180);assert.deepEqual(b.captureEngineState(),a.captureEngineState());
 a.dispose();b.dispose();
});
test('reconnect preserves gear and damage; input spoof/flood rejected before engine',()=>{
 const m=full();place(m,0,0,0);place(m,1,0,7,Math.PI);advance(m,PROTECTION);
 m.command('r0',{...neutral(m.round,1,m.tick),fire:true,shot:1});advance(m,15);
 const hp=m.actors[1].shield,ammo=m.actors[0].ammo.static;m.disconnect('r1');advance(m,15);m.reconnect('r1');
 assert.equal(m.actors[1].shield,hp);assert.equal(m.actors[0].ammo.static,ammo);
 assert(!m.command('r0',{...neutral(m.round,2,m.tick),health:999}));assert(!m.command('r0',{...neutral(m.round,2,m.tick),throttle:Infinity}));
 m.disconnect('r1');advance(m,1202);assert.equal(m.actors[1].alive,false);m.reconnect('r1');assert.equal(m.actors[1].alive,false);m.dispose();
});
test('rejected whole snapshots leave the live simulation and compiled context intact',()=>{
 const m=full(true);advance(m,300);const before=m.captureEngineState();
 const badRules=structuredClone(before);badRules.rules[0]=99;
 assert.throws(()=>m.restoreEngineState(badRules),/restore/);assert.deepEqual(m.captureEngineState(),before);
 const duplicate=structuredClone(before);duplicate.actors[1].host.id=duplicate.actors[0].host.id;
 assert.throws(()=>m.restoreEngineState(duplicate),/COMBATANTS/);assert.deepEqual(m.captureEngineState(),before);
 m.step();assert.equal(m.tick,301);m.dispose();
});
test('engine offline six AI complete a round, results freeze, rematch clears rule state',()=>{
 const m=full(true);let frames=0;while(m.phase!=='results'&&frames++<PROTECTION+DEADLINE+1)m.step();
 assert.equal(m.phase,'results');assert(m.actors.every(a=>a.distance>30));assert(m.actors.filter(a=>a.alive).length<=1);
 assert(m.actors.filter(a=>a.shots>0).length>=2,'bots must reach combat and fire, not only expire in the field');
 assert(m.actors.some(a=>a.damage>0&&a.hits>0),'bot combat must land authoritative hits');
 const final=m.captureEngineState();advance(m,60);assert.deepEqual(m.captureEngineState(),final);
 m.start('next',3);assert.equal(m.tick,0);assert(m.actors.every(a=>a.alive&&a.ammo.static===80));assert.equal(m.projectiles.length,0);m.dispose();
});
test('compiled field visits every phase and enforces a final-center draw at the deadline',()=>{
 const m=full();for(let i=0;i<6;i++)place(m,i,-12,0);
 const phases=new Set<number>();let radius=320;
 while(m.phase!=='results'&&m.tick<PROTECTION+DEADLINE){m.step();const field=m.snapshot('r0').field;phases.add(field.phase);assert(field.radius<=radius);radius=field.radius;}
 assert.deepEqual([...phases],[0,1,2,3,4]);assert.equal(m.tick,PROTECTION+DEADLINE);
 assert.equal(m.phase,'results');assert.equal(m.winner,null);assert.equal(m.reason,'Static Field deadline');
 assert(m.actors.every(a=>!a.alive));m.dispose();
});
test.after(()=>terrain.dispose());

