/** Read-only HTTP comparison of the installed preview server and scoped adapter. */
import assert from 'node:assert/strict';
import {request} from 'node:http';
import {createHash} from 'node:crypto';
import {readFile,writeFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {createRequire} from 'node:module';
import {pathToFileURL} from 'node:url';
const root=resolve(process.env.GITHUB_WORKSPACE,'work'),game=resolve(root,'lottominded-ultra.io/games/gothtechnology2/belle-isle-source/game');
const require=createRequire(resolve(game,'package.json')),vite=await import(pathToFileURL(require.resolve('vite')).href),preview=vite.preview??vite.default.preview;
const file=resolve(game,'dist/audio/swoop/track-01.mp3'),bytes=await readFile(file),hash=b=>createHash('sha256').update(b).digest('hex');
const report={scope:'Actual locked Vite preview HTTP responses serving the same built soundtrack. Not a browser or hardware test.',source:JSON.parse(await readFile(resolve(root,'integration-evidence/source.json'),'utf8')).candidateTree,track:{bytes:bytes.length,sha256:hash(bytes)},cases:{},passed:false};
async function run(name,plugins){
 const server=await preview({root:game,configFile:false,logLevel:'error',plugins,build:{outDir:'dist'},preview:{host:'127.0.0.1',port:0,strictPort:false}});
 try{
  const get=headers=>new Promise((yes,no)=>{const r=request({hostname:'127.0.0.1',port:server.httpServer.address().port,path:'/audio/swoop/track-01.mp3',headers},response=>{const chunks=[];response.on('data',b=>chunks.push(b));response.on('error',no);response.on('end',()=>yes({status:response.statusCode,headers:response.headers,body:Buffer.concat(chunks)}));});r.on('error',no);r.end();});
  const first=await get({Range:'bytes=0-'}),h={Range:`bytes=524288-${bytes.length-1}`,'If-None-Match':first.headers.etag??'W/"old"','If-Modified-Since':first.headers['last-modified']??'Sat, 14 Nov 2026 03:24:55 GMT'},resumed=await get(h);
  const describe=r=>({status:r.status,headers:r.headers,bytes:r.body.length,sha256:hash(r.body)});
  report.cases[name]={initial:describe(first),requestHeaders:h,resumed:describe(resumed)};
  assert.equal(first.status,206);assert.equal(hash(first.body),hash(bytes));
  if(name==='stock'){assert.equal(resumed.status,304,'The trace-specific conditional response must be reproduced before treating this as the fixture cause');assert.equal(resumed.body.length,0);}
  else{assert.equal(resumed.status,206);assert.equal(resumed.headers['content-range'],`bytes 524288-${bytes.length-1}/${bytes.length}`);assert.equal(hash(resumed.body),hash(bytes.subarray(524288)));assert.equal(Number(resumed.headers['content-length']),bytes.length-524288);}
 }finally{server.httpServer.closeAllConnections();await new Promise((yes,no)=>server.httpServer.close(e=>e?no(e):yes()));}
}
try{await run('stock',[]);const {previewMediaPlugin}=await import(pathToFileURL(resolve(game,'scripts/preview-media-server.mjs')).href);await run('corrected',[previewMediaPlugin()]);assert.equal(hash(await readFile(file)),hash(bytes));report.passed=true;}catch(e){report.failure=e.stack??String(e);process.exitCode=1;}finally{await writeFile(resolve(root,'integration-evidence/media-revalidation.json'),JSON.stringify(report,null,2));console.log(JSON.stringify(report,null,2));}
