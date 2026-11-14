import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {RideCore} from '../../runtime/ride-core/src/ridecore.ts';
import {ParkTerrain,type ParkMap} from './terrain.ts';
import {greenhouseWorld} from './conservatory.ts';

const map=JSON.parse(fs.readFileSync(process.cwd()+'/public/belle/map.json','utf8')) as ParkMap;
function walk(route:readonly (readonly [number,number])[]){
 const terrain=new ParkTerrain(map),cfg=map.conservatory!;
 const points=route.map(([u,v])=>greenhouseWorld(cfg,u,v)),first=points[0],next=points[1];
 const core=new RideCore(terrain,{spawn:{position:{...first,y:terrain.height(first.x,first.z)},headingY:Math.atan2(next.x-first.x,next.z-first.z)}});
 core.advance(1/60,{dismount:true});for(let i=0;i<120;i++)core.advance(1/60,{});
 assert.equal(core.current.footMode,2);
 for(const [index,target]of points.slice(1).entries()){
  for(let tick=0;tick<2400;tick++){
   const dx=target.x-core.current.x,dz=target.z-core.current.z,distance=Math.hypot(dx,dz);
   if(distance<.12)break;
   core.advance(1/60,{throttle:Math.min(.65,distance*.55),facingYaw:Math.atan2(dx,dz)});
   assert(!core.controller.crashed,'unexpected fall');assert.equal(core.current.footMode,2);
   assert(Number.isFinite(core.current.x+core.current.y+core.current.z));
  }
  assert(Math.hypot(target.x-core.current.x,target.z-core.current.z)<.16,'walk waypoint '+index);
 }
}

test('normal walking controls cross the rejected maze footprint directly in both axes and directions',()=>{
 walk([[-88,0],[-52,0],[-88,0]]);
 walk([[-70,-14],[-70,14],[-70,-14]]);
});
test('normal walking controls enter all five greenhouse rooms and return through the original doorway',()=>{
 walk([[-24,0],[0,0],[18,0],[0,0],[0,-20],[0,-30],[0,0],[0,20],[3.5,21],[3.5,27.7],[0,28.5],[0,34],[0,28.5],[3.5,27.7],[3.5,21],[0,20],[0,0],[-24,0]]);
});
