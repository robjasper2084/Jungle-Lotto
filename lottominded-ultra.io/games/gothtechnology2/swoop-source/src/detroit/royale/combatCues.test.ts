import test from 'node:test';import assert from 'node:assert/strict';
import {CombatCueTracker,combatCueDuration,type CombatCueFrame} from './combatCues.ts';
const frame=(tick:number,shield:number,events:CombatCueFrame['events']=[],extra:Partial<CombatCueFrame['actors'][number]>={}):CombatCueFrame=>({round:'one',tick,actors:[{id:'enemy',alive:true,shield,spawnSerial:0,...extra}],events});
const hit=(tick:number)=>({tick,kind:'hit',actor:'me',target:'enemy'});
test('confirmed shield hits, breaks and body hits survive repeated snapshot delivery',()=>{
 const c=new CombatCueTracker();assert.equal(c.update(frame(10,50),'me'),undefined);
 assert.deepEqual(c.update(frame(11,30,[hit(11)]),'me'),{kind:'shield',target:'enemy'});
 assert.equal(c.update(frame(11,30,[hit(11)]),'me'),undefined);
 assert.deepEqual(c.update(frame(12,0,[hit(11),hit(12)]),'me'),{kind:'shield-break',target:'enemy'});
 assert.deepEqual(c.update(frame(13,0,[hit(13)]),'me'),{kind:'hit',target:'enemy'});
 assert(combatCueDuration('eliminated')>combatCueDuration('hit'));
});
test('a shot alone, another attacker, a stale event and temporary shield VFX do not invent a confirmed hit',()=>{
 const c=new CombatCueTracker();const events=[{tick:20,kind:'shot',actor:'me'}, {...hit(20),actor:'someone-else'},hit(1)];
 assert.equal(c.update(frame(40,0,events),'me'),undefined);
 assert.deepEqual(c.update(frame(41,0,[hit(41)]),'me'),{kind:'hit',target:'enemy'});
});
test('only confirmed kill attribution wins over a hit and elimination is announced once',()=>{
 const c=new CombatCueTracker();c.update(frame(10,20),'me');
 const dead=frame(11,0,[hit(11)],{alive:false,elimination:{tick:11,killer:{id:'other'}}});
 assert.equal(c.update(dead,'me')?.kind,'shield-break');
 const own=frame(12,0,[hit(12)],{alive:false,elimination:{tick:12,killer:{id:'me'}}});
 assert.equal(c.update(own,'me')?.kind,'eliminated');assert.equal(c.update(own,'me'),undefined);
});
test('round changes, respawns and missing target baselines never invent shield breaks',()=>{
 const c=new CombatCueTracker();c.update(frame(10,50),'me');
 assert.equal(c.update(frame(11,0,[hit(11)],{spawnSerial:1}),'me')?.kind,'hit');
 assert.equal(c.update({...frame(11,0,[hit(11)]),round:'two'},'me')?.kind,'hit');
 assert.equal(c.update(frame(1,0,[hit(1)]),'me')?.kind,'hit');
});
test('melee contact plus damage produces one cue and an out-of-view confirmed hit remains generic',()=>{
 const c=new CombatCueTracker();const f={...frame(5,0,[{...hit(5),kind:'melee-hit'},hit(5)]),actors:[]};
 assert.deepEqual(c.update(f,'me'),{kind:'hit',target:'enemy'});assert.equal(c.update(f,'me'),undefined);
});
test('personal elimination counter confirms out-of-view kills once without revealing a victim',()=>{
 const c=new CombatCueTracker();const start={...frame(10,0),actors:[],self:{kills:0}};assert.equal(c.update(start,'me'),undefined);
 const killed={...start,tick:11,self:{kills:1}};assert.deepEqual(c.update(killed,'me'),{kind:'eliminated'});assert.equal(c.update(killed,'me'),undefined);
 assert.equal(c.update({...killed,tick:12,actors:frame(12,0,[],{alive:false,elimination:{tick:11,killer:{id:'me'}}}).actors},'me'),undefined);
 assert.equal(c.update({...start,round:'new'},'me'),undefined);
 assert.equal(new CombatCueTracker().update(killed,'me'),undefined,'joining an existing snapshot does not replay earlier kills');
});
