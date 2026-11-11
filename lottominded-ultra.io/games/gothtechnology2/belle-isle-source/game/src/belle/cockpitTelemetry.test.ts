import test from 'node:test';
import assert from 'node:assert/strict';
import {jarvsLcdReading} from './cockpitTelemetry.ts';
import type {CockpitJarvsInput} from './cockpitTelemetry.ts';
const sample=(extra:Partial<CockpitJarvsInput>={}):CockpitJarvsInput=>({
 status:'SCANNING',signalLock:true,radarMeters:null,terrainRise:0,
 threat:0,memoryCells:8,advice:'Flight path clear',suggestedLift:0,assistEnabled:false,...extra
});
test('JARVS LCD readout is a safe standby when sensors are unavailable',()=>{
 const reading=jarvsLcdReading();
 assert.equal(reading.status,'STANDBY');assert.equal(reading.radar,'SCAN STANDBY');
 assert.equal(reading.assist,'ASSIST INACTIVE');assert.equal(reading.risk,0);
 assert.equal(jarvsLcdReading(sample({signalLock:false,radarMeters:3,assistEnabled:true})).radar,'SCAN STANDBY');
});
test('forward radar, terrain rise, bounded memory and advice reach the real LCD readout',()=>{
 const r=jarvsLcdReading(sample({status:'CAUTION',radarMeters:7.65,terrainRise:3.19,
 threat:.48,memoryCells:13,advice:'Rising terrain — increase clearance',assistEnabled:true,suggestedLift:.2}));
 assert.equal(r.status,'CAUTION');assert.equal(r.radar,'SCAN 8m');assert.equal(r.terrain,'RISE +3.2m');
 assert.equal(r.cells,'ROUTE 13/64');assert.equal(r.risk,.48);
 assert.equal(r.assist,'ASSIST LIFT');assert.match(r.advice,/terrain/);
});
test('null radar never claims a verified clear route and assist is only reported as armed',()=>{
 const r=jarvsLcdReading(sample({status:'SCANNING',radarMeters:null,assistEnabled:true}));
 assert.equal(r.radar,'SCAN NO RETURN');assert.equal(r.assist,'ASSIST ARMED');
});
test('malformed or out-of-range sensor values cannot corrupt the physical HUD',()=>{
 const r=jarvsLcdReading(sample({status:'CRITICAL',radarMeters:Infinity,
 terrainRise:Infinity,threat:4,memoryCells:999,advice:'Contact detected',suggestedLift:0}));
 assert.equal(r.radar,'SCAN NO RETURN');assert.equal(r.terrain,'RISE +0.0m');
 assert.equal(r.risk,1);assert.equal(r.cells,'ROUTE 64/64');assert.equal(r.assist,'ASSIST OFF');
});
