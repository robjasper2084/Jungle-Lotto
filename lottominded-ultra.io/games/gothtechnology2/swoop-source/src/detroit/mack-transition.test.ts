import assert from 'node:assert/strict';
import {test} from 'node:test';
import {CUT_METRES,pointOnCut,nearestCut} from './geography.ts';
import {DetroitWorld,heightAt,MACK_LANDING,MACK_TRANSITION_END} from './world.ts';
import {profileLevel,toLocal,toMap} from './geo-profile.ts';
import {GeoTerrain} from './geo-terrain.ts';
import {createGroundSample} from './terrain.ts';
import {RideController,NEUTRAL_ACTIONS,createPose} from './controller.ts';
import {DogFollower} from './companion.ts';
import {streetElevation} from './street-geometry.ts';

const end=pointOnCut(CUT_METRES);
const point=(d:number,u=0)=>({x:end.x+Math.sin(end.heading)*d-Math.cos(end.heading)*u,z:end.z+Math.cos(end.heading)*d+Math.sin(end.heading)*u});
const world=await new DetroitWorld().init(),terrain=new GeoTerrain(world);

test('Mack endpoint retains its street landing and joins the city with continuous rendered/collision terrain',()=>{
  for(const u of [-24,-6,0,6,24]){
    let previous=heightAt(point(-1,u).x,point(-1,u).z);
    for(let d=0;d<=MACK_TRANSITION_END+10;d+=.5){
      const p=point(d,u),height=heightAt(p.x,p.z),ground=world.sampleGround(p.x,p.z,createGroundSample());
      assert.ok(Math.abs(nearestCut(p.x,p.z).d-CUT_METRES-d)<.001,'continuous endpoint distance');
      assert.ok(Math.abs(height-previous)<.025,`abrupt drop at ${d}, lane ${u}`);
      assert.equal(ground.offCourse,false,`missing terrain collider at ${d}, lane ${u}`);
      assert.ok(Math.abs(ground.height-height)<.025,`render/collision grade at ${d}, lane ${u}`);
      assert.ok(ground.normal.y>.995,`steep triangle at ${d}, lane ${u}`);
      if(d<=MACK_LANDING)assert.ok(Math.abs(height-profileLevel(CUT_METRES,'street'))<.001,'Mack street tie-in lowered');
      if(d>MACK_LANDING)assert.equal(streetElevation({kind:'residential'},p.x,p.z,height),height,'floating street beyond ramp');
      previous=height;
    }
  }
});

test('rider and companion cross the former Mack drop and its runout in both directions',()=>{
  for(const direction of [-1,1]){
    const start=direction>0?-20:MACK_TRANSITION_END+5,target=direction>0?MACK_TRANSITION_END+5:-20,p=point(start);
    const sim=new RideController(terrain,{spawn:{position:toLocal(p.x,heightAt(p.x,p.z),p.z),headingY:-end.heading+(direction<0?Math.PI:0)}});
    const pose=createPose();sim.writePose(pose);const dog=new DogFollower(terrain);dog.reset(pose);
    let crossed=false;
    for(let i=0;i<10000;i++){
      sim.step(1/120,{...NEUTRAL_ACTIONS,throttle:.4});sim.writePose(pose);dog.step(1/120,pose);
      const m=toMap(pose.x,pose.y,pose.z),d=(m.x-end.x)*Math.sin(end.heading)+(m.z-end.z)*Math.cos(end.heading);
      assert.equal(sim.crashed,false,`crash at ${d}: ${sim.crashCause}`);
      assert.ok(Math.abs(m.y-heightAt(m.x,m.z))<.08,`rider loses ground at ${d}`);
      const dp=toMap(dog.current.x,dog.current.y,dog.current.z);
      assert.ok(dp.y>=heightAt(dp.x,dp.z)-.05,`dog below terrain at ${d}`);
      if((d-target)*direction>=0){crossed=true;break;}
    }
    assert.ok(crossed,`did not finish Mack transition, direction ${direction}`);
  }
});
