import test from 'node:test';import assert from 'node:assert/strict';import {menuAction,menuPresentation,type RoyaleMenuState} from './menuState.ts';
const base:RoyaleMenuState={online:false,host:true,round:1,rounds:3,complete:false};
test('results advance the series instead of replacing it with a practice match',()=>{assert.deepEqual(menuAction({...base,phase:'results'}),{action:'rematch',label:'Next round 2 / 3',disabled:false});assert.equal(menuAction({...base,phase:'results',round:3,complete:true}).label,'Start new match');});
test('online guests cannot launch the next round but the host can',()=>{assert.equal(menuAction({...base,phase:'results',online:true,host:false}).disabled,true);assert.equal(menuAction({...base,phase:'results',online:true}).disabled,false);});
test('a room lobby returns to readiness and invite controls rather than gameplay',()=>{assert.equal(menuAction({...base,phase:'lobby',online:true}).action,'room');});
test('active and eliminated riders can return to their existing match',()=>{for(const phase of ['deployment','active','overtime'])assert.equal(menuAction({...base,phase}).action,'resume');assert.equal(menuAction(base).action,'practice');});
test('Combat Block describes its actual three riders and one round, regardless of the city selections',()=>{
 const state={...base,phase:'active',mode:'combat' as const,rounds:1,riders:3},copy=menuPresentation(state,9);
 assert.equal(copy.facts,'ROUND 1 / 1 · COMBAT BLOCK');assert.match(copy.brief,/you \+ 2 AI opponents · one round/);assert.equal(copy.captionTitle,'3 RIDERS.\nONE ROUND.');assert.doesNotMatch(copy.captionDetail,/Detroit/);
 assert.equal(menuAction({...state,phase:'results',complete:true}).label,'Retry Combat Block');assert.match(menuPresentation({...state,phase:'results',complete:true},9).brief,/one-round drill/);
});
test('range copy never describes a competitive ten-rider match',()=>{
 const state={...base,phase:'active',mode:'range' as const,riders:1},copy=menuPresentation(state,9);
 assert.equal(copy.facts,'SHOOTING RANGE · SOLO DRILLS · 10–100 M');assert.equal(copy.captionDetail,'Solo targets / Shooting range');assert.match(copy.brief,/aiming and cover drills/);assert.equal(menuAction(state).label,'Return to range');
});
test('city copy uses actual participants and resets to the selected practice after leaving training',()=>{
 assert.equal(menuPresentation({...base,phase:'active',riders:6},9).captionTitle,'6 RIDERS.\nONE SURVIVOR.');
 const selected=menuPresentation({...base,mode:'combat',riders:3},2);assert.equal(selected.brief,'3-rider practice · you + 2 AI opponents');assert.equal(selected.captionTitle,'3 RIDERS.\nONE SURVIVOR.');
 assert.equal(menuPresentation(base,0).brief,'Solo exploration · no AI opponents');
});
