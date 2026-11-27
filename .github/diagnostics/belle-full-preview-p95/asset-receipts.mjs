/** Independent replay of every consumed HTTP/blob asset receipt.
 * The index argument must first be rebuilt from the verified, unchanged dist
 * with verifyEmbeddedAssetIndex. No network, browser or evidence writes occur.
 */
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {matchEmbeddedImage,canonicalImageMime} from './embedded-assets.mjs';

const sha=b=>createHash('sha256').update(b).digest('hex');
const hash=value=>typeof value==='string'&&/^[a-f0-9]{64}$/.test(value);
const finite=(value,label)=>{assert(Number.isFinite(value)&&value>=0,'Invalid '+label);return value;};
const cleanURL=url=>!url.username&&!url.password&&!url.hash;
function sourceManifest(sourceFiles){
 assert(Array.isArray(sourceFiles)&&sourceFiles.length,'Missing exact source inventory');
 const map=new Map();
 for(const row of sourceFiles){
  assert(typeof row.file==='string'&&row.file&&!row.file.includes('\\')&&!/[\0-\x1f\x7f]/.test(row.file)&&
   row.file.split('/').every(p=>p&&p!=='.'&&p!=='..'),'Unsafe source inventory path');
  assert(Number.isSafeInteger(row.bytes)&&row.bytes>=0&&hash(row.sha256),'Invalid source byte identity');
  assert(!map.has(row.file),'Duplicate source path');map.set(row.file,{file:row.file,bytes:row.bytes,sha256:row.sha256});
 }
 return map;
}
function assetURL(raw,game){
 assert(typeof raw==='string'&&raw,'Missing asset URL');const url=new URL(raw);
 assert(cleanURL(url),'Asset URL has credentials or fragment');
 if(url.protocol==='http:'){
  assert.equal(url.origin,game.origin,'HTTP asset origin differs from original game origin');return {url,kind:'http-file'};
 }
 assert.equal(url.protocol,'blob:','Unsupported asset protocol');
 assert.equal(url.origin,game.origin,'Blob origin differs from original game origin');
 const inner=new URL(url.pathname);
 assert(inner.protocol==='http:'&&inner.origin===game.origin&&cleanURL(inner)&&!inner.search&&!url.search,'Malformed or unbound blob URL');
 assert(inner.pathname.length>1,'Missing blob object identity');return {url,kind:'embedded-blob'};
}
export async function verifyAssetReceipts(receipts,{sourceFiles,gameUrl,deadlineHostMs,embeddedImageIndex,readCapturedFile}){
 assert(Array.isArray(receipts)&&receipts.length>0,'Missing original asset receipt list');assert.equal(typeof readCapturedFile,'function');
 const game=new URL(gameUrl);
 assert(game.protocol==='http:'&&game.hostname==='127.0.0.1'&&game.pathname==='/'&&cleanURL(game),'Invalid original game URL');
 assert.deepEqual([...game.searchParams].sort(),[['locationPerf','1'],['profile','1']],'Original full game URL changed');
 finite(deadlineHostMs,'absolute collection deadline');assert(deadlineHostMs>=60000,'Missing original absolute stop deadline');
 const stopHostMs=deadlineHostMs-60000,manifest=sourceManifest(sourceFiles);
 const rows=[...manifest.values()].sort((a,b)=>a.file<b.file?-1:a.file>b.file?1:0);
 assert(embeddedImageIndex?.version===1&&embeddedImageIndex.format==='belle-glb-embedded-images-v1','Missing independently rebuilt image index');
 assert.equal(embeddedImageIndex.manifestSha256,sha(Buffer.from(JSON.stringify(rows))),'Embedded index belongs to a different source inventory');
 const verified=[];
 for(const [index,r] of receipts.entries()){
  assert(r&&typeof r==='object','Malformed asset receipt');
  const {url,kind}=assetURL(r.url,game);assert.equal(r.kind,kind,'Asset kind does not match actual URL');
  assert.equal(r.receivedBy,'browser-response-body','Asset was not recorded as a browser response');
  assert.equal(r.complete,true,'Original asset receipt is incomplete');assert.equal(r.error,undefined,'Original receipt failure must not be erased');
  finite(r.observedHostMs,'response observation time');assert(r.observedHostMs<=stopHostMs,'Response was admitted after native collection stop');
  if(r.expectedEmptyResponse===true){
   assert.equal(kind,'http-file');assert.equal(url.pathname,'/favicon.ico');assert.equal(r.status,204);
   assert.equal(r.file,null);assert.equal(r.bytes,0);assert.equal(r.sha256,sha(Buffer.alloc(0)));assert.notEqual(r.deadlineExceeded,true);
   assert.equal(r.embeddedMatches,undefined,'Empty favicon must not claim embedded-image binding');
   verified.push({index,kind,expectedEmptyResponse:true,url:r.url});continue;
  }
  assert.equal(r.status,200,'Original asset response failed');
  assert(Number.isSafeInteger(r.bytes)&&r.bytes>=0&&hash(r.sha256),'Malformed captured byte identity');
  assert.equal(r.file,'assets/'+r.sha256+'.bin','Captured body path is not bound to its hash');
  finite(r.bodyStartedHostMs,'body start');finite(r.bodyFinishedHostMs,'body/hash/write finish');finite(r.bindingFinishedHostMs,'binding finish');
  assert(r.observedHostMs<=r.bodyStartedHostMs&&r.bodyStartedHostMs<=r.bodyFinishedHostMs&&r.bodyFinishedHostMs<=r.bindingFinishedHostMs,'Asset operation ordering changed');
  assert.equal(r.deadlineExceeded,false,'Asset crossed the original absolute collection deadline');
  assert(r.bindingFinishedHostMs<=deadlineHostMs,'Asset binding completed after the original absolute collection deadline');
  const payload=await readCapturedFile(r.file);assert(payload instanceof Uint8Array,'Captured body is not bytes');
  assert.equal(payload.byteLength,r.bytes,'Captured body length changed');assert.equal(sha(payload),r.sha256,'Captured body hash changed');
  if(kind==='http-file'){
   const decoded=decodeURIComponent(url.pathname),name=decoded==='/'?'index.html':decoded.slice(1),expected=manifest.get(name);
   assert(expected,'HTTP response path is not in exact built inventory');assert.equal(r.bytes,expected.bytes,'HTTP response length mismatch');assert.equal(r.sha256,expected.sha256,'HTTP response differs from exact built bytes');
   assert.equal(r.embeddedMatches,undefined,'HTTP file must not claim blob image provenance');
   verified.push({index,kind,url:r.url,file:r.file,sourceFile:name,bytes:r.bytes,sha256:r.sha256});continue;
  }
  const mimeType=canonicalImageMime(r.mimeType),matches=matchEmbeddedImage(embeddedImageIndex,payload,r.mimeType);
  assert.deepEqual(r.embeddedMatches,matches,'Stored blob provenance omits or changes exact matching images');
  for(const candidate of matches){
   const expected=manifest.get(candidate.sourceFile);assert(expected,'Blob image source is absent from exact inventory');
   assert.equal(candidate.sourceBytes,expected.bytes);assert.equal(candidate.sourceSha256,expected.sha256);
   assert.equal(candidate.bytes,r.bytes);assert.equal(candidate.sha256,r.sha256);assert.equal(candidate.mimeType,mimeType);
  }
  verified.push({index,kind,url:r.url,file:r.file,bytes:r.bytes,sha256:r.sha256,mimeType,embeddedMatches:structuredClone(matches),
   provenanceScope:'Payload matches every listed exact-built embedded image; duplicate matches do not identify which instance created the Blob URL.'});
 }
 return {verified:true,origin:game.origin,deadlineHostMs,stopHostMs,embeddedIndexSha256:sha(Buffer.from(JSON.stringify(embeddedImageIndex))),receipts:verified};
}
