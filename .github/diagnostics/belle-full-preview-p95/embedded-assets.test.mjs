import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {mkdtemp,mkdir,writeFile,readFile,rm,symlink} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join,dirname} from 'node:path';
import {gzipSync} from 'node:zlib';
import {buildEmbeddedAssetIndex,verifyEmbeddedAssetIndex,matchEmbeddedImage,canonicalImageMime,MAX_GZIP_DECODED_BYTES} from './embedded-assets.mjs';
import {verifyAssetReceipts} from './asset-receipts.mjs';

const hash=bytes=>createHash('sha256').update(bytes).digest('hex');
const PNG=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aZ3sAAAAASUVORK5CYII=','base64');
// Signature fixtures test MIME/provenance; the index is not an image decoder.
const JPEG=Buffer.from([255,216,255,224,0,4,74,70,255,217]);
function glb(json,bin){
 const body=Buffer.isBuffer(json)?json:Buffer.from(JSON.stringify(json)),j=Buffer.concat([body,Buffer.alloc((4-body.length%4)%4,32)]);
 const parts=[],chunk=(type,b)=>{const h=Buffer.alloc(8);h.writeUInt32LE(b.length);h.writeUInt32LE(type,4);return Buffer.concat([h,b]);};
 parts.push(chunk(0x4e4f534a,j));
 if(bin!==undefined){const b=Buffer.concat([bin,Buffer.alloc((4-bin.length%4)%4)]);parts.push(chunk(0x004e4942,b));}
 const h=Buffer.alloc(12);h.writeUInt32LE(0x46546c67);h.writeUInt32LE(2,4);h.writeUInt32LE(12+parts.reduce((n,p)=>n+p.length,0),8);return Buffer.concat([h,...parts]);
}
function imageGLB(payload=PNG,mime='image/png',{duplicates=1,offset=4}={}){
 const bin=Buffer.concat([Buffer.alloc(offset,19),payload]);return glb({asset:{version:'2.0'},buffers:[{byteLength:bin.length}],
  bufferViews:[{buffer:0,byteOffset:offset,byteLength:payload.length}],images:Array.from({length:duplicates},()=>({bufferView:0,mimeType:mime}))},bin);
}
async function fixture(files,run){
 const directory=await mkdtemp(join(tmpdir(),'belle-embedded-index-'));
 try{
  const manifest=[];
  for(const [file,bytes] of Object.entries(files)){const p=join(directory,file);await mkdir(dirname(p),{recursive:true});await writeFile(p,bytes);manifest.push({file,bytes:bytes.length,sha256:hash(bytes)});}
  await run(directory,manifest);
 }finally{await rm(directory,{recursive:true,force:true});}
}
const rejectsFile=(bytes,pattern)=>fixture({'model.glb':bytes},async(d,m)=>assert.rejects(buildEmbeddedAssetIndex(d,m),pattern));

test('BIN image provenance binds the exact source hash, logical view and absolute payload span',async()=>{
 const bytes=imageGLB();await fixture({'belle/model.glb':bytes,'assets/main.js':Buffer.from('export{}')},async(d,m)=>{
  const index=await buildEmbeddedAssetIndex(d,m);assert.equal(index.candidates.length,1);
  const row=index.candidates[0];assert.equal(row.sourceFile,'belle/model.glb');assert.equal(row.sourceBytes,bytes.length);assert.equal(row.sourceSha256,hash(bytes));
  assert.equal(row.imageIndex,0);assert.equal(row.mimeType,'image/png');assert.equal(row.bytes,PNG.length);assert.equal(row.sha256,hash(PNG));
  assert.equal(row.storage.bufferViewByteOffset,4);assert.equal(row.storage.sourceByteOffset,index.sources[0].binChunk.byteOffset+4);
  assert.deepEqual(bytes.subarray(row.storage.sourceByteOffset,row.storage.sourceByteEnd),PNG);
  assert.deepEqual(matchEmbeddedImage(index,PNG,' image/PNG '),[row]);
  assert.deepEqual(await verifyEmbeddedAssetIndex(d,m,JSON.parse(JSON.stringify(index))),index);
 });
});

test('duplicate images within and across GLBs preserve every possible binding',async()=>{
 const a=imageGLB(PNG,'image/png',{duplicates:2}),b=imageGLB(PNG,'image/png',{duplicates:2,offset:8});
 await fixture({'z.glb':b,'a.glb':a},async(d,m)=>{
  const index=await buildEmbeddedAssetIndex(d,m),matches=matchEmbeddedImage(index,PNG,'image/png');
  assert.equal(matches.length,4);assert.deepEqual(matches.map(x=>[x.sourceFile,x.imageIndex]),[['a.glb',0],['a.glb',1],['z.glb',0],['z.glb',1]]);
  assert.deepEqual(await buildEmbeddedAssetIndex(d,[...m].reverse()),index,'Manifest order does not change canonical receipts');
 });
});

test('changed payload, missing payload and wrong MIME never match a valid index',async()=>{
 await fixture({'model.glb':imageGLB()},async(d,m)=>{
  const index=await buildEmbeddedAssetIndex(d,m),changed=Buffer.from(PNG);changed[changed.length-1]^=1;
  assert.throws(()=>matchEmbeddedImage(index,changed,'image/png'),/not bound/);
  assert.throws(()=>matchEmbeddedImage(index,PNG.subarray(0,-1),'image/png'),/not bound/);
  assert.throws(()=>matchEmbeddedImage(index,PNG,'image/jpeg'),/signature/);
  assert.throws(()=>matchEmbeddedImage(index,PNG,''),/MIME/);
  assert.throws(()=>matchEmbeddedImage(index,PNG,'image/png; charset=utf-8'),/MIME/);
  assert.throws(()=>matchEmbeddedImage(index,PNG,'image/webp'),/Unsupported/);
  assert.throws(()=>matchEmbeddedImage({...index,version:2},PNG,'image/png'),/index/);
  const surrounded=Buffer.concat([Buffer.alloc(17),PNG,Buffer.alloc(5)]);
  assert.equal(matchEmbeddedImage(index,new Uint8Array(surrounded.buffer,surrounded.byteOffset+17,PNG.length),'image/png').length,1,'Typed-array slice boundaries are respected');
 });
});

test('image base64 data URIs retain exact UTF-8 JSON string offsets after non-ASCII text',async()=>{
 const uri='data:image/jpeg;base64,'+JPEG.toString('base64');
 const bytes=glb({asset:{version:'2.0'},extras:{name:'Île 🌿'},images:[{uri,mimeType:'image/jpeg'}]});
 await fixture({'data.glb':bytes},async(d,m)=>{
  const index=await buildEmbeddedAssetIndex(d,m),row=index.candidates[0];assert.equal(row.storage.kind,'image-data-uri');assert.equal(row.storage.encoding,'base64');
  assert.equal(JSON.parse(bytes.subarray(row.storage.jsonStringByteOffset,row.storage.jsonStringByteEnd).toString()),uri);
  assert.equal(row.storage.uriSha256,hash(Buffer.from(uri)));assert.equal(row.sha256,hash(JPEG));assert.equal(matchEmbeddedImage(index,JPEG,'image/jpeg').length,1);
 });
});

test('explicit percent-encoded image data URIs bind decoded octets without a fictitious payload file offset',async()=>{
 const uri='data:image/png,'+[...PNG].map(x=>'%'+x.toString(16).padStart(2,'0')).join('');
 await fixture({'percent.glb':glb({asset:{version:'2.0'},images:[{uri}]})},async(d,m)=>{
  const index=await buildEmbeddedAssetIndex(d,m),row=index.candidates[0];assert.equal(row.storage.encoding,'percent');assert.equal(row.storage.sourceByteOffset,undefined);
  assert.equal(row.storage.jsonPointer,'/images/0/uri');assert.equal(row.sha256,hash(PNG));assert.equal(matchEmbeddedImage(index,PNG,'image/png').length,1);
 });
});

test('a bufferView in an explicit base64 buffer keeps decoded view offsets and encoded source span',async()=>{
 const prefix=Buffer.alloc(9,71),buffer=Buffer.concat([prefix,PNG,Buffer.alloc(6)]),uri='data:application/gltf-buffer;base64,'+buffer.toString('base64');
 const bytes=glb({asset:{version:'2.0'},buffers:[{uri,byteLength:buffer.length}],bufferViews:[{buffer:0,byteOffset:9,byteLength:PNG.length}],images:[{bufferView:0,mimeType:'image/png'}]});
 await fixture({'data-buffer.glb':bytes},async(d,m)=>{
  const row=(await buildEmbeddedAssetIndex(d,m)).candidates[0];assert.equal(row.storage.kind,'data-uri-buffer-view');assert.equal(row.storage.bufferViewByteOffset,9);
  assert.equal(row.storage.dataURI.jsonPointer,'/buffers/0/uri');assert.equal(row.storage.dataURI.decodedSha256,hash(buffer));assert.equal(row.sha256,hash(PNG));
  assert.equal(JSON.parse(bytes.subarray(row.storage.dataURI.jsonStringByteOffset,row.storage.dataURI.jsonStringByteEnd).toString()),uri);
 });
});

test('known external images are verified separately and cannot authorize a blob',async()=>{
 const bytes=glb({asset:{version:'2.0'},images:[{uri:'../../shared/picture.png',mimeType:'image/png'}]});
 await fixture({'exports/hero/model.glb':bytes,'shared/picture.png':PNG},async(d,m)=>{
  const index=await buildEmbeddedAssetIndex(d,m);assert.equal(index.candidates.length,0);assert.equal(index.externalImages.length,1);
  assert.equal(index.externalImages[0].targetFile,'shared/picture.png');assert.equal(index.externalImages[0].blobBinding,false);
  assert.throws(()=>matchEmbeddedImage(index,PNG,'image/png'),/not bound/);
 });
});

test('source and serialized-index mutation are rejected independently',async()=>{
 const bytes=imageGLB();await fixture({'model.glb':bytes},async(d,m)=>{
  const index=await buildEmbeddedAssetIndex(d,m),altered=structuredClone(index);altered.candidates[0].storage.sourceByteOffset++;
  await assert.rejects(verifyEmbeddedAssetIndex(d,m,altered),/differs/);
  const wrong=structuredClone(m);wrong[0].sha256='0'.repeat(64);await assert.rejects(buildEmbeddedAssetIndex(d,wrong),/hash mismatch/);
  wrong[0].sha256=m[0].sha256;wrong[0].bytes++;await assert.rejects(buildEmbeddedAssetIndex(d,wrong),/length mismatch/);
  const changed=Buffer.from(bytes);changed[changed.length-1]^=1;await writeFile(join(d,'model.glb'),changed);await assert.rejects(verifyEmbeddedAssetIndex(d,m,index),/hash mismatch/);
 });
});

test('unsafe, duplicate and aliased build paths fail closed',async()=>{
 await fixture({'model.glb':imageGLB()},async(d,m)=>{
  for(const file of ['../model.glb','/model.glb','./model.glb','x/../model.glb','x\\model.glb','x//model.glb'])await assert.rejects(buildEmbeddedAssetIndex(d,[{...m[0],file}]),/path/);
  await assert.rejects(buildEmbeddedAssetIndex(d,[m[0],m[0]]),/Duplicate/);
  await symlink(join(d,'model.glb'),join(d,'alias.glb'));await assert.rejects(buildEmbeddedAssetIndex(d,[{...m[0],file:'alias.glb'}]),/symlinks/);
  await assert.rejects(buildEmbeddedAssetIndex(d,[{...m[0],file:'model.gltf'}]),/Standalone/);
 });
});

test('no-image meshopt fallback buffers do not become embedded sources',async()=>{
 const bytes=glb({asset:{version:'2.0'},extensionsRequired:['EXT_meshopt_compression'],buffers:[{byteLength:4},{byteLength:8192,extensions:{EXT_meshopt_compression:{fallback:true}}}]},Buffer.alloc(4));
 await fixture({'geometry.glb':bytes},async(d,m)=>{const index=await buildEmbeddedAssetIndex(d,m);assert.equal(index.sources.length,1);assert.deepEqual(index.candidates,[]);});
});

test('container/header/chunk corruption is rejected even when its outer manifest hash matches',async()=>{
 const original=imageGLB();
 for(const [label,mutate] of [
  ['magic',b=>b.writeUInt32LE(0,0)],['version',b=>b.writeUInt32LE(3,4)],['length',b=>b.writeUInt32LE(b.length-1,8)],
  ['alignment',b=>b.writeUInt32LE(b.readUInt32LE(12)-1,12)],['type',b=>b.writeUInt32LE(0,16)],['overrun',b=>b.writeUInt32LE(0xfffffffc,12)]
 ]){const b=Buffer.from(original);mutate(b);await rejectsFile(b,/GLB|chunk|Unaligned/);assert(label);}
 await rejectsFile(original.subarray(0,15),/Truncated/);
 await rejectsFile(glb({asset:{version:'2.1'}}),/asset version/);
 await rejectsFile(glb({asset:{version:'2.0',minVersion:'3.0'}}),/minimum/);
 await rejectsFile(glb(Buffer.from('{"asset":{"version":"2.0"},"images":[],"images":[]}')),/Duplicate/);
 const invalidUTF8=Buffer.from('{"asset":{"version":"2.0"},"name":"X"}');invalidUTF8[invalidUTF8.indexOf(88)]=255;
 await rejectsFile(glb(invalidUTF8),/encoded data|encoding/i);
});

test('BIN padding cannot supply bytes outside the declared logical buffer',async()=>{
 const bytes=imageGLB(PNG,'image/png',{offset:1});
 await fixture({'padded.glb':bytes},async(d,m)=>{assert.equal((await buildEmbeddedAssetIndex(d,m)).candidates[0].sha256,hash(PNG));});
 const bad=Buffer.from(bytes);bad[bad.length-1]=17;await rejectsFile(bad,/padding/);
 const bin=Buffer.concat([PNG,Buffer.alloc(3)]);
 await rejectsFile(glb({asset:{version:'2.0'},buffers:[{byteLength:PNG.length}],bufferViews:[{buffer:0,byteOffset:PNG.length-1,byteLength:3}],images:[{bufferView:0,mimeType:'image/png'}]},bin),/logical buffer|padding/);
 await rejectsFile(glb({asset:{version:'2.0'},buffers:[{byteLength:4}]}),/no BIN/);
});

test('invalid image declarations, ranges and semantic extensions fail closed',async()=>{
 const make=overrides=>glb({asset:{version:'2.0'},buffers:[{byteLength:PNG.length}],bufferViews:[{buffer:0,byteLength:PNG.length}],images:[{bufferView:0,mimeType:'image/png'}],...overrides},PNG);
 for(const [overrides,pattern] of [
  [{images:[{bufferView:0}]},/MIME/],
  [{images:[{bufferView:0,mimeType:'image/png',uri:'a.png'}]},/exactly one/],
  [{images:[{}]},/exactly one/],
  [{images:[{bufferView:0,mimeType:'image/jpeg'}]},/signature/],
  [{images:[{bufferView:0,mimeType:'image/webp'}]},/Unsupported/],
  [{images:[{bufferView:-1,mimeType:'image/png'}]},/index/],
  [{images:[{bufferView:99,mimeType:'image/png'}]},/Missing/],
  [{images:[{bufferView:0,mimeType:'image/png',extensions:{unknown:{}}}]},/extension/],
  [{bufferViews:[{buffer:0,byteOffset:-1,byteLength:PNG.length}]},/offset/],
  [{bufferViews:[{buffer:0,byteLength:Number.MAX_SAFE_INTEGER+1}]},/length/],
  [{bufferViews:[{buffer:0,byteLength:PNG.length+1}]},/logical/],
  [{bufferViews:[{buffer:0,byteLength:PNG.length,byteStride:4}]},/layout/],
  [{bufferViews:[{buffer:0,byteLength:PNG.length,extensions:{EXT_meshopt_compression:{}}}]},/extension/],
  [{bufferViews:[{buffer:1,byteLength:PNG.length}],buffers:[{byteLength:PNG.length},{byteLength:PNG.length}]},/first buffer/]
 ])await rejectsFile(make(overrides),pattern);
});

test('malformed or ambiguous data URI forms are rejected rather than leniently decoded',async()=>{
 const valid=PNG.toString('base64');
 for(const uri of ['data:image/png;base64,','data:image/png;base64,'+valid.slice(0,-1),'data:image/png;base64,AB==',
  'data:image/png;base64,'+valid+'\n','data:image/png;charset=utf-8;base64,'+valid,'data:image/gif;base64,'+valid,
  'data:image/png,%','data:image/png,%0G','data:image/png,é','data:image/png,<unsafe>']){
  await rejectsFile(glb({asset:{version:'2.0'},images:[{uri}]}),/data URI|base64|Image bytes/);
 }
 await rejectsFile(glb({asset:{version:'2.0'},images:[{uri:'data:image/png;base64,'+valid,mimeType:'image/jpeg'}]}),/MIME mismatch/);
 await rejectsFile(glb({asset:{version:'2.0'},buffers:[{uri:'data:text/plain;base64,'+valid,byteLength:PNG.length}],bufferViews:[{buffer:0,byteLength:PNG.length}],images:[{bufferView:0,mimeType:'image/png'}]}),/MIME/);
});

test('unknown or escaping external image and image-buffer resources cannot authorize blobs',async()=>{
 for(const uri of ['https://example.com/a.png','/a.png','../../outside.png','a.png?x=1','a%2f.png','a\\b.png','%zz.png','missing.png']){
  await rejectsFile(glb({asset:{version:'2.0'},images:[{uri,mimeType:'image/png'}]}),/URI|path|manifest|URI malformed/);
 }
 await rejectsFile(glb({asset:{version:'2.0'},buffers:[{uri:'external.bin',byteLength:PNG.length}],bufferViews:[{buffer:0,byteLength:PNG.length}],images:[{bufferView:0,mimeType:'image/png'}]}),/External image buffers/);
});

test('MIME normalization is explicit and has no generic image fallback',()=>{
 assert.equal(canonicalImageMime(' IMAGE/JPEG '),'image/jpeg');
 for(const value of [null,undefined,'','image/jpg','image/*','application/octet-stream','image/png;foo=bar'])assert.throws(()=>canonicalImageMime(value),/MIME/);
});

test('gzip containers bind compressed manifest bytes and exact decoded GLB image ranges separately',async()=>{
 for(const [payload,mime] of [[PNG,'image/png'],[JPEG,'image/jpeg']]){
  const bytes=imageGLB(payload,mime),packed=gzipSync(bytes,{level:9});
  await fixture({'belle/model.glb.gz':packed},async(d,m)=>{
   const index=await buildEmbeddedAssetIndex(d,m),source=index.sources[0],row=index.candidates[0];
   assert.equal(source.file,'belle/model.glb.gz');assert.equal(source.bytes,packed.length);assert.equal(source.sha256,hash(packed));
   assert.equal(source.compression.kind,'gzip-single-member');assert.equal(source.compression.trailerByteOffset+8,packed.length);
   assert.equal(source.compression.isize,bytes.length);assert.equal(source.compression.decodedByteLimit,MAX_GZIP_DECODED_BYTES);
   assert.equal(source.decodedGLB.bytes,bytes.length);assert.equal(source.decodedGLB.sha256,hash(bytes));
   assert.equal(source.jsonChunk,undefined);assert.equal(source.binChunk,undefined,'No decoded offsets are labeled compressed source chunks');
   assert.equal(row.sourceFile,source.file);assert.equal(row.sourceBytes,packed.length);assert.equal(row.sourceSha256,hash(packed));
   assert.equal(row.storage.kind,'gzip-decoded-glb-image');assert.equal(row.storage.offsetBasis,'decompressed-glb');
   assert.deepEqual(row.storage.decodedGLB,{bytes:bytes.length,sha256:hash(bytes)});
   const view=row.storage.decodedStorage;assert.equal(view.kind,'glb-bin-buffer-view');
   assert.deepEqual(bytes.subarray(view.sourceByteOffset,view.sourceByteEnd),payload);
   assert.equal(row.storage.sourceByteOffset,undefined,'No linear compressed-image byte offset is invented');
   assert.deepEqual(matchEmbeddedImage(index,payload,mime),[row]);
   assert.deepEqual(await verifyEmbeddedAssetIndex(d,m,index),index);
  });
 }
});

test('gzip and direct containers retain all duplicate matches without changing direct records',async()=>{
 const bytes=imageGLB(PNG,'image/png',{duplicates:2});
 await fixture({'a.glb':bytes,'b.glb.gz':gzipSync(bytes,{level:9}),'c.glb.gz':gzipSync(bytes,{level:1})},async(d,m)=>{
  const index=await buildEmbeddedAssetIndex(d,m),direct=await buildEmbeddedAssetIndex(d,m.filter(x=>x.file==='a.glb'));
  assert.deepEqual(index.sources.filter(x=>x.file==='a.glb'),direct.sources);
  assert.deepEqual(index.candidates.filter(x=>x.sourceFile==='a.glb'),direct.candidates);
  const matches=matchEmbeddedImage(index,PNG,'image/png');assert.equal(matches.length,6);
  assert.deepEqual(matches.map(x=>[x.sourceFile,x.imageIndex]),[['a.glb',0],['a.glb',1],['b.glb.gz',0],['b.glb.gz',1],['c.glb.gz',0],['c.glb.gz',1]]);
  assert.deepEqual(await buildEmbeddedAssetIndex(d,[...m].reverse()),index);
 });
});

test('gzip data URI provenance keeps URI spans in decoded GLB coordinates',async()=>{
 const uri='data:image/png;base64,'+PNG.toString('base64');
 const bytes=glb({asset:{version:'2.0'},extras:{label:'Île 🌿'},images:[{uri}]}),packed=gzipSync(bytes);
 await fixture({'model.glb.gz':packed},async(d,m)=>{
  const row=(await buildEmbeddedAssetIndex(d,m)).candidates[0],storage=row.storage.decodedStorage;
  assert.equal(storage.kind,'image-data-uri');assert.equal(row.storage.offsetBasis,'decompressed-glb');
  assert.equal(JSON.parse(bytes.subarray(storage.jsonStringByteOffset,storage.jsonStringByteEnd).toString()),uri);
  assert.equal(row.sha256,hash(PNG));assert.equal(storage.sourceByteOffset,undefined);
 });
});

test('gzip external-image references retain the original directory and cannot authorize a blob',async()=>{
 const bytes=glb({asset:{version:'2.0'},images:[{uri:'../texture.png',mimeType:'image/png'}]});
 await fixture({'models/scene/model.glb.gz':gzipSync(bytes),'models/texture.png':PNG},async(d,m)=>{
  const index=await buildEmbeddedAssetIndex(d,m);assert.equal(index.candidates.length,0);assert.equal(index.externalImages.length,1);
  const external=index.externalImages[0];assert.equal(external.targetFile,'models/texture.png');assert.equal(external.blobBinding,false);
  assert.deepEqual(external.decodedGLB,{bytes:bytes.length,sha256:hash(bytes)});assert.throws(()=>matchEmbeddedImage(index,PNG,'image/png'),/not bound/);
 });
});

test('gzip envelopes reject unsupported headers, truncation and corrupted DEFLATE despite matching manifests',async()=>{
 const original=gzipSync(imageGLB(),{level:9});
 for(const mutate of [b=>b[0]=0,b=>b[2]=0,b=>b[3]=4,b=>b[3]=8,b=>b[3]=32,b=>b[10]=255]){
  const bytes=Buffer.from(original);mutate(bytes);
  await fixture({'bad.glb.gz':bytes},async(d,m)=>assert.rejects(buildEmbeddedAssetIndex(d,m)));
 }
 for(const bytes of [original.subarray(0,17),original.subarray(0,-1),original.subarray(0,-8)])
  await fixture({'short.glb.gz':bytes},async(d,m)=>assert.rejects(buildEmbeddedAssetIndex(d,m)));
});

test('gzip CRC, ISIZE and maximum output bounds are independently enforced',async()=>{
 const original=gzipSync(imageGLB(),{level:9});
 const changes=[
  ['CRC',b=>b[b.length-8]^=1,/CRC32/],
  ['size smaller',b=>b.writeUInt32LE(b.readUInt32LE(b.length-4)-1,b.length-4),/larger than|ISIZE|buffer|Buffer/],
  ['size larger',b=>b.writeUInt32LE(b.readUInt32LE(b.length-4)+1,b.length-4),/ISIZE/],
  ['zero',b=>b.writeUInt32LE(0,b.length-4),/bound/],
  ['oversize',b=>b.writeUInt32LE(MAX_GZIP_DECODED_BYTES+1,b.length-4),/bound/]
 ];
 for(const [label,mutate,pattern] of changes){const bytes=Buffer.from(original);mutate(bytes);
  await fixture({'bad.glb.gz':bytes},async(d,m)=>assert.rejects(buildEmbeddedAssetIndex(d,m),pattern));assert(label);
 }
});

test('gzip rejects trailing bytes and additional members, including empty members',async()=>{
 const original=gzipSync(imageGLB()),empty=gzipSync(Buffer.alloc(0));
 const cases=[Buffer.concat([original,Buffer.alloc(1)]),Buffer.concat([original,Buffer.alloc(8)]),Buffer.concat([original,Buffer.from('junk')]),
  Buffer.concat([original,original]),Buffer.concat([empty,original]),Buffer.concat([original,empty])];
 for(const bytes of cases)await fixture({'trailing.glb.gz':bytes},async(d,m)=>assert.rejects(buildEmbeddedAssetIndex(d,m)));
});

test('decoded gzip content still requires valid GLB and supported exact image storage',async()=>{
 const nonGLB=gzipSync(Buffer.from('not a GLB'));
 await fixture({'bad.glb.gz':nonGLB},async(d,m)=>assert.rejects(buildEmbeddedAssetIndex(d,m),/GLB/));
 const badGLB=imageGLB();badGLB.writeUInt32LE(0,0);
 await fixture({'bad.glb.gz':gzipSync(badGLB)},async(d,m)=>assert.rejects(buildEmbeddedAssetIndex(d,m),/magic/));
 const badMime=imageGLB(PNG,'image/jpeg');
 await fixture({'bad.glb.gz':gzipSync(badMime)},async(d,m)=>assert.rejects(buildEmbeddedAssetIndex(d,m),/signature/));
 await fixture({'scene.gltf.gz':gzipSync(Buffer.from('{"asset":{"version":"2.0"}}'))},async(d,m)=>assert.rejects(buildEmbeddedAssetIndex(d,m),/Standalone/));
});

test('gzip source and decoded provenance mutations are rejected by independent rebuild',async()=>{
 const packed=gzipSync(imageGLB());await fixture({'model.glb.gz':packed},async(d,m)=>{
  const index=await buildEmbeddedAssetIndex(d,m);
  for(const mutate of [x=>x.sources[0].decodedGLB.sha256='0'.repeat(64),x=>x.sources[0].compression.crc32='00000000',
   x=>x.candidates[0].storage.decodedGLB.bytes++,x=>x.candidates[0].storage.decodedStorage.sourceByteOffset++]){
   const changed=structuredClone(index);mutate(changed);await assert.rejects(verifyEmbeddedAssetIndex(d,m,changed),/differs/);
  }
  const changed=Buffer.from(packed);changed[9]^=1;await writeFile(join(d,'model.glb.gz'),changed);
  await assert.rejects(verifyEmbeddedAssetIndex(d,m,index),/hash mismatch/);
 });
});

test('existing strict response verifier replays complete gzip image bindings without altered deadline semantics',async()=>{
 await fixture({'scene.glb.gz':gzipSync(imageGLB(PNG,'image/png',{duplicates:2}))},async(d,m)=>{
  const index=await buildEmbeddedAssetIndex(d,m),payloadHash=hash(PNG);
  const receipt={url:'blob:http://127.0.0.1:4321/fixture',status:200,mimeType:'image/png',kind:'embedded-blob',receivedBy:'browser-response-body',
   complete:true,observedHostMs:1000,bodyStartedHostMs:1001,bodyFinishedHostMs:1002,bindingFinishedHostMs:1003,deadlineExceeded:false,
   file:'assets/'+payloadHash+'.bin',bytes:PNG.length,sha256:payloadHash,embeddedMatches:matchEmbeddedImage(index,PNG,'image/png')};
  const options={sourceFiles:m,gameUrl:'http://127.0.0.1:4321/?profile=1&locationPerf=1',deadlineHostMs:61000,embeddedImageIndex:index,
   readCapturedFile:async file=>{assert.equal(file,receipt.file);return PNG;}};
  const result=await verifyAssetReceipts([receipt],options);assert.equal(result.verified,true);assert.equal(result.receipts[0].embeddedMatches.length,2);
  assert.deepEqual(result.receipts[0].embeddedMatches,receipt.embeddedMatches);
  await assert.rejects(verifyAssetReceipts([{...receipt,bindingFinishedHostMs:61001}],options),/deadline/);
  await assert.rejects(verifyAssetReceipts([{...receipt,embeddedMatches:receipt.embeddedMatches.slice(0,1)}],options),/omits/);
 });
});
