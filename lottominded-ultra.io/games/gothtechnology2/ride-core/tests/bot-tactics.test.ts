import {test} from 'node:test';import assert from 'node:assert/strict';
import {tacticalDestination,leadTarget} from '../src/royale/botTactics.ts';
import type {BattleTerrain} from '../src/royale/battleTerrain.ts';
const terrain={ground:()=>({height:0}),clear:()=>true,line:()=>true} as unknown as BattleTerrain;
test('the shrinking field outranks combat and loot',()=>{const r=tacticalDestination(terrain,{x:95,y:0,z:0},{x:0,z:0,radius:100},{x:100,y:0,z:0},undefined,true,[{x:96,y:0,z:0}],0,400);assert.equal(r.mode,'rotate');assert.equal(r.point.x,0);});
test('hurt riders select reachable cover which blocks the visible opponent',()=>{
 const world={...terrain,line:(a:{x:number},b:{x:number})=>a.x===20?b.x>=-5:true} as BattleTerrain;
 const r=tacticalDestination(world,{x:0,y:0,z:0},{x:0,z:0,radius:100},{x:20,y:0,z:0},undefined,true,[],0,400);assert.equal(r.mode,'cover');assert(r.point.x<-5);
});
test('supplies are sought only while unseen, while memory searches a fixed last seen location',()=>{
 const p={x:0,y:0,z:0},f={x:0,z:0,radius:100},supply={x:8,y:0,z:4};assert.equal(tacticalDestination(terrain,p,f,undefined,undefined,false,[supply],0,400).mode,'resupply');
 const memory={x:20,y:0,z:8};assert.deepEqual(tacticalDestination(terrain,p,f,undefined,memory,false,[],0,400),{point:memory,mode:'search'});
});
test('projectile leading accounts for transverse movement and gravity',()=>{const q=leadTarget({x:0,y:0,z:0},{x:0,y:0,z:90},{x:10,z:0},180,9.81);assert.equal(q.x,5);assert.equal(q.z,90);assert(Math.abs(q.y-1.22625)<1e-6);});
