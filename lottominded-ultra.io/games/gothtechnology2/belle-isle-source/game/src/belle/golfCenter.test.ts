import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import layout from './golfCenterLayout.json' with {type:'json'};
import {ParkTerrain,inside,segment,type ParkMap,type Point} from './terrain.ts';
const map=JSON.parse(fs.readFileSync(new URL('../../public/belle/map.json',import.meta.url),'utf8')) as ParkMap;
const terrain=new ParkTerrain(map);
test('Golf Center arrival is on a mapped path with collision-free room for rider and chase camera',()=>{
 const [x,z]=layout.approach,[tx,tz]=layout.entry,d=Math.hypot(tx-x,tz-z);
 assert(map.roads.some(r=>r.foot&&r.points.slice(1).some((p,i)=>segment(x,z,r.points[i],p).d<r.width/2)));
 for(let i=-5;i<=2;i+=.25){const px=x+(tx-x)/d*i,pz=z+(tz-z)/d*i;assert(terrain.land(px,pz));assert(!terrain.obstructed(px,pz,.65));assert(Math.abs(terrain.height(px,pz)-2)<.01);}
});
test('Golf clubhouse footprint stays aligned with authoritative building collision',()=>{
 const building=map.buildings.find(b=>b.id===layout.id)!;const c=Math.cos(layout.angle),s=Math.sin(layout.angle);
 layout.polygon.forEach(([u,v],i)=>{assert(Math.hypot(layout.center[0]+c*u-s*v-building.points[i][0],layout.center[1]+s*u+c*v-building.points[i][1])<.002);});
 assert(terrain.obstructed(...layout.center as Point));
});
test('all thirty Golf Center mats are on dry land, clear of existing paths and buildings',()=>{
 const audit=JSON.parse(fs.readFileSync(new URL('../../../qa/golf-export-20261103.json',import.meta.url),'utf8'));
 assert.equal(audit.stations.length,30);
 const course=map.areas.find(a=>a.id==='294968618')!;
 for(const {x,z} of audit.stations){
  assert(terrain.land(x,z));assert(!terrain.obstructed(x,z,1.5));assert(inside(x,z,course.points));
  for(const road of map.roads)for(let i=1;i<road.points.length;i++)assert(segment(x,z,road.points[i-1],road.points[i]).d>road.width/2+1.3,'station overlaps path '+road.id);
 }
});
