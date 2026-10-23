import test from 'node:test';
import assert from 'node:assert/strict';
import {Quaternion,Vector3} from 'three';
import {sampleKimodoWalk,kimodoWalkFoot,KIMODO_WALK} from '../src/kimodoWalk.ts';

test('approved Kimodo loop is periodic and keeps valid directions and orientations',()=>{
 assert.equal(KIMODO_WALK.sourceSha256,'c6a834ebd97b06da059ba295481043d0b662eda09742d56546b7a836c53221ce');
 assert.deepEqual(sampleKimodoWalk(0),sampleKimodoWalk(1));
 assert.deepEqual(sampleKimodoWalk(-.25),sampleKimodoWalk(.75));
 for(let i=0;i<160;i++){
  const row=sampleKimodoWalk(i/160);assert(row.every(Number.isFinite));
  for(const offset of [0,3,6,9,12,15,18,21,38,41])assert(Math.abs(new Vector3().fromArray(row,offset).length()-1)<1e-6);
  for(const offset of [30,34,47])assert(Math.abs(new Quaternion().fromArray(row,offset).length()-1)<1e-6);
  for(const side of [0,1]){const foot=kimodoWalkFoot(row,side,.85);assert(foot.lift>=0&&foot.lift<.3);}
 }
 const before=sampleKimodoWalk(1-1e-5),after=sampleKimodoWalk(1e-5);
 assert(Math.max(...before.map((v,k)=>Math.abs(v-after[k])))<.002,'walking loop has a visible seam');
});

test('approved arm clearance stays relaxed and scales foot reach without changing phase',()=>{
 for(let i=0;i<80;i++){
  const row=sampleKimodoWalk(i/80);
  for(const side of [0,1]){
   const offset=12+side*6,direction=new Vector3().fromArray(row,offset),spread=Math.abs(Math.asin(direction.x));
   assert(spread>.12&&spread<.5,'arm is pinned against torso or spread too wide');
   const adult=kimodoWalkFoot(row,side,.9),small=kimodoWalkFoot(row,side,.45);
   assert(Math.abs(adult.z-small.z*2)<1e-8);assert(Math.abs(adult.lift-small.lift*2)<1e-8);assert.equal(adult.pitch,small.pitch);
  }
 }
});
