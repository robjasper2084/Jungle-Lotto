import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,mkdir,writeFile,rm,symlink} from 'node:fs/promises';
import {createServer,request} from 'node:http';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {previewMediaMiddleware,previewMediaPlugin} from './preview-media-server.mjs';

async function fixture(t){
 const root=await mkdtemp(join(tmpdir(),'belle-media-'));await mkdir(join(root,'audio/swoop'),{recursive:true});
 const bytes=Buffer.from(Array.from({length:1024},(_,i)=>i%256));await writeFile(join(root,'audio/swoop/track-01.mp3'),bytes);
 const server=createServer((req,res)=>previewMediaMiddleware(root)(req,res,()=>res.writeHead(418).end('next')));
 await new Promise((yes,no)=>{server.once('error',no);server.listen(0,'127.0.0.1',yes);});
 t.after(async()=>{server.closeAllConnections();await new Promise(r=>server.close(r));await rm(root,{recursive:true,force:true});});
 const get=({headers={},method='GET',path='/audio/swoop/track-01.mp3'}={})=>new Promise((yes,no)=>{
  const req=request({hostname:'127.0.0.1',port:server.address().port,path,method,headers},res=>{const chunks=[];res.on('data',b=>chunks.push(b));res.on('error',no);res.on('end',()=>yes({status:res.statusCode,headers:res.headers,body:Buffer.concat(chunks)}));});req.on('error',no);req.end();
 });return {root,bytes,get};
}

test('GET returns exact original audio bytes with revalidation and without a partial validator',async t=>{
 const {bytes,get}=await fixture(t),r=await get();assert.equal(r.status,200);assert.deepEqual(r.body,bytes);assert.equal(r.headers['content-length'],String(bytes.length));assert.equal(r.headers['content-type'],'audio/mpeg');assert.equal(r.headers['cache-control'],'no-cache, max-age=0, must-revalidate');assert.equal(r.headers.etag,undefined);assert.equal(r.headers['last-modified'],undefined);
});
for(const [range,start,end]of [['bytes=0-0',0,0],['bytes=0-',0,1023],['bytes=512-',512,1023],['bytes=12-42',12,42],['bytes=-9',1015,1023],['bytes=1000-99999',1000,1023]])test('correct native media byte range '+range,async t=>{const {get,bytes}=await fixture(t),r=await get({headers:{Range:range}});assert.equal(r.status,206);assert.deepEqual(r.body,bytes.subarray(start,end+1));assert.equal(r.headers['content-range'],`bytes ${start}-${end}/1024`);assert.equal(Number(r.headers['content-length']),end-start+1);});
test('the traced conditional resumed range receives its complete byte body, never a bare 304',async t=>{
 const {get,bytes}=await fixture(t),r=await get({headers:{Range:'bytes=512-1023','If-None-Match':'W/"1024-old"','If-Modified-Since':'Sat, 14 Nov 2026 03:24:55 GMT'}});assert.equal(r.status,206);assert.equal(r.headers['content-type'],'audio/mpeg');assert.equal(r.headers['content-range'],'bytes 512-1023/1024');assert.deepEqual(r.body,bytes.subarray(512));
});
for(const range of ['bytes=1024-','bytes=9-2','bytes=-0','bytes=999999999999999999999-'])test('unsatisfiable range stays a real 416: '+range,async t=>{const {get}=await fixture(t),r=await get({headers:{Range:range}});assert.equal(r.status,416);assert.equal(r.body.length,0);assert.equal(r.headers['content-range'],'bytes */1024');});
for(const range of ['items=0-1','bytes=0-1,4-5','bytes=bad'])test('unsupported range falls back to intact whole file: '+range,async t=>{const {get,bytes}=await fixture(t),r=await get({headers:{Range:range}});assert.equal(r.status,200);assert.deepEqual(r.body,bytes);});
test('If-Range without a matching published validator returns a full representation',async t=>{const {get,bytes}=await fixture(t),r=await get({headers:{Range:'bytes=0-9','If-Range':'"old"'}});assert.equal(r.status,200);assert.deepEqual(r.body,bytes);});
test('HEAD has full metadata and no body',async t=>{const {get}=await fixture(t),r=await get({method:'HEAD',headers:{Range:'bytes=0-9'}});assert.equal(r.status,200);assert.equal(r.headers['content-length'],'1024');assert.equal(r.body.length,0);});
test('missing media is not substituted or silently successful',async t=>{const {get}=await fixture(t);assert.equal((await get({path:'/audio/swoop/track-99.mp3'})).status,404);});
test('unrelated game files and encoded traversal never enter the media handler',async t=>{const {get}=await fixture(t);for(const path of ['/assets/main.js','/audio/swoop/%2e%2e/track-01.mp3','/audio/swoop/secret.mp3'])assert.equal((await get({path})).status,418);});
test('write methods are rejected without mutating files',async t=>{const {get,bytes}=await fixture(t);assert.equal((await get({method:'POST'})).status,405);assert.deepEqual((await get()).body,bytes);});
test('media symlinks cannot escape the served build',async t=>{const {get,root}=await fixture(t);const outside=await mkdtemp(join(tmpdir(),'belle-outside-'));t.after(()=>rm(outside,{recursive:true,force:true}));await writeFile(join(outside,'secret'),Buffer.from('secret'));await symlink(join(outside,'secret'),join(root,'audio/swoop/track-02.mp3'));assert.equal((await get({path:'/audio/swoop/track-02.mp3'})).status,403);});
test('plugin installs only a preview-server adapter, never runtime or build transforms',()=>{const plugin=previewMediaPlugin();assert.deepEqual(Object.keys(plugin).sort(),['configurePreviewServer','name']);let called=0;plugin.configurePreviewServer({config:{root:'/tmp/build',build:{outDir:'dist'}},middlewares:{use(fn){assert.equal(typeof fn,'function');called++;}}});assert.equal(called,1);});
