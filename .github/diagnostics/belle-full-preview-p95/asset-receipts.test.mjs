import test,{before,after} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,mkdir,writeFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {resolve} from 'node:path';
import {createHash} from 'node:crypto';
import {buildEmbeddedAssetIndex,verifyEmbeddedAssetIndex,matchEmbeddedImage} from './embedded-assets.mjs';
import {verifyAssetReceipts} from './asset-receipts.mjs';

const sha=b=>createHash('sha256').update(b).digest('hex');
const png=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=','base64');
const js=Buffer.from('export const unchanged = true;\n');
const gameUrl='http://127.0.0.1:4242/?profile=1&locationPerf=1';
let root,sourceFiles,embeddedImageIndex;
const captures=new Map(),deadlineHostMs=120000;
function glb(payload){
 const json=Buffer.from(JSON.stringify({asset:{version:'2.0'},buffers:[{byteLength:payload.length}],
  bufferViews:[{buffer:0,byteOffset:0,byteLength:payload.length}],images:[{bufferView:0,mimeType:'image/png'},{bufferView:0,mimeType:'image/png'}]}));
 const paddedJSON=Buffer.alloc(Math.ceil(json.length/4)*4,32);json.copy(paddedJSON);
 const paddedBIN=Buffer.alloc(Math.ceil(payload.length/4)*4);payload.copy(paddedBIN);
 const out=Buffer.alloc(12+8+paddedJSON.length+8+paddedBIN.length);
 out.writeUInt32LE(0x46546c67,0);out.writeUInt32LE(2,4);out.writeUInt32LE(out.length,8);
 out.writeUInt32LE(paddedJSON.length,12);out.writeUInt32LE(0x4e4f534a,16);paddedJSON.copy(out,20);
 const at=20+paddedJSON.length;out.writeUInt32LE(paddedBIN.length,at);out.writeUInt32LE(0x004e4942,at+4);paddedBIN.copy(out,at+8);return out;
}
before(async()=>{
 root=await mkdtemp(resolve(tmpdir(),'belle-asset-receipts-'));await mkdir(resolve(root,'assets'));
 const files=[['model.glb',glb(png)],['assets/main.js',js],['index.html',Buffer.from('<script type="module" src="/assets/main.js"></script>')]];
 sourceFiles=[];for(const [file,bytes]of files){await writeFile(resolve(root,file),bytes);sourceFiles.push({file,bytes:bytes.length,sha256:sha(bytes)});}
 const original=await buildEmbeddedAssetIndex(root,sourceFiles);
 embeddedImageIndex=await verifyEmbeddedAssetIndex(root,sourceFiles,original);
 assert.equal(embeddedImageIndex.candidates.length,2);
});
after(async()=>{await rm(root,{recursive:true,force:true});});
function receipt(payload,url,kind,extra={}){
 const digest=sha(payload),file='assets/'+digest+'.bin';captures.set(file,Buffer.from(payload));
 return {url,kind,status:200,receivedBy:'browser-response-body',observedHostMs:1000,phase:'before-capture',
  bodyStartedHostMs:1001,bodyFinishedHostMs:1002,bindingFinishedHostMs:1003,deadlineExceeded:false,
  file,bytes:payload.length,sha256:digest,complete:true,...extra};
}
const http=()=>receipt(js,'http://127.0.0.1:4242/assets/main.js','http-file');
const blob=()=>receipt(png,'blob:http://127.0.0.1:4242/876b8888-5555-4444-3333-222222222222','embedded-blob',
 {mimeType:'image/png',embeddedMatches:structuredClone(matchEmbeddedImage(embeddedImageIndex,png,'image/png'))});
const options=()=>({sourceFiles,gameUrl,deadlineHostMs,embeddedImageIndex,readCapturedFile:async file=>{
 assert(captures.has(file),'Unexpected captured file request');return Buffer.from(captures.get(file));}});
async function rejectsUnchanged(value,pattern,overrides={}){
 const before=structuredClone(value);await assert.rejects(verifyAssetReceipts([value],{...options(),...overrides}),pattern);assert.deepEqual(value,before);
}
test('HTTP exact bytes and original empty favicon semantics replay without mutating receipts',async()=>{
 const r=http();r.url+='?cache=fixed';
 const favicon={url:'http://127.0.0.1:4242/favicon.ico',kind:'http-file',status:204,receivedBy:'browser-response-body',
  observedHostMs:500,complete:true,expectedEmptyResponse:true,file:null,bytes:0,sha256:sha(Buffer.alloc(0))};
 const input=[r,favicon],before=structuredClone(input),result=await verifyAssetReceipts(input,options());
 assert.equal(result.verified,true);assert.equal(result.receipts[0].sourceFile,'assets/main.js');assert.equal(result.receipts[1].expectedEmptyResponse,true);assert.deepEqual(input,before);
});
test('same-origin PNG blob retains every valid duplicate image binding and every response receipt',async()=>{
 const a=blob(),b=blob();b.observedHostMs=1000.5;b.bodyStartedHostMs=1001.5;
 const before=structuredClone([a,b]),result=await verifyAssetReceipts([a,b],options());
 assert.equal(result.receipts.length,2);for(const row of result.receipts)assert.deepEqual(row.embeddedMatches,embeddedImageIndex.candidates);
 assert.deepEqual([a,b],before);
});
test('exact origin includes port and rejects foreign, opaque, credentialed or unsupported URLs',async()=>{
 for(const url of ['blob:http://127.0.0.1:4243/id','blob:https://127.0.0.1:4242/id','blob:null/id','blob:http://user@127.0.0.1:4242/id','data:image/png;base64,AAAA']){
  const r=blob();r.url=url;await rejectsUnchanged(r,/origin|protocol|unbound|Malformed/);
 }
 for(const url of ['http://127.0.0.1:4243/assets/main.js','http://localhost:4242/assets/main.js','http://user@127.0.0.1:4242/assets/main.js']){
  const r=http();r.url=url;await rejectsUnchanged(r,/origin|credentials/);
 }
});
test('unknown bytes, wrong MIME and malformed image media types never become complete bindings',async()=>{
 for(const mimeType of ['image/jpeg','image/png; charset=binary','application/octet-stream','',undefined]){
  const r=blob();r.mimeType=mimeType;await rejectsUnchanged(r,/MIME|signature/);
 }
 const changed=Buffer.from(png);changed[changed.length-1]^=1;
 const r=receipt(changed,'blob:http://127.0.0.1:4242/id','embedded-blob',{mimeType:'image/png',embeddedMatches:[]});
 await rejectsUnchanged(r,/not bound/);
});
test('missing duplicate matches or altered source offsets remain failures',async()=>{
 const omitted=blob();omitted.embeddedMatches.pop();await rejectsUnchanged(omitted,/omits or changes/);
 const altered=blob();altered.embeddedMatches[0].storage.sourceByteOffset++;await rejectsUnchanged(altered,/omits or changes/);
 const wrong=blob();wrong.kind='http-file';await rejectsUnchanged(wrong,/kind/);
});
test('HTTP source path, status, payload storage and captured bytes are independently checked',async()=>{
 const absent=http();absent.url='http://127.0.0.1:4242/assets/missing.js';await rejectsUnchanged(absent,/not in exact/);
 const status=http();status.status=304;await rejectsUnchanged(status,/response failed/);
 const unsafe=http();unsafe.file='../source-receipt.json';await rejectsUnchanged(unsafe,/body path/);
 const r=http(),changed=Buffer.from(js);changed[0]^=1;await rejectsUnchanged(r,/body hash changed/,{readCapturedFile:async()=>changed});
 const falseEmpty=blob();falseEmpty.expectedEmptyResponse=true;await rejectsUnchanged(falseEmpty,/http-file/);
});
test('original incomplete/error flags cannot be erased by matching body bytes',async()=>{
 const incomplete=blob();incomplete.complete=false;await rejectsUnchanged(incomplete,/incomplete/);
 const failed=blob();failed.error='prior collection failure';await rejectsUnchanged(failed,/must not be erased/);
 const changedInventory=structuredClone(sourceFiles);changedInventory[0].sha256='0'.repeat(64);
 await rejectsUnchanged(blob(),/different source inventory/,{sourceFiles:changedInventory});
});
test('queued body work may finish after native stop but never after the original absolute deadline',async()=>{
 const good=blob();Object.assign(good,{observedHostMs:59999,bodyStartedHostMs:60001,bodyFinishedHostMs:119998,bindingFinishedHostMs:120000,bodyPhase:'after-native-keyup'});
 assert.equal((await verifyAssetReceipts([good],options())).verified,true);
 for(const change of [{observedHostMs:60001},{bodyStartedHostMs:999},{bodyFinishedHostMs:1000.5},{bindingFinishedHostMs:1001},{bindingFinishedHostMs:120001},{deadlineExceeded:true}]){
  const r=blob();Object.assign(r,change);await rejectsUnchanged(r,/stop|ordering|deadline/);
 }
});
test('missing normal-body binding timestamp fails; favicon remains the only no-body exception',async()=>{
 const r=blob();delete r.bindingFinishedHostMs;await rejectsUnchanged(r,/binding finish/);
 await assert.rejects(verifyAssetReceipts([],options()),/Missing original/);
});
