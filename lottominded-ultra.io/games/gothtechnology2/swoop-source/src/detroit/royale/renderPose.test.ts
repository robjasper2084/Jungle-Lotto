import test from 'node:test';
import assert from 'node:assert/strict';
import {createPose} from '../../../../ride-core/src/controller.ts';
import {interpolateRenderPose,previousRenderPose} from './renderPose.ts';

test('60 Hz movement is evenly sampled on faster and uneven display callbacks',()=>{
 const velocity=12,step=1/60;
 for(const rate of [60,90,120,144]){
  let lastX=0,lastTime=0;
  for(let frame=2;frame<rate*2;frame++){
   const time=frame/rate+(frame%2?.0004:0),tick=Math.floor(time/step),alpha=time/step-tick;
   const previous={...createPose(),x:(tick-1)*step*velocity},current={...previous,x:tick*step*velocity};
   const rendered=interpolateRenderPose(previous,current,alpha);
   assert(Math.abs(rendered.x-(time-step)*velocity)<1e-9);
   if(lastTime)assert(Math.abs((rendered.x-lastX)/(time-lastTime)-velocity)<1e-7);
   lastTime=time;lastX=rendered.x;
  }
 }
});

test('wraparound heading and foot phase stay continuous without mutating simulation',()=>{
 const previous={...createPose(),headingY:Math.PI-.02,footMode:2,footBlend:1,footPhase:.99,footCycle:.99};
 const current={...previous,x:1,headingY:-Math.PI+.02,footPhase:.01,footCycle:1.01};
 const saved=structuredClone(current),out=interpolateRenderPose(previous,current,.5);
 assert(Math.abs(out.headingY-Math.PI)<1e-9);
 assert(out.footPhase<.001||out.footPhase>.999);assert.equal(out.footCycle,1);
 assert.equal(out.x,.5);assert.deepEqual(current,saved);assert.notEqual(out,current);
});

test('re-entry, elimination, teleports and mount transitions do not slide through terrain',()=>{
 const a={id:'rider',pose:createPose(),spawnSerial:0,alive:true};
 assert.equal(previousRenderPose(a,{...a,spawnSerial:1}),undefined);
 assert.equal(previousRenderPose(a,{...a,alive:false}),undefined);
 assert.equal(previousRenderPose(a,{...a,id:'other'}),undefined);
 assert.equal(previousRenderPose(a,{...a}),a.pose);
 for(const current of [{...a.pose,x:100},{...a.pose,footMode:2,parkX:4},{...a.pose,footMode:3}]){
  assert.deepEqual(interpolateRenderPose(a.pose,current,.1),current);
 }
 assert.deepEqual(interpolateRenderPose(undefined,a.pose,.1),a.pose);
 assert.equal(interpolateRenderPose(a.pose,{...a.pose,x:1},NaN).x,1);
});
