import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {KOI_POND_ID,KOI_COUNT,TEMPERANCE_VIEW,koiPose,fountains,flowPoint,waterLevel,natureMix} from './waterFeatures.ts';
import {inside,segment,ParkTerrain,type ParkMap} from './terrain.ts';
import {greenhouseInside} from './conservatory.ts';
const map=JSON.parse(readFileSync(new URL('../../public/belle/map.json',import.meta.url),'utf8')) as ParkMap;
test('all koi remain submerged and clear of the real pond shoreline for a full orbit',()=>{
 const pond=map.waterSources!.find(w=>w.id===KOI_POND_ID)!;assert(pond);
 for(let i=0;i<KOI_COUNT;i++)for(let time=0;time<120;time+=.25){const p=koiPose(i,time);assert(inside(p.x,p.z,pond.points));assert(p.y+.1*p.size<1.05);assert(p.y-.1*p.size>.2);assert(pond.points.slice(1).every((b,j)=>segment(p.x,p.z,pond.points[j],b).d>.4));assert(Number.isFinite(p.yaw));}
});
test('every modeled fountain flows into its existing receiving bowl',()=>{
 const all=fountains(map);assert.deepEqual(all.map(f=>f.id).sort(),['9146545','6169445676','6179290151'].sort());
 for(const source of all)for(const f of source.flows){assert.deepEqual(flowPoint(f,0),f.from);assert(flowPoint(f,1).every((v,i)=>Math.abs(v-f.to[i])<1e-9));assert(f.seconds>0);for(let t=0;t<=1;t+=.02){assert(flowPoint(f,t).every(Number.isFinite));assert(flowPoint(f,t)[1]>=Math.min(f.from[1],f.to[1])-.001);}}
 const scott=all.find(f=>f.id==='9146545')!;assert(scott.flows.some(f=>flowPoint(f,.5)[1]>12));assert(scott.flows.some(f=>f.to[1]===.42));
});
test('water audio rolls off and all channels obey mute, pause and volume',()=>{
 const all=fountains(map),f=all[0];assert(waterLevel(all,f.x,f.z)>.5);assert.equal(waterLevel(all,-9000,-9000),0);const near=waterLevel([f],f.x+f.range*.1,f.z),far=waterLevel([f],f.x+f.range*.9,f.z);assert(near>far&&far>0);
 for(const mix of [natureMix(false,true,1,false,1),natureMix(true,false,1,false,1),natureMix(true,true,0,false,1)])assert.deepEqual(mix,{wind:0,birds:0,water:0});
 assert(natureMix(true,true,.5,true,0).birds<natureMix(true,true,.5,false,0).birds);
 assert.deepEqual(natureMix(true,true,NaN,false,1),{wind:0,birds:0,water:0});
});

test('indoor fountain visit lands on a clear conservatory floor',()=>{const terrain=new ParkTerrain(map),[x,z]=TEMPERANCE_VIEW;assert(terrain.land(x,z));assert(!terrain.obstructed(x,z,.5));assert(greenhouseInside(map.conservatory!,x,z));});
