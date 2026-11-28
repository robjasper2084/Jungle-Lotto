import test from 'node:test';
import assert from 'node:assert/strict';
import {SwoopCoverage,ProjectedTerrain} from '../src/terrain.ts';
import {fromSwoop,fromSwoopDirection,SWOOP_LOCAL_HEIGHT_OFFSET,toSwoopDirection} from '../src/geo.ts';
import type {TerrainSampler,GroundSample,Vec3} from '../../../lottominded-ultra.io/games/gothtechnology2/swoop-source/src/detroit/terrain.ts';

const close=(a:number,b:number,tolerance=1e-8)=>assert.ok(Math.abs(a-b)<tolerance,`${a} != ${b}`);
const sample=():GroundSample=>({height:0,normal:{x:0,y:1,z:0},surface:'pavement',offCourse:false});
test('exact footprint retains an empty hole between mapped chunks',()=>{
  const cover=new SwoopCoverage([{x:50,z:50},{x:150,z:50},{x:50,z:150}]);
  assert.ok(cover.containsMap(50,50));assert.ok(cover.containsMap(150,50));assert.ok(cover.containsMap(50,150));
  assert.equal(cover.containsMap(150,150),false);assert.equal(cover.containsMap(250,50),false);
  assert.ok(cover.containsMap(200,50),'closed outer edge');assert.equal(cover.containsMap(NaN,50),false);
  assert.deepEqual(cover.segments({x:-20,y:0,z:150},{x:1,y:0,z:0},240),[
    {start:0,end:20,source:false},{start:20,end:120,source:true},{start:120,end:240,source:false}
  ]);
});
test('new rideable triangle has exact footprint, not its rectangle',()=>{
  const cover=new SwoopCoverage();
  cover.addRideTriangles(new Float32Array([20,3,20,20,3,80,80,3,20]));
  assert.ok(cover.containsMap(30,30));assert.equal(cover.containsMap(70,70),false);
  const segments=cover.segments({x:0,y:0,z:30},{x:1,y:0,z:0},100);
  assert.equal(segments.length,3);close(segments[1].start,20);close(segments[1].end,70);assert.equal(segments[1].source,true);
});
test('visual footprint exposes added floors once without filling their empty corners',()=>{
  const cover=new SwoopCoverage([{x:50,z:50}]);
  cover.addRideTriangles(new Float32Array([80,3,20,80,3,160,240,3,20]));
  const polygons=cover.mapFootprintPolygons();
  assert.equal(polygons.length,2,'one full tile plus one triangle, even across multiple cells');
  assert.deepEqual(polygons[1],[[[80,20],[80,160],[240,20],[80,20]]]);
  assert.ok(cover.containsMap(120,40));assert.equal(cover.containsMap(220,140),false);
  assert.equal(cover.containsMap(50,150),false,'the visual mask must not claim the combined bounding rectangle');
});
test('source-only fast path requires the complete swept ray to fit one full tile',()=>{
  const cover=new SwoopCoverage([{x:50,z:50}]);
  cover.addRideTriangles(new Float32Array([120,3,20,120,3,80,180,3,20]));
  assert.ok(cover.coversRayInOneTile({x:30,y:2,z:30},{x:1,y:0,z:0},50,.4));
  assert.ok(cover.coversRayInOneTile({x:30,y:2,z:30},{x:0,y:-1,z:0},50,.4));
  assert.equal(cover.coversRayInOneTile({x:30,y:2,z:30},{x:1,y:0,z:0},70,.4),false,'a lateral sample crosses the tile edge');
  assert.equal(cover.coversRayInOneTile({x:130,y:2,z:30},{x:1,y:0,z:0},4,.4),false,'partial floor triangles still use exact interval clipping');
  assert.equal(cover.coversRayInOneTile({x:-1,y:2,z:30},{x:1,y:0,z:0},10,0),false,'outside origins must preserve host queries');
});
test('vertical faces do not invent ground outside the source map',()=>{
  const cover=new SwoopCoverage();
  cover.addRideTriangles(new Float32Array([20,0,20,20,4,20,20,4,80]),undefined,true);
  assert.equal(cover.containsMap(20,30),false);
});
test('underpass query forwards contact height and preserves caller-owned sample',()=>{
  const calls:{x:number;z:number;reference?:number}[]=[];
  const local:TerrainSampler={sampleGround(x,z,out,reference){calls.push({x,z,reference});out.height=reference!==undefined&&reference>=5.6?6:0;out.normal={x:0,y:1,z:0};out.surface='wood';out.offCourse=false;return out;},raycast:()=>null,raycastObstacle:()=>null};
  const terrain=new ProjectedTerrain(local),p=fromSwoop(13,0,-42),out=sample();
  assert.equal(terrain.sampleGround(p.x,p.z,out,SWOOP_LOCAL_HEIGHT_OFFSET),out);close(out.height,SWOOP_LOCAL_HEIGHT_OFFSET);
  terrain.sampleGround(p.x,p.z,out,6+SWOOP_LOCAL_HEIGHT_OFFSET);close(out.height,6+SWOOP_LOCAL_HEIGHT_OFFSET);
  close(calls[0].x,13);close(calls[0].z,-42);close(calls[0].reference!,0);close(calls[1].reference!,6);assert.equal(out.surface,'wood');
  terrain.sampleGround(p.x,p.z,out);assert.equal(calls[2].reference,undefined,'default must not select an overhead deck');
});
test('swept ray offsets, normals and returned distance use the same transform',()=>{
  let seen:{origin:Vec3;direction:Vec3;max:number;half:number;side:Vec3}|undefined;
  const local:TerrainSampler={sampleGround(_x,_z,out){return out;},raycast:()=>null,raycastObstacle(origin,direction,max,half=0,side){seen={origin:{...origin},direction:{...direction},max,half,side:{...side!}};return max*.4;}};
  const terrain=new ProjectedTerrain(local),origin=fromSwoop(30,3,42),direction={x:1,y:0,z:0},side={x:0,y:0,z:-1};
  close(terrain.raycastObstacle(origin,direction,20,1.4,side)!,8);
  assert.ok(seen);close(seen.origin.x,30);close(seen.origin.y,3);close(seen.origin.z,42);
  const sourceOffset=fromSwoopDirection(seen.side.x*seen.half,seen.side.y*seen.half,seen.side.z*seen.half);
  close(sourceOffset.x,side.x*1.4);close(sourceOffset.y,side.y*1.4);close(sourceOffset.z,side.z*1.4);
});
test('traffic velocity and impact callback cross the coordinate boundary once',()=>{
  let impact:unknown;
  const local:TerrainSampler={sampleGround(_x,_z,out){return out;},raycast:()=>null,raycastObstacle:()=>null,navigationObstacles:()=>[{id:'rider',kind:'cyclist',x:2,y:3,z:4,vx:7,vz:-1,height:2,radius:.4,onImpact:i=>impact=i}]};
  const terrain=new ProjectedTerrain(local),p=fromSwoop(2,3,4),[actor]=terrain.navigationObstacles(p.x,p.z,10),velocity=fromSwoopDirection(7,0,-1);
  close(actor.x,p.x);close(actor.y,p.y);close(actor.z,p.z);close(actor.vx,velocity.x);close(actor.vz,velocity.z);
  actor.onImpact!({speed:5,vx:3,vz:-2});const expected=toSwoopDirection(3,0,-2);
  close((impact as {vx:number}).vx,expected.x);close((impact as {vz:number}).vz,expected.z);
});
