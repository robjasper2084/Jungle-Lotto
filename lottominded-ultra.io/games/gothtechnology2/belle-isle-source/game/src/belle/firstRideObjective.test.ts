import test from 'node:test';
import assert from 'node:assert/strict';
import {chooseFirstRideDestination} from './firstRideObjective.ts';
test('first ride guidance favors recognizable landmarks at navigable distances',()=>{
 const start={x:0,z:0},list=[{name:'Near spawn',x:20,z:0},{name:'Belle Isle Casino',x:800,z:100},{name:'MacArthur Bridge',x:450,z:50}];
 assert.equal(chooseFirstRideDestination(list,start)?.name,'MacArthur Bridge');
 assert.equal(chooseFirstRideDestination([{name:'Short trail',x:190,z:0}],start)?.name,'Short trail');
 assert.equal(chooseFirstRideDestination([{name:'Too close',x:30,z:0}],start),undefined);
});
