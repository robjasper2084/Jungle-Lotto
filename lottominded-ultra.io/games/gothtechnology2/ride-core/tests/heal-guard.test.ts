import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {initializeEngine} from '../src/engine/runtime.ts';
import {ArenaTerrain,ground} from '../src/royale/arena.ts';
import {RoyaleMatch,neutral,PROTECTION} from '../src/royale/rules.ts';
await initializeEngine(await readFile(new URL('../src/engine/breadflower.wasm',import.meta.url)));
const terrain=await ArenaTerrain.create();
for(const engine of [false,true])test(`${engine?'compiled authority':'fallback'} preserves full-health packs and still heals real damage`,()=>{
 const m=new RoyaleMatch(terrain,engine,6);for(let i=0;i<6;i++)m.add('r'+i,'Rider '+i);m.start('heal',1);
 const place=(i:number,x:number,z:number)=>{const a=m.actors[i];a.controller.reset({position:{x,y:ground(x,z).height,z},headingY:0});a.pose={...a.controller.poseValue};};
 place(0,0,0);place(1,0,7);for(let i=2;i<6;i++)place(i,-80-i*7,0);
 const step=(n:number)=>{for(let j=0;j<n;j++)m.step();};step(PROTECTION);
 let seq=0;m.command('r1',{...neutral(m.round,++seq,m.tick),repair:true});step(1);
 assert.equal(m.actors[1].integrity,100);assert.equal(m.actors[1].repairs,1);assert.equal(m.actors[1].repairUntil,0);
 // Real projectiles exhaust shield and injure health in both rule engines.
 for(let shot=1;shot<=4;shot++){m.command('r0',{...neutral(m.round,shot,m.tick),fire:true,shot});step(30);}
 m.command('r0',neutral(m.round,5,m.tick));step(30);
 const injured=m.actors[1].integrity;assert(injured<100&&injured>0,'must exercise damaged-health authority');
 m.command('r1',{...neutral(m.round,++seq,m.tick),repair:true});step(1);
 assert.equal(m.actors[1].repairs,0);assert(m.actors[1].repairUntil>m.tick);
 step(181);assert.equal(m.actors[1].integrity,Math.min(100,injured+35));assert.equal(m.actors[1].repairUntil,0);m.dispose();
});
test.after(()=>terrain.dispose());
