import test from 'node:test';
import assert from 'node:assert/strict';
import map from '../../public/belle/map.json' with {type:'json'};
import source from './showcaseStops.json' with {type:'json'};
import type {ParkMap} from './terrain.ts';
import {resolveShowcaseStops,SHOWCASE_ROUTE_ID} from './showcaseStops.ts';

const park=map as ParkMap;
test('showcase resolves exactly three real map destinations in route order',()=>{
 const stops=resolveShowcaseStops(park);
 assert.equal(SHOWCASE_ROUTE_ID,'belle-showcase-bridge-wooded-canals-blue-heron');
 assert.deepEqual(stops.map(s=>s.id),['macarthur-bridge','wooded-canals','blue-heron-lagoon']);
 assert.deepEqual(stops.map(s=>s.destination.id),['macarthur-overlook','32613741','32613819']);
 assert.equal(new Set(stops.map(s=>s.destination.id)).size,3);
 for(const stop of stops){assert.ok(Number.isFinite(stop.destination.x));assert.ok(Number.isFinite(stop.destination.z));}
});
test('MacArthur travel target is next to the mapped bridge entrance',()=>{
 const bridge=resolveShowcaseStops(park)[0].destination;
 const end=park.bridge.b;
 assert.ok(Math.hypot(bridge.x-end[0],bridge.z-end[1])<100);
});
test('wooded canal uses the mapped Nashua Canal POI, not a generic forest camera',()=>{
 const canal=resolveShowcaseStops(park)[1].destination;
 assert.equal(canal.name,'Nashua Canal');
 assert.ok(park.areas.some(a=>a.name==='Belle Isle Flatwoods'&&a.kind==='wood'));
});
test('Blue Heron stop matches the mapped lagoon habitat view',()=>{
 assert.equal(resolveShowcaseStops(park)[2].destination.id,park.lagoonHabitat?.id);
 assert.ok(park.lagoonHabitat?.view.every(Number.isFinite));
 assert.ok(park.lagoonHabitat?.look.every(Number.isFinite));
});
test('missing landmark is an error instead of an invented fallback',()=>{
 const altered={...park,pois:park.pois.filter(p=>p.id!=='32613741')};
 assert.throws(()=>resolveShowcaseStops(altered),/Missing or renamed/);
});
test('route metadata is unique and has verifiable public references',()=>{
 assert.equal(source.stops.length,3);
 assert.equal(new Set(source.stops.map(s=>s.id)).size,3);
 for(const s of source.stops){assert.match(s.reference,/^https:\/\//);assert.ok(s.focus.length>20);}
});

test('Nashua Canal remains immediately beside mapped lagoon water and Flatwoods',()=>{
 const place=resolveShowcaseStops(park)[1].destination;
 const distance=(ring:[number,number][])=>{
  let best=Infinity;
  for(let i=0;i<ring.length;i++){
   const a=ring[i],b=ring[(i+1)%ring.length],dx=b[0]-a[0],dz=b[1]-a[1];
   const len=dx*dx+dz*dz,t=len?Math.min(1,Math.max(0,((place.x-a[0])*dx+(place.z-a[1])*dz)/len)):0;
   best=Math.min(best,Math.hypot(place.x-a[0]-dx*t,place.z-a[1]-dz*t));
  }
  return best;
 };
 const water=park.waterSources?.find(w=>w.id==='17884439');
 assert.ok(water,'Nashua lagoon source must exist');
 assert.ok(distance(water.points)<15,'Canal POI must stay beside mapped water');
 const woods=park.areas.filter(a=>a.name==='Belle Isle Flatwoods');
 assert.ok(woods.length>0);
 assert.ok(woods.some(a=>distance(a.points)<15),'Canal POI must stay near woodland edge');
});
