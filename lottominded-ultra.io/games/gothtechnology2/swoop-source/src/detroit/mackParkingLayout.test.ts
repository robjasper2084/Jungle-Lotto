import {test} from 'node:test';
import assert from 'node:assert/strict';
import {MACK_PARKING_LOTS,parkingClearOfStudio} from './mackParkingLayout.ts';
import {studioMap} from './mackStudioSite.ts';
test('parking surfaces and painted bays stay outside the rotated studio footprint',()=>{
 assert.equal(parkingClearOfStudio({x:2495,z:-1471,width:20,depth:25}),false,'former pad fought the black slab');
 const corner=studioMap(25,0);assert.equal(parkingClearOfStudio({...corner,width:3,depth:3}),false,'edge overlap is rejected even with the centre outside');
 assert.equal(parkingClearOfStudio({x:2583,z:-1471,width:20,depth:25}),true,'clear outdoor parking stays available');
 assert.ok(MACK_PARKING_LOTS.length>0);for(const lot of MACK_PARKING_LOTS)assert.equal(parkingClearOfStudio(lot),true);
});
