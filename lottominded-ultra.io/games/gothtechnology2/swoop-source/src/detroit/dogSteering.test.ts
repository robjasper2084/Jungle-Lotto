import {test} from 'node:test';
import assert from 'node:assert/strict';
import {dogSteering,wrapDogAngle} from './dogSteering.ts';
import {DogFollower} from './companion.ts';
import {createPose} from './controller.ts';
import type {TerrainSampler} from './terrain.ts';
const flat:TerrainSampler={sampleGround(_x,_z,o){o.height=0;o.offCourse=false;Object.assign(o.normal,{x:0,y:1,z:0});return o;},raycast:()=>null,raycastObstacle:()=>null};

test('a fast 90 degree turn brakes into an arc with bounded angular acceleration',()=>{
 for(const hz of [30,60,120]){
  let heading=0,speed=7.5,rate=0,minSpeed=speed;
  for(let f=0;f<hz*3;f++){
   const p=dogSteering(heading,speed,rate,Math.PI/2,7.5,1/hz);
   assert.ok(Math.abs(p.turnRate-rate)<=7/hz+1e-8,'instant swivel');
   assert.ok(Math.abs(p.heading-heading)<=2.6/hz+1e-8,'unbounded turn rate');
   heading=p.heading;rate=p.turnRate;speed=p.speed;minSpeed=Math.min(minSpeed,speed);
  }
  assert.ok(minSpeed<5,'dog must slow before a tight corner');assert.ok(Math.abs(wrapDogAngle(heading-Math.PI/2))<.01);
 }
});
test('turning beside a stationary rider advances the paws and comes to rest',()=>{
 const h=createPose(),dog=new DogFollower(flat);dog.reset(h);h.headingY=.9;
 let stepping=0;
 for(let f=0;f<1200;f++){
  const before={...dog.current};dog.step(1/120,h);const p=dog.current;
  if(Math.abs(p.heading-before.heading)>.0001){assert.ok(p.phase>before.phase);assert.ok((p.gaitSpeed??0)>.01);stepping++;}
  const dx=p.x-before.x,dz=p.z-before.z;
  assert.ok(Math.abs(dx*Math.cos(p.heading)-dz*Math.sin(p.heading))<1e-7,'sideways slide');
 }
 assert.ok(stepping>20);assert.ok(Math.abs(wrapDogAngle(dog.current.heading-h.headingY))<.02);assert.equal(dog.current.speed,0);
});
test('pose interpolation preserves the slow-turn gait and look-ahead channels',()=>{
 const h=createPose(),dog=new DogFollower(flat);dog.reset(h);h.headingY=1;
 for(let i=0;i<30;i++)dog.step(1/120,h);
 const sampled={x:0,y:0,z:0,heading:0,pitch:0,roll:0,speed:0,phase:0,time:0,turnRate:0};
 const p=dog.sample(.5,sampled);assert.ok((p.gaitSpeed??0)>.05);assert.ok(Math.abs(p.lookYaw??0)>.01);
});
