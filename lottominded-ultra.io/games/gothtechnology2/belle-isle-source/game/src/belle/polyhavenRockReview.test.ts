import test from 'node:test';
import assert from 'node:assert/strict';
import {BoxGeometry,IcosahedronGeometry} from 'three';
import {fitRockReviewGeometry} from './polyhavenRockReview.ts';

test('rock art fits existing registered boulder radius and height without changing source geometry',()=>{
 const source=new BoxGeometry(4,8,3);source.translate(5,8,-4);source.computeBoundingBox();
 const before=source.boundingBox!.clone(),result=fitRockReviewGeometry(source);
 assert.deepEqual(source.boundingBox,before);
 const p=result.getAttribute('position');
 for(let i=0;i<p.count;i++){
  assert(Math.hypot(p.getX(i),p.getZ(i))<=.780001);
  assert(p.getY(i)>=-.320001&&p.getY(i)<=.660001);
 }
 assert(Math.abs(result.boundingBox!.min.y+.32)<1e-5);
 assert(Math.abs(result.boundingBox!.max.y-.66)<1e-5);
});
test('excessive mesh density is rejected instead of loading a full scan',()=>{
 assert.throws(()=>fitRockReviewGeometry(new IcosahedronGeometry(1,10)),/triangle budget/);
});
