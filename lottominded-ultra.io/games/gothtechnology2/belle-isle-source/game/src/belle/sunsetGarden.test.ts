import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import * as T from 'three';
import {ParkTerrain,segment,type ParkMap} from './terrain.ts';
import {addSunsetGarden} from './sunsetGarden.ts';
import {referenceSpawn,SUNSET_GARDEN} from './sunsetReferencePolicy.ts';
import type {Solid} from './flightCollision.ts';
const map:ParkMap=JSON.parse(readFileSync(new URL('../../public/belle/map.json',import.meta.url),'utf8'));
test('reference spawn stays on a clear motor road facing the point',()=>{const p=referenceSpawn(map),terrain=new ParkTerrain(map);assert(terrain.land(p.x,p.z));assert(!terrain.obstructed(p.x,p.z,2));assert(Math.sin(p.heading)<-.8);assert(map.roads.some(r=>!r.foot&&r.points.some((b,i)=>i>0&&segment(p.x,p.z,r.points[i-1],b).d<.1)));});
test('scenery geometry and collision remain bounded and keep route shoulders clear',async()=>{
 const scene=new T.Scene(),terrain=new ParkTerrain(map),solids:Solid[]=[];const add=terrain.flightSolids.add.bind(terrain.flightSolids);terrain.flightSolids.add=s=>{solids.push(s);add(s);};const garden=await addSunsetGarden(scene,map,terrain);
 assert(garden.stats.trees>30&&garden.stats.trees<=95);assert(garden.stats.leaves<=95*2400);
 const routes=map.roads.flatMap(r=>r.points.slice(1).map((b,i)=>({a:r.points[i],b,w:r.width})));
 for(const s of solids){assert(terrain.land(s.x,s.z));assert(Math.hypot(s.x-SUNSET_GARDEN.x,s.z-SUNSET_GARDEN.z)<345);const clearance=Math.min(...routes.map(r=>segment(s.x,s.z,r.a,r.b).d-r.w*.5));assert(clearance>s.radius+.15,`${s.kind} overlaps route at ${s.x},${s.z}`);}
 garden.root.traverse(o=>{if(o instanceof T.Mesh){const p=o.geometry.getAttribute('position');for(let i=0;i<p.count;i++)assert(Number.isFinite(p.getX(i))&&Number.isFinite(p.getY(i))&&Number.isFinite(p.getZ(i)));}});
 garden.setQuality('smooth');assert.equal(garden.root.getObjectByName('Reference full autumn maple canopies')!.visible,false);garden.setQuality('high');assert.equal(garden.root.getObjectByName('Reference full autumn maple canopies')!.visible,true);
 garden.update(3000,3000);assert.equal(garden.root.visible,false);garden.update(0,1450);assert.equal(garden.root.visible,true);
});
