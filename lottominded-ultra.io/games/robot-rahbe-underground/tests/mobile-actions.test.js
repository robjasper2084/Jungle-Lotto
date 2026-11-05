import test from 'node:test';
import assert from 'node:assert/strict';
import {createSimulation,update} from '../src/simulation.js';
const play=()=>{const s=createSimulation();s.mode='playing';return s;};
const run=(s,a,n=30)=>{for(let i=0;i<n;i++)update(s,a);};
test('analog walking, sprint and crouch have distinct speeds and release cleanly',()=>{
  const walk=play(),sprint=play(),crouch=play(),half=play();
  run(walk,{moveX:1});run(sprint,{moveX:1,sprint:true});run(crouch,{moveX:1,crouch:true});run(half,{moveX:.5});
  assert.ok(sprint.player.x>walk.player.x);assert.ok(walk.player.x>crouch.player.x);assert.ok(half.player.x<walk.player.x);
  assert.equal(crouch.player.crouching,true);run(crouch,{moveX:0});assert.equal(crouch.player.crouching,false);assert.equal(crouch.player.vx,0);
});
test('aim and fire independently of walking direction, then release without residual firing',()=>{
  const s=play();run(s,{moveX:1,aim:{x:-.8,y:-.6},shoot:true},8);
  assert.ok(s.player.x>190);assert.ok(s.shots.some(p=>p.vx<0&&p.vy<0));
  const count=s.shots.length;run(s,{moveX:0},15);assert.ok(s.shots.length<=count);
});
