import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import * as T from 'three';
import {ParkTerrain,inside,segment,type ParkMap} from './terrain.ts';
import {greenhouseWorld} from './conservatory.ts';
import {CONSERVATORY_SEATS,CONSERVATORY_POTS,conservatoryPondPlan} from './conservatoryGardenPlan.ts';
import {addConservatoryGarden} from './conservatoryGarden.ts';

const map=JSON.parse(fs.readFileSync(new URL('../../public/belle/map.json',import.meta.url),'utf8')) as ParkMap;
const cfg=map.conservatory!,terrain=new ParkTerrain(map);
test('new benches and pots have solid footprints while their viewing approaches remain clear',()=>{
  for(const p of [...CONSERVATORY_SEATS,...CONSERVATORY_POTS]){
    const w=greenhouseWorld(cfg,p.u,p.v);assert(terrain.obstructed(w.x,w.z,.25));
  }
  for(const [u,v]of [[0,32],[0,33],[0,34],[0,-28],[0,-29],[0,-30],[-24,0],[0,0],[16,0],[23,24],[23,34]]){
    const w=greenhouseWorld(cfg,u,v);assert(!terrain.obstructed(w.x,w.z,.35),'clear viewing approach '+u+','+v);
  }
});
test('pond additions keep full plant radii away from paths, glazing, rails and monuments',()=>{
  const plan=conservatoryPondPlan(map),pond=map.water.find(w=>w.id==='hydro-6')!;
  assert(plan.banks.length>10);assert(plan.reeds.length>2);
  for(const p of plan.banks){
    const w=greenhouseWorld(cfg,p.u,p.v);assert(!inside(w.x,w.z,pond.points));
    for(const r of map.roads)for(let i=1;i<r.points.length;i++)assert(segment(w.x,w.z,r.points[i-1],r.points[i]).d>r.width/2+p.radius+.24);
    for(const wall of [...cfg.walls,...cfg.gardenWalls||[]])assert(segment(p.u,p.v,wall.a as [number,number],wall.b as [number,number]).d>p.radius+.19);
  }
  for(const p of plan.reeds){
    const w=greenhouseWorld(cfg,p.u,p.v);assert(inside(w.x,w.z,pond.points));
    for(let i=1;i<pond.points.length;i++)assert(segment(w.x,w.z,pond.points[i-1],pond.points[i]).d>p.radius);
  }
});
test('garden geometry uses five opaque bounded batches and culls outside the conservatory',()=>{
  const scene=new T.Scene(),garden=addConservatoryGarden(scene,map);
  assert.equal(garden.stats.batches,5);assert(garden.stats.triangles<150000);assert(garden.stats.fernCrowns>=50);
  garden.update(...cfg.center as [number,number]);assert(garden.root.visible);
  for(const o of garden.root.children){
    const mesh=o as T.Mesh,g=mesh.geometry,material=mesh.material as T.MeshStandardMaterial;
    assert(!material.transparent);assert(!material.map);assert(g.boundingSphere&&Number.isFinite(g.boundingSphere.radius));
    for(const n of g.attributes.position.array)assert(Number.isFinite(n));
    g.dispose();material.dispose();
  }
  garden.update(0,0);assert(!garden.root.visible);
});
