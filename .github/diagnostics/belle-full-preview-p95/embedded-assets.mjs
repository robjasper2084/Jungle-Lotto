/** Strict, offline provenance for image bytes embedded in exact built GLB2 files.
 * This is an image-source index, not a general glTF/codec validator. It performs
 * no network requests and never changes the build or browser/application state.
 */
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {readFile,realpath,lstat} from 'node:fs/promises';
import {resolve,relative,isAbsolute,sep,posix} from 'node:path';

const FORMAT='belle-glb-embedded-images-v1';
const IMAGE_MIMES=new Set(['image/png','image/jpeg']);
const BUFFER_MIMES=new Set(['application/octet-stream','application/gltf-buffer']);
const has=(value,key)=>Object.prototype.hasOwnProperty.call(value,key);
const sha=bytes=>createHash('sha256').update(bytes).digest('hex');
const object=value=>value!==null&&typeof value==='object'&&!Array.isArray(value);
const uint=(value,label,min=0)=>{assert(Number.isSafeInteger(value)&&value>=min,'Invalid '+label);return value;};
const bytesOf=value=>{
 assert(value instanceof Uint8Array,'Expected byte buffer');
 return Buffer.from(value.buffer,value.byteOffset,value.byteLength);
};
const plainMime=value=>{
 assert(typeof value==='string'&&value.length>0,'Missing MIME type');
 const mime=value.trim().toLowerCase();
 assert(/^[a-z0-9][a-z0-9!#$&^_.+-]*\/[a-z0-9][a-z0-9!#$&^_.+-]*$/.test(mime),'Unsupported MIME parameters or syntax');
 return mime;
};
export function canonicalImageMime(value){
 const mime=plainMime(value);assert(IMAGE_MIMES.has(mime),'Unsupported embedded image MIME: '+mime);return mime;
}
function identifyImage(bytes){
 if(bytes.length>=8&&bytes.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10])))return 'image/png';
 if(bytes.length>=3&&bytes[0]===255&&bytes[1]===216&&bytes[2]===255)return 'image/jpeg';
 throw Error('Image bytes lack a supported PNG/JPEG signature');
}
function validateImage(bytes,mime){assert.equal(identifyImage(bytes),mime,'Image signature does not match MIME');}

function pathName(file){
 assert(typeof file==='string'&&file.length>0&&!file.includes('\\')&&!/[\0-\x1f\x7f]/.test(file),'Invalid manifest path');
 assert(!isAbsolute(file)&&file.split('/').every(part=>part&&part!=='.'&&part!=='..'),'Unsafe manifest path');
 return file;
}
function manifestRows(files){
 assert(Array.isArray(files)&&files.length>0,'Missing verified build inventory');
 const names=new Set();
 const rows=files.map(row=>{
  assert(object(row));const file=pathName(row.file);assert(!names.has(file),'Duplicate manifest path');names.add(file);
  uint(row.bytes,'manifest byte length');assert(typeof row.sha256==='string'&&/^[a-f0-9]{64}$/.test(row.sha256),'Invalid manifest SHA256');
  return {file,bytes:row.bytes,sha256:row.sha256};
 });
 return rows.sort((a,b)=>a.file<b.file?-1:a.file>b.file?1:0);
}
async function readVerified(root,row){
 let current=root;
 for(const part of row.file.split('/')){
  current=resolve(current,part);const stat=await lstat(current);assert(!stat.isSymbolicLink(),'Build symlinks are unsupported');
 }
 const path=await realpath(current),rel=relative(root,path);
 assert(rel&&!isAbsolute(rel)&&rel!=='..'&&!rel.startsWith('..'+sep),'Build path escapes root');
 const stat=await lstat(path);assert(stat.isFile(),'Build entry is not a regular file');
 const bytes=await readFile(path);assert.equal(bytes.length,row.bytes,'Built file byte length mismatch: '+row.file);
 assert.equal(sha(bytes),row.sha256,'Built file hash mismatch: '+row.file);return bytes;
}

/** Locate exact JSON string spans and reject duplicate keys. Positions are
 * UTF-16 while scanning, then converted to source UTF-8 byte offsets in receipts.
 * JSON.parse first validates token/escape/number grammar; this pass adds spans.
 */
function jsonStringSpans(text){
 let at=0;const spans=new Map(),space=()=>{while(/\s/.test(text[at]??'')&&at<text.length)at++;};
 const pointer=key=>key.replace(/~/g,'~0').replace(/\//g,'~1');
 const string=()=>{const start=at++;while(at<text.length){const c=text[at++];if(c==='\\')at++;else if(c==='"')return {start,end:at,value:JSON.parse(text.slice(start,at))};}throw Error('Unterminated JSON string');};
 const value=(path,depth)=>{
  assert(depth<=128,'GLB JSON nesting exceeds supported bound');space();const first=text[at];
  if(first==='"'){const row=string();spans.set(path,row);return;}
  if(first==='{'){
   at++;space();const keys=new Set();if(text[at]==='}'){at++;return;}
   while(true){space();assert.equal(text[at],'"');const key=string().value;assert(!keys.has(key),'Duplicate GLB JSON key');keys.add(key);
    space();assert.equal(text[at++],':');value(path+'/'+pointer(key),depth+1);space();const next=text[at++];if(next==='}')return;assert.equal(next,',');}
  }
  if(first==='['){at++;space();if(text[at]===']'){at++;return;}let i=0;while(true){value(path+'/'+i++,depth+1);space();const next=text[at++];if(next===']')return;assert.equal(next,',');}}
  const start=at;while(at<text.length&&!/[\s,\]}]/.test(text[at]))at++;assert(at>start,'Invalid JSON value');
 };
 value('',0);space();assert.equal(at,text.length,'Trailing GLB JSON text');return spans;
}
function parseGLB(bytes){
 assert(bytes.length>=20,'Truncated GLB header');assert.equal(bytes.readUInt32LE(0),0x46546c67,'Invalid GLB magic');
 assert.equal(bytes.readUInt32LE(4),2,'Unsupported GLB container version');assert.equal(bytes.readUInt32LE(8),bytes.length,'GLB declared length mismatch');
 const chunks=[];let offset=12;
 while(offset<bytes.length){
  assert(offset+8<=bytes.length,'Truncated GLB chunk header');const length=bytes.readUInt32LE(offset),type=bytes.readUInt32LE(offset+4);
  assert.equal(length%4,0,'Unaligned GLB chunk');assert(length<=bytes.length-offset-8,'GLB chunk exceeds file');
  assert(type===0x4e4f534a||type===0x004e4942,'Unsupported GLB chunk type');
  chunks.push({type,headerByteOffset:offset,byteOffset:offset+8,byteLength:length});offset+=8+length;
 }
 assert(chunks.length>=1&&chunks.length<=2,'Unsupported GLB chunk sequence');assert.equal(chunks[0].type,0x4e4f534a,'First GLB chunk must be JSON');
 if(chunks.length===2)assert.equal(chunks[1].type,0x004e4942,'Second GLB chunk must be BIN');
 const jsonChunk=chunks[0],binChunk=chunks[1]??null;
 const text=new TextDecoder('utf-8',{fatal:true,ignoreBOM:true}).decode(bytes.subarray(jsonChunk.byteOffset,jsonChunk.byteOffset+jsonChunk.byteLength));
 assert(!text.startsWith('\ufeff'),'GLB JSON BOM is unsupported');const json=JSON.parse(text);assert(object(json)&&object(json.asset));
 assert.equal(json.asset.version,'2.0','Unsupported glTF asset version');if(has(json.asset,'minVersion'))assert.equal(json.asset.minVersion,'2.0','Unsupported minimum glTF version');
 for(const name of ['images','buffers','bufferViews'])if(has(json,name))assert(Array.isArray(json[name]),'Invalid glTF '+name+' array');
 const spans=jsonStringSpans(text);
 const buffers=json.buffers??[];
 if(binChunk){
  assert(object(buffers[0])&&!has(buffers[0],'uri'),'GLB BIN lacks its first declared buffer');const length=uint(buffers[0].byteLength,'BIN logical byte length',1);
  assert(binChunk.byteLength>=length&&binChunk.byteLength-length<=3,'GLB BIN padding/length mismatch');
  assert(bytes.subarray(binChunk.byteOffset+length,binChunk.byteOffset+binChunk.byteLength).every(b=>b===0),'Nonzero GLB BIN padding');
 }else if(buffers[0]&&!has(buffers[0],'uri'))throw Error('Declared GLB buffer has no BIN chunk');
 return {json,text,spans,jsonChunk,binChunk};
}
function decodeDataURI(uri,allowed,{buffer=false}={}){
 assert(typeof uri==='string'&&uri.startsWith('data:'),'Unsupported image/buffer URI');
 const comma=uri.indexOf(',');assert(comma>5,'Malformed data URI');const parts=uri.slice(5,comma).split(';');
 assert(parts.length===1||(parts.length===2&&parts[1]==='base64'),'Unsupported data URI parameters/encoding');
 const mimeType=plainMime(parts[0]);assert(allowed.has(mimeType),'Unsupported data URI MIME');
 const data=uri.slice(comma+1);let bytes,encoding;
 if(parts.length===2){
  assert(data.length>0&&data.length%4===0&&/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(data),'Malformed/noncanonical base64 data URI');
  bytes=Buffer.from(data,'base64');assert.equal(bytes.toString('base64'),data,'Noncanonical base64 pad bits');encoding='base64';
 }else{
  assert(!buffer,'glTF buffer data URIs require base64');const octets=[];
  for(let i=0;i<data.length;i++){
   if(data[i]==='%'){assert(/^[a-fA-F0-9]{2}$/.test(data.slice(i+1,i+3)),'Malformed data URI percent escape');octets.push(parseInt(data.slice(i+1,i+3),16));i+=2;}
   else{assert(/^[A-Za-z0-9._~-]$/.test(data[i]),'Unsupported unescaped data URI byte');octets.push(data.charCodeAt(i));}
  }
  bytes=Buffer.from(octets);assert(bytes.length>0,'Empty data URI');encoding='percent';
 }
 return {bytes,mimeType,encoding,uriSha256:sha(Buffer.from(uri,'utf8')),uriCodeUnits:uri.length};
}
function uriReceipt(parsed,pointer,decoded){
 const span=parsed.spans.get(pointer);assert(span,'Missing data URI JSON span');
 return {jsonPointer:pointer,encoding:decoded.encoding,uriSha256:decoded.uriSha256,uriCodeUnits:decoded.uriCodeUnits,
  jsonStringByteOffset:parsed.jsonChunk.byteOffset+Buffer.byteLength(parsed.text.slice(0,span.start),'utf8'),
  jsonStringByteEnd:parsed.jsonChunk.byteOffset+Buffer.byteLength(parsed.text.slice(0,span.end),'utf8'),
  decodedBytes:decoded.bytes.length,decodedSha256:sha(decoded.bytes)};
}
function externalTarget(sourceFile,uri){
 assert(typeof uri==='string'&&uri.length>0&&!uri.includes('\\')&&!/[\0-\x20\x7f?#]/.test(uri),'Unsupported external image URI');
 assert(!uri.startsWith('/')&&!/^[^/]*:/.test(uri),'Nonrelative external image URI');
 assert(!/%(?:2f|5c)/i.test(uri),'Encoded path separator is unsupported');
 const decoded=decodeURIComponent(uri);assert(!decoded.includes('\\')&&!/[\0-\x1f\x7f]/.test(decoded),'Invalid decoded image URI');
 const target=posix.normalize(posix.join(posix.dirname(sourceFile),decoded));pathName(target);return target;
}

/** Build from the exact verified inventory. Every read is checked again against
 * its byte length/hash. Standalone .gltf is deliberately unsupported. External
 * image references are verified and recorded separately; they never authorize
 * a blob response. Unknown image storage/extensions/MIME fail closed.
 */
export async function buildEmbeddedAssetIndex(distDir,verifiedFiles){
 const rows=manifestRows(verifiedFiles),byName=new Map(rows.map(row=>[row.file,row]));
 assert(!rows.some(row=>/\.gltf$/i.test(row.file)),'Standalone .gltf image indexing is unsupported');
 const root=await realpath(distDir);assert((await lstat(root)).isDirectory(),'Build root is not a directory');
 const sources=[],candidates=[],externalImages=[];
 for(const source of rows.filter(row=>/\.glb$/i.test(row.file))){
  const bytes=await readVerified(root,source),parsed=parseGLB(bytes),{json,binChunk,jsonChunk}=parsed;
  sources.push({...source,jsonChunk,binChunk});
  const images=json.images??[],buffers=json.buffers??[],views=json.bufferViews??[];
  for(const [imageIndex,image] of images.entries()){
   assert(object(image),'Invalid glTF image');assert.equal(has(image,'uri')!==has(image,'bufferView'),true,'Image must have exactly one URI or bufferView');
   if(has(image,'extensions'))assert(object(image.extensions)&&Object.keys(image.extensions).length===0,'Unsupported image extension');
   const common={sourceFile:source.file,sourceBytes:source.bytes,sourceSha256:source.sha256,imageIndex};
   let payload,mimeType,storage;
   if(has(image,'bufferView')){
    mimeType=canonicalImageMime(image.mimeType);const bufferViewIndex=uint(image.bufferView,'image bufferView index'),view=views[bufferViewIndex];assert(object(view),'Missing image bufferView');
    if(has(view,'extensions'))assert(object(view.extensions)&&Object.keys(view.extensions).length===0,'Unsupported image bufferView extension');
    assert(!has(view,'byteStride')&&!has(view,'target'),'Image bufferView has vertex/index layout');
    const bufferIndex=uint(view.buffer,'image buffer index'),buffer=buffers[bufferIndex];assert(object(buffer),'Missing image buffer');
    if(has(buffer,'extensions'))assert(object(buffer.extensions)&&Object.keys(buffer.extensions).length===0,'Unsupported image buffer extension');
    const bufferByteLength=uint(buffer.byteLength,'image buffer length',1),bufferViewByteOffset=has(view,'byteOffset')?uint(view.byteOffset,'image bufferView offset'):0;
    const length=uint(view.byteLength,'image bufferView length',1);assert(bufferViewByteOffset<=bufferByteLength&&length<=bufferByteLength-bufferViewByteOffset,'Image bufferView exceeds logical buffer');
    const base={bufferIndex,bufferViewIndex,bufferByteLength,bufferViewByteOffset,byteLength:length,jsonPointer:'/images/'+imageIndex};
    if(!has(buffer,'uri')){
     assert.equal(bufferIndex,0,'Only the first buffer may refer to GLB BIN');assert(binChunk,'Missing GLB BIN for image');
     const sourceByteOffset=binChunk.byteOffset+bufferViewByteOffset,sourceByteEnd=sourceByteOffset+length;
     payload=bytes.subarray(sourceByteOffset,sourceByteEnd);storage={kind:'glb-bin-buffer-view',...base,sourceByteOffset,sourceByteEnd,binChunkByteOffset:binChunk.byteOffset,binChunkByteLength:binChunk.byteLength};
    }else{
     assert(typeof buffer.uri==='string'&&buffer.uri.startsWith('data:'),'External image buffers are unsupported');
     const decoded=decodeDataURI(buffer.uri,BUFFER_MIMES,{buffer:true});assert(decoded.bytes.length>=bufferByteLength,'Data URI buffer shorter than declared');
     payload=decoded.bytes.subarray(bufferViewByteOffset,bufferViewByteOffset+length);
     storage={kind:'data-uri-buffer-view',...base,dataURI:uriReceipt(parsed,'/buffers/'+bufferIndex+'/uri',decoded)};
    }
   }else if(typeof image.uri==='string'&&image.uri.startsWith('data:')){
    const decoded=decodeDataURI(image.uri,IMAGE_MIMES);mimeType=decoded.mimeType;
    if(has(image,'mimeType'))assert.equal(canonicalImageMime(image.mimeType),mimeType,'Image/data URI MIME mismatch');
    payload=decoded.bytes;storage={kind:'image-data-uri',...uriReceipt(parsed,'/images/'+imageIndex+'/uri',decoded)};
   }else{
    const targetFile=externalTarget(source.file,image.uri),target=byName.get(targetFile);assert(target,'External image absent from exact build manifest');
    const external=await readVerified(root,target);mimeType=has(image,'mimeType')?canonicalImageMime(image.mimeType):identifyImage(external);validateImage(external,mimeType);
    externalImages.push({...common,uri:image.uri,targetFile,bytes:target.bytes,sha256:target.sha256,mimeType,blobBinding:false});continue;
   }
   validateImage(payload,mimeType);candidates.push({...common,mimeType,bytes:payload.length,sha256:sha(payload),storage});
  }
 }
 return {version:1,format:FORMAT,manifestSha256:sha(Buffer.from(JSON.stringify(rows),'utf8')),sources,candidates,externalImages};
}

/** Accept only an index produced or independently rebuilt from exact bytes.
 * Matching never chooses one of several equivalent source images arbitrarily.
 */
export function matchEmbeddedImage(index,payload,mimeType){
 assert(object(index)&&index.version===1&&index.format===FORMAT&&Array.isArray(index.candidates),'Unsupported embedded image index');
 const bytes=bytesOf(payload),mime=canonicalImageMime(mimeType);validateImage(bytes,mime);const digest=sha(bytes);
 const matches=index.candidates.filter(row=>row.bytes===bytes.length&&row.sha256===digest&&row.mimeType===mime);
 assert(matches.length>0,'Blob image is not bound to an embedded image in the exact build');return matches;
}
export async function verifyEmbeddedAssetIndex(distDir,verifiedFiles,expectedIndex){
 const rebuilt=await buildEmbeddedAssetIndex(distDir,verifiedFiles);assert.deepEqual(expectedIndex,rebuilt,'Embedded image index differs from exact rebuilt sources');return rebuilt;
}
