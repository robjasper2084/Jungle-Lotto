import {test} from 'node:test';
import assert from 'node:assert/strict';
import {DogFollower,DOG_MAX_SPEED} from './companion.ts';
import {createPose} from './controller.ts';
import type {TerrainSampler} from './terrain.ts';
const flat:TerrainSampler={sampleGround(_x,_z,out){out.height=0;out.normal={x:0,y:1,z:0};return out;},raycast:()=>null,raycastObstacle:()=>null};

test('the dog responds promptly to a normal riding start without snapping or exceeding its running limit',()=>{
 for(const hz of [30,60,120]){
  const hero=createPose(),dog=new DogFollower(flat);dog.reset(hero);hero.speed=6;
  let maxGap=0,previousSpeed=0;
  for(let i=0;i<hz*3;i++){
   hero.z+=hero.speed/hz;dog.step(1/hz,hero);
   maxGap=Math.max(maxGap,hero.z-dog.current.z);
   assert.ok(dog.current.speed<=DOG_MAX_SPEED+.001);
   assert.ok(dog.current.speed-previousSpeed<=10/hz,'smooth bounded acceleration');
   previousSpeed=dog.current.speed;
   if(i===hz-1)assert.ok(hero.z-dog.current.z<1.9,'within two metres after the first second');
  }
  assert.ok(maxGap<2.2,'a normal start does not leave the dog far behind');
  assert.ok(Math.abs(hero.z-dog.current.z)<.35,'back alongside within three seconds');
 }
});

test('a fast rider leaves the dog behind without speed matching or distance teleports',()=>{
 const h=createPose(),dog=new DogFollower(flat);dog.reset(h);h.speed=18;let previousZ=dog.current.z;
 for(let i=0;i<2400;i++){h.z+=18/120;dog.step(1/120,h);assert.ok(dog.current.speed<=DOG_MAX_SPEED+.001);assert.ok(dog.current.z-previousZ<=DOG_MAX_SPEED/120+.001);previousZ=dog.current.z;}
 assert.ok(h.z-dog.current.z>180);
 h.speed=0;for(let i=0;i<7200;i++)dog.step(1/120,h);
 assert.ok(Math.hypot(dog.current.x-h.x,dog.current.z-h.z)<1.5,'dog catches up when the rider waits');
});

test('the dog follows a left turn with its body facing the curve',()=>{
 const h=createPose(),dog=new DogFollower(flat);dog.reset(h);h.speed=3;
 for(let i=0;i<720;i++){if(i>240)h.headingY-=.5/120;h.x+=Math.sin(h.headingY)*3/120;h.z+=Math.cos(h.headingY)*3/120;dog.step(1/120,h);}
 assert.ok(dog.current.x< -5);assert.ok(Math.sin(dog.current.heading)<-.7);assert.ok(Math.hypot(dog.current.x-h.x,dog.current.z-h.z)<2.5);
});
test('the Boerboel keeps pace alongside a 3.2 km ride and comes to a complete stop',()=>{
  const hero=createPose(),dog=new DogFollower(flat);dog.reset(hero);hero.speed=6.67;
  for(let i=0;i<57600;i++){hero.z+=hero.speed/120;dog.step(1/120,hero);}
  assert.ok(Math.abs(dog.current.x-1.3)<.03);
  assert.ok(Math.abs(dog.current.z-hero.z)<.4);
  assert.ok(dog.current.speed>6.5&&dog.current.phase>100);
  hero.speed=0;for(let i=0;i<1200;i++)dog.step(1/120,hero);
  assert.equal(dog.current.speed,0);assert.ok(Math.hypot(dog.current.x-hero.x,dog.current.z-hero.z)<1.5);
});
test('reverse riding turns the dog to face its actual direction of travel',()=>{
  const h=createPose(),dog=new DogFollower(flat);dog.reset(h);h.speed=-2;
  for(let i=0;i<600;i++){h.z-=2/120;dog.step(1/120,h);}
  assert.ok(Math.cos(dog.current.heading)<-.99);assert.ok(Math.abs(dog.current.z-h.z)<.5);
});
test('turns maintain separation from the wheel',()=>{
  const h=createPose(),dog=new DogFollower(flat);dog.reset(h);h.speed=5;
  for(let i=0;i<1600;i++){
    h.headingY+=1/120;h.x+=Math.sin(h.headingY)*5/120;h.z+=Math.cos(h.headingY)*5/120;dog.step(1/120,h);
    assert.ok(Math.hypot(dog.current.x-h.x,dog.current.z-h.z)>=.79);
  }
  assert.ok(Math.hypot(dog.current.x-h.x,dog.current.z-h.z)<2);
});
test('the companion stays on sloped terrain when its hero jumps and regroups without teleporting after hero relocation',()=>{
  const slope:TerrainSampler={...flat,sampleGround(x,z,out){flat.sampleGround(x,z,out);out.height=x*.2;out.normal={x:-.2,y:.98,z:0};return out;}};
  const h=createPose(),dog=new DogFollower(slope);dog.reset(h);h.y=3;h.airHeight=3;dog.step(1/120,h);
  assert.ok(Math.abs(dog.current.y-(dog.current.x*.2+.015))<1e-8);
  const before={...dog.current};h.x=60;h.z=-2000;dog.step(1/120,h);
  assert.ok(Math.hypot(dog.current.x-before.x,dog.current.z-before.z)<=DOG_MAX_SPEED/120);assert.equal(dog.mode,'regroup');assert.ok(Math.abs(dog.current.y-(dog.current.x*.2+.015))<1e-8);
  assert.ok(dog.current.speed<=DOG_MAX_SPEED);
});
test('a fully blocked dog stops and a paused dog freezes both translation and gait',()=>{
  const blocked:TerrainSampler={...flat,raycastObstacle:()=>.1};
  const h=createPose(),dog=new DogFollower(blocked);dog.reset(h);const start={...dog.current};h.z+=1;
  for(let i=0;i<120;i++)dog.step(1/120,h);
  assert.equal(dog.current.x,start.x);assert.equal(dog.current.z,start.z);assert.equal(dog.current.speed,0);
  const frozen={...dog.current};dog.step(0,h);assert.deepEqual(dog.current,frozen);
});

test('dog catches up at a brisk 8 metres per second without teleporting',()=>{const h=createPose(),dog=new DogFollower(flat);dog.reset(h);h.speed=8;for(let i=0;i<2400;i++){h.z+=8/120;dog.step(1/120,h);}assert.ok(Math.abs(h.z-dog.current.z)<.7);assert.ok(dog.current.speed<=DOG_MAX_SPEED+.001);});

test('a dog stalled against a railing promptly turns along it and reunites around the end',()=>{
 const fenced:TerrainSampler={...flat,raycastObstacle(origin,direction,max){
  if(Math.abs(direction.x)<.0001)return null;
  const t=-origin.x/direction.x,z=origin.z+direction.z*t;
  return t>=0&&t<=max&&Math.abs(z)<3.3?t:null;
 }};
 for(const hz of [30,60,120]){
 const h=createPose(),dog=new DogFollower(fenced);dog.reset(h);h.x=-3;
 dog.current.x=.75;dog.current.z=0;dog.current.heading=-Math.PI/2;
 let previousX=dog.current.x,cleared=false;
 for(let i=0;i<hz*14;i++){
  dog.step(1/hz,h);
  if(previousX*dog.current.x<0){assert.ok(Math.abs(dog.current.z)>3.3,'go around, never through the fence');cleared=true;}
  previousX=dog.current.x;
  if(i===hz*3)assert.ok(Math.abs(dog.current.z)>.7,'starts escaping within three seconds');
 }
 assert.ok(cleared,'passes the end of the rail');
 assert.ok(Math.hypot(dog.current.x-h.x,dog.current.z-h.z)<1.6,'returns beside the rider');
 }
});
