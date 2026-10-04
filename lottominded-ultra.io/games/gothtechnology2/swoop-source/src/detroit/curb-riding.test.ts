import {test} from 'node:test';
import assert from 'node:assert/strict';
import {RideController,NEUTRAL_ACTIONS,createPose} from './controller.ts';
import {FollowCamera} from './followCamera.ts';
import type {TerrainSampler} from './terrain.ts';

function terrain(height:(z:number)=>number):TerrainSampler{
  return {sampleGround(_x,z,out){out.height=height(z);out.surface='pavement';out.offCourse=false;Object.assign(out.normal,{x:0,y:1,z:0});return out;},raycast:()=>null,raycastObstacle:()=>null};
}
test('repeated curb crossings stay grounded without false jumps or camera impulses',()=>{
  for(const hz of [60,120,240])for(const throttle of [.3,1]){
    const ground=terrain(z=>z>=5&&z<5.5||z>=9&&z<12?.15:0);
    const sim=new RideController(ground,{spawn:{position:{x:0,y:0,z:0},headingY:0}}),p=createPose(),camera=new FollowCamera(ground);
    sim.writePose(p);camera.reset(p);let previousEye=camera.eye.y,maxEyeStep=0;
    for(let i=0;i<hz*6;i++){
      sim.step(1/hz,{...NEUTRAL_ACTIONS,throttle});sim.writePose(p);camera.step(1/hz,p);
      assert.equal(sim.snapshot().grounded,true,`curb must not launch the wheel at ${hz} Hz, z=${p.z}`);
      assert.ok(Math.abs(p.y-ground.sampleGround(p.x,p.z,{height:0,normal:{x:0,y:1,z:0},surface:'pavement',offCourse:false}).height)<1e-6);
      maxEyeStep=Math.max(maxEyeStep,Math.abs(camera.eye.y-previousEye));previousEye=camera.eye.y;
    }
    assert.ok(p.z>12,'crossed both raised slabs');assert.equal(sim.snapshot().landings,0);assert.equal(sim.crashed,false);
    assert.ok(maxEyeStep<.06,`camera movement is continuous at ${hz} Hz: ${maxEyeStep}`);
  }
});
test('a real ledge still enters flight and a requested hop still launches',()=>{
  const sim=new RideController(terrain(z=>z<5?1:0),{spawn:{position:{x:0,y:1,z:0},headingY:0}});
  let airborne=false;
  for(let i=0;i<600;i++){sim.step(1/120,{...NEUTRAL_ACTIONS,throttle:.5});if(!sim.snapshot().grounded)airborne=true;}
  assert.ok(airborne,'one metre ledge retains gravity');assert.ok(sim.snapshot().landings>0);
  const hop=new RideController(terrain(()=>.15));hop.step(1/120,{...NEUTRAL_ACTIONS,hop:true});
  for(let i=0;i<30;i++)hop.step(1/120,NEUTRAL_ACTIONS);
  assert.equal(hop.snapshot().hops,1);assert.equal(hop.snapshot().grounded,false);
});
