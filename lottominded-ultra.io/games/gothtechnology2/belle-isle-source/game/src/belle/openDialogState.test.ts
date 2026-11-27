import test from 'node:test';
import assert from 'node:assert/strict';
import {createOpenDialogState} from './openDialogState.ts';

const changed={type:'childList'} as MutationRecord;
const opened={type:'attributes',attributeName:'open'} as MutationRecord;
const childList=(added:number[],removed:number[])=>({type:'childList',
 addedNodes:added.map(nodeType=>({nodeType})),removedNodes:removed.map(nodeType=>({nodeType})),
}) as unknown as MutationRecord;
const attribute=(localName:string,nodeType=1)=>({type:'attributes',attributeName:'open',
 target:{nodeType,localName},
}) as unknown as MutationRecord;
function fixture(initial=false){
 let present=initial,queries=0,drains=0,disconnects=0,queryError:unknown,drainError:unknown;
 let queued:MutationRecord[]=[];
 let notify:(records:readonly MutationRecord[])=>void=()=>{};
 const root={querySelector(selector:string){
  assert.equal(selector,'dialog[open]');queries++;
  if(queryError)throw queryError;
  return present?{} as Element:null;
 }} as unknown as Document;
 const state=createOpenDialogState(root,callback=>{
  notify=callback;
  return {
   observe(node,options){assert.equal(node,root);assert.deepEqual(options,{subtree:true,childList:true,attributes:true,attributeFilter:['open']});},
   takeRecords(){drains++;if(drainError)throw drainError;const result=queued;queued=[];return result;},
   disconnect(){disconnects++;queued=[];},
  };
 });
 return {...state,queries:()=>queries,drains:()=>drains,disconnects:()=>disconnects,
  mutate(value:boolean,record=opened){present=value;queued.push(record);},
  deliver(){const records=queued;queued=[];notify(records);},
  failQuery(value:unknown){queryError=value;},failDrain(value:unknown){drainError=value;},
 };
}

test('unchanged reads eliminate repeated selector scans while draining every pending-mutation queue',()=>{
 const f=fixture();
 for(let i=0;i<10000;i++)assert.equal(f.hasOpenDialog(),false);
 assert.equal(f.queries(),1);assert.equal(f.drains(),10000);
});

test('text and comment replacements retain presence without rescanning, before and after delivery',()=>{
 for(const initial of [false,true]){
  const f=fixture(initial);assert.equal(f.hasOpenDialog(),initial);
  for(let i=0;i<1000;i++){
   f.mutate(initial,childList(i%2?[3,8]:[3],i%2?[8]:[3]));
   if(i%2)f.deliver();
   assert.equal(f.hasOpenDialog(),initial);
  }
  assert.equal(f.queries(),1);assert.equal(f.drains(),1001);
 }
});

test('known non-dialog open attributes do not invalidate cached presence',()=>{
 for(const initial of [false,true]){
  const f=fixture(initial);assert.equal(f.hasOpenDialog(),initial);
  for(const name of ['details','input','section','svg']){
   f.mutate(initial,attribute(name));assert.equal(f.hasOpenDialog(),initial);
   f.mutate(initial,attribute(name));f.deliver();assert.equal(f.hasOpenDialog(),initial);
  }
  assert.equal(f.queries(),1);
 }
});

test('relevant transitions in a mixed mutation batch remain synchronous and delivered transitions invalidate',()=>{
 const f=fixture();assert.equal(f.hasOpenDialog(),false);
 f.mutate(false,childList([3],[3]));f.mutate(true,attribute('dialog'));
 f.mutate(true,attribute('details'));assert.equal(f.hasOpenDialog(),true);
 f.mutate(true,childList([8],[3]));f.mutate(false,attribute('dialog'));
 f.mutate(false,childList([3],[8]));f.deliver();assert.equal(f.hasOpenDialog(),false);
 assert.equal(f.queries(),3);
});

test('every element insertion or removal invalidates, regardless of mutable descendants',()=>{
 const f=fixture();assert.equal(f.hasOpenDialog(),false);
 for(const [present,record] of [[true,childList([1],[])],[false,childList([],[1])],
  [true,childList([3,1],[8])],[false,childList([3],[8,1])]] as const){
  f.mutate(present,record);assert.equal(f.hasOpenDialog(),present);
 }
 assert.equal(f.queries(),5);
});

test('incomplete, unfamiliar and non-element attribute records conservatively invalidate',()=>{
 const f=fixture();let present=false;assert.equal(f.hasOpenDialog(),present);
 const unknown=[changed,opened,attribute('dialog'),attribute('DIALOG'),attribute('details',9),
  attribute(''),childList([11],[]),{type:'unrecognized'} as unknown as MutationRecord,
  {type:'childList',addedNodes:[{}],removedNodes:[]} as unknown as MutationRecord];
 for(const record of unknown){present=!present;f.mutate(present,record);assert.equal(f.hasOpenDialog(),present);}
 assert.equal(f.queries(),unknown.length+1);
});

test('mutation inspection failures disable caching for both queued and delivered records',()=>{
 const unreadable={get type(){throw Error('unreadable record');}} as unknown as MutationRecord;
 for(const deliver of [false,true]){
  const f=fixture();assert.equal(f.hasOpenDialog(),false);
  f.mutate(true,unreadable);if(deliver)f.deliver();
  assert.equal(f.hasOpenDialog(),true);assert.equal(f.disconnects(),1);
  f.mutate(false,childList([3],[3]));assert.equal(f.hasOpenDialog(),false);
  assert.equal(f.queries(),3);
 }
});

test('same-task opening and closing are visible before observer delivery',()=>{
 const f=fixture();assert.equal(f.hasOpenDialog(),false);
 f.mutate(true);assert.equal(f.hasOpenDialog(),true);
 f.mutate(false);assert.equal(f.hasOpenDialog(),false);
 f.mutate(true);assert.equal(f.hasOpenDialog(),true);
 assert.equal(f.queries(),4);
});

test('delivered records invalidate the cached presence even when takeRecords is now empty',()=>{
 const f=fixture(true);assert.equal(f.hasOpenDialog(),true);
 f.mutate(false);f.deliver();assert.equal(f.hasOpenDialog(),false);
 f.mutate(true);f.deliver();assert.equal(f.hasOpenDialog(),true);
 f.deliver();assert.equal(f.hasOpenDialog(),true);assert.equal(f.queries(),3);
});

test('subtree addition, removal, reparenting, and replacement invalidate presence',()=>{
 const f=fixture();assert.equal(f.hasOpenDialog(),false);
 for(const present of [true,false,true,false]){
  f.mutate(present,changed);assert.equal(f.hasOpenDialog(),present);
 }
 assert.equal(f.queries(),5);
});

test('batched open-close transitions query the final DOM state once',()=>{
 const f=fixture();
 assert.equal(f.hasOpenDialog(),false);
 f.mutate(true);f.mutate(false);assert.equal(f.hasOpenDialog(),false);
 assert.equal(f.queries(),2);
});

test('selector exceptions propagate and never certify a stale cached result',()=>{
 const f=fixture();assert.equal(f.hasOpenDialog(),false);
 const error=Error('query failed');f.mutate(true);f.failQuery(error);
 assert.throws(()=>f.hasOpenDialog(),value=>value===error);
 f.failQuery(undefined);assert.equal(f.hasOpenDialog(),true);assert.equal(f.queries(),3);
});

test('setup failure falls back to fresh selector results on every read',()=>{
 for(const failAt of ['construct','observe'] as const){
  let present=false,queries=0,disconnects=0;
  const root={querySelector(){queries++;return present?{}:null;}} as unknown as Document;
  const f=createOpenDialogState(root,()=>{
   if(failAt==='construct')throw Error('unavailable');
   return {observe(){throw Error('unavailable');},takeRecords(){return [];},disconnect(){disconnects++;}};
  });
  assert.equal(f.hasOpenDialog(),false);present=true;assert.equal(f.hasOpenDialog(),true);
  assert.equal(queries,2);assert.equal(disconnects,failAt==='observe'?1:0);
 }
});

test('a failed drain disables caching and immediately queries the live DOM',()=>{
 const f=fixture();assert.equal(f.hasOpenDialog(),false);
 f.mutate(true);f.failDrain(Error('observer failed'));assert.equal(f.hasOpenDialog(),true);
 f.mutate(false);assert.equal(f.hasOpenDialog(),false);
 assert.equal(f.queries(),3);assert.equal(f.disconnects(),1);
});

test('disposal is idempotent and later reads stay live, including queued old deliveries',()=>{
 const f=fixture();assert.equal(f.hasOpenDialog(),false);
 f.dispose();f.dispose();assert.equal(f.disconnects(),1);
 f.mutate(true);f.deliver();assert.equal(f.hasOpenDialog(),true);
 f.mutate(false);f.deliver();assert.equal(f.hasOpenDialog(),false);
 assert.equal(f.queries(),3);
});
