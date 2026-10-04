import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createPose,NaturalMotionEngine} from '@digital-static/ridecore';
import {FollowCamera} from './riding/followCamera.ts';
import {riderMotion} from './riding/riderMotion.ts';
import {CyclistMotion,RiderCadence} from './riding/cyclistMotion.ts';
import {ElmwoodRun} from './elmwood-gameplay.ts';
import {createGroundSample,type TerrainSampler} from '@digital-static/ridecore';
const flat:TerrainSampler={sampleGround(_x,_z,out){return Object.assign(out,createGroundSample());},raycast:()=>null,raycastObstacle:()=>null};
test('Elmwood RideCore poses remain finite and anticipate turns with the new body adapter',()=>{
 const anticipate=(yaw:number)=>{const p={...createPose(),speed:10,rollAngle:.3,riderLookYaw:yaw},engine=new NaturalMotionEngine();for(let i=0;i<30;i++)engine.step(1/120,p,0);return riderMotion(p);};
 const m=anticipate(.5);
 for(const value of Object.values(m))if(typeof value==='number')assert.ok(Number.isFinite(value));
 assert.ok(m.headYaw>anticipate(0).headYaw);
});
test('Elmwood calm chase camera retains terrain clearance without roll or dynamic zoom',()=>{
 const p={...createPose(),speed:15,yawRate:.5,rollAngle:.3,velocityZ:15},camera=new FollowCamera(flat);camera.calm=true;camera.reset(p);
 for(let i=0;i<360;i++)camera.step(1/120,p);
 assert.equal(camera.fov,55);assert.equal(camera.roll,0);assert.ok(camera.eye.y>.35);assert.ok(camera.target.x>.1);
});
test('Elmwood cyclists coast, brake and plant a foot; distant detail is throttled',()=>{
 const m=new CyclistMotion(2);for(let i=0;i<120;i++)m.step(1/60,{x:0,y:0,z:i/12,headingY:0,speed:5});
 const wheel=m.pose.wheelSpin;for(let i=0;i<180;i++)m.step(1/60,{x:0,y:0,z:10,headingY:0,speed:0});
 assert.ok(m.pose.stopFoot>.99);assert.ok(m.pose.wheelSpin>=wheel);const c=new RiderCadence();let far=0;for(let i=0;i<600;i++)far+=+c.due(0,1/60,80);assert.ok(far>=99&&far<=102);
});
test('Elmwood split feedback uses actual checkpoints and does not award skipped gates',()=>{
 const r=new ElmwoodRun([{x:0,z:0},{x:0,z:20},{x:0,z:40}]);r.reset('sprint',{x:0,z:0});r.referenceSplits=[10,20];
 r.update(1,{x:0,z:35},[]);assert.equal(r.splits.length,0);assert.equal(r.score,0);
 r.relocate({x:0,z:15});r.update(1,{x:0,z:18},[]);assert.deepEqual(r.splits,[2]);assert.match(r.message,/8.00 s ahead/);
 r.update(1,{x:0,z:18},[],true);assert.equal(r.splits.length,1);assert.equal(r.score,100);
 r.reset('sprint',{x:0,z:0});assert.deepEqual(r.splits,[]);
});
