import test from 'node:test';
import assert from 'node:assert/strict';
import {HoverController,flightAxis,type HoverInput} from './hoverController.ts';
import type {ParkTerrain} from './terrain.ts';
const flat={land:()=>true,height:()=>2,raycastFlight:()=>null,obstructed:()=>false} as unknown as ParkTerrain;
const idle:HoverInput={throttle:0,steer:0,lift:0,brake:false,boost:false};
function tick(c:HoverController,seconds:number,input:HoverInput=idle,hz=60){for(let i=0;i<seconds*hz;i++)c.advance(1/hz,input);}
function drone(terrain=flat){const c=new HoverController(terrain,{x:0,z:0,heading:0});c.setMode('drone');c.launch();tick(c,4);return c;}
test('drone release and brake stop both axes immediately without drifting',()=>{
 for(const input of[idle,{...idle,throttle:1,strafe:1,brake:true}]){const c=drone();tick(c,3,{...idle,throttle:1,strafe:1});assert(c.pose.speed>10);const {x,z}=c.pose;c.advance(1/30,input);assert.equal(c.pose.speed,0);assert.equal(c.pose.x,x);assert.equal(c.pose.z,z);}
});
test('strafe does not rotate the bike and release of one axis preserves the other',()=>{
 const c=drone();tick(c,2,{...idle,strafe:1});assert(c.pose.x<-10);assert.equal(c.pose.z,0);assert.equal(c.pose.heading,0);assert(Math.abs(c.pose.roll)<.066);
 tick(c,2,{...idle,throttle:1,strafe:1});const x=c.pose.x,z=c.pose.z;tick(c,1,{...idle,throttle:1});assert.equal(c.pose.x,x);assert(c.pose.z>z+10);
});
test('exponential response has a quiet neutral region and full endpoint authority',()=>{
 assert.equal(flightAxis(.04),0);assert.equal(flightAxis(NaN),0);assert.equal(flightAxis(1),1);assert.equal(flightAxis(-1),-1);assert(flightAxis(.5)<.3);assert.equal(flightAxis(2),1);
});
test('altitude hold settles above changing terrain and retains commanded height',()=>{
 const slope={...flat,height:(_x:number,z:number)=>2+Math.max(0,z)*.015} as ParkTerrain,c=drone(slope);
 tick(c,2,{...idle,lift:.4});const clearance=c.clearance;tick(c,6,{...idle,throttle:.7});tick(c,4);assert.equal(c.clearance,clearance);assert(Math.abs(c.pose.y-c.floor(c.pose.x,c.pose.z)-clearance)<.03);
});
test('drone movement is stable across 30 and 120 Hz and mode changes clear momentum',()=>{
 const a=drone(),b=drone();const i={...idle,throttle:.8,strafe:.4,steer:.2};tick(a,5,i,30);tick(b,5,i,120);assert(Math.hypot(a.pose.x-b.pose.x,a.pose.z-b.pose.z)<.02);a.setMode('classic');assert.equal(a.pose.speed,0);
});
test('moving vessel obstacle blocks lateral approach before hull contact',()=>{
 const c=new HoverController(flat,{x:0,z:0,heading:0},(o,d,max)=>d.x<0&&o.x+d.x*max<=-12?Math.max(0,(o.x+12)/-d.x):null);c.setMode('drone');c.launch();tick(c,8,{...idle,strafe:1});assert(c.pose.x>=-10.71);assert(c.pose.x<-9);assert(c.collision);assert.equal(c.pose.speed,0);
});
