import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {buildLandmarkIndexManifest,decodeLandmarkIndexEntries} from './landmark-index-manifest.mjs';
import pins from './landmark-index-pins.json' with {type:'json'};

const sha=bytes=>createHash('sha256').update(bytes).digest('hex');
const raw=array=>new Uint8Array(array.buffer,array.byteOffset,array.byteLength);
const fnv=array=>array.reduce((h,value)=>Math.imul(h^value,16777619),2166136261)>>>0;
const json=value=>Buffer.from(JSON.stringify(value));

function glb(model,binary){
  const encoded=json(model),jsonLength=Math.ceil(encoded.length/4)*4,binLength=Math.ceil(binary.length/4)*4;
  const result=Buffer.alloc(12+8+jsonLength+8+binLength);
  result.writeUInt32LE(0x46546c67,0);result.writeUInt32LE(2,4);result.writeUInt32LE(result.length,8);
  result.writeUInt32LE(jsonLength,12);result.writeUInt32LE(0x4e4f534a,16);result.fill(0x20,20,20+jsonLength);encoded.copy(result,20);
  result.writeUInt32LE(binLength,20+jsonLength);result.writeUInt32LE(0x004e4942,24+jsonLength);Buffer.from(binary).copy(result,28+jsonLength);
  return result;
}

function fixture(Component=Uint16Array){
  const full=new Component([0,1,2,0,2,3]),reduced=new Uint32Array([0,2,3]);
  // Prefix/suffix values are intentionally outside the source vertex range.
  // Only the actual accessor slice is an original index array.
  const storage=new Component([99,...full,88]),width=Component.BYTES_PER_ELEMENT;
  const binary=Buffer.concat([Buffer.from(raw(storage)),Buffer.alloc(48)]);
  const model={asset:{version:'2.0'},buffers:[{byteLength:binary.length},{byteLength:storage.byteLength,extensions:{EXT_meshopt_compression:{fallback:true}}}],
    bufferViews:[{buffer:1,byteOffset:0,byteLength:storage.byteLength,extensions:{EXT_meshopt_compression:{buffer:0,byteOffset:0,byteLength:storage.byteLength,byteStride:width,count:storage.length,mode:'INDICES'}}},
      {buffer:0,byteOffset:storage.byteLength,byteLength:48}],
    accessors:[{bufferView:1,componentType:5126,count:4,type:'VEC3'},{bufferView:0,byteOffset:width,componentType:width===2?5123:5125,count:6,type:'SCALAR'}],
    meshes:[{primitives:[{attributes:{POSITION:0},indices:1}]}]};
  const metadata={version:1,sourceSha256:'1'.repeat(64),entries:[{mesh:0,primitive:0,name:'Synthetic original',vertices:4,originalCount:6,hash:fnv(full),count:3,offset:4,length:12,error:.125}]};
  const encodedIndicesBytes=Buffer.concat([Buffer.from([91,92,93,94]),Buffer.from(raw(reduced)),Buffer.from([95,96])]);
  const calls=[];
  // The synthetic decoder separates GLB/accessor validation from codec behavior.
  // The real, hash-pinned Meshopt module is independently exercised against all
  // 37 immutable source entries by verifyLandmarkIndexManifest's CLI.
  const decoder={ready:Promise.resolve(),decodeGltfBuffer(target,count,size,source,mode,filter){
    calls.push({operation:'full',count,size,mode,filter,source:[...source]});
    assert.equal(source.length,count*size);target.set(source);
  },decodeIndexSequence(target,count,size,source){
    calls.push({operation:'reduced',count,size,source:[...source]});
    assert.equal(source.length,count*size);target.set(source);
  }};
  return {full,reduced,storage,binary,model,metadata,encodedIndicesBytes,decoder,calls,
    inputs(){return {metadataBytes:json(metadata),encodedIndicesBytes,modelBytes:glb(model,binary),sourceBytes:Buffer.from('immutable synthetic original selection source')};}};
}

test('synthetic GLB accessors preserve nonzero byte offsets and exact Uint16/Uint32 source index bytes',async()=>{
  for(const Component of [Uint16Array,Uint32Array]){
    const f=fixture(Component),decoded=await decodeLandmarkIndexEntries(f.inputs(),f.decoder);
    assert.equal(decoded.entries.length,1);const row=decoded.entries[0];
    assert.equal(row.key,'0:0');assert.deepEqual(row.entry,f.metadata.entries[0]);
    assert(row.sourceIndex instanceof Component);assert.deepEqual(row.sourceIndex,f.full);
    assert(row.decodedIndex instanceof Uint32Array);assert.deepEqual(row.decodedIndex,f.reduced);
    assert.deepEqual(f.calls.map(c=>c.operation),['full','reduced']);
    assert.equal(f.calls[0].mode,'INDICES');assert.equal(f.calls[0].size,Component.BYTES_PER_ELEMENT);
    assert.equal(f.calls[1].size,4);assert.deepEqual(f.calls[1].source,[...raw(f.reduced)]);
  }
});

test('manifest hashes actual arrays and source assets while retaining the historical metadata digest separately',async()=>{
  const f=fixture(),input=f.inputs(),before=Object.fromEntries(Object.entries(input).map(([k,b])=>[k,sha(b)]));
  const manifest=await buildLandmarkIndexManifest(input,f.decoder),entry=manifest.entries[0];
  assert.equal(manifest.schema,1);
  assert.deepEqual(entry.sourceIndex,{type:'Uint16Array',bytes:12,count:6,sha256:sha(raw(f.full))});
  assert.deepEqual(entry.decodedIndex,{type:'Uint32Array',bytes:12,count:3,sha256:sha(raw(f.reduced))});
  assert.deepEqual(entry.entry,f.metadata.entries[0]);
  assert.equal(manifest.metadata.sourceSha256,f.metadata.sourceSha256);
  assert.notEqual(manifest.metadata.sourceSha256,manifest.assets.model.sha256);
  assert.equal(manifest.assets.model.sha256,sha(input.modelBytes));
  assert.equal(manifest.assets.encodedIndices.sha256,sha(input.encodedIndicesBytes));
  assert.equal(manifest.assets.metadata.sha256,sha(input.metadataBytes));
  assert.equal(manifest.source.sha256,sha(input.sourceBytes));
  assert.deepEqual(Object.fromEntries(Object.entries(input).map(([k,b])=>[k,sha(b)])),before,'Decoder/manifest must not mutate any input byte');
});

test('pins preserve every original metadata entry and bind both index layouts without replacing the historical source digest',()=>{
  assert.equal(pins.entries.length,37);
  assert.equal(new Set(pins.entries.map(e=>e.key)).size,37);
  assert.equal(pins.source.sha256,'250463508b35a2772fd080c0f2109094a03dff2888b338aa3d868d4ef2c7e765');
  assert.equal(pins.metadata.sourceSha256,'560632f68f9f68974fef2f2f09f2e436f6742658ac864e35091e1c9a7c79e80f');
  assert.notEqual(pins.metadata.sourceSha256,pins.assets.model.sha256);
  for(const {key,entry,sourceIndex,decodedIndex} of pins.entries){
    assert.equal(key,entry.mesh+':'+entry.primitive);
    assert.equal(sourceIndex.count,entry.originalCount);assert.equal(decodedIndex.count,entry.count);
    assert.equal(decodedIndex.type,'Uint32Array');assert.equal(decodedIndex.bytes,entry.count*4);
    assert(['Uint16Array','Uint32Array'].includes(sourceIndex.type));
    assert.equal(sourceIndex.bytes,entry.originalCount*(sourceIndex.type==='Uint16Array'?2:4));
    assert.match(sourceIndex.sha256,/^[a-f0-9]{64}$/);assert.match(decodedIndex.sha256,/^[a-f0-9]{64}$/);
  }
});

test('original metadata mesh/primitive, vertex count, index count and FNV must bind the exact GLB primitive',async()=>{
  for(const mutate of [f=>{f.metadata.entries[0].mesh=1;},f=>{f.metadata.entries[0].primitive=1;},f=>{f.metadata.entries[0].vertices=5;},f=>{f.metadata.entries[0].originalCount=9;},f=>{f.metadata.entries[0].hash^=1;},f=>{f.model.meshes[0].primitives[0].mode=1;}]){
    const f=fixture();mutate(f);await assert.rejects(()=>decodeLandmarkIndexEntries(f.inputs(),f.decoder));
  }
});

test('same-length changed full indices fail even if counts and positions remain unchanged',async()=>{
  const f=fixture();f.binary.writeUInt16LE(1,3*2);
  await assert.rejects(()=>decodeLandmarkIndexEntries(f.inputs(),f.decoder),/FNV/);
});

test('same-length changed reduced indices produce a different immutable SHA rather than a count-only match',async()=>{
  const f=fixture(),original=await buildLandmarkIndexManifest(f.inputs(),f.decoder);
  f.encodedIndicesBytes.writeUInt32LE(1,4+4);
  const altered=await buildLandmarkIndexManifest(f.inputs(),f.decoder);
  assert.equal(original.entries[0].decodedIndex.count,altered.entries[0].decodedIndex.count);
  assert.notEqual(original.entries[0].decodedIndex.sha256,altered.entries[0].decodedIndex.sha256);
  assert.notEqual(original.assets.encodedIndices.sha256,altered.assets.encodedIndices.sha256);
});

test('full and reduced indices outside original vertices fail, including the upper equality boundary',async()=>{
  const a=fixture();a.binary.writeUInt16LE(4,2);
  await assert.rejects(()=>decodeLandmarkIndexEntries(a.inputs(),a.decoder),/Original landmark index/);
  const b=fixture();b.encodedIndicesBytes.writeUInt32LE(4,4);
  await assert.rejects(()=>decodeLandmarkIndexEntries(b.inputs(),b.decoder),/Reduced landmark index/);
});

test('duplicate associations, malformed counts, invalid error and truncated encoded ranges are rejected',async()=>{
  for(const mutate of [f=>f.metadata.entries.push({...f.metadata.entries[0]}),f=>{f.metadata.entries[0].count=4;},f=>{f.metadata.entries[0].count=9;},f=>{f.metadata.entries[0].error=-1;},f=>{f.metadata.entries[0].error=null;},f=>{f.metadata.entries[0].offset=-1;},f=>{f.metadata.entries[0].offset=100;},f=>{f.metadata.entries[0].length=100;},f=>{f.metadata.version=2;},f=>{f.metadata.sourceSha256='not-a-hash';}]){
    const f=fixture();mutate(f);await assert.rejects(()=>decodeLandmarkIndexEntries(f.inputs(),f.decoder));
  }
});

test('unsupported accessor types, normalization, sparse storage and misaligned slices fail closed',async()=>{
  for(const mutate of [f=>{f.model.accessors[1].componentType=5126;},f=>{f.model.accessors[1].type='VEC2';},f=>{f.model.accessors[1].normalized=true;},f=>{f.model.accessors[1].sparse={};},f=>{f.model.accessors[1].byteOffset=1;},f=>{f.model.accessors[1].byteOffset=8;},f=>{f.model.accessors[0].componentType=5123;},f=>{f.model.accessors[0].sparse={};},f=>{f.model.accessors[0].type='VEC2';}]){
    const f=fixture();mutate(f);await assert.rejects(()=>decodeLandmarkIndexEntries(f.inputs(),f.decoder));
  }
});

test('meshopt compression must have valid original buffer, offset, count, stride and index mode',async()=>{
  for(const mutate of [e=>{e.buffer=1;},e=>{e.byteOffset=100;},e=>{e.byteLength=100;},e=>{e.count++;},e=>{e.byteStride=4;},e=>{e.byteStride=1;},e=>{e.mode='ATTRIBUTES';},e=>{e.filter='OCTAHEDRAL';}]){
    const f=fixture();mutate(f.model.bufferViews[0].extensions.EXT_meshopt_compression);
    await assert.rejects(()=>decodeLandmarkIndexEntries(f.inputs(),f.decoder));
  }
});

test('GLB magic, declared size, version, chunk bounds and embedded-buffer identity are verified',async()=>{
  for(const mutate of [b=>b.writeUInt32LE(0,0),b=>b.writeUInt32LE(1,4),b=>b.writeUInt32LE(b.length+4,8),b=>b.writeUInt32LE(b.length*2,12),b=>b.writeUInt32LE(0,16)]){
    const f=fixture(),input=f.inputs();mutate(input.modelBytes);
    await assert.rejects(()=>decodeLandmarkIndexEntries(input,f.decoder));
  }
  const f=fixture();f.model.buffers[0].uri='external.bin';await assert.rejects(()=>decodeLandmarkIndexEntries(f.inputs(),f.decoder));
});

test('decoder failures cannot produce a manifest or a partial success',async()=>{
  for(const which of ['decodeGltfBuffer','decodeIndexSequence']){
    const f=fixture();f.decoder[which]=()=>{throw Error('deliberate corrupt encoded stream');};
    await assert.rejects(()=>buildLandmarkIndexManifest(f.inputs(),f.decoder),/corrupt encoded stream/);
  }
});
