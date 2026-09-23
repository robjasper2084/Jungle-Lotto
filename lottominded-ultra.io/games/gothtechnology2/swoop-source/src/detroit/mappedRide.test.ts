import assert from 'node:assert/strict';
import {test} from 'node:test';
import {DetroitWorld,cutPoint,cutCoords,CUT_LENGTH,SPOTS,heightAt,clamp} from './world.ts';
import {GeoTerrain} from './geo-terrain.ts';
import {toLocal,toMap,GEO} from './geo-profile.ts';
import {RideController,NEUTRAL_ACTIONS} from './controller.ts';
import {createGroundSample} from './terrain.ts';
import {nextCheckpoint,GATES} from './progress.ts';
const mapWorld=await new DetroitWorld().init(),world=new GeoTerrain(mapWorld),g=createGroundSample(),dt=1/120;
function local(d:number,u=0){const p=cutPoint(d,u);return {...toLocal(p.x,heightAt(p.x,p.z),p.z),heading:-p.heading};}
function rider(d=150,u=0){const p=local(d,u);return new RideController(world,{spawn:{position:p,headingY:p.heading}});}
function run(s:RideController,seconds:number,a:Partial<typeof NEUTRAL_ACTIONS>={}){for(let i=0;i<seconds/dt;i++)s.step(dt,{...NEUTRAL_ACTIONS,...a});return s.snapshot();}
test('mapped time trial credits only the next gate in the correct direction and lane',()=>{
 for(let i=0;i<8;i++){assert.equal(nextCheckpoint(i,local(GATES[i]-1),local(GATES[i]+1)),i+1);assert.equal(nextCheckpoint(i,local(GATES[i]+1),local(GATES[i]-1)),i);assert.equal(nextCheckpoint(i,local(GATES[i]-1,30),local(GATES[i]+1,30)),i);}
 assert.equal(nextCheckpoint(0,local(GATES[6]),local(GATES[7])),0);
});
test('every mapped start is supported and preserves altitude across the origin transform',()=>{
 for(const p of SPOTS){const q=toLocal(p.x,heightAt(p.x,p.z),p.z);world.sampleGround(q.x,q.z,g);assert.ok(Number.isFinite(g.height)&&g.normal.y>.9);assert.ok(Math.abs(q.y-g.height)<.04);}
});
test('Motion 4 accelerates, leans and brakes on the mapped Cut',()=>{const s=rider();const a=run(s,3,{throttle:1});assert.ok(a.speed>3&&a.riderPitch>.1);const b=run(s,2,{throttle:-1});assert.ok(b.speed<a.speed*.5);assert.equal(b.crashed,false);});
test('Motion 4 carves in the mapped coordinate frame',()=>{const s=rider(200),heading=s.snapshot().headingY;run(s,1,{throttle:.4});const a=run(s,.7,{throttle:.3,steer:.3});assert.ok(Math.abs(a.headingY-heading)>.08);assert.ok(Math.abs(a.rollAngle)>.02);assert.equal(a.crashed,false);});
test('preloaded hop lands on mapped terrain without moving the origin',()=>{const s=rider();run(s,1,{crouch:true});s.step(dt,{...NEUTRAL_ACTIONS,crouch:true,hop:true});let max=0;for(let i=0;i<360;i++){s.step(dt,NEUTRAL_ACTIONS);max=Math.max(max,s.groundClearance);}const a=s.snapshot();assert.ok(max>.1);assert.equal(a.hops,1);assert.equal(a.landings,1);assert.equal(a.grounded,true);});
test('traffic follows mapped paths, colliders match actors, and distant traffic unloads',()=>{
 const p=cutPoint(600);mapWorld.updateTraffic(0,p.x,p.z);mapWorld.step();const a=mapWorld.traffic.find(t=>t.speed>0)!;assert.ok(a);mapWorld.updateTraffic(5,p.x,p.z);mapWorld.step();const b=mapWorld.traffic.find(t=>t.id===a.id)!;assert.ok(Math.hypot(a.x-b.x,a.z-b.z)>1);assert.ok(Math.abs(mapWorld.trafficBodies.get(a.id)!.translation().z-b.z)<.001);mapWorld.updateTraffic(0,-10000,10000);mapWorld.step();assert.equal(mapWorld.trafficBodies.size,0);
});
test('whole mapped Cut is traversable by Motion 4 at cruising speed',t=>{
 const s=rider(30);let station=30,count=0,maxLateral=0;
 while(station<CUT_LENGTH-40&&count++<65000){
  const a=s.snapshot(),p=toMap(a.position.x,a.position.y,a.position.z),c=cutCoords(p.x,p.z);station=c.d;maxLateral=Math.max(maxLateral,Math.abs(c.u));
  const target=local(Math.min(CUT_LENGTH-10,station+8)),desired=Math.atan2(target.x-a.position.x,target.z-a.position.z),error=Math.atan2(Math.sin(desired-a.headingY),Math.cos(desired-a.headingY));
  s.step(dt,{...NEUTRAL_ACTIONS,throttle:clamp((6.5-a.speed)*.45,-.25,.55),steer:clamp(-error*2.5,-1,1)});if(s.crashed)break;
 }
 const a=s.snapshot();assert.equal(a.crashed,false,JSON.stringify({station,cause:a.crashCause,maxLateral}));assert.ok(station>CUT_LENGTH-45,`stopped at ${station}`);assert.ok(maxLateral<1,`lateral drift ${maxLateral}`);t.diagnostic(`${a.distanceTravelled.toFixed(1)} m, ${count/120} s, maximum centerline drift ${maxLateral.toFixed(3)} m`);
});
test('all three access ramp centreline segments support actual Motion 4 riding uphill',()=>{
 for(const r of GEO.ramps)for(let i=1;i<r.points.length;i++){
  const a=r.points[i-1],b=r.points[i],length=Math.hypot(b[0]-a[0],b[1]-a[1]);if(length<3)continue;
  const s=new RideController(world,{spawn:{position:toLocal(a[0],heightAt(a[0],a[1]),a[1]),headingY:-Math.atan2(b[0]-a[0],b[1]-a[1])}});
  let n=0;while(s.snapshot().distanceTravelled<length-1&&n++<10000){const speed=s.snapshot().speed;s.step(dt,{...NEUTRAL_ACTIONS,throttle:clamp((3-speed)*.5,-.2,.6)});if(s.crashed)break;}
  assert.equal(s.crashed,false,r.name+' segment '+i);assert.ok(s.snapshot().distanceTravelled>=length-1,r.name+' stalled');
 }
});
test('mapped static collision has width and recovery remains on supported ground',()=>{
 const p=cutPoint(450),q=cutPoint(460),wall=mapWorld.addBox({x:q.x,y:heightAt(q.x,q.z)+1,z:q.z,hx:2,hy:1,hz:1,kind:'test-fixture'});mapWorld.step();
 const hit=world.raycastObstacle(toLocal(p.x,heightAt(p.x,p.z)+.6,p.z),{x:-(q.x-p.x),y:0,z:q.z-p.z},15,.35);assert.ok(hit!==null&&hit<12);
 const s=rider(450);run(s,4,{throttle:.7});assert.ok(s.snapshot().crashes>0);run(s,2);s.step(dt,{...NEUTRAL_ACTIONS,reset:true});assert.equal(s.crashed,false);
 mapWorld.physics.removeCollider(wall,true);mapWorld.step();
});
