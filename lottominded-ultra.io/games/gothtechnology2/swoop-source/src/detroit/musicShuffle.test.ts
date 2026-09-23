import {test} from 'node:test';
import assert from 'node:assert/strict';
import {MusicShuffle} from './musicShuffle.ts';
test('shuffle visits every track before repeating and avoids cycle-boundary repeats',()=>{
 const queue=new MusicShuffle(()=>.37),ids=['a','b','c','d'];let last='b';
 for(let cycle=0;cycle<5;cycle++){const heard=[];for(let i=0;i<ids.length;i++){const next=queue.next('all',ids,last)!;assert.notEqual(next,last);heard.push(next);last=next;}assert.deepEqual(heard.sort(),ids);}
});
test('random source changes opening order; stations retain their remaining tracks',()=>{
 assert.notEqual(new MusicShuffle(()=>0).next('all',['a','b','c']),new MusicShuffle(()=>.99).next('all',['a','b','c']));
 const queue=new MusicShuffle(()=>0),first=queue.next('ride',['a','b']);queue.next('bonus',['x','y']);assert.notEqual(queue.next('ride',['a','b']),first);
});
test('empty and explicitly selected single tracks are supported',()=>{
 const queue=new MusicShuffle();assert.equal(queue.next('empty',[]),undefined);assert.equal(queue.next('one',['a'],'a'),'a');
});
