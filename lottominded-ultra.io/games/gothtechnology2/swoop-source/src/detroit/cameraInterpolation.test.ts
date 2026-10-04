import test from 'node:test';import assert from 'node:assert/strict';import {FollowCamera} from './followCamera.ts';import {createPose} from './controller.ts';import {createGroundSample,type TerrainSampler} from './terrain.ts';
const flat:TerrainSampler={sampleGround(_x,_z,out){return Object.assign(out,createGroundSample());},raycast:()=>null,raycastObstacle:()=>null};
test('render camera tracks the same fractional simulation frame as the rider through a turn',()=>{
 const p=createPose(),f=new FollowCamera(flat);f.reset(p);const before={eye:{...f.eye},target:{...f.target},fov:f.fov,roll:f.roll};
 p.speed=9;p.x=.1;p.z=.1;p.headingY=.3;p.yawRate=1;p.velocityX=3;p.velocityZ=8;f.step(1/120,p);
 const current={eye:{...f.eye},target:{...f.target},fov:f.fov,roll:f.roll},mid=f.sample(.5);
 for(const k of ['x','y','z'] as const){assert.equal(mid.eye[k],(before.eye[k]+current.eye[k])/2);assert.equal(mid.target[k],(before.target[k]+current.target[k])/2);}
 assert.equal(f.sample(1).eye.x,current.eye.x);assert.equal(f.sample(0).eye.x,before.eye.x);
});
test('recovery resets camera history and does not interpolate across a teleport',()=>{
 const p=createPose(),f=new FollowCamera(flat);f.reset(p);p.x=150;p.z=-80;f.reset(p);const frame=f.sample(0);assert.equal(frame.eye.x,f.eye.x);assert.equal(frame.target.z,-80);
});
