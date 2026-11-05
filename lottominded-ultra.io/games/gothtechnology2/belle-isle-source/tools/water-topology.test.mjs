import test from 'node:test';
import assert from 'node:assert/strict';
import {buildWaterTopology} from './water-topology.mjs';
import {inside,ParkTerrain} from '../game/src/belle/terrain.ts';
import fs from 'node:fs';
const square=(x,z,w)=>[[x,z],[x+w,z],[x+w,z+w],[x,z+w],[x,z]];
const isLand=(p,polys)=>polys.some(poly=>inside(...p,poly[0])&&!poly.slice(1).some(h=>inside(...p,h)));
test('water subtraction retains a real island without filling an entire pond back in',()=>{
 const result=buildWaterTopology(square(0,0,100),[{points:square(20,20,60),holes:[square(45,45,10)]}],[]);
 assert(isLand([5,5],result.landPolygons));assert(!isLand([30,30],result.landPolygons));assert(isLand([50,50],result.landPolygons));
});
test('centerline-only canal joins lakes and cuts a continuous channel through land',()=>{
 const result=buildWaterTopology(square(0,0,100),[{points:square(5,40,20),holes:[]},{points:square(75,40,20),holes:[]}],[{points:[[15,50],[85,50]],width:8}]);
 for(let x=16;x<85;x++)assert(!isLand([x,50],result.landPolygons));assert(isLand([50,40],result.landPolygons));assert.equal(result.water.length,1);
});
const map=JSON.parse(fs.readFileSync(new URL('../game/public/belle/map.json',import.meta.url))),terrain=new ParkTerrain(map);
test('actual ponds and lakes remain water in both rendering and rider collision',()=>{
 for(const name of ['Model Yacht Basin','Koi & Lily Pond','Lake Tacoma','Lake Okonoka','Blue Heron Lagoon','Lake Muskoday']){
  const source=map.waterSources.find(w=>w.name===name);assert(source,name);
  const xs=source.points.map(p=>p[0]),zs=source.points.map(p=>p[1]);let count=0;
  for(let i=1;i<20;i++)for(let j=1;j<20;j++){
   const p=[Math.min(...xs)+(Math.max(...xs)-Math.min(...xs))*i/20,Math.min(...zs)+(Math.max(...zs)-Math.min(...zs))*j/20];
   if(!inside(...p,source.points)||source.holes.some(h=>inside(...p,h))||terrain.land(...p))continue;
   assert(!isLand(p,map.landPolygons),name+' is covered by grass');count++;
  }assert(count>0,name+' has no accessible water samples');
 }
});
test('every sampled mapped road and path crossing remains supported after water restoration',()=>{
 let count=0;for(const r of map.roads)for(let i=1;i<r.points.length;i++){
  const a=r.points[i-1],b=r.points[i],n=Math.ceil(Math.hypot(b[0]-a[0],b[1]-a[1])/2);
  for(let j=0;j<=n;j++){const p=[a[0]+(b[0]-a[0])*j/n,a[1]+(b[1]-a[1])*j/n];if(!inside(...p,map.island))continue;assert(terrain.land(...p),r.id+' '+r.name);count++;}
 }assert(count>20000);
});
test('all five mapped island canal routes have continuous visible water',()=>{
 assert.equal(map.waterwayRoutes.length,5);for(const r of map.waterwayRoutes)for(let i=1;i<r.points.length;i++){
  const a=r.points[i-1],b=r.points[i],p=[(a[0]+b[0])/2,(a[1]+b[1])/2];if(!inside(...p,map.island))continue;
  assert(map.water.some(w=>inside(...p,w.points)&&!w.holes.some(h=>inside(...p,h))),r.name+' missing water');
 }
});
