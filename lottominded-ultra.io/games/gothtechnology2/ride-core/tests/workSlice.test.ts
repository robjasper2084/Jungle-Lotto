import {test} from 'node:test';
import assert from 'node:assert/strict';
import {WorkSlice} from '../src/workSlice.ts';
test('construction yields at its budget and resets the budget after resuming',async()=>{
 let time=0,yields=0;
 const slice=new WorkSlice(6,()=>time,async()=>{yields++;time+=20;});
 time=5;await slice.checkpoint();assert.equal(yields,0);
 time=6;await slice.checkpoint();assert.equal(yields,1);
 time=30;await slice.checkpoint();assert.equal(yields,1);
 time=32;await slice.checkpoint();assert.equal(yields,2);
});
