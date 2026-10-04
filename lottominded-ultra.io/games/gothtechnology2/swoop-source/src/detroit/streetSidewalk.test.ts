import {test} from 'node:test';
import assert from 'node:assert/strict';
import {CITY} from './geography.ts';
import {curbRise} from './streetCurbs.ts';
import {parallelStreetSidewalk} from './streetSidewalk.ts';
test('the parallel Riverwalk beside Atwater uses the existing concrete sidewalk',()=>{
 const walk=CITY.roads.find(r=>r.id==='69706033')!;
 for(let i=1;i<=3;i++)assert.equal(parallelStreetSidewalk(walk.points[i-1],walk.points[i])?.name,'Atwater Street');
 // A perpendicular crossing keeps its own route surface and lowered curb.
 assert.equal(parallelStreetSidewalk([-80,-1194],[-65,-1194]),undefined);
});
test('Atwater curb remains raised beside a parallel walking route',()=>{
 const road=CITY.roads.find(r=>r.id==='334443405')!,a=road.points[1],b=road.points[2],dx=b[0]-a[0],dz=b[1]-a[1],length=Math.hypot(dx,dz);
 const x=(a[0]+b[0])/2+dz/length*(road.width/2+.2),z=(a[1]+b[1])/2-dx/length*(road.width/2+.2);
 assert.ok(curbRise(road,x,z)>.149,'Parallel Riverwalk must not flatten this curb');
});
