import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {snapshotScopedSubmission} from './scoped-submission-receipt.ts';
import {assertScopedSubmittedOwner} from './scoped-submission-contract.mjs';
import {assertSubmittedOwner,assertDrawPair} from './contract.mjs';
const clone=value=>structuredClone(value),hash=bytes=>createHash('sha256').update(bytes).digest('hex');
const bytes=array=>new Uint8Array(array.buffer,array.byteOffset,array.byteLength);
const callbackNames=['onBeforeRender','onAfterRender','onBeforeShadow','onAfterShadow'];
// Source facts only, not retrofitted proof. Artifact15181761412 retains these
// calls but DOES NOT record their actual native group or synchronous bytes.
// Extraction first-failed-draws-typed.json SHA256:
// 0c81118745a6e92c44036a6d847c39f32a47585c2f24f0ffce986fb973a2ecc1
const observed={path:'Scene#0/Mapped%20secondary%20buildings%20%C2%B7%20roofs#0',positionCount:1467,indexCount:3015,
 quiet:{start:0,count:'Infinity'},ranges:[{start:0,count:0},{start:468,count:6}],actualGroupRecorded:false};
function attribute(array,itemSize){return {array,itemSize,count:array.length/itemSize,normalized:false,gpuType:1015,usage:35044};}
function fixture({interleaved=false,indexed=true,extraAttributes=false}={}){
 const count=observed.positionCount,position=new Float32Array(count*3);for(let i=0;i<position.length;i++)position[i]=(i%97)/8;
 const attributes={position:attribute(position,3),normal:attribute(Float32Array.from(position,v=>v/4),3),uv:attribute(new Float32Array(count*2),2)};
 if(interleaved){
  // Nonzero byteOffset ensures only the actual typed-array view is hashed.
  const raw=new Float32Array(new ArrayBuffer((count*5+8)*4),16,count*5);for(let i=0;i<raw.length;i++)raw[i]=(i%31)/16;
  const data={array:raw,stride:5,usage:35048};
  attributes.position={isInterleavedBufferAttribute:true,data,count,itemSize:3,offset:0,normalized:false};
  attributes.uv={isInterleavedBufferAttribute:true,data,count,itemSize:2,offset:3,normalized:false};
 }
 if(extraAttributes){
  attributes.color=attribute(Uint8Array.from({length:count*3},(_,i)=>i%256),3);attributes.color.normalized=true;
  attributes.sedimentCoord=attribute(Float32Array.from({length:count*2},(_,i)=>i/19),2);
 }
 const index=indexed?attribute(Uint16Array.from({length:observed.indexCount},(_,i)=>i%count),1):null;
 const geometry={type:'BufferGeometry',attributes,index,groups:[],morphAttributes:{},drawRange:{start:0,count:Infinity},getAttribute(name){return this.attributes[name];}};
 const object={isMesh:true,type:'Mesh',count:1,geometry,name:'Mapped secondary buildings · roofs',
  onBeforeRender:function beforeRender(){return 1;},onAfterRender:function afterRender(){return 2;},
  onBeforeShadow:function beforeShadow(){return 3;},onAfterShadow:function afterShadow(){return 4;}};
 return {geometry,object};
}
function sceneObject(object){
 const g=object.geometry;
 const row=a=>{if(!a)return null;const interleaved=!!a.isInterleavedBufferAttribute,data=interleaved?a.data:a,array=data.array;return {
  type:array.constructor.name,bytes:array.byteLength,count:a.count,itemSize:a.itemSize,normalized:a.normalized,interleaved,
  offset:interleaved?a.offset:0,stride:interleaved?data.stride:a.itemSize,gpuType:a.gpuType??null,usage:data.usage,meshPerAttribute:a.meshPerAttribute??null,sha256:hash(bytes(array))};};
 return {path:observed.path,type:'Mesh',count:1,isRoof:false,instanceMatrix:null,instanceColor:null,morphTargetInfluences:null,
  callbacks:callbackNames.map(name=>({functionSha256:hash(new TextEncoder().encode(JSON.stringify(Function.prototype.toString.call(object[name]))))})),
  geometry:{type:g.type,attributes:Object.fromEntries(Object.keys(g.attributes).sort().map(name=>[name,row(g.attributes[name])])),index:row(g.index),groups:[],morphAttributes:{},drawRange:{start:g.drawRange.start,count:g.drawRange.count===Infinity?'Infinity':g.drawRange.count}}};
}
async function proved(range=observed.ranges[1],options={}){
 const {geometry,object}=fixture(options),scene=sceneObject(object),quiet={...geometry.drawRange};geometry.drawRange={...range};
 const snapshot=snapshotScopedSubmission(geometry,object,null,quiet);
 const draw={path:observed.path,pass:'shadow',calls:1,triangles:range.count/3,lines:0,points:0,submittedGroup:null,submittedGeometry:{positionCount:geometry.attributes.position.count,indexCount:geometry.index?.count??0,...range},scopedSubmission:snapshot.receipt};
 geometry.drawRange={...quiet};snapshot.assertRestored();await snapshot.settle(async value=>hash(value));
 return {geometry,object,scene,quiet,snapshot,draw};
}

test('retained original no-proof 0/0 and468/6 draws still fail; an unobserved group is never inferred',()=>{
 for(const range of observed.ranges){
  const {object}=fixture(),scene=sceneObject(object),draw={path:observed.path,pass:'shadow',calls:1,triangles:range.count/3,
   submittedGeometry:{positionCount:observed.positionCount,indexCount:observed.indexCount,...range}};
  assert.equal(observed.actualGroupRecorded,false);
  assert.throws(()=>assertSubmittedOwner(draw,scene),/no owner proof/);
  assert.throws(()=>assertScopedSubmittedOwner(draw,scene),/Missing scoped/);
 }
});
test('new explicitly observed scoped0 and468/6 calls preserve full source bytes and exact submitted ranges',async()=>{
 for(const range of observed.ranges){
  const {scene,draw}=await proved(range),before=clone(draw);
  assertScopedSubmittedOwner(draw,scene);assert.deepStrictEqual(draw,before);
  assert.deepStrictEqual(draw.submittedGeometry,{positionCount:1467,indexCount:3015,...range});
  assert.deepStrictEqual(draw.scopedSubmission.sourceDrawRange,observed.quiet);
  assert.deepStrictEqual(draw.scopedSubmission.restoredRange,observed.quiet);
  assert.equal(draw.calls,1);assert.equal(draw.triangles,range.count/3);
 }
});
test('unchanged same geometry and separate pooled geometry do not enter this proof branch',()=>{
 const {geometry,object}=fixture(),quiet={...geometry.drawRange};
 assert.equal(snapshotScopedSubmission(geometry,object,undefined,quiet),null);
 assert.equal(snapshotScopedSubmission({...geometry},object,undefined,undefined),null);
 geometry.drawRange={start:468,count:6};
 assert.throws(()=>snapshotScopedSubmission(geometry,object,undefined,quiet),/observed null/);
 assert.throws(()=>snapshotScopedSubmission(geometry,object,{},quiet),/observed null/);
 assert.throws(()=>snapshotScopedSubmission(geometry,object,null,geometry.drawRange),/independent pre-render/);
});
test('restoration must be observed on the original identity before asynchronous hashes can settle',async()=>{
 const {geometry,object}=fixture(),quiet={...geometry.drawRange};geometry.drawRange={start:468,count:6};
 const snapshot=snapshotScopedSubmission(geometry,object,null,quiet);let hashes=0;
 await assert.rejects(snapshot.settle(async value=>{hashes++;return hash(value);}),/restoration was not proven/);assert.equal(hashes,0);
 await assert.rejects(snapshot.settle(async value=>hash(value)),/restoration was not proven/);
 assert.throws(()=>snapshot.assertRestored(),/not restored/);assert.equal(snapshot.receipt.restoredRange,null);
 geometry.drawRange={...quiet};object.geometry={...geometry};assert.throws(()=>snapshot.assertRestored(),/identity/);
 object.geometry=geometry;geometry.drawRange={start:468,count:6};const current=snapshotScopedSubmission(geometry,object,null,quiet);
 geometry.drawRange={...quiet};current.assertRestored();geometry.drawRange={start:0,count:0};
 await assert.rejects(current.settle(async value=>hash(value)),/not restored/);
 const valid=await proved();assert.equal(valid.snapshot.receipt.settled,true);
});
test('synchronous copies preserve all original attribute/index bytes while callbacks retain original references',async()=>{
 const {geometry,object}=fixture(),scene=sceneObject(object),quiet={...geometry.drawRange};geometry.drawRange={start:468,count:6};
 const snapshot=snapshotScopedSubmission(geometry,object,null,quiet);
 geometry.attributes.position.array[0]=-999;geometry.attributes.normal.array[1]=777;geometry.attributes.uv.array[2]=123;geometry.index.array[0]=8;
 geometry.drawRange={...quiet};snapshot.assertRestored();await snapshot.settle(async value=>{await Promise.resolve();return hash(value);});
 const draw={path:observed.path,calls:1,triangles:2,lines:0,points:0,submittedGroup:null,submittedGeometry:{positionCount:1467,indexCount:3015,start:468,count:6},scopedSubmission:snapshot.receipt};
 assertScopedSubmittedOwner(draw,scene);
 assert.notEqual(snapshot.receipt.attributes.position.sha256,hash(bytes(geometry.attributes.position.array)));
 assert.notEqual(snapshot.receipt.index.sha256,hash(bytes(geometry.index.array)));
 assert.deepStrictEqual(snapshot.receipt.callbacks,scene.callbacks);
});
test('actual callback reference changes are rejected at restoration and before hashing even with identical source text',async()=>{
 const sameText=callback=>Function('return ('+Function.prototype.toString.call(callback)+')')();
 for(const name of callbackNames){
  const {geometry,object}=fixture(),quiet={...geometry.drawRange},original=object[name];geometry.drawRange={start:468,count:6};
  const snapshot=snapshotScopedSubmission(geometry,object,null,quiet);geometry.drawRange={...quiet};
  const replacement=sameText(original);assert.notStrictEqual(replacement,original);assert.equal(Function.prototype.toString.call(replacement),Function.prototype.toString.call(original));
  object[name]=replacement;assert.throws(()=>snapshot.assertRestored(),/callback identity/);assert.equal(snapshot.receipt.restoredRange,null);
  object[name]=original;snapshot.assertRestored();object[name]=replacement;let hashes=0;
  await assert.rejects(snapshot.settle(async value=>{hashes++;return hash(value);}),/callback identity/);assert.equal(hashes,0);assert.equal(snapshot.receipt.settled,false);
 }
});
test('deferred hashing rechecks geometry, quiet range and all original callback identities before settlement',async()=>{
 const mutations=[
  {name:'byte-identical geometry clone',edit:f=>f.object.geometry={...f.geometry},error:/geometry identity/},
  {name:'quiet range changed',edit:f=>f.geometry.drawRange={start:0,count:0},error:/quiet range/},
  ...callbackNames.map(name=>({name:'same-source '+name,edit:f=>{
   const original=f.object[name],replacement=Function('return ('+Function.prototype.toString.call(original)+')')();
   assert.notStrictEqual(replacement,original);assert.equal(Function.prototype.toString.call(replacement),Function.prototype.toString.call(original));f.object[name]=replacement;
  },error:/callback identity/})),
 ];
 for(const mutation of mutations){
  const f=fixture(),quiet={...f.geometry.drawRange};f.geometry.drawRange={start:468,count:6};
  const snapshot=snapshotScopedSubmission(f.geometry,f.object,null,quiet);f.geometry.drawRange={...quiet};snapshot.assertRestored();
  let release,entered,calls=0,finished=0;const gate=new Promise(resolve=>release=resolve),started=new Promise(resolve=>entered=resolve);
  const result=snapshot.settle(async value=>{calls++;entered();await gate;finished++;return hash(value);});
  const rejected=assert.rejects(result,mutation.error,mutation.name);await started;mutation.edit(f);release();await rejected;
  assert.equal(finished,calls,'Every started hash must finish');assert.equal(snapshot.receipt.settled,false);
  assert.equal(snapshot.receipt.attributes.position.sha256,null);assert.equal(snapshot.receipt.callbacks[0].functionSha256,null);
  const terminalCalls=calls;await assert.rejects(snapshot.settle(async value=>{calls++;return hash(value);}),mutation.error);assert.equal(calls,terminalCalls);
 }
});
test('plain and interleaved source schemas include full byte views, offset/stride and data usage',async()=>{
 const {scene,draw,geometry}=await proved(observed.ranges[1],{interleaved:true});assertScopedSubmittedOwner(draw,scene);
 const position=draw.scopedSubmission.attributes.position,uv=draw.scopedSubmission.attributes.uv,raw=geometry.attributes.position.data.array;
 assert.equal(position.interleaved,true);assert.equal(position.bytes,1467*5*4);assert.equal(position.stride,5);assert.equal(uv.offset,3);assert.equal(position.usage,35048);
 assert.equal(position.gpuType,null);assert.equal(position.sha256,uv.sha256);assert.equal(position.sha256,hash(bytes(raw)));
 assert.notEqual(position.sha256,hash(new Uint8Array(raw.buffer)),'Backing-buffer prefix/suffix must not be hashed');
});
test('every original attribute includes color and sedimentCoord with no position-only exception',async()=>{
 const {scene,draw}=await proved(observed.ranges[1],{extraAttributes:true});assertScopedSubmittedOwner(draw,scene);
 assert.deepStrictEqual(Object.keys(draw.scopedSubmission.attributes),['color','normal','position','sedimentCoord','uv']);
 for(const name of ['color','sedimentCoord']){
  const changed=clone(draw);changed.scopedSubmission.attributes[name].sha256='e'.repeat(64);assert.throws(()=>assertScopedSubmittedOwner(changed,scene));
 }
});
test('settlement waits for all hashes and releases copies on terminal success or failure without retry',async()=>{
 const {geometry,object}=fixture(),quiet={...geometry.drawRange};geometry.drawRange={start:468,count:6};
 const snapshot=snapshotScopedSubmission(geometry,object,null,quiet);geometry.drawRange={...quiet};snapshot.assertRestored();
 let calls=0,finish,entered;const gate=new Promise(resolve=>finish=resolve),started=new Promise(resolve=>entered=resolve),error=Error('hash failed');
 let rejected=false;
 const result=snapshot.settle(async value=>{const at=++calls;if(at===1)throw error;if(at===2){entered();await gate;}return hash(value);});
 void result.catch(()=>{rejected=true;});await started;await Promise.resolve();assert.equal(rejected,false);finish();
 await assert.rejects(result,value=>value===error);assert.equal(snapshot.receipt.settled,false);assert.equal(snapshot.receipt.attributes.position.sha256,null);
 const originalCalls=calls;await assert.rejects(snapshot.settle(async value=>{calls++;return hash(value);}),value=>value===error);assert.equal(calls,originalCalls);
 const good=await proved();let repeated=0;assert.strictEqual(await good.snapshot.settle(async value=>{repeated++;return hash(value);}),good.draw.scopedSubmission);assert.equal(repeated,0);
});
test('nonindexed ordinary source proof uses its original position count without inventing an index',async()=>{
 const {scene,draw}=await proved({start:6,count:3},{indexed:false});assertScopedSubmittedOwner(draw,scene);assert.equal(draw.scopedSubmission.index,null);assert.equal(draw.submittedGeometry.indexCount,0);
});
test('range validation rejects negative, fractional, nonfinite, oversized and out-of-original subsets',()=>{
 for(const bad of [{start:-1,count:3},{start:.5,count:3},{start:0,count:NaN},{start:0,count:-Infinity},{start:0,count:-1},{start:0,count:1.5},{start:3016,count:0},{start:468,count:999999},{start:1,count:Infinity},{start:469,count:6},{start:468,count:5}]){
  const {geometry,object}=fixture(),quiet={...geometry.drawRange};geometry.drawRange=bad;assert.throws(()=>snapshotScopedSubmission(geometry,object,null,quiet));
 }
 for(const bad of [null,{start:0,count:NaN},{start:0,count:-Infinity},{start:-1,count:Infinity},{start:0,count:3016}]){
  const {geometry,object}=fixture();geometry.drawRange={start:468,count:6};assert.throws(()=>snapshotScopedSubmission(geometry,object,null,bad));
 }
 const {geometry,object}=fixture();geometry.drawRange={start:0,count:0};assert.throws(()=>snapshotScopedSubmission(geometry,object,null,{start:3,count:9}),/outside/);
});
test('changed scopes reject source groups, roof exceptions, morphs and all instanced/skinned/batched cases',()=>{
 const changes=[f=>f.object.type='SkinnedMesh',f=>f.object.isSkinnedMesh=true,f=>f.object.isInstancedMesh=true,f=>f.object.isBatchedMesh=true,
  f=>f.object.count=2,f=>delete f.object.count,f=>f.object.instanceMatrix={},f=>f.object.instanceColor={},f=>f.geometry.isInstancedBufferGeometry=true,
  f=>f.geometry.groups.push({start:0,count:3,materialIndex:0}),f=>f.geometry.morphAttributes.position=[],f=>f.object.morphTargetInfluences=[],
  f=>f.geometry.attributes.position.isInstancedBufferAttribute=true,f=>f.geometry.attributes.position.meshPerAttribute=1];
 for(const change of changes){const f=fixture(),quiet={...f.geometry.drawRange};f.geometry.drawRange={start:468,count:6};change(f);assert.throws(()=>snapshotScopedSubmission(f.geometry,f.object,null,quiet));}
 const f=fixture({interleaved:true}),quiet={...f.geometry.drawRange};f.geometry.drawRange={start:468,count:6};f.geometry.attributes.position.data.isInstancedInterleavedBuffer=true;
 assert.throws(()=>snapshotScopedSubmission(f.geometry,f.object,null,quiet),/Instanced/);
 const r=fixture(),rq={...r.geometry.drawRange};r.geometry.drawRange={start:0,count:0};assert.throws(()=>snapshotScopedSubmission(r.geometry,r.object,null,rq,true),/roof exception/);
});
test('host rejects every metadata, byte, range, group, callback and restoration mismatch',async()=>{
 const {draw,scene}=await proved();
 const edits=[d=>d.scopedSubmission.attributes.position.sha256='0'.repeat(64),d=>d.scopedSubmission.attributes.normal.bytes--,
  d=>d.scopedSubmission.attributes.uv.offset=1,d=>d.scopedSubmission.attributes.uv.stride=3,d=>d.scopedSubmission.attributes.position.interleaved=true,
  d=>d.scopedSubmission.attributes.position.type='Uint32Array',d=>d.scopedSubmission.attributes.position.count--,d=>d.scopedSubmission.attributes.position.itemSize=2,
  d=>d.scopedSubmission.attributes.position.normalized=true,d=>d.scopedSubmission.attributes.position.gpuType=1013,d=>d.scopedSubmission.attributes.position.usage++,
  d=>d.scopedSubmission.attributes.position.meshPerAttribute=1,d=>delete d.scopedSubmission.attributes.normal,d=>d.scopedSubmission.attributes.fake=clone(d.scopedSubmission.attributes.position),
  d=>d.scopedSubmission.index.sha256='1'.repeat(64),d=>d.scopedSubmission.index.type='Uint32Array',d=>d.scopedSubmission.index.bytes++,
  d=>d.scopedSubmission.sourcePositionCount++,d=>d.scopedSubmission.sourceIndexCount++,d=>d.scopedSubmission.geometryType='BoxGeometry',
  d=>d.scopedSubmission.sourceDrawRange.count=3015,d=>d.scopedSubmission.sourceActive.count--,d=>d.scopedSubmission.submittedActive.count=3,
  d=>d.scopedSubmission.submittedDrawRange.count=3,d=>d.submittedGeometry.start++,d=>d.submittedGeometry.positionCount++,
  d=>d.scopedSubmission.restoredRange=null,d=>d.scopedSubmission.restoredRange.count=0,d=>d.scopedSubmission.settled=false,
  d=>d.scopedSubmission.actualGroupRecorded=false,d=>delete d.scopedSubmission.actualGroup,d=>d.scopedSubmission.actualGroup={},
  d=>delete d.submittedGroup,d=>d.submittedGroup={undefined:true},d=>d.submittedGroup={},
  d=>d.scopedSubmission.sourceGroups.push({start:0,count:3}),d=>d.scopedSubmission.objectCount=2,d=>d.scopedSubmission.objectFlags.skinned=true,
  d=>d.scopedSubmission.callbacks[0].functionSha256='2'.repeat(64),d=>d.scopedSubmission.callbacks.reverse(),d=>d.scopedSubmission.callbacks.pop(),
  d=>d.submittedOwnership={kind:'exact-original-owner'}];
 edits.push(d=>d.calls=2,d=>d.calls=-1,d=>d.lines=1,d=>d.points=1,d=>d.triangles=1,d=>delete d.triangles);
 for(const [i,edit] of edits.entries()){const changed=clone(draw);edit(changed);assert.throws(()=>assertScopedSubmittedOwner(changed,scene),undefined,'Mutation '+i);}
 for(const edit of [s=>s.isRoof=true,s=>s.type='InstancedMesh',s=>s.count=0,s=>delete s.count,s=>delete s.instanceMatrix,s=>s.instanceColor={},s=>s.morphTargetInfluences=[],s=>s.geometry.groups=[{}]]){
  const changed=clone(scene);edit(changed);assert.throws(()=>assertScopedSubmittedOwner(draw,changed));
 }
 const changed=clone(draw);changed.path='Scene#0/107227742_STAGED_LOD0#0/RoofPatinatedCopperPanels#0';
 assert.throws(()=>assertScopedSubmittedOwner(changed,{...scene,path:changed.path}));
 const noCall=clone(draw);noCall.calls=0;noCall.triangles=0;assertScopedSubmittedOwner(noCall,scene);
});
test('same original scoped proof compares exactly across before/candidate while retaining zero-triangle calls',async()=>{
 const before=[],candidate=[];
 for(const range of observed.ranges){before.push((await proved(range)).draw);candidate.push((await proved(range)).draw);}
 const roofPath='Scene#0/107227742_STAGED_LOD0#0/RoofPatinatedCopperPanels#0';
 const roof={path:roofPath,pass:'color',calls:1,triangles:48,submittedGeometry:{positionCount:96,indexCount:144,start:0,count:'Infinity'}};
 const appended={...clone(roof),triangles:98,submittedGeometry:{positionCount:150,indexCount:294,start:0,count:'Infinity'}};
 assertDrawPair([...before,roof],[...candidate,appended]);assert.equal(before[0].calls,1);assert.equal(before[0].triangles,0);
 for(const edit of [d=>d[0].calls=0,d=>d.shift(),d=>d[1].submittedGeometry.count=3,d=>d[1].scopedSubmission.callbacks[0].functionSha256='0'.repeat(64)]){
  const changed=clone(candidate);edit(changed);assert.throws(()=>assertDrawPair([...before,roof],[...changed,appended]));
 }
});
