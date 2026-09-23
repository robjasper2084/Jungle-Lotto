import assert from 'node:assert/strict';
import {test} from 'node:test';
import * as T from 'three';
import {batchStaticGroup} from './static-batch.ts';
import {GEO,MAP_ORIGIN,toMap,toLocal,gpsAt,profileLevel,nearestRamp,BRIDGE_LEVELS,cutWidth} from './geo-profile.ts';
import {GeoTerrain} from './geo-terrain.ts';
import {DetroitWorld,heightAt,cutPoint,CUT_TRAFFIC} from './world.ts';
import {CUT_METRES,nearestCut} from './geography.ts';
import {createGroundSample} from './terrain.ts';
import {RideController} from './controller.ts';
import {NEUTRAL_ACTIONS} from './controller.ts';
import {createPose} from './controller.ts';
import {FollowCamera} from './followCamera.ts';
const world=await new DetroitWorld().init(),terrain=new GeoTerrain(world),g=createGroundSample();
world.step();
test('every bridge collider clears both trail edges and ramps meet the corrected street datum',()=>{
  for(const b of BRIDGE_LEVELS){
    let samples=0;
    for(let d=b.start;d<=b.end;d+=1)for(const lane of [-1,-.5,0,.5,1]){
      const p=cutPoint(d,lane*cutWidth(d)/2),floor=world.sampleGround(p.x,p.z,createGroundSample()).height;
      const roof=world.raycastObstacle({x:p.x,y:floor+.15,z:p.z},{x:0,y:1,z:0},15);
      if(roof===null)continue;samples++;
      assert.ok(roof+.15>=b.minClearance-.025,`${b.name}: low collision roof at ${d}, lane ${lane}: ${roof+.15}m`);
    }
    assert.ok(samples>10,b.name+' missing collision deck');
  }
  for(const r of GEO.ramps){
    const end=r.points.at(-1)!,floor=world.sampleGround(end[0],end[1],createGroundSample()).height;
    assert.ok(Math.abs(floor-profileLevel(r.topAt,'street'))<.18,r.name+' landing disconnected from street');
  }
});

test('Wilkins clears the standing rider and keeps the chase camera below the slab',()=>{
  const bridge=GEO.bridges.find(b=>b.name==='Wilkins Street')!;
  const camera=new FollowCamera(terrain),pose=createPose();
  for(let d=bridge.at-24;d<=bridge.at+24;d+=.25){
    const p=cutPoint(d),local=toLocal(p.x,heightAt(p.x,p.z),p.z);
    Object.assign(pose,local,{headingY:-p.heading,speed:6,velocityX:-Math.sin(p.heading)*6,velocityZ:Math.cos(p.heading)*6});
    if(d===bridge.at-24)camera.reset(pose);
    camera.step(1/24,pose);
    const roof=terrain.raycast({...local,y:local.y+.12},{x:0,y:1,z:0},4);
    if(roof!==null)assert.ok(roof+.12>=2.4,'standing headroom at '+d+': '+(roof+.12));
    const floor=terrain.sampleGround(camera.eye.x,camera.eye.z,createGroundSample()).height;
    const ceiling=terrain.raycast({...camera.eye,y:floor+.12},{x:0,y:1,z:0},4);
    if(ceiling!==null)assert.ok(camera.eye.y<=floor+.12+ceiling-.29,'camera inside slab at '+d);
    const head={x:local.x,y:local.y+2.1,z:local.z},dir={x:camera.eye.x-head.x,y:camera.eye.y-head.y,z:camera.eye.z-head.z};
    const length=Math.hypot(dir.x,dir.y,dir.z);
    assert.equal(terrain.raycast(head,dir,length),null,'head occluded at '+d);
  }
});

test('Gratiot is the game origin and map/local translation preserves metre scale',()=>{
  const p=toLocal(MAP_ORIGIN.x,MAP_ORIGIN.y,MAP_ORIGIN.z);assert.deepEqual(p,{x:0,y:0,z:0});
  const gps=gpsAt(MAP_ORIGIN.x,MAP_ORIGIN.z);assert.ok(Math.abs(gps.lat-GEO.origin.gps[0])<1e-9);assert.ok(Math.abs(gps.lon-GEO.origin.gps[1])<1e-9);
  const q=toMap(100,5,-80);assert.deepEqual(toLocal(q.x,q.y,q.z),{x:100,y:5,z:-80});
  const east=toLocal(MAP_ORIGIN.x-.5,MAP_ORIGIN.y,MAP_ORIGIN.z-.8660254),north=toLocal(MAP_ORIGIN.x+.8660254,MAP_ORIGIN.y,MAP_ORIGIN.z-.5);
  assert.ok(new T.Vector3(east.x,east.y,east.z).cross(new T.Vector3(north.x,north.y,north.z)).y>.999999,'east cross north points up; the level must not be mirrored');
  terrain.sampleGround(0,0,g);assert.ok(Math.abs(g.height)<.1,'trail at origin is ground zero');
});
test('mapped ramp bottoms meet the Cut and bridges include the omitted crossings',()=>{
  for(const r of GEO.ramps)assert.ok(nearestCut(r.points[0][0],r.points[0][1]).distance<.02,r.name);
  for(const name of ['East Jefferson Avenue','East Larned Street','Chestnut Street','Gratiot Avenue'])assert.ok(GEO.bridges.some(b=>b.name===name));
  assert.ok(!GEO.bridges.some(b=>b.name==='Franklin Street'||b.name==='Woodbridge Street'));
  assert.ok(profileLevel(CUT_METRES,'floor')-profileLevel(GEO.bridges.find(b=>b.name==='Gratiot Avenue')!.at,'floor')>7,'north end rises toward Mack');
});
test('full Cut riding corridor clears buildings, retaining walls and every bridge',()=>{
  for(let d=2;d<CUT_METRES-3;d+=3)for(const lane of [-1.25,0,1.25]){
    const p=cutPoint(d,lane),q=cutPoint(d+3,lane),floor=world.sampleGround(p.x,p.z,g).height;
    for(const h of [.55,1.6]){const hit=world.raycastObstacle({x:p.x,y:floor+h,z:p.z},{x:q.x-p.x,y:0,z:q.z-p.z},3,.32);assert.equal(hit,null,'blocked at '+d+' m, lane '+lane+', height '+h);}
  }
  // Mixed indexed abutments and unindexed decks must survive the render batch.
  const group=new T.Group(),material=new T.MeshStandardMaterial();
  for(const m of world.geoMeshes)group.add(new T.Mesh(m.geometry,material));
  group.scale.x=-1;group.position.set(MAP_ORIGIN.x,-MAP_ORIGIN.y,-MAP_ORIGIN.z);batchStaticGroup(group);group.updateMatrixWorld(true);
  for(const bridge of GEO.bridges){const p=cutPoint(bridge.at),local=toLocal(p.x,heightAt(p.x,p.z)+1,p.z);const ray=new T.Raycaster(new T.Vector3(local.x,local.y,local.z),new T.Vector3(0,1,0),0,15);assert.ok(ray.intersectObject(group,true).length>0,bridge.name+' visible deck missing after batching');}
});
test('mapped ramp routes have rideable grades and unobstructed body clearance',()=>{
  for(const r of GEO.ramps)for(let i=1;i<r.points.length;i++){
    const a=r.points[i-1],b=r.points[i],length=Math.hypot(b[0]-a[0],b[1]-a[1]);
    for(let d=0;d<length;d+=2){const x=a[0]+(b[0]-a[0])*d/length,z=a[1]+(b[1]-a[1])*d/length;world.sampleGround(x,z,g);assert.ok(g.normal.y>.93,r.name+' steep ground '+g.normal.y+' at '+x+','+z);const hit=world.raycastObstacle({x,y:g.height+1,z},{x:(b[0]-a[0])/length,y:0,z:(b[1]-a[1])/length},Math.min(2,length-d),.32);assert.equal(hit,null,r.name+' obstruction');assert.ok(Math.abs(g.height-nearestRamp(x,z).height)<.25,r.name+' surface mismatch '+(g.height-nearestRamp(x,z).height)+' at '+x+','+z);}
  }
});
test('spline traffic stays inside the cartographic route corridor',()=>{
  for(const p of CUT_TRAFFIC.samples)assert.ok(nearestCut(p.x,p.z).distance<.61);
});
test('the EUC rides through each corrected overpass without a collision',()=>{
  for(const b of GEO.bridges){
    const p=cutPoint(b.at-12),start=toLocal(p.x,heightAt(p.x,p.z),p.z),sim=new RideController(terrain,{spawn:{position:start,headingY:-p.heading}});
    for(let i=0;i<720;i++){world.step();sim.step(1/120,{...NEUTRAL_ACTIONS,throttle:.7});if(sim.crashed)break;}
    assert.equal(sim.crashed,false,b.name);assert.ok(sim.snapshot().distanceTravelled>24,b.name+' did not pass under bridge');
  }
});
