import {test} from 'node:test';
import assert from 'node:assert/strict';
import {RideCore,HUMAN_PROFILE,MASCOT_PROFILE,RideController,NEUTRAL_ACTIONS,createPose,type TerrainSampler} from '../src/index.ts';
const flat:TerrainSampler={sampleGround(_x,_z,o){o.height=0;o.normal={x:0,y:1,z:0};o.surface='pavement';o.offCourse=false;return o;},raycast:()=>null,raycastObstacle:()=>null};

test('portable frame adapter preserves exact source mechanics at 30, 60 and 144 FPS',()=>{
 const direct=new RideController(flat),expected=createPose();
 for(const input of [{throttle:1},{throttle:.5,steer:.35},{throttle:-1}])for(let i=0;i<240;i++)direct.step(1/120,{...NEUTRAL_ACTIONS,...input});
 direct.writePose(expected);
 for(const fps of [30,60,144]){
  const core=new RideCore(flat);
  for(const input of [{throttle:1},{throttle:.5,steer:.35},{throttle:-1}])for(let i=0;i<fps*2;i++)core.advance(1/fps,input);
  assert.deepEqual(core.current,expected,`${fps} FPS drifted from original controller`);
 }
});
test('short trick press survives frames smaller than a physics step; holding does not repeat',()=>{
 const core=new RideCore(flat);let total=0;
 core.advance(1/480,{trick:5});core.advance(1/480);core.advance(1/240);
 assert.equal(core.controller.tricks.id,5);
 for(let i=0;i<600;i++)for(const e of core.advance(1/60).events)if(e.type==='trick')total+=e.points;
 assert.equal(total,240);
 core.reset();total=0;
 for(let i=0;i<600;i++)for(const e of core.advance(1/60,{trick:5}).events)if(e.type==='trick')total+=e.points;
 assert.equal(total,240);
});
test('human stops with one foot down; mascot stops remain on both pedals',()=>{
 const core=new RideCore(flat,{profile:HUMAN_PROFILE});for(let i=0;i<60;i++)core.advance(1/60);
 assert.ok(core.current.stopFoot>.97);core.setProfile(MASCOT_PROFILE);
 assert.equal(core.current.stopFoot,0);assert.equal(core.renderPose.stopFoot,0);assert.equal(core.snapshot().oneFootStop,0);
 for(let i=0;i<60;i++)core.advance(1/60);assert.equal(core.current.stopFoot,0);assert.equal(core.controller.wheelScale,.75);
});
test('long inactive frames are bounded, reset clears queued actions and terrain controls spawn height',()=>{
 const terrace:TerrainSampler={...flat,sampleGround(x,z,o){flat.sampleGround(x,z,o);o.height=3;return o;}};
 const core=new RideCore(terrace);assert.equal(core.current.y,3);
 const result=core.advance(8);assert.equal(result.steps,30);assert.equal(result.droppedSeconds,7.75);
 core.advance(1/480,{trick:5});core.reset({position:{x:4,y:0,z:8},headingY:.2});core.advance(1/60);
 assert.equal(core.controller.tricks.active,false);assert.equal(core.current.x,4);assert.equal(core.current.z,8);assert.equal(core.current.y,3);
 for(const dt of [-1,NaN,Infinity])assert.throws(()=>core.advance(dt),RangeError);
 assert.throws(()=>core.setProfile({...HUMAN_PROFILE,wheelScale:0}),RangeError);
});
