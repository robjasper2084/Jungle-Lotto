import test from 'node:test';
import assert from 'node:assert/strict';
import {CompanionGround} from '../src/companionGround.ts';
import {companionAnchor} from '../../../lottominded-ultra.io/games/gothtechnology2/belle-isle-source/game/src/belle/companionSafety.ts';
import type {GroundSample} from '../../../lottominded-ultra.io/games/gothtechnology2/belle-isle-source/game/runtime/ride-core/src/terrain.ts';

const sample=():GroundSample=>({height:0,normal:{x:0,y:1,z:0},surface:'pavement',offCourse:false});

test('island contact calls and shore waiting retain the original arguments and result',()=>{
  const references:unknown[]=[];
  const terrain={containsSwoop:()=>false,sampleGround(_x:number,_z:number,out:GroundSample,...reference:unknown[]){references.push(reference);out.height=2;return out;},land(_x:number,_z:number,...reference:unknown[]){references.push(reference);return true;},height(_x:number,_z:number,...reference:unknown[]){references.push(reference);return 2;}};
  const dog={x:10,y:8,z:20},contact=new CompanionGround(terrain,()=>dog),previous={x:10,z:20,headingY:0,speed:0},rider={x:14,y:30,z:26,headingY:1,speed:5};
  assert.deepEqual(contact.anchor(previous,rider),companionAnchor(previous,rider,true,2));
  contact.sampleGround(10,20,sample());contact.reset(()=>contact.sampleGround(10,20,sample()));
  assert.ok(references.every(args=>Array.isArray(args)&&args.length===0),'outside source, no reference argument is introduced');
});

test('explicit resets use the accepted anchor deck and restore live underpass contact afterward',()=>{
  const level=(reference?:number)=>reference!==undefined&&reference>=7.6?8:0;
  const terrain={containsSwoop:()=>true,sampleGround(_x:number,_z:number,out:GroundSample,reference?:number){out.height=level(reference);return out;},land:()=>true,height:(_x:number,_z:number,reference?:number)=>level(reference)};
  const dog={x:0,y:0,z:0},contact=new CompanionGround(terrain,()=>dog),previous={x:0,z:0,headingY:0,speed:0},rider={x:0,y:8,z:0,headingY:0,speed:0};
  assert.deepEqual(contact.anchor(previous,rider),{...previous},'upper deck is accepted as ground');
  assert.equal(contact.sampleGround(0,0,sample()).height,0,'ordinary lower-dog probes do not snap to the overhead rider');
  contact.reset(()=>assert.equal(contact.sampleGround(0,0,sample()).height,8));
  assert.equal(contact.sampleGround(0,0,sample()).height,0,'reset override must not leak');
  assert.throws(()=>contact.reset(()=>{throw Error('reset failed');}));
  assert.equal(contact.sampleGround(0,0,sample()).height,0,'failed reset also restores contact context');
});

test('existing distance regroup uses the relocated anchor height without changing local probes',()=>{
  const level=(reference?:number)=>reference!==undefined&&reference>=7.6?8:0;
  const terrain={containsSwoop:()=>true,sampleGround(_x:number,_z:number,out:GroundSample,reference?:number){out.height=level(reference);return out;},land:()=>true,height:(_x:number,_z:number,reference?:number)=>level(reference)};
  const dog={x:0,y:0,z:0},contact=new CompanionGround(terrain,()=>dog),previous={x:0,z:0,headingY:0,speed:0};
  contact.anchor(previous,{x:100,y:8,z:100,headingY:0,speed:0});
  assert.equal(contact.sampleGround(100,100,sample()).height,8);assert.equal(contact.sampleGround(0,0,sample()).height,0);
  Object.assign(dog,{x:100,y:8,z:100});assert.equal(contact.sampleGround(101,100,sample()).height,8);
});
