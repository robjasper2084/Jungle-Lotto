import assert from 'node:assert/strict';
import {test} from 'node:test';
import {DetroitWorld,cutCoords,clamp} from './world.ts';
import {GeoTerrain} from './geo-terrain.ts';
import {toMap,nearestRamp} from './geo-profile.ts';
import {RideController,NEUTRAL_ACTIONS,createPose} from './controller.ts';
import {CHALLENGES,DistrictRun} from './district.ts';
import {routePosition,discoveryTargets} from './districtView.ts';
const mapped=await new DetroitWorld().init(),world=new GeoTerrain(mapped),dt=1/120;
// Route validation isolates authored terrain; moving-actor separation is covered by encounter tests.
mapped.updateTraffic(0,1e8,1e8);mapped.step();
for(const definition of CHALLENGES.filter(c=>c.kind!=='discovery'))test(`${definition.title} is achievable with the real rider controller on mapped terrain`,t=>{
 const p=routePosition(definition.start),sim=new RideController(world,{spawn:{position:p,headingY:p.heading}}),run=new DistrictRun(definition),pose=createPose();let station=definition.start,maxOffset=0;
 for(let i=0;i<120*1000&&!run.done&&!run.failed;i++){
  const s=sim.snapshot(),q=toMap(s.position.x,s.position.y,s.position.z),c=cutCoords(q.x,q.z);station=c.d;maxOffset=Math.max(maxOffset,Math.abs(c.u));
  const seconds=i*dt,carve=definition.id==='silk-line',landing=definition.id==='soft-landing';
  const target=routePosition(station+(carve?3:8),carve?Math.sin(seconds*1.6)*.9:0),desired=Math.atan2(target.x-s.position.x,target.z-s.position.z),error=Math.atan2(Math.sin(desired-s.headingY),Math.cos(desired-s.headingY));
  const cycle=seconds%5,preload=landing&&cycle>2&&cycle<3.2;
  mapped.step();
  sim.step(dt,{...NEUTRAL_ACTIONS,throttle:clamp(((carve||landing?4:6.5)-s.speed)*.45,-.25,.55),steer:clamp(-error*2.5,-1,1),crouch:preload,hop:landing&&cycle>=3.2&&cycle<3.2+dt,hopHeld:landing&&cycle>=3.2&&cycle<3.3});sim.writePose(pose);
  const after=toMap(pose.x,pose.y,pose.z),coord=cutCoords(after.x,after.z);run.step(dt,{station:coord.d,offset:coord.u,speed:pose.speed,grounded:sim.snapshot().grounded,crashed:sim.crashed,roll:pose.rollAngle,slip:pose.slipAngle,traction:pose.tractionUsage,airHeight:pose.airHeight,landing:sim.touchedDown?sim.lastLandingQuality:undefined,hopCharge:sim.lastHopCharge});
 }
 assert.ok(run.done,JSON.stringify({id:definition.id,station,progress:run.progress,reason:run.reason,crash:sim.snapshot().crashCause,maxOffset}));t.diagnostic(`${run.progress}; ${run.elapsed.toFixed(1)} s; medal ${run.medal}; maximum trail offset ${maxOffset.toFixed(2)} m`);
});
test('discovery uses existing subjects and the first photograph has an unobstructed view',()=>{
 const targets=discoveryTargets();assert.equal(targets.length,3);const mural=toMap(targets[1].x,targets[1].y,targets[1].z);assert.ok(nearestRamp(mural.x,mural.z).distance>=5,'mural must not be one skipped at a ramp');
 const start=routePosition(1770),target=targets[0],eye={x:start.x,y:start.y+2.35,z:start.z},v={x:target.x-eye.x,y:target.y-eye.y,z:target.z-eye.z},length=Math.hypot(v.x,v.y,v.z);const hit=world.raycast(eye,{x:v.x/length,y:v.y/length,z:v.z/length},length-.8);assert.equal(hit,null,`Gratiot target obstructed at ${hit}`);
});
test('each discovery subject can be photographed from the trail without leaving its supported floor',t=>{
 for(const target of discoveryTargets()){
  const map=toMap(target.x,target.y,target.z),station=cutCoords(map.x,map.z).d;let view:number|undefined;
  for(let d=station-30;d<=station+30;d+=3){const p=routePosition(d),dx=target.x-p.x,dy=target.y-p.y-2.35,dz=target.z-p.z,length=Math.hypot(dx,dy,dz);if(Math.hypot(dx,dz)<3||Math.hypot(dx,dz)>42)continue;const hit=world.raycast({x:p.x,y:p.y+2.35,z:p.z},{x:dx/length,y:dy/length,z:dz/length},length-.8);if(hit===null){view=d;break;}}
  assert.ok(view!==undefined,`${target.name} has no usable trail-side photo position`);t.diagnostic(`${target.name}: clear view from trail station ${view?.toFixed(1)} m`);
 }
});
