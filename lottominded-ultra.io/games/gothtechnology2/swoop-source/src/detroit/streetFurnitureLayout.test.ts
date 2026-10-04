import test from 'node:test';import assert from 'node:assert/strict';
import {CITY} from './geography.ts';
import {streetFurnitureSites,streetMarkingStyle,sidewalkHalfWidth} from './streetFurnitureLayout.ts';
import {roadwayClearance} from './roadsidePlacement.ts';
import {dryStreetSite} from './dryStreetSite.ts';
const sites=streetFurnitureSites((x,z)=>x>-360&&x<450&&z>-1950&&z<220);
test('Atwater receives two-way lane paint while all park walks remain unpainted',()=>{
 const roads=CITY.roads.filter(r=>r.name==='Atwater Street');assert.ok(roads.some(r=>r.kind==='unclassified'));
 for(const r of roads)assert.equal(streetMarkingStyle(r),'double-yellow');
 for(const r of CITY.roads.filter(r=>['cycleway','footway','path','pedestrian'].includes(r.kind)))assert.equal(streetMarkingStyle(r),'none');
});
test('street lights and their bases remain outside river, harbor, inlet and ponds',()=>{
 assert.ok(sites.some(s=>s.asset==='street-lamp'));
 for(const s of sites.filter(s=>s.asset==='street-lamp'))assert.ok(dryStreetSite(s.x,s.z),JSON.stringify(s));
 assert.equal(dryStreetSite(-140,-1360),false,'harbor water');
 assert.equal(dryStreetSite(-1000,-1700),false,'river water');
});
test('tall street furniture leaves sidewalks and every mapped crossing path clear',()=>{
 const tall=sites.filter(s=>!['drain-grate','utility-cover'].includes(s.asset));assert.ok(tall.length>50);
 for(const s of tall){const road=CITY.roads.find(r=>r.name===s.street)!;assert.ok(roadwayClearance(s)>=2*sidewalkHalfWidth(road)+.45-1e-6,JSON.stringify(s));assert.ok(Number.isFinite(s.heading));}
 for(const asset of ['street-lamp','camera-pole','hydrant','bench','drain-grate','bike-rack'])assert.ok(sites.some(s=>s.asset===asset&&s.street==='Atwater Street'));
});
