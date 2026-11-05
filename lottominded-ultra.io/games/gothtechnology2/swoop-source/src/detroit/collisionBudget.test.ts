import {test} from 'node:test';
import assert from 'node:assert/strict';
import R from '@dimforge/rapier3d-compat';
import {DetroitWorld} from './world.ts';
import type {CrowdAgent,CrowdPath} from './crowdFlow.ts';

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

test('city routes follow the current rider focus and share one external snapshot per traffic tick',async()=>{
 await R.init();const map=new DetroitWorld();map.physics=new R.World({x:0,y:-9.81,z:0});
 try{
  map.randomizePeople(314159);map.updateTraffic(0,1e8,1e8);
  const route=(map as unknown as {cityCrowds:{path:CrowdPath;agents:CrowdAgent[]}[]}).cityCrowds[0];assert.ok(route);
  const person=route.agents[0],station=person.distance,lane=person.lane,x=person.x,z=person.z;
  let snapshots=0,groundQueries=0;map.crowdActors=()=>{snapshots++;return[];};
  map.sampleGround=(_x,_z,out)=>{groundQueries++;out.height=42;return out;};
  map.updateTraffic(.1,x,z);
  assert.equal(snapshots,1,'districts reuse one consistent external-actor snapshot');
  assert.equal(route.path.point(station,lane).y,42,'a retained route queries terrain around the new focus');
  assert.ok(groundQueries>0);map.updateTraffic(.2,1e8,1e8);groundQueries=0;route.path.point(station,lane);
  assert.equal(groundQueries,0,'distant people no longer raycast terrain around the old focus');
 }finally{map.physics.free();}
});
