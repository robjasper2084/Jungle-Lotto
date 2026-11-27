/** Independent diagnostic decoding of the immutable original landmark display indices.
 * This module never loads or changes a game scene, mesh, renderer or callback. */
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {createRequire} from 'node:module';
import {readFile} from 'node:fs/promises';
import {dirname,resolve} from 'node:path';
import {pathToFileURL,fileURLToPath} from 'node:url';
import pins from './landmark-index-pins.json' with {type:'json'};

const gamePath='lottominded-ultra.io/games/gothtechnology2/belle-isle-source/game';
const sourcePath=gamePath+'/src/belle/landmarkDetail.ts';
const assetPaths=Object.freeze({metadata:'belle/landmark-detail.json',encodedIndices:'belle/landmark-detail.bin',model:'belle/landmarks.glb'});
const decoderSha256='d428e73a000057c6c94bfcedc3412d0c2dc14ca8800e88553aab05113ad2bf19';
const sha=bytes=>createHash('sha256').update(bytes).digest('hex');
const bytesOf=array=>new Uint8Array(array.buffer,array.byteOffset,array.byteLength);
const integer=(value,label,min=0)=>{assert(Number.isSafeInteger(value)&&value>=min,label+' must be a bounded nonnegative integer');return value;};
const arrayAt=(array,index,label)=>{assert(Array.isArray(array),label+' array missing');integer(index,label+' index');assert(index<array.length,label+' index outside array');return array[index];};
const section=(bytes,start,length,label)=>{integer(start,label+' offset');integer(length,label+' length');assert(start<=bytes.byteLength&&length<=bytes.byteLength-start,label+' outside immutable buffer');return bytes.subarray(start,start+length);};
const parseJSON=bytes=>JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(bytes));
const sourceHash=array=>{let hash=2166136261;for(const value of array)hash=Math.imul(hash^value,16777619);return hash>>>0;};

function parseGLB(bytes) {
  assert(bytes instanceof Uint8Array&&bytes.byteLength>=28,'Incomplete immutable GLB');
  const view=new DataView(bytes.buffer,bytes.byteOffset,bytes.byteLength);
  assert.equal(view.getUint32(0,true),0x46546c67,'Wrong GLB magic');
  assert.equal(view.getUint32(4,true),2,'Unsupported GLB version');
  assert.equal(view.getUint32(8,true),bytes.byteLength,'GLB length mismatch');
  const chunks=[];
  for(let offset=12;offset<bytes.byteLength;){
    assert(offset+8<=bytes.byteLength,'Truncated GLB chunk header');
    const length=view.getUint32(offset,true),type=view.getUint32(offset+4,true);offset+=8;
    assert(length%4===0,'Unaligned GLB chunk');
    chunks.push({type,bytes:section(bytes,offset,length,'GLB chunk')});offset+=length;
  }
  assert.equal(chunks.length,2,'Expected only original JSON and BIN chunks');
  assert.equal(chunks[0].type,0x4e4f534a,'Missing first GLB JSON chunk');
  assert.equal(chunks[1].type,0x004e4942,'Missing GLB binary chunk');
  const model=parseJSON(chunks[0].bytes),binary=chunks[1].bytes;
  assert.equal(model.asset?.version,'2.0','Unexpected GLTF asset version');
  const buffer=arrayAt(model.buffers,0,'GLB buffer');
  integer(buffer.byteLength,'GLB buffer length');
  assert(buffer.uri===undefined&&buffer.byteLength<=binary.byteLength&&binary.byteLength-buffer.byteLength<=3,'Invalid original embedded buffer');
  return {model,binary:binary.subarray(0,buffer.byteLength)};
}

function compressedView(model,binary,index,decoder) {
  const view=arrayAt(model.bufferViews,index,'Buffer view'),fallback=arrayAt(model.buffers,view.buffer,'Buffer');
  integer(view.byteLength,'Buffer view length');integer(view.byteOffset??0,'Buffer view offset');
  assert((view.byteOffset??0)+view.byteLength<=fallback.byteLength,'Buffer view exceeds its declared buffer');
  const ext=view.extensions?.EXT_meshopt_compression;
  assert(ext&&ext.buffer===0,'Expected immutable embedded meshopt index stream');
  assert(['INDICES','TRIANGLES'].includes(ext.mode),'Index accessor has non-index meshopt mode');
  assert(ext.filter===undefined||ext.filter==='NONE','Index accessor has an attribute filter');
  integer(ext.count,'Meshopt count',1);integer(ext.byteStride,'Meshopt stride',1);
  assert([2,4].includes(ext.byteStride),'Unsupported meshopt index stride');
  assert.equal(ext.count*ext.byteStride,view.byteLength,'Meshopt decoded byte count differs from buffer view');
  assert(view.byteStride===undefined||view.byteStride===ext.byteStride,'Unexpected interleaved index stride');
  const encoded=section(binary,ext.byteOffset??0,ext.byteLength,'Meshopt index stream');
  assert(encoded.byteLength>0,'Empty meshopt index stream');
  const decoded=new Uint8Array(view.byteLength);
  decoder.decodeGltfBuffer(decoded,ext.count,ext.byteStride,encoded,ext.mode,ext.filter);
  return {bytes:decoded,stride:ext.byteStride};
}

function readFullIndices(model,binary,primitive,decoder) {
  const accessor=arrayAt(model.accessors,primitive.indices,'Index accessor');
  assert(accessor.type==='SCALAR'&&accessor.normalized!==true&&!accessor.sparse,'Unsupported original index accessor');
  integer(accessor.count,'Original index count',1);
  const constructors={5123:Uint16Array,5125:Uint32Array},Constructor=constructors[accessor.componentType];
  assert(Constructor,'Unsupported original index component type');
  const {bytes,stride}=compressedView(model,binary,accessor.bufferView,decoder),width=Constructor.BYTES_PER_ELEMENT;
  assert.equal(stride,width,'Original index component/meshopt stride mismatch');
  const offset=accessor.byteOffset??0;integer(offset,'Original index accessor offset');
  assert(offset%width===0,'Unaligned original index accessor');
  const selected=section(bytes,offset,accessor.count*width,'Original index accessor');
  const view=new DataView(selected.buffer,selected.byteOffset,selected.byteLength),result=new Constructor(accessor.count);
  for(let index=0;index<result.length;index++)result[index]=width===2?view.getUint16(index*width,true):view.getUint32(index*width,true);
  return result;
}

/** Pure decoder used by verification and independent synthetic negative controls.
 * Returned typed arrays are source evidence only; they are never sent to Three. */
export async function decodeLandmarkIndexEntries({metadataBytes,encodedIndicesBytes,modelBytes},decoder) {
  assert(metadataBytes instanceof Uint8Array&&encodedIndicesBytes instanceof Uint8Array,'Missing immutable landmark bytes');
  assert(decoder&&typeof decoder.decodeGltfBuffer==='function'&&typeof decoder.decodeIndexSequence==='function','Missing original meshopt decoder');
  await decoder.ready;
  assert.equal(new Uint8Array(new Uint16Array([1]).buffer)[0],1,'Unsupported big-endian typed-array host');
  const metadata=parseJSON(metadataBytes),{model,binary}=parseGLB(modelBytes);
  assert.equal(metadata.version,1,'Unexpected landmark metadata version');
  assert.match(metadata.sourceSha256??'',/^[a-f0-9]{64}$/,'Missing historical source digest');
  assert(Array.isArray(metadata.entries)&&metadata.entries.length>0&&metadata.entries.length<=4096,'Invalid landmark entry inventory');
  const seen=new Set(),entries=[];
  for(const entry of metadata.entries){
    integer(entry.mesh,'Landmark mesh');integer(entry.primitive,'Landmark primitive');
    integer(entry.vertices,'Landmark vertices',1);integer(entry.originalCount,'Landmark original count',1);
    integer(entry.hash,'Landmark original index hash');assert(entry.hash<=0xffffffff,'Original index hash outside uint32');
    integer(entry.count,'Landmark reduced count',1);integer(entry.offset,'Landmark encoded offset');integer(entry.length,'Landmark encoded length',1);
    assert(entry.originalCount%3===0&&entry.count%3===0,'Landmark indices are not complete triangles');
    assert(entry.count<=entry.originalCount,'Reduced index allocation exceeds original index count');
    if(entry.error!==undefined)assert(Number.isFinite(entry.error)&&entry.error>=0,'Invalid exported simplification error');
    const key=entry.mesh+':'+entry.primitive;assert(!seen.has(key),'Ambiguous duplicate landmark mesh/primitive entry');seen.add(key);
    const mesh=arrayAt(model.meshes,entry.mesh,'Landmark mesh'),primitive=arrayAt(mesh.primitives,entry.primitive,'Landmark primitive');
    assert(primitive.mode===undefined||primitive.mode===4,'Landmark primitive is not TRIANGLES');
    const position=arrayAt(model.accessors,primitive.attributes?.POSITION,'Position accessor');
    assert(position.type==='VEC3'&&position.componentType===5126&&position.normalized!==true&&!position.sparse,'Unsupported landmark position accessor');
    assert.equal(position.count,entry.vertices,'Landmark metadata vertex count differs from original primitive');
    const sourceIndex=readFullIndices(model,binary,primitive,decoder);
    assert.equal(sourceIndex.length,entry.originalCount,'Landmark original index count mismatch');
    assert(sourceIndex.every(value=>value<entry.vertices),'Original landmark index is outside original vertices');
    assert.equal(sourceHash(sourceIndex),entry.hash,'Landmark original index FNV mismatch');
    const encoded=section(encodedIndicesBytes,entry.offset,entry.length,'Reduced landmark stream');
    const decodedIndex=new Uint32Array(entry.count);
    decoder.decodeIndexSequence(bytesOf(decodedIndex),entry.count,4,encoded);
    assert(decodedIndex.every(value=>value<entry.vertices),'Reduced landmark index is outside original vertices');
    entries.push({key,entry,sourceIndex,decodedIndex});
  }
  return {metadata,entries};
}

export async function buildLandmarkIndexManifest(inputs,decoder) {
  const {metadata,entries}=await decodeLandmarkIndexEntries(inputs,decoder);
  assert(inputs.sourceBytes instanceof Uint8Array,'Missing original landmark selection source');
  const index=array=>({type:array.constructor.name,bytes:array.byteLength,count:array.length,sha256:sha(bytesOf(array))});
  return {schema:1,source:{path:sourcePath,sha256:sha(inputs.sourceBytes)},assets:Object.fromEntries(Object.entries(assetPaths).map(([role,path])=>{
    const bytes=inputs[role==='metadata'?'metadataBytes':role==='encodedIndices'?'encodedIndicesBytes':'modelBytes'];
    return [role,{path,bytes:bytes.byteLength,sha256:sha(bytes)}];
  })),metadata:{version:metadata.version,sourceSha256:metadata.sourceSha256},entries:entries.map(row=>({key:row.key,entry:row.entry,sourceIndex:index(row.sourceIndex),decodedIndex:index(row.decodedIndex)}))};
}

/** Load the very decoder bytes present in both immutable application inputs. */
export async function loadPinnedLandmarkDecoder(gameRoot) {
  const require=createRequire(resolve(gameRoot,'package.json')),three=dirname(require.resolve('three'));
  assert.equal(JSON.parse(await readFile(resolve(three,'../package.json'),'utf8')).version,'0.185.1','Unexpected original Three version');
  const file=require.resolve('three/addons/libs/meshopt_decoder.module.js'),bytes=await readFile(file);
  assert.equal(sha(bytes),decoderSha256,'Original meshopt decoder bytes changed');
  const {MeshoptDecoder}=await import(pathToFileURL(file).href);await MeshoptDecoder.ready;
  assert(MeshoptDecoder.supported,'Original meshopt decoder is unavailable');return MeshoptDecoder;
}

/** Rebuild every hash from the original assets, then require the reviewed pins. */
export async function verifyLandmarkIndexManifest(assetRoot,gameRoot) {
  const [metadataBytes,encodedIndicesBytes,modelBytes,sourceBytes]=await Promise.all([
    ...Object.values(assetPaths).map(path=>readFile(resolve(assetRoot,path))),readFile(resolve(gameRoot,'src/belle/landmarkDetail.ts')),
  ]);
  const inputs={metadataBytes,encodedIndicesBytes,modelBytes,sourceBytes};
  for(const [role,bytes] of [['metadata',metadataBytes],['encodedIndices',encodedIndicesBytes],['model',modelBytes]]){
    assert.equal(bytes.byteLength,pins.assets[role].bytes,'Original '+role+' length changed');
    assert.equal(sha(bytes),pins.assets[role].sha256,'Original '+role+' bytes changed');
  }
  assert.equal(sha(sourceBytes),pins.source.sha256,'Original landmark selection source changed');
  const rebuilt=await buildLandmarkIndexManifest(inputs,await loadPinnedLandmarkDecoder(gameRoot));
  assert.deepEqual(rebuilt,pins,'Immutable landmark index manifest differs');return rebuilt;
}

if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)){
  const [assetRoot,gameRoot]=process.argv.slice(2);assert(assetRoot&&gameRoot,'Usage: landmark-index-manifest.mjs ASSET_ROOT GAME_ROOT');
  const manifest=await verifyLandmarkIndexManifest(assetRoot,gameRoot);
  console.log(JSON.stringify({verified:true,entries:manifest.entries.length,source:manifest.source,assets:manifest.assets,
    sourceIndexBytes:manifest.entries.reduce((sum,e)=>sum+e.sourceIndex.bytes,0),decodedIndexBytes:manifest.entries.reduce((sum,e)=>sum+e.decodedIndex.bytes,0)}));
}
