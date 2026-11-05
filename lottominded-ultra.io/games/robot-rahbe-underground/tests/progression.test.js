import test from 'node:test';import assert from 'node:assert/strict';
import {createSimulation,serialize,update,hurt} from '../src/simulation.js';
import {buyUpgrade,seedForDay,recordRun,readProfile} from '../src/progression.js';import {routeAction} from './route-driver.js';
test('relic purchases persist, cannot double-charge, and shield absorbs one real hit',()=>{
 const s=createSimulation();s.mode='playing';s.coins=600;assert.equal(buyUpgrade(s,'shield'),true);assert.equal(s.coins,400);assert.equal(buyUpgrade(s,'shield'),false);assert.equal(s.coins,400);assert.equal(hurt(s),false);assert.equal(s.player.hp,6);assert.equal(s.shield,0);s.player.invuln=0;hurt(s);assert.equal(s.player.hp,5);buyUpgrade(s,'piercing');const loaded=createSimulation(serialize(s));assert.equal(loaded.upgrades.piercing,true);assert.equal(loaded.upgrades.shield,true);
});
test('piercing pulse hits two enemies and never damages the same target twice',()=>{
 const s=createSimulation();s.mode='playing';s.upgrades.piercing=true;s.player.x=600;const a={id:900,type:'guard',depth:0,x:680,y:440,hp:3,vx:0,min:680,max:680,shot:20},b={...a,id:901,x:730,min:730,max:730};s.world.enemies=[a,b];update(s,{shoot:true});for(let i=0;i<10;i++)update(s);assert.equal(a.hp,2);assert.equal(b.hp,2);
});
test('daily layouts are deterministic and 128 distinct challenge routes complete with normal damage',()=>{
 assert.equal(seedForDay('2026-10-10'),seedForDay('2026-10-10'));assert.notEqual(seedForDay('2026-10-10'),seedForDay('2026-10-11'));
 for(let seed=1;seed<=128;seed++){const s=createSimulation(null,{mode:'daily',seed});s.mode='playing';for(let frame=0;frame<18000&&s.mode==='playing';frame++){update(s,routeAction(s));s.events=[];}assert.equal(s.mode,'won','seed '+seed);assert.equal(s.world.seals.filter(x=>x.taken).length,3);assert.equal(s.deaths,0);}
});
test('records retain personal best and award original-character costumes by achievement',()=>{
 const s=createSimulation();s.mode='won';s.time=240;s.secrets=2;const p=recordRun(s);assert.ok(p.unlocks.includes('vault-gold'));assert.ok(p.last.medals.includes('No signal lost'));s.time=300;assert.equal(recordRun(s,p).best.seconds,240);
});
test('resuming daily progress retains elapsed time, deaths and collected side routes',()=>{
 const s=createSimulation(null,{mode:'daily',seed:seedForDay('2026-10-10')});s.time=97.5;s.deaths=2;s.kills=4;s.world.branchRooms[0].taken=true;s.reached=2;
 const loaded=createSimulation(serialize(s));assert.equal(loaded.time,97.5);assert.equal(loaded.deaths,2);assert.equal(loaded.kills,4);assert.equal(loaded.seed,s.seed);assert.equal(loaded.runMode,'daily');assert.equal(loaded.world.branchRooms[0].taken,true);assert.equal(loaded.depth,2);
 const legacy=createSimulation({version:1,reached:1,coins:75});assert.equal(legacy.time,0);assert.equal(legacy.coins,75);
});
test('damaged local records cannot prevent play or create unearned costume options',()=>{
 const p=readProfile({unlocks:null,costume:'unknown',best:{seconds:'<bad>'},daily:null});assert.deepEqual(p.unlocks,['original']);assert.equal(p.best,null);assert.equal(p.costume,'original');assert.deepEqual(readProfile({unlocks:['original','riverwalk','<bad>'],costume:'riverwalk'}).unlocks,['original','riverwalk']);
});
test('current and widely spaced daily seeds retain a beatable main path',()=>{
 const seeds=[seedForDay('2026-10-10'),seedForDay('2026-10-11'),...Array.from({length:32},(_,i)=>(Math.imul(i+1,2654435761)>>>0))];
 for(const seed of seeds){const s=createSimulation(null,{mode:'daily',seed});s.mode='playing';for(let frame=0;frame<18000&&s.mode==='playing';frame++)update(s,routeAction(s));assert.equal(s.mode,'won','seed '+seed);assert.equal(s.deaths,0,'seed '+seed);}
});
