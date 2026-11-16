import test from 'node:test';
import assert from 'node:assert/strict';
import {shoreStyle,shorePatch,stoneHSL,stoneCharacter} from './shorePhotoPolicy.ts';
test('photographed river banks retain broken clustered rock distribution',()=>{
 const locations=[[0,0],[258,517],[1035,-78],[3216,876]];
 for(const [x,z] of locations){
  const a=shoreStyle(x,z,'natural-riprap'),b=shoreStyle(x,z,'wooded-bank');
  assert.deepEqual(a,shoreStyle(x,z,'natural-riprap'));
  assert(a.rockChance>.4&&a.rockChance<=1);
  assert(b.rockChance<a.rockChance);
  assert(b.driftwoodChance>a.driftwoodChance);
  assert(a.maxRadius>b.maxRadius);
  assert(shorePatch(x,z)>=0&&shorePatch(x,z)<=1);
 }
});
test('public swim beaches and built-up edges remain unblocked',()=>{
 for(const zone of ['swim-beach','formal-edge'] as const){
  const p=shoreStyle(1735,410,zone);
  assert.equal(p.rockChance,0);
  assert.equal(p.maxStones,0);
  assert.equal(p.driftwoodChance,0);
 }
 assert(shoreStyle(90,174,'bridge-approach').minStones>=3);
});
test('dry limestone and wet water-worn boulders use muted physical palette',()=>{
 assert.equal(stoneCharacter(.2,false),'light-limestone');
 assert.equal(stoneCharacter(.2,true),'river-worn-dark');
 for(const rock of ['light-limestone','mottled-gray','river-worn-dark'] as const){
  const c=stoneHSL(rock,.5);
  assert(c.every(Number.isFinite)&&c.every(x=>x>=0&&x<=.8));
 }
 assert(stoneHSL('light-limestone',.5)[2]>stoneHSL('river-worn-dark',.5)[2]);
});
