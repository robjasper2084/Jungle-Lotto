import test from 'node:test';
import assert from 'node:assert/strict';
import {REWARD_GAMES,rewardGameForURL,rewardGameForNavigation} from '../../store/public/arcade/games.js';
test('game routes recognize each launch and index alias under a hosted base',()=>{
 const base='https://example.test/Jungle-Lotto/lottominded-ultra.io/games/gothtechnology2/';
 assert.equal(REWARD_GAMES.length,7);
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
test('early game navigation accepts only known games from the active same-origin frame',()=>{
 const base='https://example.test/store/',source={},event={source,origin:'https://example.test',data:{type:'GOTHTECH_GAME_NAVIGATION',gameId:'static-wars'}};
 assert.equal(rewardGameForNavigation(event,source,base)?.id,'static-wars');
 for(const patch of [{source:{}},{origin:'https://foreign.test'},{data:{type:'GOTHTECH_GAME_NAVIGATION',gameId:'unknown'}},{data:{type:'other',gameId:'static-wars'}}]){
  assert.equal(rewardGameForNavigation({...event,...patch},source,base),undefined);
 }
 assert.equal(rewardGameForNavigation(event,null,base),undefined);
});
