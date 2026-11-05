import test from 'node:test';
import assert from 'node:assert/strict';
import {playerLabel,eliminationLabel} from './playerIdentity.ts';
test('player identity preserves chosen names, labels bots, and removes misleading controls',()=>{
 assert.equal(playerLabel('Night Rider'),'Night Rider');assert.equal(playerLabel('Echo',true),'Echo [AI]');assert.equal(playerLabel('   '),'Rider');assert.equal(playerLabel('Rider\u202e123'),'Rider123');assert.equal(playerLabel('<b>Ace</b>'),'<b>Ace</b>');
});
test('death copy distinguishes an actual killer from arena and disconnect deaths',()=>{
 assert.equal(eliminationLabel({tick:1,cause:'rider',killer:{id:'a',name:'Night Rider',bot:false}}),'Eliminated by Night Rider');assert.equal(eliminationLabel({tick:1,cause:'field'}),'Eliminated by the Static Field');assert.equal(eliminationLabel({tick:1,cause:'disconnect'}),'Eliminated after disconnecting');assert.equal(eliminationLabel(),'Eliminated');
});
