import test from 'node:test';
import assert from 'node:assert/strict';
import {quickTicket,validTicket,coverageWheel,parsePool,deskGame} from './lottoDeskEngine.ts';
import {LOTTO_GAMES} from './lottoGames.ts';

test('quick picks respect every app matrix and preserve leading/repeated daily digits',()=>{
 let word=123;const random=()=>{word=(Math.imul(word,1664525)+1013904223)>>>0;return word;};
 for(const game of LOTTO_GAMES)for(let i=0;i<200;i++)assert.ok(validTicket(quickTicket(game.id,random)),game.id);
 assert.deepEqual(quickTicket('pick-4',()=>0).numbers,[0,0,0,0]);
});
test('wheel rejects empty, out of range, fractional and negative numbers',()=>{
 for(const pool of ['', '0 70 999 1 2', '1 2 3 4 5.5', '-1 2 3 4 5', 'NaN 1 2 3 4'])assert.throws(()=>coverageWheel('powerball',pool,1));
 assert.throws(()=>coverageWheel('powerball','1 1 2 2 3',1));
 assert.throws(()=>coverageWheel('powerball','1 2 3 4 5',27));
 assert.throws(()=>coverageWheel('pick-3','1 2 3',1));
});
test('coverage wheel returns unique complete valid tickets, bounded independently of full combinations',()=>{
 const result=coverageWheel('powerball','1 2 3 4 5 6',26);
 assert.equal(result.total,6);assert.equal(result.tickets.length,6);assert.equal(new Set(result.tickets.map(t=>t.numbers.join(','))).size,6);
 result.tickets.forEach(t=>assert.ok(validTicket(t)));
 const capped=coverageWheel('mega-millions','1 2 3 4 5 6 7 8 9 10 11 70',24,999);
 assert.equal(capped.total,792);assert.equal(capped.tickets.length,24);capped.tickets.forEach(t=>assert.ok(validTicket(t)));
});
test('analysis parser accepts zero digits but never treats empty input as zero',()=>{
 assert.deepEqual(parsePool('0 1 3',deskGame('pick-3')),[0,1,3]);
 assert.throws(()=>parsePool('',deskGame('pick-3')));
 assert.throws(()=>parsePool('0 1 3',deskGame('powerball')));
 assert.throws(()=>parsePool('1.2 3',deskGame('pick-3')));
});
