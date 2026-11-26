import test from 'node:test';
import assert from 'node:assert/strict';
import {createElapsedQueries} from './timer.ts';
function fixture(){
 let active:WebGLQuery|null=null,next=0,time=0;
 const state={available:true,ready:true,disjoint:false,lost:false,ns:123456,error:0,deleted:[] as WebGLQuery[],events:[] as string[]};
 const gl={
  NO_ERROR:0,CURRENT_QUERY:1,QUERY_RESULT_AVAILABLE:2,QUERY_RESULT:3,
  getExtension:()=>state.available?{TIME_ELAPSED_EXT:4,GPU_DISJOINT_EXT:5}:null,
  getParameter:()=>state.disjoint,isContextLost:()=>state.lost,getError:()=>state.error,
  getQuery:()=>active,createQuery:()=>({id:next++}) as unknown as WebGLQuery,
  beginQuery:(_target:number,query:WebGLQuery)=>{assert.equal(active,null);active=query;state.events.push('begin');},
  endQuery:()=>{assert(active);active=null;state.events.push('end');},
  getQueryParameter:(_query:WebGLQuery,key:number)=>key===2?state.ready:state.ns,
  deleteQuery:(query:WebGLQuery)=>{state.deleted.push(query);state.events.push('delete');},
 } as unknown as WebGL2RenderingContext;
 return{gl,state,clock:{now:()=>time,pause:async()=>{time+=10;},timeoutMs:20},setActive:(value:WebGLQuery)=>{active=value;}};
}
test('one elapsed query brackets exactly one original render; fence/result/deletion follow its end',async()=>{
 const f=fixture(),timer=createElapsedQueries(f.gl,f.clock),answer={native:true};let renders=0;
 const result=await timer.measure(()=>{renders++;f.state.events.push('render');return answer;},async()=>{f.state.events.push('fence');});
 assert.equal(result.value,answer);assert.equal(renders,1);assert.deepEqual(f.state.events,['begin','render','end','fence','delete']);
 const read=timer.read();for(const key of ['attempted','allocated','begun','ended','completed','resolved','deleted'])assert.equal(read[key as keyof typeof read],1);
 assert.equal(read.liveQueries,0);assert.equal(read.rows[0].nanoseconds,123456);assert.equal(read.rows[0].status,'valid');
});
test('an original render throw still ends and deletes its own query and is never retried',async()=>{
 const f=fixture(),timer=createElapsedQueries(f.gl,f.clock),error={original:true};let calls=0,completed=0;
 await assert.rejects(timer.measure(()=>{calls++;throw error;},async()=>{completed++;}),caught=>caught===error);
 assert.equal(calls,1);assert.equal(completed,0);assert.deepEqual(f.state.events,['begin','end','delete']);
 assert.equal(timer.read().rows[0].status,'failed');assert.equal(timer.read().rows[0].nanoseconds,null);assert.equal(timer.read().liveQueries,0);
});
test('unavailable extension and foreign active queries cannot fabricate elapsed results',async()=>{
 const f=fixture();f.state.available=false;const unavailable=createElapsedQueries(f.gl,f.clock);assert.equal(unavailable.available,false);
 await assert.rejects(unavailable.measure(()=>assert.fail('no render'),async()=>{}),/unavailable/);
 assert.equal(unavailable.read().allocated,0);assert.equal(unavailable.read().rows[0].nanoseconds,null);
 const g=fixture();g.setActive({external:true} as unknown as WebGLQuery);const timer=createElapsedQueries(g.gl,g.clock);
 await assert.rejects(timer.measure(()=>assert.fail('no render'),async()=>{}),/Another elapsed query/);
 assert.equal(timer.read().allocated,0);assert.equal(timer.read().deleted,0);assert.deepEqual(g.state.events,[]);
});
test('timeout, context loss and GL error preserve incomplete records and release the allocated query',async()=>{
 for(const mode of ['timeout','lost','error'] as const){
  const f=fixture(),timer=createElapsedQueries(f.gl,f.clock);
  if(mode==='timeout')f.state.ready=false;
  await assert.rejects(timer.measure(()=>{if(mode==='error')f.state.error=1282;},async()=>{if(mode==='lost')f.state.lost=true;}));
  const read=timer.read();assert.equal(read.allocated,1);assert.equal(read.deleted,1);assert.equal(read.liveQueries,0);
  assert.equal(read.rows[0].status,'failed');assert.equal(read.rows[0].nanoseconds,null);assert.equal(read.resolved,0);
 }
});
test('disjoint during resolution or at final read invalidates the whole context, including prior valid samples',async()=>{
 const f=fixture(),timer=createElapsedQueries(f.gl,f.clock);
 await timer.measure(()=>{},async()=>{});f.state.disjoint=true;
 const read=timer.read();assert.equal(read.disjoint,true);assert.equal(read.rows[0].status,'disjoint');assert.equal(read.rows[0].nanoseconds,null);
 assert.equal(read.rows[0].observedNanoseconds,123456,'invalidation preserves the raw returned measurement');
 const g=fixture(),other=createElapsedQueries(g.gl,g.clock);
 await assert.rejects(other.measure(()=>{},async()=>{g.state.disjoint=true;}),/Disjoint/);
 assert.equal(other.read().deleted,1);assert.equal(other.read().rows[0].nanoseconds,null);
});
test('negative, nonfinite and fractional query results are retained as failed measurements',async()=>{
 for(const ns of [-1,Infinity,NaN,1.5]){
  const f=fixture();f.state.ns=ns;const timer=createElapsedQueries(f.gl,f.clock);
  await assert.rejects(timer.measure(()=>{},async()=>{}),/Invalid elapsed/);
  assert.equal(timer.read().resolved,1);assert.equal(timer.read().deleted,1);assert.equal(timer.read().rows[0].nanoseconds,null);
  assert.equal(timer.read().rows[0].observedNanoseconds,Number.isFinite(ns)?ns:String(ns));
 }
});
