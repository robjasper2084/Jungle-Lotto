import {test} from 'node:test';
import assert from 'node:assert/strict';
import {routeGuide} from './routeGuide.ts';
test('guide gives heading-relative turns and backtracking after a missed gate',()=>{
 assert.match(routeGuide(0,0,0,{x:0,z:20}),/AHEAD.*20 m/);
 assert.match(routeGuide(0,0,0,{x:20,z:0}),/RIGHT/);
 assert.match(routeGuide(0,0,0,{x:-20,z:0}),/LEFT/);
 assert.match(routeGuide(0,0,0,{x:0,z:-20}),/TURN BACK/);
 assert.match(routeGuide(0,0,Math.PI/2,{x:20,z:0}),/AHEAD/);
});
