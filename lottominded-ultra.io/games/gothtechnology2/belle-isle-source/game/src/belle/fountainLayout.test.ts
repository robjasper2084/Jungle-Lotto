import {test} from 'node:test';import assert from 'node:assert/strict';import {readFileSync} from 'node:fs';import {scottLayout,alignScottMap,cascadePoint,cascadeLevel,CASCADE_START,CASCADE_RUN,CASCADE_SIDE,CASCADE_WIDTH,CASCADE_STEPS} from './fountainLayout.ts';import {monumentSolids} from './monumentCollision.ts';import {segment,type ParkMap} from './terrain.ts';
const map=JSON.parse(readFileSync(new URL('../../public/belle/map.json',import.meta.url),'utf8')) as ParkMap;
test('Scott monument is centered on its circular basin, not the combined cascade relation',()=>{const p=scottLayout(map);assert(Math.abs(p.x-199.34)<.1);assert(Math.abs(p.z-1310.53)<.1);assert(p.radius>17&&p.radius<17.2);alignScottMap(map);const m=map.monuments!.find(m=>m.id==='9146545')!;assert.equal(m.x,p.x);assert.equal(m.radius,p.radius);assert.equal(monumentSolids([m])[0].radius,p.radius);});
test('cascade occupies the mapped outer pool and stays clear of Fountain Drive',()=>{
 const p=scottLayout(map),m=map.monuments!.find(m=>m.id==='9146545')!,solids=monumentSolids([m]),roads=map.roads.filter(r=>r.name==='Fountain Drive');
 for(let i=1;i<CASCADE_STEPS;i++)assert(cascadeLevel(i)<cascadeLevel(i-1));
 for(let along=CASCADE_START;along<=CASCADE_START+CASCADE_RUN*CASCADE_STEPS;along+=.5)for(let side=-16.4;side<=16.4;side+=1){
  const q=cascadePoint(p,side+CASCADE_SIDE,along);assert(q[0]<137&&q[0]>105&&q[1]>1327&&q[1]<1365);
  for(const road of roads)for(let k=1;k<road.points.length;k++)assert(segment(...q,road.points[k-1],road.points[k]).d>road.width/2+1,'cascade crosses drive');
 }
 for(const road of roads)for(let k=1;k<road.points.length;k++)for(const s of solids)assert(segment(s.x,s.z,road.points[k-1],road.points[k]).d>s.radius+road.width/2,'collision blocks drive');
});
