import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {
  PAGE_CHARACTERS,
  encodeEvidence,
  decodeEvidence,
  createEvidencePager,
  readEvidenceCheckpoint,
} from './evidence-transfer.ts';

const source = Object.freeze({head:'a'.repeat(40),tree:'b'.repeat(40)});
const mode = 'candidate';
const session = 'independent-transfer-regression';
const hash = text => createHash('sha256').update(text,'utf8').digest('hex');
const clone = value => structuredClone(value);
const sourceValue = () => ({schema:1,mode,source:{...source},errors:[],preparation:[],cases:[
  {name:'Aquarium front',settings:{quality:'high',scale:1},before:{positions:[1,2,3],world:[4,5,6]},captures:[]},
]});

function harness(initial=sourceValue()) {
  let value=initial;
  const pager=createEvidencePager(()=>value,{mode,source});
  const calls=[];
  const remote=async(method,args)=>{
    calls.push({method,args:clone(args)});
    // Browser protocol values cross a serialization boundary in production.
    return clone(await pager[method](args));
  };
  return {pager,calls,remote,get value(){return value;},set value(next){value=next;}};
}
const read=(h,options={})=>readEvidenceCheckpoint({remote:h.remote,session,mode,source,...options});

function resign(manifest) {
  const {sha256,...metadata}=manifest;
  manifest.sha256=hash(JSON.stringify(metadata));
  return manifest;
}

test('codec preserves scalar distinctions and matches Playwright materializing sparse holes as undefined',()=>{
  const sparse=new Array(7);sparse[1]=undefined;sparse[2]=-0;sparse[4]=NaN;sparse[6]=Infinity;
  const value={nil:null,zero:0,negativeZero:-0,undefined,values:[undefined,NaN,Infinity,-Infinity,false,''],sparse};
  const restored=decodeEvidence(encodeEvidence(value));
  const expected={...value,sparse:Array.from(sparse)};
  assert.deepStrictEqual(restored,expected);
  assert(Object.is(restored.negativeZero,-0));
  assert(Object.hasOwn(restored,'undefined'));
  assert(Object.hasOwn(restored.sparse,0));
  assert(Object.hasOwn(restored.sparse,1));
  assert(Object.hasOwn(restored.sparse,3));
  assert.equal(restored.sparse.length,7);
  for(const scalar of [undefined,-0,NaN,Infinity,-Infinity,null,'Detroit 🏙️'])
    assert.deepStrictEqual(decodeEvidence(encodeEvidence(scalar)),scalar);
});

test('codec preserves Unicode, lone surrogates and strings resembling tagged values',()=>{
  const value={text:'Detroit \u0000 Ω 𐀀 🏙️ \ud800 / \udfff',literal:'{"__roof_evidence_scalar_v1__":"NaN"}'};
  assert.deepStrictEqual(decodeEvidence(encodeEvidence(value)),value);
});

test('codec rejects unsupported scalar, exotic object and cyclic data instead of dropping it',()=>{
  const cyclic={};cyclic.self=cyclic;
  for(const value of [()=>{},Symbol('value'),1n,new Date(0),/roof/,new Map([['x',1]]),new Set([1]),new Uint8Array([1,2]),cyclic])
    assert.throws(()=>encodeEvidence(value),undefined,String(value));
  for(const value of [{nested:()=>{}},{nested:Symbol('value')},{nested:1n}])assert.throws(()=>encodeEvidence(value));
  const symbolic={x:1,[Symbol('hidden')]:2};assert.throws(()=>encodeEvidence(symbolic));
});

test('codec rejects accessors without executing them and reserved marker collisions',()=>{
  let reads=0;
  const value={};Object.defineProperty(value,'x',{enumerable:true,get(){reads++;return 7;}});
  assert.throws(()=>encodeEvidence(value),/accessor/i);
  assert.equal(reads,0);
  const array=[];Object.defineProperty(array,'0',{enumerable:false,get(){reads++;return 7;}});
  assert.throws(()=>encodeEvidence(array),/accessor/i);
  assert.equal(reads,0,'A nonenumerable numeric getter must be rejected before array serialization');
  assert.throws(()=>encodeEvidence({__roof_evidence_scalar_v1__:'undefined'}),/reserved/i);
  assert.throws(()=>decodeEvidence('{"__roof_evidence_scalar_v1__":"not-a-scalar"}'));
  assert.throws(()=>decodeEvidence('{"__roof_evidence_scalar_v1__":"NaN","extra":1}'));
  assert.throws(()=>decodeEvidence('{"__roof_evidence_scalar_v1__":"hole"}'));
});

test('codec matches the original Playwright omission of nonenumerable fields and array extra keys',()=>{
  // Playwright's utilityScript serializer reads Object.keys(record) and only
  // numbered array elements. Real submission receipts use a nonenumerable
  // settleOwners function, so it must never become transport evidence.
  const named=[1];named.note='must survive';
  const hidden={x:1};Object.defineProperty(hidden,'secret',{value:2,enumerable:false});
  const hiddenArray=[1];Object.defineProperty(hiddenArray,'note',{value:'must survive',enumerable:false});
  const receipt={geometry:'source'};let calls=0;
  Object.defineProperty(receipt,'settleOwners',{value:()=>{calls++;},enumerable:false});
  assert.deepStrictEqual(decodeEvidence(encodeEvidence(named)),[1]);
  assert.deepStrictEqual(decodeEvidence(encodeEvidence(hidden)),{x:1});
  assert.deepStrictEqual(decodeEvidence(encodeEvidence(hiddenArray)),[1]);
  assert.deepStrictEqual(decodeEvidence(encodeEvidence(receipt)),{geometry:'source'});
  assert.equal(calls,0);
});

test('codec matches original Playwright normalization of null-prototype records',()=>{
  const value=Object.assign(Object.create(null),{x:1});
  assert.deepStrictEqual(decodeEvidence(encodeEvidence(value)),{x:1});
});

test('codec does not execute a custom JSON hook that can rewrite otherwise plain evidence',()=>{
  let calls=0;const value={actual:'original'};
  Object.defineProperty(value,'toJSON',{value:()=>{calls++;return {actual:'altered'};},enumerable:false});
  let encoded;
  try{encoded=encodeEvidence(value);}catch{}
  assert.equal(calls,0);
  if(encoded!==undefined)assert.deepStrictEqual(decodeEvidence(encoded),{actual:'original'});
});

test('complete checkpoint exactly reconstructs source evidence and binds independent SHA-256 hashes',async()=>{
  const h=harness();h.value.cases[0].before.special={negativeZero:-0,missing:undefined,nan:NaN,positive:Infinity,negative:-Infinity};
  const checkpoint=await read(h);
  assert.deepStrictEqual(checkpoint.value,h.value);
  assert.equal(checkpoint.manifest.revision,1);
  assert.equal(checkpoint.receipt.sealed,true);
  assert.equal(checkpoint.receipt.deadlineMs,15000);
  assert.equal(checkpoint.newSections.length,checkpoint.sections.size);
  const {sha256,...metadata}=checkpoint.manifest;
  assert.equal(sha256,hash(JSON.stringify(metadata)));
  for(const section of checkpoint.sections.values())assert.equal(section.sha256,hash(section.encoded));
  assert.equal(h.calls[0].method,'begin');assert.equal(h.calls.at(-1).method,'finish');
});

test('unchanged checkpoint transfers no section pages, reuses values and advances a sealed revision',async()=>{
  const h=harness(),first=await read(h);h.calls.length=0;
  const second=await read(h,{previous:first});
  assert.deepStrictEqual(second.value,first.value);
  assert.deepStrictEqual(h.calls.map(c=>c.method),['begin','finish']);
  assert.equal(second.newSections.length,0);
  assert.equal(second.receipt.pages,0);
  assert.equal(second.receipt.characters,0);
  assert.equal(second.manifest.revision,2);
  assert.equal(second.receipt.reusedSections,first.sections.size);
  for(const [key,section] of second.sections)assert.strictEqual(section,first.sections.get(key));
});

test('changing one existing case component transfers only that component',async()=>{
  const h=harness(),first=await read(h);h.calls.length=0;
  h.value.cases[0].captures.push({pngSha256:'c'.repeat(64),rawSha256:'d'.repeat(64),index:0});
  const second=await read(h,{previous:first});
  assert.deepStrictEqual(second.value,h.value);
  assert.deepStrictEqual(second.newSections.map(s=>s.path),[['cases',0,'captures']]);
  const pageIndexes=new Set(h.calls.filter(c=>c.method==='page').map(c=>c.args.index));
  assert.equal(pageIndexes.size,1);
  assert.equal(second.receipt.reusedSections,first.sections.size-1);
  assert.deepStrictEqual(first.value.cases[0].captures,[]);
});

test('adding a case retains old evidence and transfers only new case components',async()=>{
  const h=harness(),first=await read(h);h.calls.length=0;
  h.value.cases.push({name:'Conservatory south',camera:[7,8,9],captures:[]});
  const second=await read(h,{previous:first});
  assert.deepStrictEqual(second.value,h.value);
  assert.deepStrictEqual(second.newSections.map(s=>s.path),[['cases',1,'name'],['cases',1,'camera'],['cases',1,'captures']]);
  assert.equal(second.receipt.reusedSections,first.sections.size);
});

test('multi-page Unicode data survives a split surrogate pair without normalization or omission',async()=>{
  const h=harness();
  h.value.cases[0].before='x'.repeat(PAGE_CHARACTERS-2)+'🚀'+'終'.repeat(PAGE_CHARACTERS+5);
  const checkpoint=await read(h);
  assert.deepStrictEqual(checkpoint.value,h.value);
  const section=checkpoint.newSections.find(s=>s.path.join('/')==='cases/0/before');
  assert.equal(section.encoded.charCodeAt(PAGE_CHARACTERS-1),0xd83d);
  assert.equal(section.encoded.charCodeAt(PAGE_CHARACTERS),0xde80);
  const index=checkpoint.manifest.sections.findIndex(s=>s.path.join('/')==='cases/0/before');
  assert.deepStrictEqual(h.calls.filter(c=>c.method==='page'&&c.args.index===index).map(c=>c.args.offset),[0,PAGE_CHARACTERS,PAGE_CHARACTERS*2]);
});

test('pager freezes transmitted strings at begin and rejects live data mutation at finish',async()=>{
  const h=harness(),original=encodeEvidence(h.value.cases[0].before);
  const manifest=await h.pager.begin({session});
  h.value.cases[0].before.positions.push(99);
  const index=manifest.sections.findIndex(s=>s.path.join('/')==='cases/0/before');
  const page=h.pager.page({session,revision:manifest.revision,index,offset:0});
  assert.equal(page.data,original);
  assert.throws(()=>h.pager.finish({session,revision:manifest.revision}),/changed/i);
});

test('pager rejects concurrent transactions, stale revisions, foreign sessions and invalid page positions',async()=>{
  const h=harness(),manifest=await h.pager.begin({session});
  await assert.rejects(()=>h.pager.begin({session}),/active/i);
  const valid={session,revision:manifest.revision,index:0,offset:0};
  for(const patch of [{session:'foreign'},{revision:0},{index:-1},{index:manifest.sections.length},{offset:-1},{offset:1},{offset:PAGE_CHARACTERS},{offset:0.5}])
    assert.throws(()=>h.pager.page({...valid,...patch}));
  assert.throws(()=>h.pager.finish({session:'foreign',revision:manifest.revision}));
  h.pager.finish({session,revision:manifest.revision});
  assert.throws(()=>h.pager.page(valid));
  await assert.rejects(()=>h.pager.begin({session:'new-session'}),/session/i);
});

test('root and case accessors are rejected without being invoked by snapshot splitting',async()=>{
  for(const atCase of [false,true]) {
    const h=harness();let reads=0;
    Object.defineProperty(atCase?h.value.cases[0]:h.value,'accessor',{enumerable:true,get(){reads++;return {lost:1};}});
    await assert.rejects(()=>read(h));
    assert.equal(reads,0);
  }
});

test('host rejects manifest identity mismatch, gaps and corrupt manifest hash',async()=>{
  for(const mutate of [m=>{m.session='foreign';},m=>{m.mode='before';},m=>{m.source.head='c'.repeat(40);},m=>{m.revision=2;},m=>{m.sha256='0'.repeat(64);}]) {
    const h=harness();
    await assert.rejects(()=>read(h,{remote:async(method,args)=>{const response=await h.remote(method,args);if(method==='begin')mutate(response);return response;}}));
    assert.equal(h.calls.filter(c=>c.method==='page').length,0);
  }
});

test('host independently rejects correctly hashed manifest paths in the wrong order',async()=>{
  const h=harness();
  await assert.rejects(()=>read(h,{remote:async(method,args)=>{
    const response=await h.remote(method,args);
    if(method==='begin'){[response.sections[0],response.sections[1]]=[response.sections[1],response.sections[0]];resign(response);}
    return response;
  }}),/path\/order/i);
});

test('host rejects signed duplicate or unsafe shape keys and invalid descriptor lengths',async()=>{
  for(const mutate of [m=>m.rootKeys.push(m.rootKeys[0]),m=>m.rootKeys.push('__proto__'),m=>{m.sections[0].characters=-1;},m=>{m.sections[0].characters=1.5;},m=>{m.caseKeys=Array.from({length:5},()=>[]);}]) {
    const h=harness();
    await assert.rejects(()=>read(h,{remote:async(method,args)=>{const response=await h.remote(method,args);if(method==='begin'){mutate(response);resign(response);}return response;}}));
  }
});

test('host rejects page session, revision, index, offset, length and byte corruption',async()=>{
  for(const mutate of [p=>{p.session='foreign';},p=>{p.revision++;},p=>{p.index++;},p=>{p.offset++;},p=>{p.characters++;},p=>{p.data+='x';},p=>{p.data=p.data.slice(1);},p=>{p.data=(p.data[0]==='0'?'1':'0')+p.data.slice(1);}]) {
    const h=harness();let altered=false;
    await assert.rejects(()=>read(h,{remote:async(method,args)=>{const response=await h.remote(method,args);if(method==='page'&&!altered){altered=true;mutate(response);}return response;}}));
    assert(altered);
    assert(!h.calls.some(c=>c.method==='finish'));
  }
});

test('host requires a matching final seal before committing reconstructed evidence',async()=>{
  for(const mutate of [s=>{s.session='foreign';},s=>{s.revision++;},s=>{s.sha256='0'.repeat(64);},s=>{s.protocol=2;}]) {
    const h=harness();
    await assert.rejects(()=>read(h,{remote:async(method,args)=>{const response=await h.remote(method,args);if(method==='finish')mutate(response);return response;}}),/seal/i);
  }
});

test('a previous checkpoint cannot be reused under a different source or session',async()=>{
  const first=await read(harness());
  for(const changed of [{session:'other-session'},{source:{head:'c'.repeat(40),tree:source.tree}},{mode:'before'}]) {
    const h=harness();
    await assert.rejects(()=>read(h,{previous:first,...changed}));
  }
});

test('the original 15000 ms deadline is cumulative across all responses',async()=>{
  const h=harness();let clock=0;
  await assert.rejects(()=>read(h,{now:()=>clock,remote:async(method,args)=>{
    const response=await h.remote(method,args);clock+=4000;return response;
  }}),error=>error.code==='DIAGNOSTIC_TIMEOUT');
  assert.equal(clock,16000);
  assert.equal(h.calls.length,4);
  assert(!h.calls.some(c=>c.method==='finish'));
});

test('a seal arriving at the deadline does not replace the accepted previous checkpoint',async()=>{
  const h=harness(),first=await read(h),original=encodeEvidence(first.value);
  h.value.errors.push('new diagnostic error');let clock=0;
  await assert.rejects(()=>read(h,{previous:first,now:()=>clock,remote:async(method,args)=>{
    const response=await h.remote(method,args);clock=method==='finish'?15000:14999;return response;
  }}),error=>error.code==='DIAGNOSTIC_TIMEOUT');
  assert.equal(encodeEvidence(first.value),original);
  assert.equal(first.manifest.revision,1);
  assert.deepStrictEqual(first.value.errors,[]);
});

test('a delayed response cannot commit after the real timer rejected the checkpoint',async()=>{
  const h=harness(),first=await read(h);h.value.errors.push('new error');
  let release,delayed=false,committed=false;
  const blocked=new Promise(resolve=>{release=resolve;});
  const transfer=read(h,{previous:first,timeoutMs:30,remote:async(method,args)=>{
    const response=await h.remote(method,args);
    if(method==='page'){delayed=true;await blocked;}
    return response;
  }}).then(value=>{committed=true;return value;});
  await assert.rejects(()=>transfer,error=>error.code==='DIAGNOSTIC_TIMEOUT');
  assert(delayed);release();
  await new Promise(resolve=>setTimeout(resolve,5));
  assert.equal(committed,false);
  assert.deepStrictEqual(first.value.errors,[]);
  assert.equal(first.manifest.revision,1);
});

test('host manifest and section hashing obey the remaining cumulative deadline and cannot commit late',async()=>{
  for(const delayOrdinal of [1,2]) {
    const h=harness(),first=await read(h);
    h.value.errors.push('uncommitted error');
    // Complete browser-side hashes before instrumenting host digest latency.
    const manifest=await h.pager.begin({session});
    h.calls.length=0;
    const subtle=crypto.subtle,original=subtle.digest;
    const ownDescriptor=Object.getOwnPropertyDescriptor(subtle,'digest');
    let release,clock=0,digestCalls=0,blockedDigest=null,deadlineTimer;
    const blocked=new Promise(resolve=>{release=resolve;});
    Object.defineProperty(subtle,'digest',{configurable:true,writable:true,value(...args){
      digestCalls++;
      if(digestCalls!==delayOrdinal)return Reflect.apply(original,subtle,args);
      blockedDigest=blocked.then(()=>Reflect.apply(original,subtle,args));
      return blockedDigest;
    }});
    try {
      const outcome=read(h,{previous:first,now:()=>clock,remote:async(method,args)=>{
        if(method==='begin'){
          h.calls.push({method,args:clone(args)});
          clock=14980;return clone(manifest);
        }
        return h.remote(method,args);
      }}).then(value=>({kind:'accepted',value}),error=>({kind:'rejected',error}));
      const verdict=await Promise.race([outcome,new Promise(resolve=>{
        deadlineTimer=setTimeout(()=>resolve({kind:'missed-deadline'}),200);
      })]);
      assert.equal(verdict.kind,'rejected','Hashing must use the 20 ms remaining, not an independent fresh budget');
      assert.equal(verdict.error.code,'DIAGNOSTIC_TIMEOUT');
      assert.match(verdict.error.message,/15000 ms/);
      assert.equal(digestCalls,delayOrdinal);
      assert(!h.calls.some(c=>c.method==='finish'));
      release();await blockedDigest;
      assert.equal((await outcome).kind,'rejected');
      assert.equal(first.manifest.revision,1);
      assert.deepStrictEqual(first.value.errors,[]);
    } finally {
      clearTimeout(deadlineTimer);
      if(ownDescriptor)Object.defineProperty(subtle,'digest',ownDescriptor);else delete subtle.digest;
      release();if(blockedDigest)await blockedDigest;
    }
  }
});

test('expanded or invalid budgets and invalid monotonic clocks are rejected',async()=>{
  for(const timeoutMs of [15001,Infinity,NaN,0,-1])await assert.rejects(()=>read(harness(),{timeoutMs}));
  for(const after of [-1,NaN,Infinity]){
    let calls=0;await assert.rejects(()=>read(harness(),{now:()=>calls++===0?0:after}),/clock/i);
  }
});
