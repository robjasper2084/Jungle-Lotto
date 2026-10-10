import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {AmbientCyclistTraffic,cyclistCircuit} from '../../../ride-core/src/ambientCyclistTraffic.ts';
import {DetroitWorld,LENGTH,cutPoint} from './world.ts';
import {GeoTerrain} from './geo-terrain.ts';
import {routePosition} from './districtView.ts';
import {TagTerrain} from '../../../ride-core/src/tag/fixture.ts';
import {DowntownArena} from '../../../ride-core/src/royale/downtownArena.ts';

function run(traffic:AmbientCyclistTraffic){
 const starts=traffic.rides.map(r=>r.riders.map(p=>p.s));let maxStep=0;
 for(let tick=0;tick<18000;tick++){
  const observer=traffic.rides[tick%2].riders[0],before=traffic.rides.flatMap(r=>r.riders.map(p=>({x:p.x,z:p.z})));
  traffic.update(.05,observer);
  traffic.rides.flatMap(r=>r.riders).forEach((r,i)=>{maxStep=Math.max(maxStep,Math.hypot(r.x-before[i].x,r.z-before[i].z));assert.ok(Number.isFinite(r.y));});
 }
 const travel=traffic.rides.map((ride,p)=>Math.min(...ride.riders.map((r,i)=>r.s-starts[p][i])));
 assert.ok(travel.every(m=>m>traffic.route.length),JSON.stringify({travel,length:traffic.route.length,riders:traffic.telemetry()}));
 assert.ok(maxStep<1.25,'no corner teleport: '+maxStep);return {travel,length:traffic.route.length,maxStep};
}
test('Swoop: every member of both ten-rider packs completes the original mapped Cut circuit',async t=>{
 const map=await new DetroitWorld().init();t.after(()=>map.physics.free());
 const traffic=new AmbientCyclistTraffic(new GeoTerrain(map),cyclistCircuit(Array.from({length:100},(_,i)=>({...routePosition(60+i*(LENGTH-120)/99),width:5}))),523);
 t.diagnostic(JSON.stringify(run(traffic)));
});
test('Static Royale: both packs use the real arena transform and original collider map',async t=>{
 const fixture=JSON.parse(await readFile(new URL('../../public/love-tag/swoop-detroit.json',import.meta.url),'utf8'));
 const source=await TagTerrain.create(fixture),arena=new DowntownArena(source);t.after(()=>source.dispose());const f=fixture.transform;
 const traffic=new AmbientCyclistTraffic(arena,cyclistCircuit(Array.from({length:100},(_,i)=>{const p=cutPoint(60+i*(LENGTH-120)/99);return {x:(p.x-f.tx)/f.sx,z:p.z-f.tz,width:5};})),523);
 t.diagnostic(JSON.stringify(run(traffic)));
});
