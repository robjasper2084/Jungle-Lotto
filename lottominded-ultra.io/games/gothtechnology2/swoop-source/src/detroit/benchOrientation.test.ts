import test from 'node:test';import assert from 'node:assert/strict';
import {streetFurnitureSites} from './streetFurnitureLayout.ts';
import {nearestStreetPoint,streetFacingHeading} from './roadsidePlacement.ts';
import {trailBenchHeading} from './cutLandmarks.ts';
import {cutPoint} from './world.ts';

test('all roadside benches point their open seating side at the actual road after relocation',()=>{
 const benches=streetFurnitureSites((x,z)=>x>-900&&x<4250&&z>-4200&&z<1100).filter(s=>s.asset==='bench');assert.ok(benches.length>15);
 for(const b of benches){const q=nearestStreetPoint(b,b.street)!;const dot=(Math.sin(b.heading)*(q.x-b.x)+Math.cos(b.heading)*(q.z-b.z))/q.distance;assert.ok(dot>.999,JSON.stringify(b));}
 const relocated=benches.find(b=>b.z<-1360&&b.z>-1380)!;assert.ok(relocated);assert.ok(Math.sin(relocated.heading)<0,'harbor clearance moved this bench to the opposite road verge');
});
test('waterfront benches face the nearby street rather than a fixed compass direction',()=>{
 for(const [x,z] of [[-252,-1737],[-256,-1718],[-115,-1725],[-113,-1572],[-104,-1420]]){const q=nearestStreetPoint({x,z})!,heading=streetFacingHeading({x,z});assert.ok(Math.sin(heading)*(q.x-x)+Math.cos(heading)*(q.z-z)>0);}
});
test('both banks of the Cut turn the open side of each trail bench toward its travel lane',()=>{
 for(const d of [110,570,930.563,1030,1630,2270,2520])for(const u of [-5.2,5.2]){const b=cutPoint(d,u),q=cutPoint(d,0),h=trailBenchHeading(d,u);assert.ok(Math.cos(h)*(q.x-b.x)-Math.sin(h)*(q.z-b.z)>0);}
});
