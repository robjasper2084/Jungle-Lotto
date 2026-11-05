import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createHash} from 'node:crypto';
import {ParkTerrain,type ParkMap} from './terrain.ts';
const map=JSON.parse(fs.readFileSync(new URL('../../public/belle/map.json',import.meta.url),'utf8')) as ParkMap;
const terrain=new ParkTerrain(map);
test('White House and stable landmarks retain their original mapped footprints',()=>{
 const originalHashes:Record<string,string>={"507125654":"dbbba1254443272f527efd99070866182eb853b9ea4921f19e81139e2a6b1696","507290052":"a8e3cdd29edd3442aea4162b10c8f7715e655574c6464e7503dd37133ad39b39"};
 for(const id of ['507125654','507290052']){
  assert.equal(createHash('sha256').update(JSON.stringify(map.buildings.find(b=>b.id===id))).digest('hex'),originalHashes[id]);
  assert.equal(map.landmarks.filter(l=>l.id===id).length,1);
  assert.equal(map.pois.filter(p=>p.id===id).length,1);
 }
});
test('historic-building review approaches are dry and collision-free',()=>{
 for(const h of map.historicHouses!){assert(terrain.land(...h.view),h.name);assert(!terrain.obstructed(...h.view,1),h.name+' approach');}
});
test('stable yard remains open while its mapped wings remain solid',()=>{
 const h=map.historicHouses!.find(h=>h.id==='507290052')!;
 const point=(u:number,v:number):[number,number]=>[h.center[0]+Math.cos(h.angle)*u-Math.sin(h.angle)*v,h.center[1]+Math.sin(h.angle)*u+Math.cos(h.angle)*v];
 assert(!terrain.obstructed(...point(0,33),.3),'courtyard must not become a full bounding box');
 assert(terrain.obstructed(...point(-36,33),.3),'west wing');
 assert(terrain.obstructed(...point(30,33),.3),'east wing');
});
