import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {mkdir,mkdtemp,rm,writeFile} from 'node:fs/promises';
import {request} from 'node:http';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import test from 'node:test';
import {createCoopStaticServer} from './coop-static-server.mjs';

const hash=bytes=>createHash('sha256').update(bytes).digest('hex');
const fresh='no-cache, max-age=0, must-revalidate';
async function fixture(t){
 const parent=await mkdtemp(join(tmpdir(),'belle-coop-static-')),root=join(parent,'dist');
 await mkdir(root);await writeFile(join(root,'index.html'),'<title>Co-op static server regression</title>');
 const server=createCoopStaticServer(root);
 await new Promise((ok,no)=>{server.once('error',no);server.listen(0,'127.0.0.1',ok);});
 t.after(async()=>{server.closeAllConnections();await new Promise(done=>server.close(done));await rm(parent,{recursive:true,force:true});});
 return {root,parent,port:server.address().port};
}
function get(port,path,options={}){
 return new Promise((ok,no)=>{
  const req=request({hostname:'127.0.0.1',port,path,method:options.method||'GET',headers:options.headers},res=>{
   const chunks=[];
   res.on('data',chunk=>{chunks.push(chunk);if(options.cancel)req.destroy(new Error('Deliberate client cancellation'));});
   res.on('aborted',()=>no(new Error('Response aborted')));res.on('error',no);
   res.on('end',()=>{
    if(!res.complete)return no(new Error('Incomplete HTTP response'));
    ok({status:res.statusCode,headers:res.headers,bytes:Buffer.concat(chunks),chunks:chunks.length,complete:res.complete});
   });
  });
  req.on('error',no);req.end();
 });
}

test('co-op static HTML keeps real bytes and mandatory per-request freshness',async t=>{
 const {port}=await fixture(t),response=await get(port,'/?profile=1');
 assert.equal(response.status,200);assert.equal(response.headers['content-type'],'text/html');
 assert.equal(response.headers['cache-control'],fresh);
 assert.equal(Number(response.headers['content-length']),response.bytes.length);
 assert.equal(response.bytes.toString(),'<title>Co-op static server regression</title>');
});

test('multi-chunk GLB stream reaches complete HTTP EOF without rewriting its bytes',async t=>{
 const {root,port}=await fixture(t),bytes=Buffer.alloc(1024*1024+37);
 for(let i=0;i<bytes.length;i++)bytes[i]=(i*17+29)%256;
 await writeFile(join(root,'model.glb'),bytes);
 const response=await get(port,'/model.glb');
 assert.equal(response.status,200);assert.equal(response.headers['content-type'],'model/gltf-binary');
 assert.equal(response.headers['cache-control'],fresh);assert.equal(response.complete,true);
 assert.ok(response.chunks>1,'Exercise a streamed response, not a single small write.');
 assert.equal(Number(response.headers['content-length']),bytes.length);
 assert.equal(response.bytes.length,bytes.length);assert.equal(hash(response.bytes),hash(bytes));
});

test('unchanged URL returns changed source bytes even with conditional request headers',async t=>{
 const {root,port}=await fixture(t),file=join(root,'model.glb');
 await writeFile(file,'version-a');const first=await get(port,'/model.glb');
 await writeFile(file,'version-b');
 const second=await get(port,'/model.glb',{headers:{'if-none-match':'"old-build"','if-modified-since':'Wed, 01 Jan 2100 00:00:00 GMT'}});
 assert.equal(first.status,200);assert.equal(second.status,200);
 assert.equal(second.headers['cache-control'],fresh);assert.equal(first.bytes.toString(),'version-a');
 assert.equal(second.bytes.toString(),'version-b');assert.notEqual(hash(first.bytes),hash(second.bytes));
});

test('HEAD preserves declared asset length without sending a body',async t=>{
 const {root,port}=await fixture(t);await writeFile(join(root,'model.glb'),'fixture-body');
 const response=await get(port,'/model.glb',{method:'HEAD'});
 assert.equal(response.status,200);assert.equal(response.headers['cache-control'],fresh);
 assert.equal(Number(response.headers['content-length']),12);assert.equal(response.bytes.length,0);
});

test('query-bearing cherry URL resolves the original file and retains fresh streaming policy',async t=>{
 const {root,port}=await fixture(t);await mkdir(join(root,'belle/nature'),{recursive:true});
 await writeFile(join(root,'belle/nature/cherry.glb'),'original-cherry-bytes');
 const response=await get(port,'/belle/nature/cherry.glb?v=blossom-20261110');
 assert.equal(response.status,200);assert.equal(response.headers['cache-control'],fresh);
 assert.equal(response.bytes.toString(),'original-cherry-bytes');
});

test('missing assets stay 404 instead of a successful HTML or empty replacement',async t=>{
 const {port}=await fixture(t);
 for(const path of ['/belle/waterfront-detail.glb','/belle/birds/pigeon.glb']){
  const response=await get(port,path);assert.equal(response.status,404);assert.equal(response.bytes.length,0);
 }
 assert.equal((await get(port,'/favicon.ico')).status,204);
});

test('malformed and encoded escaping paths cannot read outside the public build',async t=>{
 const {parent,port}=await fixture(t);await writeFile(join(parent,'outside.glb'),'must-not-be-served');
 for(const path of ['/%2e%2e%2foutside.glb','/%ZZ']){
  const response=await get(port,path);assert.equal(response.status,404);assert.equal(response.bytes.length,0);
 }
});

test('actual client cancellation remains a failure and cannot corrupt the next transfer',async t=>{
 const {root,port}=await fixture(t),bytes=Buffer.alloc(1024*1024,73);
 await writeFile(join(root,'model.glb'),bytes);
 await assert.rejects(get(port,'/model.glb',{cancel:true}),/cancellation|aborted/);
 const response=await get(port,'/model.glb');
 assert.equal(response.status,200);assert.equal(response.complete,true);assert.equal(hash(response.bytes),hash(bytes));
});
