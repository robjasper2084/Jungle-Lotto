import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';
import {ElmwoodTerrain} from './elmwood-terrain.ts';import {rideCoreTerrain} from './ridecore-terrain.ts';
import {ElmwoodRun,laneGates} from './elmwood-gameplay.ts';import {elmwoodRaceRecovery} from './elmwood-race-recovery.ts';
const read=(n:string)=>JSON.parse(fs.readFileSync(new URL('../../public/elmwood/'+n,import.meta.url),'utf8'));
const site=read('site.json'),terrain=new ElmwoodTerrain(read('terrain.json'),site.features,read('placements.json'));await terrain.init();
const gates=laneGates(site.features.find((f:any)=>f.id==='59197492').points),map=rideCoreTerrain(terrain);
test('a missed gate recovery returns to the last earned checkpoint and preserves race progress',()=>{
 const run=new ElmwoodRun(gates);run.reset('sprint',gates[0]);run.gate=4;run.elapsed=82;run.score=300;run.splits=[20,40,60];
 run.relocate(gates.at(-1)!);const r=elmwoodRaceRecovery(run,map);assert(r);assert(Math.hypot(r.position.x-gates[3].x,r.position.z-gates[3].z)<3);
 run.relocate(r.position);run.update(.01,r.position,[]);assert.equal(run.gate,4);assert.equal(run.score,300);assert.deepEqual(run.splits,[20,40,60]);assert(run.elapsed>=82);assert.equal(run.finished,false);
});
test('blocked earned checkpoints do not teleport a racer through scenery',()=>{
 const run=new ElmwoodRun(gates);run.reset('sprint',gates[0]);assert.equal(elmwoodRaceRecovery(run,{...map,raycastObstacle:()=>0}),undefined);
 assert(elmwoodRaceRecovery(run,map));run.finished=true;assert.equal(elmwoodRaceRecovery(run,map),undefined);run.finished=false;run.mode='free';assert.equal(elmwoodRaceRecovery(run,map),undefined);
});


test('only competitive Elmwood modes carry three recoveries and a new run resets the stock',()=>{
 const run=new ElmwoodRun(gates);
 for(const mode of ['free','tour'] as const){run.reset(mode,gates[0]);assert.equal(run.limitedRecovery,false);}
 for(const mode of ['sprint','tricks'] as const){run.reset(mode,gates[0]);assert.equal(run.limitedRecovery,true);for(let i=0;i<3;i++)assert(run.recoveryStock.consume());assert.equal(run.recoveryStock.consume(),false);assert.equal(run.recoveryLabel,'0/3 recoveries');}
 run.reset('sprint',gates[0]);assert.equal(run.recoveryStock.remaining,3);
 const blocked=elmwoodRaceRecovery(run,{...map,raycastObstacle:()=>0});assert.equal(blocked,undefined);assert.equal(run.recoveryStock.remaining,3);
});
