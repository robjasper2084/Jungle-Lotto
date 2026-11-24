import test from 'node:test';
import assert from 'node:assert/strict';
import {HydraulicFrameClock,observeHydraulicPreviewBoundary,observeHydraulicInputBoundary} from './hydraulicFrameClock.ts';

function ride(revision=0,time=0){return{
 hydraulicCommandRevision:revision,hydraulicCommandTime:time,debt:0,
 clearHydraulicCatchUp(){this.debt=0;},
};}

test('eligible clock retains real long intervals without changing the driving step',()=>{
 const clock=new HydraulicFrameClock(),car=ride();
 assert.equal(clock.sample(100,car,'active'),0);
 assert.equal(clock.sample(116,car,'active'),.016);
 assert.equal(clock.sample(13116,car,'active'),13);
});

test('a new accepted command excludes the preceding render stall while an unchanged command keeps its interval',()=>{
 const clock=new HydraulicFrameClock(),car=ride();clock.sample(100,car,'active');
 car.hydraulicCommandRevision=1;car.hydraulicCommandTime=12900;
 assert.equal(clock.sample(13000,car,'active'),.1);
 assert.equal(clock.sample(13100,car,'active'),.1);
 car.hydraulicCommandRevision=2;car.hydraulicCommandTime=13150;
 assert.equal(clock.sample(13200,car,'active'),.05);
});

test('an already-issued RAF timestamp cannot consume time before the input handler accepted a command',()=>{
 const clock=new HydraulicFrameClock(),car=ride();clock.sample(1000,car,'active');
 car.hydraulicCommandRevision++;car.hydraulicCommandTime=1010;
 assert.equal(clock.sample(1005,car,'active'),0);
 assert.equal(clock.sample(1008,car,'active'),0);
 assert.equal(clock.sample(1026,car,'active'),.016);
});

test('pause, preview and vehicle boundaries discard debt and never replay excluded time',()=>{
 const clock=new HydraulicFrameClock(),car=ride();clock.sample(100,car,'active');car.debt=.6;
 clock.reset();assert.equal(car.debt,0);
 assert.equal(clock.sample(50000,car,'active'),0);
 assert.equal(clock.sample(50016,car,'active'),.016);
 car.debt=.4;assert.equal(clock.sample(60000,car,'preview'),0);assert.equal(car.debt,0);
 assert.equal(clock.sample(60100,car,'preview'),.1);
 assert.equal(clock.sample(70000,car,'active'),0);
 const next=ride(7,70100);car.debt=.2;next.debt=.3;
 assert.equal(clock.sample(70200,next,'active'),0);assert.equal(car.debt,0);assert.equal(next.debt,0);
 assert.equal(clock.sample(70220,next,'active'),.02);
});

test('invalid and backward timestamps never create motion credit or duplicate elapsed time',()=>{
 for(const bad of [NaN,Infinity,-Infinity,-1]){
  const clock=new HydraulicFrameClock(),car=ride();clock.sample(100,car,'active');car.debt=.5;
  assert.equal(clock.sample(bad,car,'active'),0);assert.equal(car.debt,0);
  assert.equal(clock.sample(10000,car,'active'),0);
 }
 const clock=new HydraulicFrameClock(),car=ride();clock.sample(100,car,'active');
 assert.equal(clock.sample(116,car,'active'),.016);
 assert.equal(clock.sample(110,car,'active'),0);assert.equal(clock.sample(116,car,'active'),0);
 assert.equal(clock.sample(118,car,'active'),.002);
 car.hydraulicCommandRevision++;car.hydraulicCommandTime=NaN;car.debt=.6;
 assert.equal(clock.sample(120,car,'active'),0);assert.equal(car.debt,0);
});

test('collapsing and reopening setup between frames resets preview credit and observes only its open boundary',()=>{
 const details={} as Element,other={} as Element,clock=new HydraulicFrameClock(),car=ride();
 let notify:MutationCallback=()=>{},disconnected=false;
 class Observer {
  constructor(callback:MutationCallback){notify=callback;}
  observe(target:Element,options:MutationObserverInit){assert.equal(target,details);assert.deepEqual(options,{attributes:true,attributeFilter:['open']});}
  disconnect(){disconnected=true;}
 }
 const stop=observeHydraulicPreviewBoundary(details,()=>clock.reset(),Observer as unknown as typeof MutationObserver);
 const mutation=(target:Element,name:string)=>({type:'attributes',target,attributeName:name} as unknown as MutationRecord);
 clock.sample(100,car,'preview');car.debt=.6;
 notify([mutation(other,'open'),mutation(details,'class')],{} as MutationObserver);
 assert.equal(car.debt,.6);
 notify([mutation(details,'open'),mutation(details,'open')],{} as MutationObserver);
 assert.equal(car.debt,0);assert.equal(clock.sample(15000,car,'preview'),0);
 stop();assert.equal(disconnected,true);
});

test('room chat open and hidden boundaries discard blocked time even when no frame saw the blocked state',()=>{
 for(const mode of ['active','preview'] as const)for(const attribute of ['open','hidden']){
  const attributes=new Set<string>();
  const surface={hasAttribute:(name:string)=>attributes.has(name)} as Element,other={} as Element,clock=new HydraulicFrameClock(),car=ride();
  let notify:MutationCallback=()=>{},disconnected=false;
  class Observer {
   constructor(callback:MutationCallback){notify=callback;}
   observe(target:Element,options:MutationObserverInit){assert.equal(target,surface);assert.deepEqual(options,{attributes:true,attributeFilter:['open','hidden'],attributeOldValue:true});}
   disconnect(){disconnected=true;}
  }
  const stop=observeHydraulicInputBoundary(surface,()=>clock.reset(),Observer as unknown as typeof MutationObserver);
  const mutation=(target:Element,name:string,oldValue:string|null=null)=>({type:'attributes',target,attributeName:name,oldValue} as unknown as MutationRecord);
  clock.sample(100,car,mode);car.debt=.6;
  notify([mutation(other,attribute),mutation(surface,'class')],{} as MutationObserver);
  assert.equal(car.debt,.6);assert.equal(clock.sample(116,car,mode),.016);
  // Both mutations arrive in one microtask; the final DOM state can equal the
  // starting state, but time spent blocked still must not reach the suspension.
  notify([mutation(surface,attribute,null),mutation(surface,attribute,'')],{} as MutationObserver);
  assert.equal(car.debt,0);assert.equal(clock.sample(15116,car,mode),0);
  assert.equal(clock.sample(15132,car,mode),.016);
  attributes.add(attribute);car.debt=.4;
  notify([mutation(surface,attribute,''),mutation(surface,attribute,'hidden')],{} as MutationObserver);
  assert.equal(car.debt,.4,'rewriting a present boolean attribute cannot reset ongoing motion');
  assert.equal(clock.sample(15148,car,mode),.016);
  notify([mutation(surface,attribute,''),mutation(surface,attribute,null)],{} as MutationObserver);
  assert.equal(car.debt,0);assert.equal(clock.sample(30148,car,mode),0);
  assert.equal(clock.sample(30164,car,mode),.016);
  stop();assert.equal(disconnected,true);
 }
});
