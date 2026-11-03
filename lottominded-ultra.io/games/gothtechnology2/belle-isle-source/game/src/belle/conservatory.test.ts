import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';
import {ENCLOSED_SHELTERS} from './referenceSites.ts';
import {ParkTerrain,type ParkMap} from './terrain.ts';
import {greenhouseWorld,greenhouseInside,greenhouseRoom} from './conservatory.ts';
const map=JSON.parse(fs.readFileSync(new URL('../../public/belle/map.json',import.meta.url),'utf8')) as ParkMap,c=map.conservatory!,terrain=new ParkTerrain(map);
test('greenhouse main entrance is open in both directions; adjacent glass blocks',()=>{
 for(const [u,v,du,dv,want] of [[-24,0,1,0,false],[-9,0,-1,0,false],[-24,3,1,0,true]] as const){
  const p=greenhouseWorld(c,u,v),q=greenhouseWorld(c,u+du,v+dv);
  const hit=terrain.raycastObstacle({...p,y:3},{x:q.x-p.x,y:0,z:q.z-p.z},15,.35);
  assert.equal(hit!==null,want,`${u},${v} entrance clearance`);
 }
});
test('five connected plant houses have clear walking approaches',()=>{
 const routes=[ [[-24,0],[0,0],[18,0]], [[0,0],[0,-20],[0,-30]], [[0,0],[0,20],[3.5,21],[3.5,27.7],[0,28.5],[0,34]] ];
 for(const route of routes)for(let j=1;j<route.length;j++){
  const a=greenhouseWorld(c,...route[j-1] as [number,number]),b=greenhouseWorld(c,...route[j] as [number,number]);
  const length=Math.hypot(b.x-a.x,b.z-a.z),d={x:(b.x-a.x)/length,y:0,z:(b.z-a.z)/length};
  assert.equal(terrain.raycastObstacle({...a,y:3},d,length,.32),null,`blocked aisle ${route[j-1]} -> ${route[j]}`);
 }
 for(const r of c.rooms){const p=greenhouseWorld(c,...r.point as [number,number]);assert(greenhouseInside(c,p.x,p.z));assert.equal(greenhouseRoom(c,p.x,p.z),r.name);assert(!terrain.obstructed(p.x,p.z,.32),r.name+" must be outside adjacent building footprints");}
});
test('plant beds block riding; unrelated buildings keep solid collision',()=>{
 const bed=c.beds[0],p=greenhouseWorld(c,bed.u,bed.v);assert(terrain.obstructed(p.x,p.z,.1));
 const enterable=new Set(['264321737',c.id,map.aquarium?.id,...(map.dossin?.ids||[])]);assert.equal(terrain.boxes.length,map.buildings.filter(b=>!enterable.has(b.id)&&(!map.facilities?.sites.some(s=>s.id===b.id&&s.kind==='shelter')||ENCLOSED_SHELTERS.has(b.id))).length);
 const outside=greenhouseWorld(c,-27,0);assert(!greenhouseInside(c,outside.x,outside.z));
});
test('monuments are uniquely identified and have matching guide entries',()=>{
 assert.equal(map.monuments!.length,22);assert.equal(new Set(map.monuments!.map(m=>m.id)).size,22);
 for(const m of map.monuments!){assert.equal(map.landmarks.filter(l=>l.id===m.id).length,1);assert(m.reference?.startsWith('https://'));assert(Number.isFinite(m.x)&&Number.isFinite(m.z));}
 const ring=map.monuments!.find(m=>m.model==='one_world')!;assert(!terrain.obstructed(ring.x,ring.z,.2),'gateway center must remain open');
 const f=map.monuments!.find(m=>m.model==='scott_fountain')!;assert(terrain.obstructed(f.x,f.z));
});

test('pond-side garden rail blocks but open gate and mapped east path remain passable',()=>{
 const rail=greenhouseWorld(c,20.7,24);assert(terrain.obstructed(rail.x,rail.z,.25));
 for(let v=18;v<38;v+=.25){const p=greenhouseWorld(c,23,v);assert(!terrain.obstructed(p.x,p.z,.32),'east pond path at '+v);}
 for(let u=22;u<=24;u+=.25){const p=greenhouseWorld(c,u,34);assert(!terrain.obstructed(p.x,p.z,.32),'open gate at '+u);}
});
