import test from 'node:test';
import assert from 'node:assert/strict';
import {createServer,request} from 'node:http';
import {mkdtemp,mkdir,writeFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {previewMediaMiddleware,previewMediaPlugin} from './preview-media-server.mjs';
async function fixture(t){
 const root=await mkdtemp(join(tmpdir(),'belle-preview-cache-'));
 await mkdir(join(root,'audio/swoop'),{recursive:true});
 const file=join(root,'audio/swoop/track-01.mp3'),bytes=Buffer.from(Array.from({length:4096},(_,i)=>i%251));await writeFile(file,bytes);
 let middleware;previewMediaPlugin().configurePreviewServer({config:{root,build:{outDir:'.'}},middlewares:{use(fn){middleware=fn;}}});
 assert.equal(typeof middleware,'function');
 const server=createServer((req,res)=>middleware(req,res,()=>res.writeHead(404).end()));await new Promise((yes,no)=>{server.once('error',no);server.listen(0,'127.0.0.1',yes);});
 t.after(async()=>{server.closeAllConnections();await new Promise(r=>server.close(r));await rm(root,{recursive:true,force:true});});
 const get=({headers={},method='GET',path='/audio/swoop/track-01.mp3'}={})=>new Promise((yes,no)=>{const req=request({host:'127.0.0.1',port:server.address().port,path,method,headers},res=>{const chunks=[];res.on('data',b=>chunks.push(b));res.on('error',no);res.on('end',()=>yes({status:res.statusCode,headers:res.headers,body:Buffer.concat(chunks)}));});req.on('error',no);req.end();});return{get,bytes,file};
}
test('actual preview plugin makes completed soundtrack bytes privately reusable for ten minutes',async t=>{
 const {get,bytes}=await fixture(t),r=await get({headers:{Range:'bytes=0-'}});
 assert.equal(r.status,206);assert.equal(r.headers['cache-control'],'private, max-age=600');assert.equal(r.headers['accept-ranges'],'bytes');assert.equal(r.headers['content-range'],`bytes 0-${bytes.length-1}/${bytes.length}`);assert.equal(r.headers.etag,undefined);assert.equal(r.headers['last-modified'],undefined);assert.deepEqual(r.body,bytes);
});
test('preview cache policy never substitutes an empty 304 for a conditional resumed range',async t=>{
 const {get,bytes}=await fixture(t),r=await get({headers:{Range:'bytes=512-1023','If-None-Match':'"obsolete"','If-Modified-Since':'Sat, 14 Nov 2026 03:24:55 GMT'}});
 assert.equal(r.status,206);assert.equal(r.headers['content-length'],'512');assert.equal(r.headers['content-range'],'bytes 512-1023/4096');assert.deepEqual(r.body,bytes.subarray(512,1024));
});
test('a browser-requested refresh reads current build bytes, not a process-level audio cache',async t=>{
 const {get,file,bytes}=await fixture(t);await get();const replacement=Buffer.from(bytes);replacement[0]^=255;await writeFile(file,replacement);
 const r=await get({headers:{'Cache-Control':'no-cache'}});assert.equal(r.status,200);assert.deepEqual(r.body,replacement);assert.equal(Number(r.headers['content-length']),replacement.length);
});
test('HEAD from installed preview middleware retains cache/range metadata without a body',async t=>{
 const {get,bytes}=await fixture(t),r=await get({method:'HEAD'});assert.equal(r.status,200);assert.equal(r.headers['cache-control'],'private, max-age=600');assert.equal(Number(r.headers['content-length']),bytes.length);assert.equal(r.body.length,0);
});
test('cache configuration is bounded and cannot inject response headers',()=>{
 for(const cacheSeconds of [-1,601,Infinity,NaN,1.5,'600\r\nX-Test: bad'])assert.throws(()=>previewMediaMiddleware('/tmp',{cacheSeconds}),/cacheSeconds/);
 for(const cacheSeconds of [0,1,600])assert.equal(typeof previewMediaMiddleware('/tmp',{cacheSeconds}),'function');
});
test('missing soundtrack remains a hard 404 under preview caching',async t=>{
 const {get}=await fixture(t);const r=await get({path:'/audio/swoop/track-99.mp3'});assert.equal(r.status,404);assert.equal(r.body.length,0);
});
