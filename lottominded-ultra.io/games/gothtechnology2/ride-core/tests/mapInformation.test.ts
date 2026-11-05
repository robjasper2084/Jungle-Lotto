import test from 'node:test';import assert from 'node:assert/strict';
import {mapBearing,mapDistance,nearbyMapPlaces} from '../src/mapInformation.ts';
test('north-up directions wrap correctly and distances use readable units',()=>{assert.equal(mapBearing(0),'N 000°');assert.equal(mapBearing(-Math.PI/2),'W 270°');assert.equal(mapBearing(Math.PI*2),'N 000°');assert.equal(mapDistance(48.4),'48 m');assert.equal(mapDistance(1250),'1.3 km');});
test('map landmarks are nearest first, finite and deduplicated',()=>{const rows=nearbyMapPlaces({x:0,y:0},[{text:'Chapel',point:{x:30,y:40}},{text:'Gate',point:{x:3,y:4}},{text:'Gate',point:{x:6,y:8}},{text:'Invalid',point:{x:NaN,y:0}},{text:'Pond',point:{x:10,y:0}}],2);assert.deepEqual(rows.map(p=>[p.text,p.distance]),[['Gate',5],['Pond',10]]);});
