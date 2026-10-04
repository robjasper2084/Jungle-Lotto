import {test} from 'node:test';
import assert from 'node:assert/strict';
import {CommunityRide,LaneRoute} from './communityRide.ts';
import {createGroundSample,type TerrainSampler,type NavigationObstacle} from '@digital-static/ridecore';
const flat:TerrainSampler={sampleGround(_x,_z,out){return Object.assign(out,createGroundSample());},raycast:()=>null,raycastObstacle:()=>null};
test('a narrow-lane crowd jam releases and the group can ride through its player',()=>{
 const route=new LaneRoute([{x:0,z:0,width:3.4},{x:0,z:400,width:3.4}]),ride=new CommunityRide(route,flat);ride.autoStart=true;
 const people=[-1.2,0,1.2].map((x,i):NavigationObstacle=>({id:'walker-'+i,x,y:0,z:45,radius:.7,height:1.8,kind:'person',vx:0,vz:0}));
 for(let i=0;i<45*60;i++)ride.step(1/60,{x:0,y:0,z:70,speed:0},people);
 assert.ok(ride.riders.every(r=>r.s>110),'all riders pass the crowd and the stationary hero: '+JSON.stringify(ride.riders));
 assert.ok(ride.riders.every(r=>r.speed>2));
});
test('crowd recovery keeps a blocked physical passage solid',()=>{
 const wall:TerrainSampler={...flat,raycastObstacle:(o,d,max)=>d.z>0&&o.z<40&&o.z+d.z*max>=40?(40-o.z)/d.z:null};
 const ride=new CommunityRide(new LaneRoute([{x:0,z:0,width:3.4},{x:0,z:200,width:3.4}]),wall);ride.autoStart=true;
 const person:NavigationObstacle={id:'walker',x:0,y:0,z:39,radius:.7,height:1.8,kind:'person',vx:0,vz:0};
 for(let i=0;i<30*60;i++)ride.step(1/60,{x:0,y:0,z:100,speed:0},[person]);
 assert.ok(ride.riders.every(r=>r.z<40),'solid scenery cannot be passed through');
});
test('wide paths carry a compact staggered pack at cruising speed without a scripted stop',()=>{
 const ride=new CommunityRide(new LaneRoute([{x:0,z:0,width:5},{x:0,z:500,width:5}]),flat);
 ride.join({x:-1,z:1});ride.continue();let minimum=Infinity,spread=0;
 for(let i=0;i<2400;i++){
  ride.step(1/60,{x:-3,y:0,z:0,speed:0});
  if(i>600){minimum=Math.min(minimum,...ride.riders.map(r=>r.speed));spread=Math.max(spread,Math.max(...ride.riders.map(r=>r.x))-Math.min(...ride.riders.map(r=>r.x)));}
 }
 assert.ok(minimum>6.4,'cruising speed '+minimum);assert.ok(spread>1.7,'staggered width '+spread);
 assert.ok(ride.riders[0].s-ride.riders[3].s<12);assert.equal(ride.stage,'riding');
 const state=JSON.stringify(ride.riders);ride.step(1,{x:0,y:0,z:0,speed:0},[],true);assert.equal(JSON.stringify(ride.riders),state);
});
test('a roadside obstruction is passed without stopping or overlapping',()=>{
 const ride=new CommunityRide(new LaneRoute([{x:0,z:0,width:5},{x:0,z:240,width:5}]),flat);
 ride.join({x:-1,z:1});ride.continue();
 const obstacle:NavigationObstacle={id:'cone',x:.9,y:0,z:70,radius:.35,height:1,kind:'prop',vx:0,vz:0};
 let minimum=Infinity,clearance=Infinity;
 for(let i=0;i<2400;i++){
  ride.step(1/60,{x:-3,y:0,z:0,speed:0},[obstacle]);
  for(const r of ride.riders){if(r.s>40&&r.s<95)minimum=Math.min(minimum,r.speed);clearance=Math.min(clearance,Math.hypot(r.x-obstacle.x,r.z-obstacle.z));}
 }
 assert.ok(minimum>2,'passing speed '+minimum);assert.ok(clearance>=.95,'clearance '+clearance);assert.ok(ride.riders.every(r=>r.s>150));
});

test('overlapping cyclists can separate and leave the start rather than locking each other in place',()=>{
 const route=new LaneRoute([{x:0,z:0,width:4},{x:0,z:240,width:4}]),ride=new CommunityRide(route,flat);ride.autoStart=true;
 ride.riders.forEach((r,i)=>{r.s=4+i*.3;r.offset=r.targetOffset=0;Object.assign(r,route.at(r.s));});
 for(let i=0;i<20*60;i++)ride.step(1/60,{x:0,y:0,z:3.8,speed:0});
 assert.ok(ride.riders.every(r=>r.s>60),JSON.stringify(ride.riders));
 for(let i=1;i<ride.riders.length;i++)for(let j=0;j<i;j++)assert.ok(Math.hypot(ride.riders[i].x-ride.riders[j].x,ride.riders[i].z-ride.riders[j].z)>=1.25);
});
