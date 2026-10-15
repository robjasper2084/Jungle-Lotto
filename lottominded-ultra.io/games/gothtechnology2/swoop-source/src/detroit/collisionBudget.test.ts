import {test} from 'node:test';
import assert from 'node:assert/strict';
import R from '@dimforge/rapier3d-compat';
import {DetroitWorld} from './world.ts';

test('120 Hz controller reuses unchanged map queries and refreshes traffic and added walls',async()=>{
 await R.init();const map=new DetroitWorld();map.physics=new R.World({x:0,y:-9.81,z:0});
 try{
  let calls=0;const step=map.physics.step.bind(map.physics);map.physics.step=()=>{calls++;step();};
  map.addBox({x:0,y:1,z:5,hx:1,hy:1,hz:1,kind:'wall'});map.step(true);
  for(let i=0;i<119;i++)map.step(true);assert.equal(calls,1);
  assert.equal(map.raycast({x:0,y:1,z:0},{x:0,y:0,z:1},20),4);
  map.addBox({x:0,y:1,z:2,hx:.5,hy:1,hz:.5,kind:'wall'});map.step(true);assert.equal(calls,2);
  assert.equal(map.raycast({x:0,y:1,z:0},{x:0,y:0,z:1},20),1.5);
  map.updateTraffic(0,1e8,1e8);map.step(true);assert.equal(calls,3);
  map.step();assert.equal(calls,4,'explicit setup and externally changed colliders always flush');
  map.solids.push({x:0,y:1,z:5,hx:1,hy:1,hz:1,kind:'wall'});
  assert(map.navigationObstacles(0,0,100).length>0);assert.equal(map.navigationObstacles(0,0,100,false).length,0);
  const body=map.physics.createRigidBody(R.RigidBodyDesc.dynamic().setTranslation(0,4,0));map.physics.createCollider(R.ColliderDesc.ball(.5),body);
  map.step(true);assert.equal(calls,5);assert(body.translation().y<4);
 }finally{map.physics.free();}
});
