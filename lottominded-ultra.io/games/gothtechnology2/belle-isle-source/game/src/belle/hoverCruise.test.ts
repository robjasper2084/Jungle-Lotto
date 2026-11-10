import test from 'node:test';
import assert from 'node:assert/strict';
import {HoverController,type HoverInput} from './hoverController.ts';
import type {ParkTerrain} from './terrain.ts';
import {HOVER_TOP_SPEED,mphToMps,speedMph} from './speedUnits.ts';
import {cockpitTelemetry} from './cockpitTelemetry.ts';
const flat={land:()=>true,height:()=>2,raycastFlight:()=>null,obstructed:()=>false} as unknown as ParkTerrain;
const idle:HoverInput={throttle:0,steer:0,lift:0,brake:false,boost:false};
function tick(c:HoverController,seconds:number,input=idle,hz=60){for(let i=0;i<seconds*hz;i++)c.advance(1/hz,input);}
function riding(){const c=new HoverController(flat,{x:0,z:0,heading:0});c.setMode('classic');c.launch();tick(c,2,{...idle,throttle:1});return c;}
test('speed display converts physical m/s to mph, including reverse and three digits',()=>{
 assert.equal(speedMph(mphToMps(60)),60);assert.equal(speedMph(-mphToMps(30)),30);assert.equal(speedMph(HOVER_TOP_SPEED),198);
 const p=cockpitTelemetry({speed:mphToMps(165),height:4,heading:0,landed:false,landing:false,boost:false,collision:false,lights:true,cruiseSpeed:mphToMps(165)});
 assert.equal(p.speed,165);assert.equal(p.mode,'CRUISE');
});
test('cruise locks forward speed after release and supports 5 mph adjustments',()=>{
 const c=riding();assert(c.toggleCruise());const locked=c.cruiseSpeed!;tick(c,8);assert(Math.abs(c.pose.speed-locked)<.03);
 c.adjustCruise(5);assert(Math.abs(c.cruiseSpeed!-locked-mphToMps(5))<1e-8);tick(c,7);assert(Math.abs(c.pose.speed-c.cruiseSpeed!)<.03);
 c.adjustCruise(-10);tick(c,7);assert(Math.abs(c.pose.speed-c.cruiseSpeed!)<.03);
 assert.equal(c.toggleCruise(),false);assert.equal(c.cruiseSpeed,null);
});
test('cruise stays steerable while throttle override returns to the set speed',()=>{
 const c=riding();c.toggleCruise();const locked=c.cruiseSpeed!;tick(c,2,{...idle,throttle:1});assert(c.pose.speed>locked+5);tick(c,7);assert(Math.abs(c.pose.speed-locked)<.05);
 tick(c,3,{...idle,steer:.4});assert(Math.abs(c.pose.heading)>.15);assert.equal(c.cruiseSpeed,locked);assert(c.pose.speed>locked*.9);
});
test('brake, reverse, boost, landing, pause, recovery and collision cancel cruise',()=>{
 for(const input of [{...idle,brake:true},{...idle,throttle:-1},{...idle,boost:true}]){const c=riding();c.toggleCruise();c.advance(1/60,input);assert.equal(c.cruiseSpeed,null);}
 for(const action of ['land','stop','reset'] as const){const c=riding();c.toggleCruise();c[action]();assert.equal(c.cruiseSpeed,null);}
 let blocked=false;const c=new HoverController(flat,{x:0,z:0,heading:0},()=>blocked?0:null);c.launch();tick(c,2,{...idle,throttle:1});c.toggleCruise();blocked=true;c.advance(1/60,idle);assert.equal(c.cruiseSpeed,null);assert.equal(c.pose.speed,0);
});
test('cruise does not launch from rest, lock reverse, or exceed the speed range',()=>{
 const c=new HoverController(flat,{x:0,z:0,heading:0});assert(!c.toggleCruise());c.launch();assert(!c.toggleCruise());tick(c,2,{...idle,throttle:-1});assert(!c.toggleCruise());
 const a=riding();a.toggleCruise();a.adjustCruise(1000);assert.equal(a.cruiseSpeed,HOVER_TOP_SPEED);a.adjustCruise(-1000);assert.equal(a.cruiseSpeed,mphToMps(5));a.adjustCruise(NaN);assert.equal(a.cruiseSpeed,mphToMps(5));
});
test('full throttle reaches the Ducati reference cap and boost cannot exceed it',()=>{
 const c=riding();tick(c,40,{...idle,throttle:1});assert(Math.abs(c.pose.speed-HOVER_TOP_SPEED)<.01);
 tick(c,3,{...idle,throttle:1,strafe:1,boost:true});assert(c.pose.speed<=HOVER_TOP_SPEED+1e-8);
 tick(c,6,{...idle,brake:true});assert.equal(c.pose.speed,0);
});
test('cruise trajectories agree at 30 and 120 Hz',()=>{
 const a=riding(),b=riding();a.toggleCruise();b.toggleCruise();tick(a,6,{...idle,steer:.3},30);tick(b,6,{...idle,steer:.3},120);assert(Math.hypot(a.pose.x-b.pose.x,a.pose.z-b.pose.z)<.02);
});
