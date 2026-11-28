import test from 'node:test';
import assert from 'node:assert/strict';
import {createJeffersonPedestrianClearance,type JeffersonWalkingCorridor} from './jeffersonPedestrianClearance.ts';
const corridor=(points:JeffersonWalkingCorridor['points'],widthM=3.6):JeffersonWalkingCorridor=>({id:'source-walk',sourceIds:[101],points,widthM,category:'sidewalk'});

test('full signal base stays outside central walking band while a broad sidewalk retains furnishing space',()=>{
 const clear=createJeffersonPedestrianClearance([corridor([[0,0],[50,0]])]);
 assert.equal(clear(10,0,.33),false);
 assert.equal(clear(10,1.32,.33),false);
 assert.equal(clear(10,1.34,.33),true);
 assert.equal(clear(10,1.34,.5),false,'complete larger base is checked, not its center only');
 assert.equal(clear(10,1.7,.33),true);
});

test('narrow sidewalks retain their whole width and endpoint approach across cell boundaries',()=>{
 const clear=createJeffersonPedestrianClearance([corridor([[31.8,0],[64.1,0]],1.2)]);
 assert.equal(clear(31.3,0,.33),false);
 assert.equal(clear(64.5,.4,.33),false);
 assert.equal(clear(45,.99,.33),false);
 assert.equal(clear(45,1.04,.33),true);
 assert.equal(clear(30,0,.33),true);
 assert.equal(clear(66,0,.33),true);
});

test('source breaks remain breaks and invalid placement coordinates never pass',()=>{
 const clear=createJeffersonPedestrianClearance([corridor([[0,0],[5,0]]),corridor([[10,0],[15,0]])]);
 assert.equal(clear(7.5,0,.33),true);
 assert.equal(clear(NaN,0,.33),false);
 assert.equal(clear(0,Infinity,.33),false);
 assert.equal(clear(0,0,-1),false);
 assert.equal(clear(-1000,1000,.33),true);
});
