import {test} from 'node:test';
import assert from 'node:assert/strict';
import {DetroitWorld,cutCoords,clamp} from './world.ts';
import {GeoTerrain} from './geo-terrain.ts';
import {toMap} from './geo-profile.ts';
import {RideController,NEUTRAL_ACTIONS,createPose} from './controller.ts';
import {DistrictRun} from './district.ts';
import {routePosition} from './districtView.ts';
import {PRACTICE_LINES,dailyChallenge} from './replayRules.ts';
const mapped=await new DetroitWorld().init(),world=new GeoTerrain(mapped),dt=1/120;
// Route validation isolates authored terrain; moving-actor separation is covered by encounter tests.
mapped.updateTraffic(0,1e8,1e8);mapped.step();
for(const definition of [...PRACTICE_LINES,dailyChallenge(new Date('2026-09-16')),dailyChallenge(new Date('2026-09-17'))])test(`${definition.id}: actual controller completes the authored gates / hop line`,()=>{
 const p=routePosition(definition.start),sim=new RideController(world,{spawn:{position:p,headingY:p.heading}}),run=new DistrictRun(definition),pose=createPose();
 for(let i=0;i<120*1000&&!run.done&&!run.failed;i++){
  const s=sim.snapshot(),q=toMap(s.position.x,s.position.y,s.position.z),c=cutCoords(q.x,q.z),seconds=i*dt,landing=definition.kind==='style';
  const offset=definition.gateOffsets?.[run.count]??0,target=routePosition(c.d+6,offset),desired=Math.atan2(target.x-s.position.x,target.z-s.position.z),error=Math.atan2(Math.sin(desired-s.headingY),Math.cos(desired-s.headingY)),cycle=seconds%5;
  mapped.step();sim.step(dt,{...NEUTRAL_ACTIONS,throttle:clamp((4-s.speed)*.45,-.25,.55),steer:clamp(-error*2.5,-1,1),crouch:landing&&cycle>2&&cycle<3.2,hop:landing&&cycle>=3.2&&cycle<3.2+dt,hopHeld:landing&&cycle>=3.2&&cycle<3.3});sim.writePose(pose);
  const a=toMap(pose.x,pose.y,pose.z),coord=cutCoords(a.x,a.z);run.step(dt,{station:coord.d,offset:coord.u,speed:pose.speed,grounded:sim.snapshot().grounded,crashed:sim.crashed,roll:pose.rollAngle,slip:pose.slipAngle,traction:pose.tractionUsage,airHeight:pose.airHeight,landing:sim.touchedDown?sim.lastLandingQuality:undefined,hopCharge:sim.lastHopCharge});
 }
 assert.ok(run.done,`${run.progress}: ${run.reason}; ${JSON.stringify(sim.snapshot())}; actors ${JSON.stringify(world.navigationObstacles(pose.x,pose.z,3))}`);
});
