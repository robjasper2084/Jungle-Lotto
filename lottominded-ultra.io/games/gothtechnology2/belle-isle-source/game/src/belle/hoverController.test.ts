import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {HoverController} from './hoverController.ts';
import {ParkTerrain,type ParkMap} from './terrain.ts';
const data=JSON.parse(fs.readFileSync(new URL('../../public/belle/map.json',import.meta.url),'utf8')) as ParkMap;
const terrain=new ParkTerrain(data);
const idle={throttle:0,steer:0,lift:0,brake:false,boost:false};
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
