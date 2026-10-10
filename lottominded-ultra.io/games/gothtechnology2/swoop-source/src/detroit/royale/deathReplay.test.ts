import test from 'node:test';import assert from 'node:assert/strict';import {DeathReplay} from './deathReplay.ts';import type {RoyaleSnapshot} from '../../../../ride-core/src/royale/rules.ts';
const camera={position:[0,1,2],quaternion:[0,0,0,1],fov:62};
test('death replay is bounded, preserves only received views and resets on re-entry',()=>{
 const r=new DeathReplay(),state={round:'a',tick:0,self:{alive:true,spawnSerial:0},actors:[{id:'visible'}],loot:[{id:'supply'}],results:[]} as unknown as RoyaleSnapshot;
 for(let i=0;i<100;i++){state.tick=i;r.observe(state,i*100,camera);}state.self!.alive=false;r.observe(state,10000,camera);assert(!r.available);r.observe(state,10600,camera);assert(r.available);r.start(20000);const f=r.sample(20000)!;assert(f.state.tick>=40);assert.deepEqual(f.state.actors,[{id:'visible'}]);assert.equal(f.state.loot.length,0);assert.equal(state.loot.length,1);assert(!r.sample(27001));assert(!r.playing);state.self!.spawnSerial=1;state.self!.alive=true;r.observe(state,28000,camera);assert(!r.available);
});
