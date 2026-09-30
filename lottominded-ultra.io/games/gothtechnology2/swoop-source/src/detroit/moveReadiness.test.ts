import {test} from 'node:test';
import assert from 'node:assert/strict';
import {SpecialMoves,moveReadiness} from './specialMoves.ts';
const ready={grounded:true,crashed:false,speed:2,bank:0,cooldown:0,active:false,clear:true};
for(const [name,change] of Object.entries({airborne:{grounded:false},fast:{speed:9},banked:{bank:.3},blocked:{clear:false},settling:{cooldown:.5},slowGlide:{speed:0},crashed:{crashed:true}}))test(`HUD and simulation agree: ${name}`,()=>{
 const state={...ready,...change},moves=new SpecialMoves();moves.cooldown=state.cooldown;
 const message=moveReadiness(4,state);assert.ok(message);
 moves.beginStep(4,state.grounded,state.crashed,state.speed,state.bank,0,0,state.clear);
 assert.equal(moves.event,message);assert.equal(moves.active,false);
});
test('ready move launches using the same conditions as its HUD',()=>{const moves=new SpecialMoves();assert.equal(moveReadiness(4,ready),'');moves.beginStep(4,true,false,2,0,0,0,true);assert.equal(moves.active,true);});
