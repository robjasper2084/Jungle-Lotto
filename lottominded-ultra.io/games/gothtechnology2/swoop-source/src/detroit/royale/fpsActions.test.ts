import test from 'node:test';
import assert from 'node:assert/strict';
import {WeaponSwap,reloadPose,FpsMotion} from './fpsMotion.ts';
import {initialCombat} from '../../../../ride-core/src/royale/rules.ts';
test('weapon swaps lower the old mesh before revealing the new mesh, then settle',()=>{
 const swap=new WeaponSwap();swap.update(0,'static',false,false);
 let p=swap.update(.05,'heart',false,false);assert.equal(p.weapon,'static');assert(p.lower>0);
 p=swap.update(.05,'heart',false,false);assert.equal(p.weapon,'static');assert(p.lower>.9);
 p=swap.update(.03,'heart',false,false);assert.equal(p.weapon,'heart');assert(p.lower>.9);
 for(let i=0;i<5;i++)p=swap.update(.05,'heart',false,false);assert.equal(p.lower,0);
 swap.update(.04,'bass',false,false);assert.deepEqual(swap.update(.01,'bass',true,false),{weapon:'bass',lower:0});
 assert.deepEqual(swap.update(.01,'static',false,true),{weapon:'static',lower:0});
});
test('reload hand choreography follows actual ammunition commit and reduced motion removes kick',()=>{
 const combat={...initialCombat(),reloadStart:100,reloadCommit:160,reloadEnd:190};
 assert.equal(reloadPose(combat,110).phase,'release');assert.equal(reloadPose(combat,130).phase,'replace');assert.equal(reloadPose(combat,150).phase,'insert');assert.equal(reloadPose(combat,160).phase,'readying');assert.equal(reloadPose(combat,190).lower,0);
 assert.equal(new FpsMotion().update(.016,'static',true,0,false,true,true,reloadPose(initialCombat(),0)).kick,0);
});
