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
 assert.deepEqual(stops.map(s=>s.destination.id),['macarthur-overlook','51495153','32613819']);
 assert.equal(new Set(stops.map(s=>s.destination.id)).size,3);
 for(const stop of stops){assert.ok(Number.isFinite(stop.destination.x));assert.ok(Number.isFinite(stop.destination.z));}
});
test('MacArthur travel target is next to the mapped bridge entrance',()=>{
 const bridge=resolveShowcaseStops(park)[0].destination;
 const end=park.bridge.b;
 assert.ok(Math.hypot(bridge.x-end[0],bridge.z-end[1])<100);
});
test('wooded canal uses the mapped Sylvan Canal POI, not a generic forest camera',()=>{
 const canal=resolveShowcaseStops(park)[1].destination;
 assert.equal(canal.name,'Sylvan Canal');
 assert.ok(park.areas.some(a=>a.name==='Belle Isle Flatwoods'&&a.kind==='wood'));
});
test('Blue Heron stop matches the mapped lagoon habitat view',()=>{
 assert.equal(resolveShowcaseStops(park)[2].destination.id,park.lagoonHabitat?.id);
 assert.ok(park.lagoonHabitat?.view.every(Number.isFinite));
 assert.ok(park.lagoonHabitat?.look.every(Number.isFinite));
});
test('missing landmark is an error instead of an invented fallback',()=>{
 const altered={...park,pois:park.pois.filter(p=>p.id!=='51495153')};
 assert.throws(()=>resolveShowcaseStops(altered),/Missing or renamed/);
});
test('route metadata is unique and has verifiable public references',()=>{
 assert.equal(source.stops.length,3);
 assert.equal(new Set(source.stops.map(s=>s.id)).size,3);
 for(const s of source.stops){assert.match(s.reference,/^https:\/\//);assert.ok(s.focus.length>20);}
});
