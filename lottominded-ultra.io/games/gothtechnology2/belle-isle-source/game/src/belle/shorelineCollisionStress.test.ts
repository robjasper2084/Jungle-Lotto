import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {ParkTerrain,type ParkMap} from './terrain.ts';
import {planBoulders} from './geology.ts';
const map:ParkMap=JSON.parse(readFileSync(new URL('../../public/belle/map.json',import.meta.url),'utf8'));
test('island, mainland, islets and inland lagoon boundaries have finite collision queries',()=>{
 const terrain=new ParkTerrain(map);
 const rings=[map.island,map.mainland,...(map.outerIslets||[]).map(x=>x.points),...map.water.map(w=>w.points),...(map.waterSources||[]).map(w=>w.points)];
 let checks=0;
 for(const ring of rings){
  const stride=Math.max(1,Math.ceil(ring.length/45));
  for(let i=0;i<ring.length;i+=stride){
   const [x,z]=ring[i],height=terrain.height(x,z);
   assert(Number.isFinite(height),'nonfinite shore height at '+x+','+z);
   assert.equal(typeof terrain.land(x,z),'boolean');
   const o={x,y:height+2,z},d={x:1,y:0,z:0};
   const hits=[terrain.raycastCamera(o,d,2,.16),terrain.raycastFlight(o,d,2,.4)];
   for(const hit of hits)assert(hit===null||(Number.isFinite(hit)&&hit>=0&&hit<=2),'invalid obstacle ray');
   checks++;
  }
 }
 assert(checks>250,'must sample shoreline, island, inlets and lake rings');
});
test('representative shoreline boulders remain in camera/flight collision regardless of draw LOD',()=>{
 const terrain=new ParkTerrain(map),rocks=planBoulders(map,terrain);
 assert(rocks.length>=12,'expected geological obstacles');
 const selected=rocks.filter((_,i)=>i%Math.max(1,Math.floor(rocks.length/12))===0).slice(0,12);
 terrain.registerBoulders(selected.map(b=>({x:b.x,z:b.z,bottom:b.y,top:b.y+b.height,radius:b.radius*.78})));
 for(const b of selected){
  assert(terrain.obstructed(b.x,b.z),'visual LOD must not remove physical rock');
  const o={x:b.x-4,y:b.y+b.height*.5,z:b.z},d={x:1,y:0,z:0};
  const flight=terrain.raycastFlight(o,d,8,.2),camera=terrain.raycastCamera(o,d,8,.2);
  assert(flight!==null&&flight<8,'flight collider lost at '+b.x);
  assert(camera!==null&&camera<8,'camera collider lost at '+b.x);
 }
});
