import {test} from 'node:test';
import assert from 'node:assert/strict';
import {RidePractice} from '../src/ridePractice.ts';
const pose={x:0,z:0,speed:3,headingY:0,airHeight:0,crashBlend:0,crashRecovery:0};
test('a bicycle learns coasting instead of jumping, then explicit camera and recovery',()=>{
 const lesson=new RidePractice(true);lesson.stepIndex=3;
 for(let i=0;i<6;i++)lesson.observe({...pose,x:i*.5},true,false,false);
 assert.equal(lesson.stepIndex,3);
 for(let i=6;i<12;i++)lesson.observe({...pose,x:i*.5},true,false,true);
 assert.equal(lesson.stepIndex,4);lesson.action('recover');assert.equal(lesson.stepIndex,4);
 lesson.action('camera');lesson.action('recover');assert.equal(lesson.complete,true);
});
test('recovering during takeoff cannot award a stale landing',()=>{
 const lesson=new RidePractice();lesson.stepIndex=3;lesson.observe(pose,true,false);
 lesson.observe({...pose,airHeight:.4},false,false);lesson.action('recover');lesson.observe(pose,true,true);
 assert.equal(lesson.stepIndex,3);
});
