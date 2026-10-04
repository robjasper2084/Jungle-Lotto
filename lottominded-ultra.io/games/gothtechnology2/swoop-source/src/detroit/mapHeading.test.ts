import {test} from 'node:test';
import assert from 'node:assert/strict';
import {compassReading,compassTicks,miniMapView} from './mapHeading.ts';
test('compass maps all quadrants and wraps through north',()=>{
 for(const [angle,bearing,direction] of [[0,0,'N'],[90,90,'E'],[180,180,'S'],[270,270,'W'],[-90,270,'W'],[719.9,0,'N']] as const){
  const value=compassReading(angle*Math.PI/180);assert.equal(value.bearing,bearing);assert.equal(value.direction,direction);
 }
 assert.equal(compassReading(NaN).direction,'N');
 const before=compassTicks(359*Math.PI/180).find(t=>t.label==='N')!;
 const after=compassTicks(Math.PI/180).find(t=>t.label==='N')!;
 assert.ok(before.position>50&&before.position<51);
 assert.ok(after.position<50&&after.position>49);
});
test('wide mini-map stays centred without stretching geographic distances',()=>{
 const v=miniMapView({x:42,y:80},300,1.6);
 assert.equal(v.w/v.h,1.6);assert.equal(v.x+v.w/2,42);assert.equal(v.y+v.h/2,80);
 assert.equal(480/v.w,300/v.h);
});
