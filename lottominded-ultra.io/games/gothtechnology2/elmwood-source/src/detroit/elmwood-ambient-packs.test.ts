import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {AmbientCyclistTraffic} from '../../../ride-core/src/ambientCyclistTraffic.ts';
import {ElmwoodTerrain} from './elmwood-terrain.ts';
import {rideCoreTerrain} from './ridecore-terrain.ts';
import {elmwoodCommunityRoute} from './elmwood-community-route.ts';
const read=async(name:string)=>JSON.parse(await readFile(new URL('../../public/elmwood/'+name,import.meta.url),'utf8'));
test('two ten-rider packs traverse the whole real Elmwood circuit with random starts',async t=>{
 const [grid,site,placements]=await Promise.all(['terrain.json','site.json','placements.json'].map(read));
 const map=new ElmwoodTerrain(grid,site.features,placements);await map.init();t.after(()=>map.physics.free());
 const traffic=new AmbientCyclistTraffic(rideCoreTerrain(map),elmwoodCommunityRoute(map.features).points,523);
 assert.deepEqual(traffic.rides.map(r=>r.riders.length),[10,10]);const starts=traffic.rides.map(r=>r.riders.map(p=>p.s));
 let maxStep=0,allStopped=0;
 for(let tick=0;tick<12000;tick++){
  const lead=traffic.rides[0].riders[0],before=traffic.rides.flatMap(r=>r.riders.map(p=>({x:p.x,z:p.z})));
  traffic.update(.05,lead);
  traffic.rides.flatMap(r=>r.riders).forEach((r,i)=>{maxStep=Math.max(maxStep,Math.hypot(r.x-before[i].x,r.z-before[i].z));assert.ok(Number.isFinite(r.y));});
  allStopped=traffic.rides.every(r=>r.riders.every(p=>p.speed<.1))?allStopped+1:0;assert.ok(allStopped<200,'both packs must not stall');
 }
 traffic.rides.forEach((ride,p)=>ride.riders.forEach((r,i)=>assert.ok(r.s-starts[p][i]>traffic.route.length,'every cyclist completes a full loop: '+JSON.stringify(r))));
 assert.ok(maxStep<1.2,'frame movement remains bounded: '+maxStep);
 t.diagnostic(JSON.stringify({length:traffic.route.length,packs:traffic.rides.map(r=>({count:r.riders.length,minTravel:Math.min(...r.riders.map((c,i)=>c.s-starts[traffic.rides.indexOf(r)][i]))})),maxStep}));
 const old=[...traffic.starts];traffic.restart(98123);assert.notDeepEqual(traffic.starts,old);
});
