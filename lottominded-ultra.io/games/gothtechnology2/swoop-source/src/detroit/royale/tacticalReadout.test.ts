import test from 'node:test';import assert from 'node:assert/strict';
import {tacticalStatus,evadeReadyAt,tacticalKeyLabel,type TacticalContext} from './tacticalReadout.ts';
const ready=(extra:Partial<TacticalContext>={}):TacticalContext=>({phase:'active',tick:300,alive:true,footMode:2,prone:0,vaulting:false,canVault:true,smokeCharges:2,smokeReady:0,evadeUntil:0,staggerUntil:0,health:65,healthPacks:1,healingUntil:0,...extra});
test('smoke stock and exact cooldown transition do not claim an unavailable throw is ready',()=>{
 assert.equal(tacticalStatus('smoke',ready()).label,'2 ready');
 const cooldown=tacticalStatus('smoke',ready({smokeCharges:1,smokeReady:390}));assert.equal(cooldown.state,'cooldown');assert.equal(cooldown.label,'1 · 1.5s');
 assert(tacticalStatus('smoke',ready({tick:390,smokeReady:390})).available);
 assert.equal(tacticalStatus('smoke',ready({smokeCharges:0,smokeReady:390})).label,'Empty');
 assert.equal(tacticalStatus('smoke',ready({footMode:0})).reason,'Get off your wheel to throw smoke');
});
test('evade shows active motion then recovery and becomes ready at the authority boundary',()=>{
 assert.equal(evadeReadyAt(0),0);assert.equal(evadeReadyAt(396),480);
 assert.equal(tacticalStatus('evade',ready({evadeUntil:396})).state,'active');
 assert.equal(tacticalStatus('evade',ready({tick:396,evadeUntil:396})).label,'1.4s');
 assert.equal(tacticalStatus('evade',ready({tick:479,evadeUntil:396})).available,false);
 assert.equal(tacticalStatus('evade',ready({tick:480,evadeUntil:396})).available,true);
 assert.equal(tacticalStatus('evade',ready({prone:.3})).reason,'Stand up before evading');
 assert.equal(tacticalStatus('evade',ready({staggerUntil:320})).available,false);
});
test('heal explains full health, active healing and empty inventory without spending anything',()=>{
 const full=ready({health:100});assert.equal(tacticalStatus('repair',full).reason,'Already at full health · no pack used');assert.equal(full.healthPacks,1);
 assert.equal(tacticalStatus('repair',ready({healingUntil:480})).label,'3.0s');
 assert.equal(tacticalStatus('repair',ready({healthPacks:0})).reason,'Find a health pack to heal');
 assert(tacticalStatus('repair',ready()).available);
});
test('deployment, elimination, mount transition and traversal block their contextual actions',()=>{
 for(const action of ['smoke','evade','vault','repair'] as const){assert.equal(tacticalStatus(action,ready({phase:'deployment'})).available,false);assert.equal(tacticalStatus(action,ready({alive:false})).available,false);}
 assert.equal(tacticalStatus('vault',ready({footMode:1})).label,'Dismounting');
 assert.equal(tacticalStatus('vault',ready({canVault:false})).reason,'Move closer to low cover or an open window');
 assert.equal(tacticalStatus('smoke',ready({vaulting:true})).available,false);
 assert.equal(tacticalStatus('vault',ready({evadeUntil:350})).available,false);
 assert.equal(tacticalKeyLabel('KeyM'),'M');assert.equal(tacticalKeyLabel('Digit5'),'5');
});
