import test from 'node:test';
import assert from 'node:assert/strict';
import {registerCompanionProvider,sourceCompanionObstacles,type CompanionPose} from '../src/companionBridge.ts';
import {fromSourceMap,fromSwoopDirection,SWOOP_MIN_SCALE} from '../src/geo.ts';

const close=(a:number,b:number)=>assert.ok(Math.abs(a-b)<1e-8,`${a} != ${b}`);

test('visible existing dog reaches source crowds in the correct position and velocity frame',()=>{
  const point=fromSourceMap(147,1.7,-63),dog={...point,heading:.8,speed:3.5};
  const unregister=registerCompanionProvider(()=>dog);
  try{
    const [actor]=sourceCompanionObstacles();
    assert.equal(actor.id,'companion');assert.equal(actor.kind,'dog');
    close(actor.x,147);close(actor.y,1.7);close(actor.z,-63);
    const velocity=fromSwoopDirection(-actor.vx,0,actor.vz);
    close(velocity.x,Math.sin(dog.heading)*dog.speed);close(velocity.z,Math.cos(dog.heading)*dog.speed);
    close(actor.radius,.36/SWOOP_MIN_SCALE);close(actor.height,.85);
    const latest=fromSourceMap(-40,5,18);Object.assign(dog,latest,{speed:0});
    const [updated]=sourceCompanionObstacles();
    assert.equal(updated,actor,'only one navigation envelope represents the existing dog');
    close(updated.x,-40);close(updated.y,5);close(updated.z,18);close(updated.vx,0);close(updated.vz,0);
  }finally{unregister();}
});

test('hidden or unavailable companion does not leave a ghost avoidance actor',()=>{
  const dog:CompanionPose={...fromSourceMap(100,0,200),heading:0,speed:0};
  let visible=false;
  const unregister=registerCompanionProvider(()=>visible?dog:undefined);
  try{
    assert.equal(sourceCompanionObstacles().length,0);
    visible=true;assert.equal(sourceCompanionObstacles().length,1);
    visible=false;assert.equal(sourceCompanionObstacles().length,0,'disabled, hidden, and cabin-only views are omitted by the provider');
    visible=true;dog.x=Number.NaN;assert.equal(sourceCompanionObstacles().length,0,'unavailable pose cannot contaminate crowd coordinates');
  }finally{unregister();}
  assert.equal(sourceCompanionObstacles().length,0);
});

test('replacing the existing companion provider keeps exactly one live actor',()=>{
  const oldDog={...fromSourceMap(1,2,3),heading:0,speed:0},liveDog={...fromSourceMap(7,8,9),heading:1,speed:1};
  const unregisterOld=registerCompanionProvider(()=>oldDog),unregisterLive=registerCompanionProvider(()=>liveDog);
  try{
    unregisterOld();
    const actors=sourceCompanionObstacles();assert.equal(actors.length,1);close(actors[0].x,7);close(actors[0].y,8);close(actors[0].z,9);
  }finally{unregisterLive();unregisterOld();}
  assert.equal(sourceCompanionObstacles().length,0);
});
