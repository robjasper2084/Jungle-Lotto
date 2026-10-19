import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {initializeEngine} from '../src/engine/runtime.ts';
import {ArenaTerrain} from '../src/royale/arena.ts';
import {RoyaleMatch,neutral,PROTECTION} from '../src/royale/rules.ts';
import {traceBallistic} from '../src/royale/ballisticSweep.ts';
await initializeEngine(await readFile(new URL('../src/engine/breadflower.wasm',import.meta.url)));
test('authoritative bullet collision produces a surface-aligned wall mark and hides it from anonymous viewers',async()=>{
 const terrain=await ArenaTerrain.create(),m=new RoyaleMatch(terrain,true);m.add('me','You');m.add('other','Other');m.start('wall',1);
 for(let i=0;i<PROTECTION;i++)m.step();const a=m.actors[0];a.controller.reset({position:{x:28,y:0,z:5},headingY:0});a.pose={...a.controller.poseValue};
 m.command(a.id,{...neutral(m.round,1,m.tick),fire:true,shot:1});for(let i=0;i<20;i++)m.step();
 const mark=m.snapshot(a.id).impacts[0];assert(mark);assert(Math.abs(mark.p.z-21.5)<.002);assert(mark.normal.z<-.99);assert(mark.p.y>1);assert.equal(m.snapshot('anonymous').impacts.length,0);
 m.dispose();terrain.dispose();
});
test('actor hits do not stamp a wall beyond the target',()=>{let marked=false;const result=traceBallistic(t=>({x:0,y:1,z:t*180}),.04,[{id:7,previous:{x:0,y:0,z:1},current:{x:0,y:0,z:1},alive:true}],()=>null,()=>({height:0}),()=>{marked=true;});assert.equal(result,7);assert(!marked);});
