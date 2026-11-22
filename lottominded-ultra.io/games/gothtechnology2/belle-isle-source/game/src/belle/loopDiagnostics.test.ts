import {test} from 'node:test';
import assert from 'node:assert/strict';
import {ManualLoopProbe,observeLoop,type LoopAcceptedSample} from './loopDiagnostics.ts';

function fixture(limit=100){
  let time=100,calls=0;const probe=new ManualLoopProbe(()=>{calls++;return time;},limit);
  return {probe,advance:(n:number)=>{time+=n;},set:(n:number)=>{time=n;},calls:()=>calls};
}
function sample(n:number,previous:number|null,overrides:Partial<LoopAcceptedSample>={}):LoopAcceptedSample {
  return {sample:n,previousProfiledSample:previous,associationValid:true,frameMs:150,
    place:'Forest',x:n,z:0,draws:20,triangles:200,renderMs:4,...overrides};
}

test('loop scope ledger separates inclusive parents, measured zero and uninvoked scopes',()=>{
  const f=fixture(),p=f.probe;p.startCapture();const first=p.beginCallback(10,100)!;
  f.advance(2);const ready=p.beginScope(first,'gateReadyCpuMs');f.advance(3);p.endScope(ready);
  f.advance(1);const body=p.beginScope(first,'callbackBodyCpuMs');f.advance(11);
  const sampling=p.beginProfileSample();f.advance(5);p.bindAcceptedSample(sample(1,null));p.endScope(sampling);
  f.advance(7);p.endScope(body);f.advance(1);const submitted=p.beginScope(first,'gateSubmittedCpuMs');
  const fence=p.beginScope(first,'fenceSyncCpuMs');f.advance(2);p.endScope(fence);
  f.advance(3);const flush=p.beginScope(first,'flushCpuMs');f.advance(4);p.endScope(flush);
  f.advance(1);p.endScope(submitted);f.advance(2);p.finishCallback(first,'executed');
  const r=p.snapshot(),row=r.topCallbacks[0];
  const expected={totalWrapperCpuMs:42,gateReadyCpuMs:3,callbackBodyCpuMs:23,
    gateSubmittedCpuMs:10,fenceSyncCpuMs:2,flushCpuMs:4,profileSampleCpuMs:5};
  for(const [key,value] of Object.entries(expected)){
    const slot=row.scopes[key as keyof typeof row.scopes]!;assert.equal(slot.calls,1,key);assert.equal(slot.cpuMs,value,key);
  }
  assert.equal(r.completedCallbacks,1);assert.equal(r.acceptedCallbacks.validCallbacks,1);assert.equal(r.inFlightAtSnapshot,null);
  f.set(200);const second=p.beginCallback(11,200)!;const zero=p.beginScope(second,'callbackBodyCpuMs');p.endScope(zero);p.finishCallback(second,'no-draw');
  const all=p.snapshot(),empty=all.topCallbacks.find(value=>value.callbackId===11)!;
  assert.deepEqual(empty.scopes.callbackBodyCpuMs,{calls:1,cpuMs:0,maxCpuMs:0,invalidCalls:0});
  assert.equal(empty.scopes.flushCpuMs,null);assert.equal(empty.scopes.gateReadyCpuMs,null);
  assert.equal(empty.wallGapSincePreviousObservedCallbackMs,58);
  assert.equal(all.allCallbacks.callbacks,2);assert.equal(all.acceptedCallbacks.callbacks,1);
  assert.equal(all.allCallbacks.scopes.callbackBodyCpuMs.callbacks,2);
  assert.equal(all.acceptedCallbacks.scopes.callbackBodyCpuMs.callbacks,1);
  assert.match(all.note,/not GPU execution timings/);assert.match(all.note,/observer finalization/);
});

test('slow intervals link exact prior accepted sample through noneligible wrapper callbacks',()=>{
  const f=fixture(),p=f.probe;p.startCapture();
  const a=p.beginCallback(1,100)!;p.bindAcceptedSample(sample(1,null));f.advance(4);p.finishCallback(a,'executed');
  f.advance(20);const cap=p.beginCallback(2,124)!;f.advance(1);p.finishCallback(cap,'no-draw');
  f.advance(20);const pending=p.beginCallback(3,145)!;f.advance(1);p.finishCallback(pending,'pending-fence');
  f.advance(20);const b=p.beginCallback(4,166)!;p.bindAcceptedSample(sample(2,1));f.advance(2);p.finishCallback(b,'executed');
  const linked=p.snapshot().slowIntervals.find(row=>row.sample===2)!;
  assert.equal(linked.callbackId,4);assert.equal(linked.previousEligibleCallback?.callbackId,1);
  assert.equal(linked.previousEligibleCallback?.acceptedSample,1);assert.equal(linked.previousEligibleCallback?.scopes.totalWrapperCpuMs?.cpuMs,4);
  const mismatch=p.beginCallback(5,168)!;p.bindAcceptedSample(sample(3,999));p.finishCallback(mismatch,'executed');
  assert.equal(p.snapshot().slowIntervals.find(row=>row.sample===3)!.previousEligibleCallback,null);
  p.breakAssociation();const afterBreak=p.beginCallback(6,168)!;p.bindAcceptedSample(sample(4,3));p.finishCallback(afterBreak,'executed');
  assert.equal(p.snapshot().slowIntervals.find(row=>row.sample===4)!.previousEligibleCallback,null);
});

test('invalid or rejected profile association cannot preserve a stale eligible predecessor',()=>{
  const f=fixture(),p=f.probe;p.startCapture();
  const a=p.beginCallback(1,100)!;p.bindAcceptedSample(sample(1,null));p.finishCallback(a,'executed');
  const bad=p.beginCallback(2,100)!;p.bindAcceptedSample(sample(2,1,{associationValid:false}));p.finishCallback(bad,'executed');
  const c=p.beginCallback(3,100)!;p.bindAcceptedSample(sample(3,2));p.finishCallback(c,'executed');
  assert.equal(p.snapshot().slowIntervals.find(row=>row.sample===3)!.previousEligibleCallback,null);
  const rejected=p.beginCallback(4,100)!;p.rejectSampleAssociation();p.finishCallback(rejected,'no-draw');
  const d=p.beginCallback(5,100)!;p.bindAcceptedSample(sample(4,3));p.finishCallback(d,'executed');
  assert.equal(p.snapshot().slowIntervals.find(row=>row.sample===4)!.previousEligibleCallback,null);
  assert.equal(p.snapshot().acceptedSamples,4);
});

test('stop inside the current callback exports it as incomplete and rejects late completion clocks',()=>{
  const f=fixture(),p=f.probe;
  assert.equal(p.beginCallback(1,100),undefined);assert.equal(p.beginProfileSample(),undefined);assert.equal(f.calls(),0);
  p.startCapture();const token=p.beginCallback(1,100)!;const body=p.beginScope(token,'callbackBodyCpuMs');
  f.advance(2);const sampling=p.beginProfileSample();p.bindAcceptedSample(sample(1,null));f.advance(4);
  const stopped=p.stopCapture(),atStop=f.calls();
  assert.equal(stopped.completedCallbacks,0);assert.equal(stopped.acceptedSamples,1);
  assert.deepEqual(stopped.inFlightAtSnapshot,{captureEpoch:1,callbackId:1,acceptedSample:1,
    associationEligible:true,openScopes:['callbackBodyCpuMs','profileSampleCpuMs'],incomplete:true});
  assert.equal(stopped.topCallbacks.length,0);assert.equal(stopped.acceptedCallbacks.scopes.totalWrapperCpuMs.callbacks,0);
  p.endScope(sampling);p.endScope(body);p.finishCallback(token,'executed');p.beginCallback(2,120);p.beginProfileSample();
  assert.equal(f.calls(),atStop);assert.deepEqual(p.snapshot(),stopped);
  stopped.inFlightAtSnapshot!.callbackId=999;assert.equal(p.snapshot().inFlightAtSnapshot?.callbackId,1);
  p.startCapture();const beforeStale=f.calls();p.endScope(body);p.finishCallback(token,'executed');assert.equal(f.calls(),beforeStale);
  const next=p.beginCallback(3,120)!;p.bindAcceptedSample(sample(1,1));f.advance(1);p.finishCallback(next,'executed');
  const restarted=p.stopCapture();assert.equal(restarted.captureEpoch,2);assert.equal(restarted.completedCallbacks,1);
  assert.equal(restarted.slowIntervals[0].previousEligibleCallback,null);assert.equal(restarted.inFlightAtSnapshot,null);
});

test('accepted samples without a fully observed callback are explicit rather than invented timing',()=>{
  const f=fixture(),p=f.probe;p.startCapture();p.bindAcceptedSample(sample(1,null));
  const r=p.stopCapture();assert.equal(r.acceptedSamples,1);assert.equal(r.acceptedSamplesWithoutObservedCallback,1);
  assert.equal(r.completedCallbacks,0);assert.equal(r.slowIntervals[0].callbackId,null);
  assert.equal(r.slowIntervals[0].previousEligibleCallback,null);assert.equal(f.calls(),0);
});

test('retention is capped and snapshots do not share scope, context or predecessor records',()=>{
  const f=fixture(10000),p=f.probe;p.startCapture();
  for(let i=1;i<=350;i++){
    const token=p.beginCallback(i,100+i)!;const input=sample(i,i===1?null:i-1,{frameMs:100+i,place:'x'.repeat(200)});
    p.bindAcceptedSample(input);input.place='changed';input.x=-100;f.advance(i);p.finishCallback(token,'executed');
  }
  const r=p.snapshot();assert.equal(r.topCallbacks.length,100);assert.equal(r.slowIntervals.length,100);
  assert.equal(r.topCallbacks[0].callbackId,350);assert.equal(r.topCallbacks.at(-1)!.callbackId,251);
  assert.equal(r.slowIntervals[0].sample,350);assert.equal(r.slowIntervals.at(-1)!.sample,251);
  assert.equal(r.topCallbacks[0].place.length,96);assert.equal(r.topCallbacks[0].x,350);
  r.topCallbacks[0].scopes.totalWrapperCpuMs!.cpuMs=-1;
  r.slowIntervals[0].previousEligibleCallback!.scopes.totalWrapperCpuMs!.cpuMs=-2;
  r.allCallbacks.scopes.totalWrapperCpuMs.cpuMs=-3;
  const fresh=p.snapshot();assert.equal(fresh.topCallbacks[0].scopes.totalWrapperCpuMs!.cpuMs,350);
  assert.equal(fresh.slowIntervals[0].previousEligibleCallback!.scopes.totalWrapperCpuMs!.cpuMs,349);
  assert(fresh.allCallbacks.scopes.totalWrapperCpuMs.cpuMs>0);
  const none=fixture(-1);none.probe.startCapture();const t=none.probe.beginCallback(1,100)!;none.probe.bindAcceptedSample(sample(1,null));none.probe.finishCallback(t,'executed');
  assert.equal(none.probe.snapshot().topCallbacks.length,0);assert.equal(none.probe.snapshot().slowIntervals.length,0);
});

test('clock faults invalidate timing without escaping and a new epoch recovers',()=>{
  for(const bad of [NaN,Infinity,-1,99,'throw'] as const){
    let values:readonly (number|string)[]=[100,101,bad,105],i=0;
    const p=new ManualLoopProbe(()=>{const value=values[i++];if(value==='throw')throw Error('clock');return value as number;});
    p.startCapture();const token=p.beginCallback(1,100)!;const scoped=p.beginScope(token,'callbackBodyCpuMs');
    p.bindAcceptedSample(sample(1,null));assert.doesNotThrow(()=>p.endScope(scoped));assert.doesNotThrow(()=>p.finishCallback(token,'executed'));
    const r=p.snapshot();assert(r.invalidObservations>0,String(bad));assert.equal(r.allCallbacks.invalidCallbacks,1);
    assert.equal(r.allCallbacks.validCallbacks,0);assert.equal(r.topCallbacks.length,0);
    values=[200,201];i=0;p.startCapture();const next=p.beginCallback(2,200)!;p.bindAcceptedSample(sample(1,null));p.finishCallback(next,'executed');
    assert.equal(p.snapshot().invalidObservations,0);assert.equal(p.snapshot().allCallbacks.validCallbacks,1);
  }
});

test('observer method failure is isolated and disables only observation until the next epoch',()=>{
  const f=fixture(),p=f.probe;p.startCapture();const token=p.beginCallback(1,100)!;
  assert.equal(observeLoop(p,()=>{throw Error('observer');}),undefined);
  const after=f.calls();p.finishCallback(token,'executed');assert.equal(f.calls(),after);assert.equal(p.capturing,false);
  assert(p.snapshot().invalidObservations>0);p.startCapture();const next=p.beginCallback(2,100)!;p.finishCallback(next,'no-draw');
  assert.equal(p.snapshot().invalidObservations,0);assert.equal(p.snapshot().completedCallbacks,1);
});

test('duplicate scope completion and callback reentry cannot manufacture valid durations',()=>{
  const f=fixture(),p=f.probe;p.startCapture();const t=p.beginCallback(1,100)!;const s=p.beginScope(t,'callbackBodyCpuMs');
  f.advance(3);p.endScope(s);const after=f.calls();p.endScope(s);assert.equal(f.calls(),after);
  assert.equal(p.beginCallback(2,103),undefined);p.finishCallback(t,'executed');
  assert.equal(p.snapshot().allCallbacks.invalidCallbacks,1);assert.equal(p.snapshot().topCallbacks.length,0);
});
