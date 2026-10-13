import {test} from 'node:test';
import assert from 'node:assert/strict';
import {AmbientCyclistTraffic,cyclistCircuit} from '../src/ambientCyclistTraffic.ts';
import type {TerrainSampler,NavigationObstacle} from '../src/terrain.ts';
const flat:TerrainSampler={sampleGround(_x,_z,out){return Object.assign(out,{height:0,normal:{x:0,y:1,z:0},surface:'pavement',offCourse:false});},raycast:()=>null,raycastObstacle:()=>null};
const points=cyclistCircuit([{x:0,z:0,width:5},{x:0,z:250,width:5},{x:0,z:500,width:5}]);
test('opposing packs keep circulating past a stationary player for several laps',()=>{
 const traffic=new AmbientCyclistTraffic(flat,points,523),player:NavigationObstacle={id:'player',x:0,y:0,z:250,radius:.65,height:1.8,kind:'rider',vx:0,vz:0};
 traffic.restart(523,player);const riders=traffic.rides.flatMap(p=>p.riders),starts=riders.map(r=>r.s);let smallest=Infinity,maxStep=0;
 for(let tick=0;tick<8000;tick++){
  const before=riders.map(r=>({x:r.x,z:r.z}));traffic.update(.05,player,false,[player]);
  riders.forEach((r,i)=>{smallest=Math.min(smallest,Math.hypot(r.x-player.x,r.z-player.z));maxStep=Math.max(maxStep,Math.hypot(r.x-before[i].x,r.z-before[i].z));});
 }
 assert(smallest>=1.18,`player clearance ${smallest}`);assert(maxStep<.85,`visible teleport ${maxStep}`);
 assert(riders.every((r,i)=>r.s-starts[i]>1500),JSON.stringify(riders.map((r,i)=>({travel:r.s-starts[i],speed:r.speed,blocked:r.blocked}))));
});
test('a blocked lane forms a spaced queue and clears when the obstruction leaves',()=>{
 const traffic=new AmbientCyclistTraffic(flat,points,523),player:NavigationObstacle={id:'player',x:0,y:0,z:250,radius:3,height:1.8,kind:'rider',vx:0,vz:0};
 traffic.restart(523,{x:0,z:150});const riders=traffic.rides.flatMap(p=>p.riders);let clearance=Infinity;
 for(let i=0;i<600;i++){traffic.update(.05,player,false,[player]);for(const r of riders)clearance=Math.min(clearance,Math.hypot(r.x-player.x,r.z-player.z));}
 assert(clearance>3.5,`blocked actor clearance ${clearance}`);
 const starts=riders.map(r=>r.s);for(let i=0;i<1000;i++)traffic.update(.05,player);
 assert(riders.every((r,i)=>r.s-starts[i]>150),'traffic must resume after obstruction is removed');
});
