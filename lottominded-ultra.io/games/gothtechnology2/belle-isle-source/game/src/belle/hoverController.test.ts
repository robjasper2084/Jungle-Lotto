import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {HoverController,type FlightMode,type HoverInput} from './hoverController.ts';
import {ParkTerrain,type ParkMap} from './terrain.ts';
const data=JSON.parse(fs.readFileSync(new URL('../../public/belle/map.json',import.meta.url),'utf8')) as ParkMap;
const terrain=new ParkTerrain(data);
const idle:HoverInput={throttle:0,steer:0,lift:0,brake:false,boost:false};
function run(c:HoverController,seconds:number,input=idle,hz=60){for(let i=0;i<seconds*hz;i++)c.advance(1/hz,input);}
test('takeoff stabilizes, landing turns fans off and allows safe dismount',()=>{
 const c=new HoverController(terrain,data.spawn);c.launch();run(c,5);
 assert(Math.abs(c.pose.y-c.floor(c.pose.x,c.pose.z)-1.4)<.03);assert(c.flying);assert.equal(c.exitPoint(),null);
 c.land();run(c,6);assert(c.landed);assert.equal(c.pose.speed,0);assert(c.exitPoint());assert(c.pose.rpm<.1);
});
test('flight can cross river water without inheriting the walking water barrier',()=>{
 const c=new HoverController(terrain,{x:0,z:1000,heading:0});c.launch();run(c,8,{...idle,throttle:1});
 assert(c.pose.z>1080);assert(!c.collision);assert.equal(c.exitPoint(),null);
});
test('airbrake stops forward motion without reversing',()=>{
 const c=new HoverController(terrain,{x:0,z:1000,heading:0});c.launch();run(c,3,{...idle,throttle:1});assert(c.pose.speed>8);
 const speed=c.pose.speed;c.advance(.1,{...idle,brake:true});assert(c.pose.speed<=speed-1.79,'brake deceleration stays immediate');
 run(c,3,{...idle,brake:true});assert.equal(c.pose.speed,0);
});
test('steering and motion are stable at 30 and 120 frames per second',()=>{
 const a=new HoverController(terrain,{x:0,z:1000,heading:0}),b=new HoverController(terrain,{x:0,z:1000,heading:0});a.launch();b.launch();
 const input={...idle,throttle:.5,steer:.35};run(a,3,input,30);run(b,3,input,120);
 assert(Math.hypot(a.pose.x-b.pose.x,a.pose.z-b.pose.z)<.01);
});
test('lift has a bounded ceiling and descent cannot sink the craft',()=>{
 const c=new HoverController(terrain,{x:0,z:1000,heading:0});run(c,12,{...idle,lift:1});
 assert(c.clearance<=36);run(c,15,{...idle,lift:-1});assert(c.pose.y>=c.floor(c.pose.x,c.pose.z)+.15);assert(c.landed);
});
test('map obstacle at chassis or rider height stops forward travel',()=>{
 const wall={height:()=>2,land:()=>true,obstructed:()=>false,raycastFlight:(o:{z:number},d:{z:number},max:number)=>d.z>0&&o.z+max>=12?Math.max(0,12-o.z):null} as unknown as ParkTerrain;
 const c=new HoverController(wall,{x:0,z:0,heading:0});c.launch();run(c,10,{...idle,throttle:1});
 assert(c.pose.z>10);assert(c.pose.z+1.3<=12.001);assert.equal(c.pose.speed,0);assert(c.collision);
});
test('course start resets momentum and holds its authored flight height',()=>{
 const c=new HoverController(terrain,{x:0,z:1000,heading:0});c.setMode('drone');c.launch();run(c,3,{...idle,throttle:1,lift:1});
 assert(c.pose.speed>0);
 const start={x:0,y:30,z:1000,heading:Math.PI/2};
 assert(c.startFlight(start));assert.equal(c.pose.speed,0);assert(c.flying);assert(!c.landed);
 run(c,3);assert(Math.abs(c.pose.y-30)<.001);assert.equal(c.pose.x,0);assert.equal(c.pose.z,1000);
 const before={...c.pose};assert(!c.startFlight({...start,y:100}));assert(!c.startFlight({...start,x:NaN}));assert.deepEqual(c.pose,before);
});

const clearTerrain={land:()=>true,height:()=>2,raycastFlight:()=>null,obstructed:()=>false} as unknown as ParkTerrain;
const airborneStart={x:0,y:30,z:0,heading:0};
function flight(mode:FlightMode,fromGround=false){
 const c=new HoverController(clearTerrain,{x:0,z:0,heading:0});c.setMode(mode);
 if(fromGround)c.launch();else assert(c.startFlight(airborneStart));
 return c;
}
function turn(c:HoverController,seconds=.25,input:HoverInput=idle){
 const before=c.pose.heading;run(c,seconds,{...input,steer:1},120);return Math.abs(c.pose.heading-before);
}

test('ground takeoff keeps yaw responsive but settles into full authority after one second',()=>{
 for(const mode of ['classic','drone'] as const){
  const takingOff=flight(mode,true),settled=flight(mode),normalTurn=turn(settled),earlyTurn=turn(takingOff);
  assert(earlyTurn>.04,`${mode}: steering must respond immediately`);
  assert(earlyTurn<normalTurn*.55,`${mode}: a held turn must not snap to full yaw on takeoff`);
  run(takingOff,.75,idle,120);
  assert(Math.abs(turn(takingOff)-normalTurn)<1e-9,`${mode}: full low-speed steering returns after one second`);
  const heading=takingOff.pose.heading;run(takingOff,.5,idle,120);assert.equal(takingOff.pose.heading,heading,'release must not leave a yaw tail');
 }
});

test('held ground steering and lift-start use the same gentle response in either direction',()=>{
 for(const mode of ['classic','drone'] as const){
  const left=new HoverController(clearTerrain,{x:0,z:0,heading:0}),right=new HoverController(clearTerrain,{x:0,z:0,heading:0});
  left.setMode(mode);right.setMode(mode);
  run(left,.5,{...idle,steer:-1});run(right,.5,{...idle,steer:1});
  assert.equal(left.pose.heading,0);assert.equal(right.pose.heading,0);
  run(left,.25,{...idle,steer:-1,lift:1},120);run(right,.25,{...idle,steer:1,lift:1},120);
  assert(left.flying&&right.flying);assert(left.pose.heading>.04);assert(right.pose.heading<-.04);
  assert(Math.abs(left.pose.heading+right.pose.heading)<1e-9,'left and right inputs remain symmetric');
  assert(right.pose.heading>-.145,`${mode}: automatic lift takeoff is also damped`);
 }
});

test('boost-speed steering is steadier for forward and lateral flight without weakening braking',()=>{
 for(const mode of ['classic','drone'] as const){
  const fast=flight(mode),normalTurn=turn(flight(mode)),moving={...idle,throttle:1,boost:true};
  run(fast,6,moving);assert(fast.pose.speed>31.9);
  const fastTurn=turn(fast,.25,moving);
  assert(fastTurn>normalTurn*.5&&fastTurn<normalTurn*.65,`${mode}: boost yaw retains useful but reduced authority`);
  const speed=fast.pose.speed,x=fast.pose.x,z=fast.pose.z;
  fast.advance(.1,{...moving,brake:true});
  if(mode==='drone'){assert.equal(fast.pose.speed,0);assert.equal(fast.pose.x,x);assert.equal(fast.pose.z,z);}
  else assert(fast.pose.speed<=speed-1.79,'classic braking keeps its existing deceleration');
 }
 const lateral=flight('drone'),moving={...idle,strafe:1,boost:true};run(lateral,6,moving);
 const yaw=turn(lateral,.25,moving),normalTurn=turn(flight('drone'));
 assert(yaw>normalTurn*.5&&yaw<normalTurn*.65,'lateral speed must moderate yaw just like forward speed');
});

test('land and recovery restart takeoff easing while pause and airborne course starts preserve flight control',()=>{
 for(const mode of ['classic','drone'] as const){
  const c=flight(mode,true),earlyTurn=turn(flight(mode,true)),normalTurn=turn(flight(mode));
  run(c,1.25);c.stop();c.launch();
  assert(Math.abs(turn(c)-normalTurn)<1e-9,'clearing input or repeating launch in flight cannot restart takeoff easing');
  c.land();run(c,6);assert(c.landed);c.launch();
  assert(Math.abs(turn(c)-earlyTurn)<1e-9,'a new ground takeoff gets a fresh easing window');
  c.reset();c.launch();assert(Math.abs(turn(c)-earlyTurn)<1e-9,'recovery clears the previous transition');
  assert(c.startFlight(airborneStart));assert.equal(c.pose.speed,0);
  assert(Math.abs(turn(c)-normalTurn)<1e-9,'authored airborne Sky starts do not inherit a ground transition');
 }
});

test('takeoff easing and speed sensitivity stay stable across simulation frame rates',()=>{
 for(const mode of ['classic','drone'] as const){
  const simulate=(hz:number)=>{
   const c=flight(mode,true);
   run(c,.5,{...idle,throttle:1,steer:1,boost:true},hz);
   run(c,2.5,{...idle,throttle:1,steer:.3,boost:true},hz);
   run(c,1,{...idle,throttle:1,steer:-.7,boost:true},hz);
   run(c,.5,{...idle,brake:true},hz);
   return c.pose;
  };
  const reference=simulate(120);
  for(const hz of [30,60]){
   const p=simulate(hz);
   assert(Math.hypot(p.x-reference.x,p.y-reference.y,p.z-reference.z)<.01,`${mode}: ${hz} Hz position`);
   assert(Math.abs(p.heading-reference.heading)<1e-9,`${mode}: ${hz} Hz heading`);
   assert(Math.abs(p.speed-reference.speed)<1e-9,`${mode}: ${hz} Hz speed`);
  }
 }
});
