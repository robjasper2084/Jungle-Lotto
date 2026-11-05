import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';
import {ParkTerrain,inside,segment,type ParkMap} from './terrain.ts';
import type {LakeHabitatPlan} from './lakeHabitatPlan.ts';
const map:ParkMap=JSON.parse(fs.readFileSync(new URL('../../public/belle/map.json',import.meta.url),'utf8'));
const plan:LakeHabitatPlan=JSON.parse(fs.readFileSync(new URL('../../public/belle/nature/okonoka.json',import.meta.url),'utf8'));
const lake=map.waterSources!.find(w=>w.id==='420959')!,terrain=new ParkTerrain(map);
const wet=(x:number,z:number)=>inside(x,z,lake.points)&&!lake.holes.some(h=>inside(x,z,h));
const roads=map.roads.flatMap(r=>r.points.slice(1).map((b,i)=>({a:r.points[i],b,w:r.width})));
test('Lake Okonoka guide points to water from a dry mapped approach',()=>{
 const cfg=map.lakeHabitat!;assert(wet(...cfg.look));assert(terrain.land(...cfg.view));assert(!terrain.obstructed(...cfg.view,1));
 assert(roads.some(r=>segment(...cfg.view,r.a,r.b).d<r.w/2));
 const marker=map.landmarks.find(l=>l.id==='420959')!;assert(wet(marker.x,marker.z));
});
test('wetland vegetation and timber preserve dry routes and open channels',()=>{
 assert(plan.reeds.length>100&&plan.reeds.length<=900);assert(plan.pads.length>100&&plan.pads.length<=1400);assert(plan.logs.length>5&&plan.logs.length<=28);
 for(const p of plan.reeds){assert(terrain.land(p.x,p.z));assert(!roads.some(r=>segment(p.x,p.z,r.a,r.b).d<r.w/2+1.98));}
 for(const p of plan.pads){assert(wet(p.x,p.z));assert(!terrain.land(p.x,p.z));assert(!roads.some(r=>segment(p.x,p.z,r.a,r.b).d<r.w/2+2.98));}
 for(const log of plan.logs)for(const t of [0,.25,.5,.75,1]){const x=log.a[0]+(log.b[0]-log.a[0])*t,z=log.a[2]+(log.b[2]-log.a[2])*t;assert(wet(x,z));assert(!roads.some(r=>segment(x,z,r.a,r.b).d<r.w/2+3.98));}
});
test('all five mapped lake islands remain dry and gain bounded woodland cover',()=>{
 const nature=JSON.parse(fs.readFileSync(new URL('../../public/belle/nature/placements.json',import.meta.url),'utf8'));
 assert.equal(lake.holes.length,5);
 for(const island of lake.holes){const trees=nature.trees.filter((p:{x:number;z:number})=>inside(p.x,p.z,island));assert(trees.length>=5);for(const p of trees)assert(terrain.land(p.x,p.z));}
});
