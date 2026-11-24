import test from 'node:test';
import assert from 'node:assert/strict';
import {createCadillacOperationTiming} from './cadillac-operation-timing.mjs';

const deferred=()=>{let resolve,reject;const promise=new Promise((yes,no)=>{resolve=yes;reject=no;});return{promise,resolve,reject};};
const freeze=value=>{for(const child of Object.values(value))if(child&&typeof child==='object')freeze(child);return Object.freeze(value);};

test('observation calls once immediately and preserves original return, promise, and error identities',async()=>{
 let clock=10,calls=0;const timing=createCadillacOperationTiming({now:()=>clock}),pending=deferred();
 timing.phase('capture');
 const returned=timing.observe('fence and paints',()=>{calls++;assert.equal(clock,10);return pending.promise;});
 assert.equal(calls,1);assert.equal(returned,pending.promise);assert.equal(timing.snapshot().entries[0].settlement,'pending');
 const result={pixels:true};clock=35;pending.resolve(result);assert.equal(await returned,result);
 const row=timing.snapshot().entries[0];assert.equal(row.phase,'capture');assert.equal(row.settlement,'resolved');assert.equal(row.durationMs,25);assert.equal(row.timingAvailable,true);
 const synchronous={get then(){assert.fail('A direct return must not be assimilated');}};
 assert.equal(timing.observe('direct value',()=>synchronous),synchronous);
 const failure=Object.freeze({failure:'exact rejection reason'}),rejected=Promise.reject(failure);
 assert.equal(timing.observe('screenshot',()=>rejected),rejected);
 await assert.rejects(rejected,error=>error===failure);
 assert.throws(()=>timing.observe('sync throw',()=>{throw failure;}),error=>error===failure);
 assert.deepEqual(timing.snapshot().entries.map(entry=>entry.settlement),['resolved','resolved','rejected','rejected']);
});

test('late settlement cannot mutate a frozen report snapshot or imply accepted case success',async()=>{
 let clock=100;const timing=createCadillacOperationTiming({now:()=>clock}),resolved=deferred(),rejected=deferred();
 timing.phase('case work');timing.observe('capture',()=>resolved.promise);timing.observe('frame wait',()=>rejected.promise);
 const report=freeze(timing.snapshot());const before=JSON.stringify(report);
 clock=150;timing.phase('failure collection');resolved.resolve();rejected.reject(new Error('late transport failure'));
 await Promise.allSettled([resolved.promise,rejected.promise]);
 const after=timing.snapshot();assert.equal(JSON.stringify(report),before);assert.equal(report.pendingOperations,2);
 assert.equal(after.pendingOperations,0);assert.equal(after.settledOperations,2);assert.equal(after.phases.length,2);
 assert.deepEqual(after.entries.map(entry=>[entry.phase,entry.settlement,entry.durationMs]),[['case work','resolved',50],['case work','rejected',50]]);
 assert(!Object.hasOwn(after,'passed'));assert(after.entries.every(entry=>!Object.hasOwn(entry,'accepted')));
});

test('clock faults leave explicit unavailable timings and never replace an operation result or error',async()=>{
 for(const fault of [NaN,Infinity,-1,99,()=>{throw new Error('clock broke');}]){
  let clock=100;const timing=createCadillacOperationTiming({now:()=>typeof clock==='function'?clock():clock});
  timing.phase('baseline');clock=fault;timing.phase('clock fault');
  const failure=Object.freeze({reason:'operation failure'});
  assert.throws(()=>timing.observe('sync failure',()=>{throw failure;}),error=>error===failure);
  const pending=deferred();assert.equal(timing.observe('eventual result',()=>pending.promise),pending.promise);
  pending.resolve(failure);assert.equal(await pending.promise,failure);
  const rows=timing.snapshot().entries,error=typeof fault==='function'?'threw':fault===99?'regressed':'invalid';
  assert.equal(timing.snapshot().phases.at(-1).atNodeMs,null);assert.equal(timing.snapshot().phases.at(-1).clockError,error);
  for(const row of rows){assert.equal(row.startedAtNodeMs,null);assert.equal(row.completedAtNodeMs,null);assert.equal(row.durationMs,null);assert.equal(row.timingAvailable,false);assert.equal(row.startedClockError,error);assert.equal(row.completedClockError,error);}
  clock=101;timing.phase('recovered');assert.equal(timing.snapshot().phases.at(-1).atNodeMs,101);
 }
 let clock=10;const timing=createCadillacOperationTiming({now:()=>clock}),pending=deferred();
 timing.observe('bad completion',()=>pending.promise);clock=9;pending.resolve();await pending.promise;
 const row=timing.snapshot().entries[0];assert.equal(row.startedAtNodeMs,10);assert.equal(row.completedAtNodeMs,null);assert.equal(row.durationMs,null);assert.equal(row.completedClockError,'regressed');assert.equal(row.settlement,'resolved');
});

test('fixed receipt bounds retain truthful global totals after dropped operations settle',async()=>{
 let clock=0,calls=0;const timing=createCadillacOperationTiming({now:()=>clock++}),pending=deferred();
 for(let i=0;i<70;i++)timing.phase('phase '+i);
 for(let i=0;i<520;i++)assert.equal(timing.observe('operation '+i,()=>{calls++;return pending.promise;}),pending.promise);
 const before=freeze(timing.snapshot());assert.equal(calls,520);assert.equal(before.entries.length,512);assert.equal(before.phases.length,64);
 assert.equal(before.observedOperations,520);assert.equal(before.pendingOperations,520);assert.equal(before.droppedOperations,8);assert.equal(before.phaseMarks,70);assert.equal(before.droppedPhaseMarks,6);
 assert.equal(before.entries[0].phase,'phase 69','Dropping marks does not retain a stale current phase');
 pending.resolve();await pending.promise;
 const after=timing.snapshot();assert.equal(after.settledOperations,520);assert.equal(after.pendingOperations,0);assert.equal(after.droppedOperations,8);assert.equal(before.pendingOperations,520);assert.equal(before.entries[0].settlement,'pending');
});

test('settlement observation failures cannot replace the original native promise',()=>{
 const timing=createCadillacOperationTiming({now:()=>1}),pending=deferred();
 Object.defineProperty(pending.promise,'constructor',{get(){throw new Error('unavailable promise species');}});
 assert.equal(timing.observe('unobservable promise',()=>pending.promise),pending.promise);
 const row=timing.snapshot().entries[0];assert.equal(row.settlement,'pending');assert.equal(row.settlementObservationError,'unavailable');
 // Resolve without relying on its unavailable species.
 pending.resolve();
});
