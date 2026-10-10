import test from 'node:test';import assert from 'node:assert/strict';import {readFile} from 'node:fs/promises';
import {initializeEngine} from '../src/engine/runtime.ts';import {ArenaTerrain} from '../src/royale/arena.ts';import {RoyaleMatch,neutral,PROTECTION} from '../src/royale/rules.ts';import {createBattleDog} from '../src/royale/dogPower.ts';
await initializeEngine(await readFile(new URL('../src/engine/breadflower.wasm',import.meta.url)));const terrain=await ArenaTerrain.create();
function match(size:6|10=10){const m=new RoyaleMatch(terrain,true,size);for(let i=0;i<size;i++)m.add('r'+i,'Rider '+i);m.start('ten-dog',1);return m;}
const step=(m:RoyaleMatch,n:number)=>{for(let i=0;i<n;i++)m.step();};
const place=(m:RoyaleMatch,i:number,x:number,z:number)=>{const a=m.actors[i];a.controller.reset({position:{x,y:terrain.ground(x,z).height,z},headingY:0});a.pose={...a.controller.poseValue};a.dog=createBattleDog(a.pose);};
test('compiled ten-player roster accepts ten unique actors, rejects eleven and restores the whole match',()=>{
 const a=match();assert.equal(a.snapshot('r9').size,10);assert.equal(a.snapshot('r9').roster.length,10);assert.throws(()=>a.add('eleven','Eleven'));step(a,15);const b=new RoyaleMatch(terrain,true,10);b.restoreEngineState(a.captureEngineState());step(a,12);step(b,12);assert.deepEqual(a.captureEngineState(),b.captureEngineState());a.dispose();b.dispose();
});
test('compiled projectile resolution accepts the tenth actor and keeps damage authoritative',()=>{const m=match();place(m,0,0,0);place(m,9,0,7);step(m,PROTECTION);m.command('r0',{...neutral(m.round,1,m.tick),fire:true,shot:1});step(m,30);assert.equal(m.actors[9].shield,30);assert.equal(m.actors[0].ammo.static,79);assert.equal(m.actors[0].hits,1);m.dispose();});
test('a collected dog power-up scans temporarily, chases in world space and knocks off exactly one rider',()=>{
 const m=match();place(m,0,0,0);place(m,1,0,12);step(m,PROTECTION);const k=(m as any).kernel; // Trusted host test injects a real collectible before a separate fresh round.
 m.dispose();const a=match();place(a,0,0,0);place(a,1,0,12);const kernel=(a as any).kernel;kernel.core.checked('loot',0,6,0,0,0);a.loot[0].kind='dog';a.loot[0].p={x:0,y:0,z:0};step(a,PROTECTION+1);assert.equal(a.actors[0].dogPower.charges,1);
 assert(a.command('r0',{...neutral(a.round,1,a.tick),dogRadar:true}));step(a,1);assert(a.snapshot('r0').self!.radar.some(p=>p.id==='r1'));assert.equal(a.actors[0].dogPower.charges,1);
 assert(a.command('r0',{...neutral(a.round,2,a.tick),dogAttack:true}));step(a,1);assert.equal(a.actors[0].dogPower.charges,0);
 let maxStep=0,last={...a.actors[0].dog};for(let i=0;i<240;i++){a.step();const d=a.actors[0].dog;maxStep=Math.max(maxStep,Math.hypot(d.x-last.x,d.z-last.z));last={...d};}
 assert(a.actors[1].controller.crashed,'actual controller must leave riding balance');assert.equal(a.actors[1].shield,25);assert.equal(a.actors[0].hits,1);assert(maxStep<1.25,'dog must not teleport');assert.equal(a.snapshot('r0').self!.radar.length,0,'scan expires');assert(!a.command('r0',{...neutral(a.round,3,a.tick),dogTarget:'r2'}));a.dispose();void k;
});
test('dog contact and radar cannot be forged without a charge or pass through solid cover',()=>{
 const m=match();place(m,0,-105,-75);place(m,1,-45,-75);step(m,PROTECTION);m.command('r0',{...neutral(m.round,1,m.tick),dogAttack:true,dogRadar:true});step(m,150);assert.equal(m.actors[0].dogPower.until,0);assert.equal(m.actors[0].hits,0);assert.equal(m.snapshot('r0').self!.radar.length,0);assert.equal(m.actors[1].controller.crashed,false);m.dispose();
 const a=match();place(a,0,-105,-75);place(a,1,-45,-75);const kernel=(a as any).kernel;kernel.core.checked('loot',0,6,-105,0,-75);a.loot[0].kind='dog';a.loot[0].p={x:-105,y:0,z:-75};step(a,PROTECTION+1);a.command('r0',{...neutral(a.round,1,a.tick),dogAttack:true});step(a,300);assert.equal(a.actors[1].shield,50);assert.equal(a.actors[0].hits,0,'the dog cannot select or knock through a building');a.dispose();
});
