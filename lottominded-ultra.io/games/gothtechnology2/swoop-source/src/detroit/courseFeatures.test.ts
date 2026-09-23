import assert from 'node:assert/strict';
import {test} from 'node:test';
import {courseFeatures,featureContact} from './courseFeatures.ts';
import {FULL_ROUTE_GATES} from './fullRoute.ts';
import {GEO,cutWidth,toMap} from './geo-profile.ts';
import {DetroitWorld,cutPoint,cutCoords,clamp} from './world.ts';
import {GeoTerrain} from './geo-terrain.ts';
import {createGroundSample} from './terrain.ts';
import {routePosition} from './districtView.ts';
import {RideController,NEUTRAL_ACTIONS,createPose} from './controller.ts';
import {CHALLENGES} from './district.ts';

test('random courses are reproducible, have both feature types and leave a clear passing lane',()=>{
 assert.deepEqual(courseFeatures(23),courseFeatures(23));assert.notDeepEqual(courseFeatures(23),courseFeatures(24));
 for(let seed=0;seed<100;seed++){
  const features=courseFeatures(seed);assert.ok(features.some(f=>f.kind==='jump'));assert.ok(features.some(f=>f.kind==='slippery'));
  for(const f of features){assert.ok(Math.abs(f.offset)+f.width/2<cutWidth(f.station)/2);assert.ok(cutWidth(f.station)-f.width>2);
   assert.ok([...GEO.bridges,...GEO.ramps].every(p=>Math.abs(p.at-f.station)>=45));assert.ok(FULL_ROUTE_GATES.every(g=>Math.abs(g-f.station)>=24));
   assert.equal(featureContact(features,f.station+1,-Math.sign(f.offset)*1),undefined);
  }
 }
 assert.deepEqual(CHALLENGES.filter(c=>c.features).map(c=>c.id),['freight-express','soft-landing']);
});
const mapped=await new DetroitWorld().init(),terrain=new GeoTerrain(mapped);
test('slippery grip is confined to marked patches and mode reset clears it',()=>{
 mapped.setHazards(23,8,true);const f=mapped.courseFeatures.find(f=>f.kind==='slippery')!;
 const p=cutPoint(f.station+2,f.offset),outside=cutPoint(f.station+2,-Math.sign(f.offset));
 assert.equal(mapped.sampleGround(p.x,p.z,createGroundSample()).surface,'ice');assert.notEqual(mapped.sampleGround(outside.x,outside.z,createGroundSample()).surface,'ice');
 mapped.setHazards(23,8,false);assert.equal(mapped.courseFeatures.length,0);assert.notEqual(mapped.sampleGround(p.x,p.z,createGroundSample()).surface,'ice');
});
test('each generated ramp launches the actual wheel and lands on supported ground without a forced hop',t=>{
 mapped.setHazards(23,8,true);mapped.updateTraffic(0,1e8,1e8);mapped.step();
 for(const f of mapped.courseFeatures.filter(f=>f.kind==='jump')){
  const p=routePosition(f.station-20,f.offset),sim=new RideController(terrain,{spawn:{position:p,headingY:p.heading}}),pose=createPose();let flew=false,landed=false,maxAir=0,station=f.station-20;
  for(let tick=0;tick<20*120&&station<f.station+30;tick++){
   const s=sim.snapshot(),m=toMap(s.position.x,s.position.y,s.position.z),c=cutCoords(m.x,m.z);station=c.d;
   const target=routePosition(c.d+3,f.offset),desired=Math.atan2(target.x-s.position.x,target.z-s.position.z),error=Math.atan2(Math.sin(desired-s.headingY),Math.cos(desired-s.headingY));
   mapped.step();sim.step(1/120,{...NEUTRAL_ACTIONS,throttle:clamp((6-s.speed)*.5,-.3,.7),steer:clamp(-error*2.5,-.8,.8)});sim.writePose(pose);
   if(station>=f.station&&station<f.station+20){flew ||= !sim.snapshot().grounded;maxAir=Math.max(maxAir,pose.airHeight);landed ||= flew&&sim.touchedDown;}
   assert.equal(sim.crashed,false,`ramp ${f.id}: ${sim.snapshot().crashCause}`);assert.ok(pose.y>=terrain.sampleGround(pose.x,pose.z,createGroundSample(),pose.y).height-.03);
  }
  assert.ok(flew&&landed&&maxAir>.15,JSON.stringify({ramp:f.id,station,flew,landed,maxAir}));t.diagnostic(`Ramp ${f.id}: ${maxAir.toFixed(2)} m airtime clearance; clean touchdown`);
 }
});
