import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import type {ParkMap} from './terrain.ts';
import {resolveEnvironmentZones,ENVIRONMENT_ZONE_ID,ENVIRONMENT_ZONE_NAMES} from './environmentZones.ts';
const map:ParkMap=JSON.parse(readFileSync(new URL('../../public/belle/map.json',import.meta.url),'utf8'));
test('four thematic environment zones each contain two real mapped views',()=>{
 const zones=resolveEnvironmentZones(map);
 assert.equal(ENVIRONMENT_ZONE_ID,'belle-four-zone-visual-audit');
 assert.deepEqual(zones.map(zone=>zone.id),['western-gateway','central-forest','northern-shoreline','eastern-recreation']);
 assert.equal(ENVIRONMENT_ZONE_NAMES.length,4);
 assert(zones.every(z=>z.stops.length===2&&z.surfaceTypes.length>=3));
 assert.equal(new Set(zones.flatMap(zone=>zone.stops.map(stop=>stop.destination.id))).size,8);
 for(const z of zones)for(const s of z.stops){assert(Number.isFinite(s.destination.x));assert(Number.isFinite(s.destination.z));assert(s.focus.length>25);}
});
test('lighthouse spelling and lagoon location match source park map, not invented locations',()=>{
 const zones=resolveEnvironmentZones(map);
 assert.equal(zones[2].stops[0].destination.name,'William Livingstone Memorial Lighthouse');
 assert.equal(zones[1].stops[1].destination.id,map.lagoonHabitat?.id);
 assert.equal(zones[1].stops[0].destination.name,'Nashua Canal');
});
test('all four zones fail closed when a named source destination is absent',()=>{
 const altered={...map,landmarks:map.landmarks.filter(l=>l.id!=='107208288'),pois:map.pois.filter((p:{id:string})=>p.id!=='107208288')};
 assert.throws(()=>resolveEnvironmentZones(altered),/Unmapped environment zone stop/);
});
test('the four-zone review cannot silently create new movement or route geometry',()=>{
 const before=JSON.stringify({roads:map.roads,bridge:map.bridge,water:map.water,spawn:map.spawn});
 resolveEnvironmentZones(map);
 assert.equal(JSON.stringify({roads:map.roads,bridge:map.bridge,water:map.water,spawn:map.spawn}),before);
});

test('Coast Guard mapped and runtime display names both resolve by stable ID',()=>{
 const zone=resolveEnvironmentZones(map)[2];
 assert.equal(zone.stops[1].destination.id,'842521472');
 assert.equal(zone.stops[1].destination.name,'Coast Guard Station');
 const amended={...map,landmarks:map.landmarks.map(l=>l.id==='842521472'?
   {...l,name:'U.S. Coast Guard Station Belle Isle'}:l)};
 const ready=resolveEnvironmentZones(amended);
 assert.equal(ready[2].stops[1].destination.name,'U.S. Coast Guard Station Belle Isle');
 const wrong={...map,landmarks:map.landmarks.map(l=>l.id==='842521472'?
   {...l,name:'Unrelated Coast Guard Alias'}:l)};
 assert.throws(()=>resolveEnvironmentZones(wrong),/Unmapped environment zone stop/);
});
