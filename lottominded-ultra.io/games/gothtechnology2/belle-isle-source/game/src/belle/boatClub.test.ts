import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {ParkTerrain,type ParkMap} from './terrain.ts';
import {BoatController} from './boatController.ts';
import {BOAT_PROFILES,type BoatKind} from './boatProfiles.ts';
import {CLUB_BERTHS,CLUB_PIERS,clubWorld,clubLocal} from './boatClubPlan.ts';
const map=JSON.parse(readFileSync(new URL('../../public/belle/map.json',import.meta.url),'utf8')) as ParkMap;
for(const kind of ['offshore','hydroplane'] as BoatKind[])test(kind+' is moored over water and can leave the real club berth without hitting the quay',()=>{
 const terrain=new ParkTerrain(map),p=CLUB_BERTHS[kind],profile=BOAT_PROFILES[kind];
 for(const forward of [-profile.length/2,0,profile.length/2])for(const side of [-profile.beam/2,profile.beam/2]){
  const x=p.x+Math.sin(p.heading)*forward+Math.cos(p.heading)*side,z=p.z+Math.cos(p.heading)*forward-Math.sin(p.heading)*side;
  assert.equal(terrain.land(x,z,0),false,'entire authored hull must remain over navigable water');
 }
 const sim=new BoatController(terrain,undefined,kind);sim.reset(p.x,p.z,p.heading);
 for(let i=0;i<240;i++){sim.advance(1/60,1,0,false);assert.equal(sim.collision,false);}
 assert(Math.hypot(sim.pose.x-p.x,sim.pose.z-p.z)>12);assert(sim.pose.speed>5);
});
test('club piers and the connected quay have walkable, matching deck heights',()=>{
 const terrain=new ParkTerrain(map);
 for(const p of CLUB_PIERS){const q=clubWorld(p.u,p.v);assert(terrain.land(q.x,q.z));assert.equal(terrain.height(q.x,q.z),.87);}
 for(const p of [[0,-20],[-31,-25],[6,-29]]){const q=clubWorld(...p as [number,number]),local=clubLocal(q.x,q.z);assert(Math.hypot(local.u-p[0],local.v-p[1])<1e-9);assert(terrain.land(q.x,q.z));assert.equal(terrain.height(q.x,q.z),2);}
});
