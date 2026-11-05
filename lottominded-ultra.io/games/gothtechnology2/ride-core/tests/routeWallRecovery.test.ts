import test from 'node:test';import assert from 'node:assert/strict';
import {CommunityRide,LaneRoute} from '../src/communityRide.ts';
import {AmbientCyclistTraffic} from '../src/ambientCyclistTraffic.ts';
import {recoverRouteWall,newRouteRecovery} from '../src/routeRecovery.ts';
import {createGroundSample,type TerrainSampler,type NavigationObstacle} from '../src/terrain.ts';
type Box={x0:number;x1:number;z0:number;z1:number};
const boxesTerrain=(boxes:Box[]):TerrainSampler=>({
 sampleGround(_x,_z,out){return Object.assign(out,createGroundSample());},raycast:()=>null,
 raycastObstacle(o,d,max,radius=0){let closest=Infinity;for(const box of boxes){let low=0,high=max;for(const [origin,direction,min,maxAxis]of [[o.x,d.x,box.x0-radius,box.x1+radius],[o.z,d.z,box.z0-radius,box.z1+radius]]){if(Math.abs(direction)<1e-10){if(origin<min||origin>maxAxis){low=Infinity;break;}}else{let a=(min-origin)/direction,b=(maxAxis-origin)/direction;if(a>b)[a,b]=[b,a];low=Math.max(low,a);high=Math.min(high,b);}}if(low<=high&&high>=0)closest=Math.min(closest,low);}return closest<=max?closest:null;}
});
const clearOf=(p:{x:number;z:number},box:Box,r=.29)=>p.x<box.x0-r||p.x>box.x1+r||p.z<box.z0-r||p.z>box.z1+r;
const route=new LaneRoute([{x:0,z:0,width:5},{x:0,z:200,width:5}]);

test('community cyclists move around a building-only lane obstruction without a player-clearance incentive',()=>{
 const box={x0:-.5,x1:.5,z0:14,z1:28},terrain=boxesTerrain([box]),ride=new CommunityRide(route,terrain,7,2);ride.continue();
 // Start close to the wall so a gradual forward passing corridor cannot be planned in time.
 ride.riders.forEach((r,i)=>Object.assign(r,{s:13.5-i*3,offset:0,targetOffset:0,speed:0,...route.at(13.5-i*3)}));
 let maxStep=0;for(let i=0;i<1800;i++){const before=ride.riders.map(r=>({x:r.x,z:r.z}));ride.step(.05,{x:30,y:0,z:0,speed:0});ride.riders.forEach((r,j)=>{assert(clearOf(r,box),`building penetration ${JSON.stringify(r)}`);maxStep=Math.max(maxStep,Math.hypot(r.x-before[j].x,r.z-before[j].z));});}
 assert(ride.riders.every(r=>r.s>35),JSON.stringify(ride.riders));assert(maxStep<.6,`teleport-sized step ${maxStep}`);
});

test('ambient packs recover from a newly encountered building and keep doing so off camera',()=>{
 const boxes:Box[]=[],terrain=boxesTerrain(boxes),traffic=new AmbientCyclistTraffic(terrain,[{x:0,z:0,width:5},{x:0,z:500,width:5}],523);traffic.restart(523,{x:0,z:0});
 const start=traffic.rides[0].riders[0].s;const box={x0:-.5,x1:.5,z0:start+1,z1:start+12};boxes.push(box);
 const riders=traffic.rides[0].riders;let maxStep=0;
 for(let i=0;i<500;i++){const before=riders.map(r=>({x:r.x,z:r.z}));traffic.update(.05,{x:10000,z:10000});riders.forEach((r,j)=>{assert(clearOf(r,box),`building penetration at ${r.x},${r.z}`);maxStep=Math.max(maxStep,Math.hypot(r.x-before[j].x,r.z-before[j].z));});}
 assert(riders.every(r=>r.s>box.z1+3),JSON.stringify(riders.map(r=>({s:r.s,blocked:r.blocked}))));assert(maxStep<.8,`visible teleport ${maxStep}`);
});

test('a narrow corner backs out continuously without crossing scenery',()=>{
 const boxes=[{x0:-.5,x1:.5,z0:10,z1:15},{x0:-2,x1:-.6,z0:9.4,z1:15},{x0:.6,x1:2,z0:9.4,z1:15}],terrain=boxesTerrain(boxes);
 const r={id:'r',s:9.05,offset:0,x:0,y:0,z:9.05},state=newRouteRecovery(r.s);let backed=false,maxStep=0;
 for(let i=0;i<100;i++){const previous={...r},step=recoverRouteWall(terrain,(s,o)=>route.at(s,o),r,state,.05,1.95,[],0);if(step)Object.assign(r,step);backed||=r.s<previous.s;maxStep=Math.max(maxStep,Math.hypot(r.x-previous.x,r.z-previous.z));for(const b of boxes)assert(clearOf(r,b));}
 assert(backed,'corner recovery must back out');assert(r.s>=9.05-1.20001,'backout is bounded');assert(maxStep<=.071,'escape must be continuous');
});

test('wall recovery never displaces a cyclist into a nearby player or backs forever at a dead end',()=>{
 const wall={x0:-.5,x1:.5,z0:10,z1:15},terrain=boxesTerrain([wall]);
 const r={id:'r',s:9.5,offset:0,x:0,y:0,z:9.5},state=newRouteRecovery(r.s),player:NavigationObstacle={id:'player',x:-1.4,y:0,z:9.5,radius:.6,height:1.8,kind:'rider',vx:0,vz:0};
 for(let i=0;i<40;i++){const step=recoverRouteWall(terrain,(s,o)=>route.at(s,o),r,state,.05,1.95,[player],0);if(step)Object.assign(r,step);assert(Math.hypot(r.x-player.x,r.z-player.z)>=1.2);assert(clearOf(r,wall));}
 assert(r.offset>0,'the clear side away from the player is chosen');
 const closed=boxesTerrain([{x0:-3,x1:3,z0:10,z1:15}]),trapped={id:'r',s:9.5,offset:0,x:0,y:0,z:9.5},memory=newRouteRecovery(9.5);
 for(let i=0;i<400;i++){const step=recoverRouteWall(closed,(s,o)=>route.at(s,o),trapped,memory,.05,1.95,[],0);if(step)Object.assign(trapped,step);}
 assert(trapped.s>=8.2999&&trapped.s<9.5);assert(!memory.backing);assert.equal(recoverRouteWall(closed,(s,o)=>route.at(s,o),trapped,memory,.05,1.95,[],0),undefined);
});
