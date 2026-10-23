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

test('rapid weapon changes and reversing a swap preserve the current hand pose',()=>{
 const swap=new WeaponSwap();swap.update(0,'static',false,false);
 const before=swap.update(.08,'heart',false,false);
 assert.deepEqual(swap.update(0,'bass',false,false),before);
 assert.deepEqual(swap.update(0,'static',false,false),before);
 const returning=swap.update(.02,'static',false,false);assert(returning.lower<before.lower&&returning.lower>0);
 swap.update(.1,'bass',false,false);const raising=swap.update(.04,'bass',false,false);
 assert.deepEqual(swap.update(0,'heart',false,false),raising);
 swap.reset();assert.deepEqual(swap.update(0,'heart',false,false),{weapon:'heart',lower:0});
});
test('weapon swap duration is stable at 30, 60 and 120 FPS without losing a frame at the mesh change',()=>{
 const results=[30,60,120].map(hz=>{const swap=new WeaponSwap();swap.update(0,'static',false,false);let pose;
  for(let n=0;n<hz/5;n++)pose=swap.update(1/hz,'heart',false,false);return pose!;});
 for(const p of results){assert.equal(p.weapon,'heart');assert(Math.abs(p.lower-results[0].lower)<1e-10);}
});
