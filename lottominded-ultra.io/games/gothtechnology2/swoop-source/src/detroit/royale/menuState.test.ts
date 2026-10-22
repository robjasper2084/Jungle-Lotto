import test from 'node:test';import assert from 'node:assert/strict';import {menuAction,type RoyaleMenuState} from './menuState.ts';
const base:RoyaleMenuState={online:false,host:true,round:1,rounds:3,complete:false};
test('results advance the series instead of replacing it with a practice match',()=>{assert.deepEqual(menuAction({...base,phase:'results'}),{action:'rematch',label:'Next round 2 / 3',disabled:false});assert.equal(menuAction({...base,phase:'results',round:3,complete:true}).label,'Start new match');});
test('online guests cannot launch the next round but the host can',()=>{assert.equal(menuAction({...base,phase:'results',online:true,host:false}).disabled,true);assert.equal(menuAction({...base,phase:'results',online:true}).disabled,false);});
test('a room lobby returns to readiness and invite controls rather than gameplay',()=>{assert.equal(menuAction({...base,phase:'lobby',online:true}).action,'room');});
test('active and eliminated riders can return to their existing match',()=>{for(const phase of ['deployment','active','overtime'])assert.equal(menuAction({...base,phase}).action,'resume');assert.equal(menuAction(base).action,'practice');});
