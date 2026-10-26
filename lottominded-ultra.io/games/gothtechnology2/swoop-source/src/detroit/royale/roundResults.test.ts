import test from 'node:test';import assert from 'node:assert/strict';
import {standingsDecision,type Standing} from './roundResults.ts';
const rider=(id:string,wins:number,kills:number,damage:number):Standing=>({id,name:id,wins,kills,damage});
test('drawn rounds explain an elimination tiebreak without inventing a round win',()=>{
 assert.equal(standingsDecision([rider('AI 6',0,2,230),rider('AI 1',0,1,400)]),'Round wins tied. Eliminations decide the match · 2 to 1.');
});
test('round wins take precedence over eliminations, then damage resolves equal eliminations',()=>{
 assert.equal(standingsDecision([rider('You',2,1,30),rider('AI 1',1,6,800)]),'Decided by round wins · 2 to 1.');
 assert.equal(standingsDecision([rider('AI 6',0,1,230),rider('You',0,1,190)]),'Round wins and eliminations tied. Damage decides the match · 230 to 190.');
});
test('equal scores describe a tied match rather than treating alphabetical order as a win',()=>{
 assert.equal(standingsDecision([rider('AI 1',0,0,0),rider('AI 2',0,0,0)]),'Round wins, eliminations and damage are equal. The match is tied.');
 assert.equal(standingsDecision([]),'');assert.equal(standingsDecision([rider('You',1,0,0)]),'');
});
