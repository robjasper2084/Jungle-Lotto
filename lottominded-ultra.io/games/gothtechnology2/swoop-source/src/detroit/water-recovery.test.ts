import {test} from 'node:test';
import assert from 'node:assert/strict';
import {DetroitWorld} from './world.ts';
import {GeoTerrain} from './geo-terrain.ts';
import {RideController,NEUTRAL_ACTIONS} from './controller.ts';
import {createGroundSample,type TerrainSampler} from './terrain.ts';
import {toMap,MAP_ORIGIN} from './geo-profile.ts';
import {clearMountedPosition,safeRecovery,DEFAULT_MOUNTED_VOLUME} from './recovery.ts';

const flat:TerrainSampler={sampleGround(_x,_z,out){Object.assign(out,{height:0,normal:{x:0,y:1,z:0},surface:'grass',offCourse:false});return out;},raycast:()=>null,raycastObstacle:()=>null};

test('recovery rejects water under the wheel and around the mounted footprint',()=>{
 const terrain={...flat,waterAt:(x:number)=>x>=0};
 assert.equal(clearMountedPosition(terrain,{x:1,y:0,z:0},0,DEFAULT_MOUNTED_VOLUME),false);
 assert.equal(clearMountedPosition(terrain,{x:-.2,y:0,z:0},0,DEFAULT_MOUNTED_VOLUME),false);
 const result=safeRecovery(terrain,{position:{x:1,y:0,z:0},headingY:0});
 assert.ok(result);assert.ok(result.position.x<-.48,'whole mounted footprint is on dry land');
});

test('the reported Chene Park bank allows backing out and recovers fully onto land',async()=>{
 const world=await new DetroitWorld().init(),terrain=new GeoTerrain(world);
 try{
  // Read from the paused user view; also exercise the next submerged slope sample.
  const edge={x:1776.15,z:-254.44},wet={x:1776.45,z:-254.74};
  const height=(p:{x:number;z:number})=>terrain.sampleGround(p.x,p.z,createGroundSample()).height;
  assert.equal(terrain.waterAt(edge.x,edge.z,height(edge)),true,'visible pond starts at -0.18 m, not -0.25 m');
  const rider=new RideController(terrain,{spawn:{position:{...wet,y:height(wet)},headingY:.7249}});
  rider.step(1/120,NEUTRAL_ACTIONS); // Release the brake before requesting reverse.
  const start=rider.snapshot();
  for(let i=0;i<480;i++)rider.step(1/120,{...NEUTRAL_ACTIONS,throttle:-1});
  const escaped=rider.snapshot();
  assert.ok(escaped.position.x<start.position.x-.7,'reverse climbs the bank while still crossing wet samples');
  assert.equal(terrain.waterAt(escaped.position.x,escaped.position.z,escaped.position.y),false);
  const distance=escaped.distanceTravelled;
  assert.equal(rider.recover(),true);assert.equal(rider.snapshot().distanceTravelled,distance);
  assert.equal(clearMountedPosition(terrain,rider.snapshot().position,rider.snapshot().headingY,DEFAULT_MOUNTED_VOLUME),true);
  const trapped=new RideController(terrain,{spawn:{position:{...wet,y:height(wet)},headingY:.7249}});
  assert.equal(trapped.recover(),true);
  const p=trapped.snapshot().position;assert.equal(terrain.waterAt(p.x,p.z,p.y),false);
  // Reachable layer-4 dock faces remain usable even over the same pond bed.
  const map=toMap(wet.x,0,wet.z),y=.3;
  world.addRideSurface(new Float32Array([map.x-2,y,map.z-2,map.x-2,y,map.z+2,map.x+2,y,map.z-2,map.x+2,y,map.z-2,map.x-2,y,map.z+2,map.x+2,y,map.z+2]));world.step();
  const dockY=y-MAP_ORIGIN.y;
  assert.ok(Math.abs(terrain.sampleGround(wet.x,wet.z,createGroundSample(),dockY).height-dockY)<.001);
  assert.equal(terrain.waterAt(wet.x,wet.z,dockY),false);
 }finally{world.physics.free();}
});

test('dry-ground approach stops at water; submerged flat travel is blocked and decks stay rideable',()=>{
 const coast={...flat,waterAt:(_x:number,z:number)=>z>.8};
 const rider=new RideController(coast,{spawn:{position:{x:0,y:0,z:0},headingY:0}});
 for(let i=0;i<480;i++)rider.step(1/120,{...NEUTRAL_ACTIONS,throttle:1});
 assert.ok(rider.snapshot().position.z<=.8);assert.equal(rider.crashed,false);
 const wet=new RideController({...flat,waterAt:()=>true},{spawn:{position:{x:0,y:0,z:0},headingY:0}});
 for(let i=0;i<240;i++)wet.step(1/120,{...NEUTRAL_ACTIONS,throttle:1});
 assert.equal(wet.snapshot().position.z,0);assert.equal(wet.recover(),false);
 const deck=new RideController({...flat,waterAt:()=>false},{spawn:{position:{x:0,y:0,z:0},headingY:0}});
 for(let i=0;i<240;i++)deck.step(1/120,{...NEUTRAL_ACTIONS,throttle:1});
 assert.ok(deck.snapshot().position.z>2);
});
