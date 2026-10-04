import test from 'node:test';import assert from 'node:assert/strict';import * as T from 'three';
import {VALADE,inValadeInlet,inValadePark,valadeTerrainDetail} from './valadeSite.ts';
import {DetroitWorld,heightAt,SPOTS} from './world.ts';
import {drapeStreet,streetElevation,streetSurfaceLift} from './street-geometry.ts';
import {createGroundSample} from './terrain.ts';
import {buildHarbor} from './harbor.ts';
import {DOCK_TOP} from './harborLayout.ts';
import {RideController,NEUTRAL_ACTIONS} from './controller.ts';
test('Valade inlet is water, its original shoreline lawn and entry remain dry',()=>{
 assert.ok(inValadeInlet(-220,-1857));assert.equal(heightAt(-220,-1857),-1.1);
 assert.ok(inValadePark(-180,-1825));assert.equal(heightAt(-180,-1825),0);
 const spot=SPOTS.find(s=>s.name.startsWith('Robert C. Valade'))!;assert.ok(spot);assert.equal(heightAt(spot.x,spot.z),0);
 const w=new DetroitWorld();assert.equal(w.buildingMeshes.some(b=>b.data.id==='777936147'),false,'open terrace must not be a filled obstacle');
 for(const c of w.chunks.filter(c=>valadeTerrainDetail(c.x,c.z)))assert.ok(c.vertices.length/3>=2601,'fine inlet edge terrain');
});
test('mapped Valade bridges and walks retain dry physical support over the inlet',async()=>{
 const w=new DetroitWorld();w.chunks=w.chunks.filter(c=>valadeTerrainDetail(c.x,c.z));w.solids=[];w.geoMeshes=[];w.buildingMeshes=[];await w.init();
 for(const road of VALADE.paths)for(let i=1;i<road.points.length;i++){
  const a=road.points[i-1],b=road.points[i];for(const p of drapeStreet({a:{x:a[0],z:a[1]},b:{x:b[0],z:b[1]},half:road.width/2,offset:0,lift:streetSurfaceLift(road)},w.chunks,(x,z,y)=>streetElevation(road,x,z,y)))w.addRideSurface(new Float32Array(p.positions));
 }
 w.step();let bridges=0;
 assert.equal(w.waterAt(-220,-1857,0),true,'unsupported inlet is a water boundary');
 for(const r of VALADE.paths.filter(p=>p.bridge)){const a=r.points[0],b=r.points[1],x=(a[0]+b[0])/2,z=(a[1]+b[1])/2;const g=w.sampleGround(x,z,createGroundSample(),.1);assert.ok(g.height>.04,'bridge sank at '+r.id);assert.equal(g.offCourse,false);assert.equal(w.waterAt(x,z,.1),false,'supported crossing is rideable');bridges++;}
 assert.equal(bridges,3);w.physics.free();
});
test('a rider stops at unsupported water and remains mounted above the visible shore',()=>{
 const terrain={sampleGround(_x:number,z:number,out:any){out.height=z<3?0:-1.1;out.normal={x:0,y:1,z:0};out.offCourse=false;return out;},waterAt(_x:number,z:number){return z>=3;},raycast:()=>null,raycastObstacle:()=>null};
 const rider=new RideController(terrain,{spawn:{position:{x:0,y:0,z:0},headingY:0}});
 for(let i=0;i<600;i++)rider.step(1/120,{...NEUTRAL_ACTIONS,throttle:.7});
 assert.ok(rider.snapshot().position.z<3);assert.ok(rider.snapshot().position.y>-.01);assert.equal(rider.crashed,false);
});
test('harbor spine and principal piers share continuous support at the visible deck height',async()=>{
 const w=new DetroitWorld();w.chunks=w.chunks.filter(c=>c.x<-50&&c.x>-250&&c.z<-1200&&c.z>-1450);w.solids=[];w.geoMeshes=[];w.buildingMeshes=[];await w.init();
 buildHarbor(w,()=>new T.Group());w.step();
 for(let i=0;i<=30;i++){const t=i/30,x=-107.324+(-98.434+107.324)*t,z=-1390.462+(-1287.611+1390.462)*t;const g=w.sampleGround(x,z,createGroundSample(),DOCK_TOP);assert.ok(Math.abs(g.height-DOCK_TOP)<.01,'unsupported spine '+t);}
 w.physics.free();
});
