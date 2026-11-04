import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';
import {planStreetLights} from './streetLightPlan.ts';import {ParkTerrain,inside,type ParkMap} from './terrain.ts';import {roadIndex} from './streetPlan.ts';
const map=JSON.parse(fs.readFileSync(new URL('../../public/belle/map.json',import.meta.url),'utf8')) as ParkMap,terrain=new ParkTerrain(map),lamps=planStreetLights(map),occupied=roadIndex(map.roads);
test('street lamps illuminate main routes and visitor paths without entering travel corridors',()=>{
 assert.ok(lamps.length>120&&lamps.length<1200);assert.ok(lamps.some(l=>l.kind==='path'));assert.ok(lamps.some(l=>Math.hypot(l.x,l.z)<100));
 for(const l of lamps){assert.ok(terrain.land(l.x,l.z));assert.ok(!terrain.bridge(l.x,l.z).active);assert.ok(!occupied(l.x,l.z,'',.5));assert.ok(!map.buildings.some(b=>inside(l.x,l.z,b.points)));assert.ok(Number.isFinite(l.y));}
});
test('woodland footpaths do not receive an uninterrupted row of street lamps',()=>{
 for(const l of lamps.filter(l=>l.kind==='path'))assert.ok(map.landmarks.some(p=>Math.hypot(p.x-l.x,p.z-l.z)<100));
 for(let i=0;i<lamps.length;i++)for(let j=i+1;j<lamps.length;j++)assert.ok(Math.hypot(lamps[i].x-lamps[j].x,lamps[i].z-lamps[j].z)>=19.999);
});
