import test from 'node:test';import assert from 'node:assert/strict';
import {createSimulation,update,respawn} from '../src/simulation.js';import {floorY} from '../src/world.js';
// Isolated collision fixtures. The complete route still uses all ordinary enemies and damage.
function vault(x){const s=createSimulation();s.mode='playing';s.depth=s.reached=4;s.player.x=x;s.player.y=floorY(4);s.world.enemies=[];return s;}
test('a rolling coin cannot hit outside its visible circle or above its top',()=>{
 const s=vault(650);s.world.hazards=[];s.world.rolling=[{x:707,y:floorY(4)-39,r:39,speed:0,min:0,max:2880}];update(s);assert.equal(s.player.hp,6,'no invisible padding outside coin');
 s.world.rolling[0].x=703;update(s);assert.equal(s.player.hp,5,'real contact still hurts');assert.equal(s.lastDamage.cause,'ROLLING COIN');
 const high=vault(700);high.world.hazards=[];high.world.rolling=[{x:700,y:floorY(4)-39,r:39,speed:0,min:0,max:2880}];high.player.y=floorY(4)-80;high.player.grounded=false;update(high);assert.equal(high.player.hp,6,'feet above coin are safe');
});
test('a brief jump tap clears an approaching roller without health loss',()=>{
 const s=vault(650);s.world.hazards=[];s.world.rolling=[{x:800,y:floorY(4)-39,r:39,speed:-155,min:0,max:2880}];update(s,{right:true,jumpPressed:true});let top=s.player.y;
 for(let frame=0;frame<55;frame++){update(s,{right:true,jumpReleased:frame===0});top=Math.min(top,s.player.y);}assert.ok(floorY(4)-top>=90,'tap has useful clearance');assert.ok(s.player.x>s.world.rolling[0].x+60);assert.equal(s.player.hp,6);assert.equal(s.deaths,0);
});
test('floor spikes identify damage, preserve position and allow a tap-jump crossing',()=>{
 const s=vault(1540);s.world.rolling=[];update(s);assert.equal(s.player.hp,5);assert.equal(s.player.x,1540,'standing spikes do not teleport to the floor entrance');assert.equal(s.lastDamage.cause,'SPIKES');assert.ok(s.events.some(e=>e.type==='hurt'&&e.text.includes('SPIKES')));for(let i=0;i<30;i++)update(s);assert.equal(s.player.hp,5,'damage grace prevents repeated instant hits');
 const clear=vault(1470);clear.world.rolling=[];update(clear,{right:true,jumpPressed:true});for(let frame=0;frame<65;frame++)update(clear,{right:true,jumpReleased:frame===0});assert.ok(clear.player.x>1647);assert.equal(clear.player.hp,6);
});
test('retry recharges an installed shield and restores six health cells',()=>{const s=vault(1540);s.upgrades.shield=true;s.shield=0;s.player.hp=0;s.mode='dead';respawn(s);assert.equal(s.player.hp,6);assert.equal(s.shield,1);assert.equal(s.reached,4);});
