import test from 'node:test';
import assert from 'node:assert/strict';
import {REWARD_GAMES,rewardGameForURL} from '../../store/public/arcade/games.js';
test('game routes recognize each launch and index alias under a hosted base',()=>{
 const base='https://example.test/Jungle-Lotto/lottominded-ultra.io/games/gothtechnology2/';
 assert.equal(REWARD_GAMES.length,5);
 for(const game of REWARD_GAMES){
  const url=new URL(game.path,base);
  assert.equal(rewardGameForURL(url.href,base)?.id,game.id);
  url.pathname+='index.html';
  assert.equal(rewardGameForURL(url.href,base)?.id,game.id);
  url.hostname='foreign.test';assert.equal(rewardGameForURL(url.href,base),undefined);
 }
 assert.equal(rewardGameForURL('../shadow-ops-canvas/',base),undefined);
 assert.equal(rewardGameForURL('products/night-protocol-hoodie/',base),undefined);
 assert.equal(rewardGameForURL('javascript:alert(1)',base),undefined);
});
